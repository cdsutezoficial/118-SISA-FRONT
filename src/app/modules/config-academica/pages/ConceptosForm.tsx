import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Loader2, Plus, Search, Trash2, X, Check, ChevronDown, Pencil, Info } from 'lucide-react'
import { FieldLabel, FieldHelp, FieldError, Switch, ModeSwitcher, DatePicker } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, Button, TextField, SelectField, MiniTable } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import RichTextEditor from '@app/core/components/RichTextEditor'
import { sanitizeHtml } from '@app/core/components/richText'
import { useNavigate } from 'react-router'
import { useFormMode, useOpenDirection } from '@app/core/infra/hooks'
import { apiGet, apiPost, apiPut } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────
// `PaymentConcept` (academic_config bounded context). El formulario sigue el
// spec del usuario: Datos Generales (Nombre, Tipo, Área, Descripción,
// Políticas) + Tarifas (alcance + monto por nivel/carrera) + Configuración del
// Concepto (switches) + Límites.
//
// El campo "Costo del concepto" ya NO se captura aquí: el precio vive en
// `PaymentRate` y la tarifa de alcance `GENERAL` se refleja además en
// `PaymentConcept.cost` (fallback para todo lo que aún lea esa columna).

type PaymentConceptType = 'ADMISSION' | 'ENROLLMENT' | 'REINSCRIPTION' | 'EXTRAORDINARY' | 'DOCUMENT' | 'OTHER'
type PaymentConceptStatus = 'ACTIVE' | 'INACTIVE'

// `AcademicLevel` — shared-kernel enum, mismo set de labels que
// `CarrerasForm.tsx` (usado por el selector de nivel en Tarifas y por la
// tabla de historial).
type AcademicLevel = 'TSU' | 'CONTINUIDAD' | 'INGENIERIA' | 'LICENCIATURA' | 'POSGRADO'

const LEVEL_LABELS: Record<AcademicLevel, string> = {
  TSU: 'TSU (Técnico Superior Universitario)',
  CONTINUIDAD: 'Continuidad de estudios (Ing/Lic)',
  INGENIERIA: 'Ingeniería',
  LICENCIATURA: 'Licenciatura',
  POSGRADO: 'Posgrado',
}

const TYPE_LABELS: Record<PaymentConceptType, string> = {
  ADMISSION: 'Admisión',
  ENROLLMENT: 'Inscripción',
  REINSCRIPTION: 'Reinscripción',
  EXTRAORDINARY: 'Extraordinario',
  DOCUMENT: 'Documento',
  OTHER: 'Otro',
}

// ─── Tarifas (alcance + monto) ────────────────────────────────────────────────
// El ALCANCE es de la sección, no de la fila: se elige una vez y todas las
// tarifas lo comparten. Por eso `TarifaScope` no vive en `TarifaDraft` sino en
// el estado del formulario — dos tarifas con alcances distintos generarían
// combinaciones que el usuario nunca quiso capturar (un monto "para nivel" y
// otro "para una carrera" en el mismo concepto) y la validación de destinos
// duplicados tendría que compararlos entre alcances que no se pueden comparar.
//
// Una `TarifaDraft` es una fila del editor. NO es una fila de `payment_rate`:
// el backend guarda UNA fila por combinación exacta (concepto + programId +
// level), así que el frontend expande cada draft al enviar (ver
// `expandTarifas()`). En alcance GENERAL no liga ni nivel ni carrera
// (programId = null, level = null); en LEVEL liga un nivel; en PROGRAMS liga
// varias carreras (una fila resultante por carrera).
type TarifaScope = 'GENERAL' | 'LEVEL' | 'PROGRAMS'

const SCOPES: TarifaScope[] = ['GENERAL', 'LEVEL', 'PROGRAMS']

const SCOPE_LABELS: Record<TarifaScope, string> = {
  GENERAL: 'General',
  LEVEL: 'Por nivel',
  PROGRAMS: 'Por carreras',
}

const SCOPE_DESCRIPTIONS: Record<TarifaScope, string> = {
  GENERAL: 'Un solo monto para todos los niveles y carreras.',
  LEVEL: 'Un monto por nivel académico, aplicable a cualquier carrera.',
  PROGRAMS: 'Un monto por grupo de carreras específicas.',
}

interface TarifaDraft {
  /** Id local estable para React y para el mapa de errores por fila. */
  key: string
  /** Solo se usa en alcance LEVEL. */
  level: AcademicLevel | ''
  /** Solo se usa en alcance PROGRAMS. */
  programIds: string[]
  /** String para el `TextField` numérico, igual que el resto del form. */
  amount: string
}

/**
 * Identidad de una combinación destino de `payment_rate`: (programa, nivel).
 * El backend no lleva un id de combo, pero `SetPaymentRateUseCaseImpl` cierra
 * la tarifa vigente que comparta esta tupla, así que es la clave con la que el
 * front tiene que razonar para saber si una fila agrega precio o lo cambia.
 */
function comboKey(programId: string | null | undefined, level: string | null | undefined): string {
  return `${programId ?? ''}|${level ?? ''}`
}

/** Campos editables de una tarifa — para ubicar el error en su control. */
type TarifaField = 'amount' | 'level' | 'programIds'

/**
 * Alcance ya decidido por las tarifas guardadas de un concepto, deducido de su
 * forma en lugar de haberlo guardado aparte: `payment_rate` no tiene columna de
 * alcance, solo la tupla destino (`program_id`, `level`).
 *
 * Devuelve `null` cuando no se puede deducir — sin tarifas, o con tarifas de
 * destinos mezclados. En ese caso el editor tiene que preguntar el alcance, que
 * es exactamente lo que hace el registro. El destino decide y no el periodo:
 * una tarifa por periodo sigue siendo general, por nivel o por carrera según
 * su `program_id`/`level`.
 */
function inferScopeFromRates(items: PaymentRateItem[]): TarifaScope | null {
  if (items.length === 0) return null
  // Por truthiness y no por `!== null`: el destino ausente llega como `null`
  // pero una clave omitida llegaría como `undefined`, y comparar contra `null`
  // la tomaría por una tarifa de carrera.
  const counts = {
    PROGRAMS: items.filter(r => !!r.programId).length,
    LEVEL: items.filter(r => !r.programId && !!r.level).length,
    GENERAL: items.filter(r => !r.programId && !r.level).length,
  }
  const match = (['GENERAL', 'LEVEL', 'PROGRAMS'] as TarifaScope[]).filter(
    scope => counts[scope] === items.length
  )
  return match.length === 1 ? match[0] : null
}

// Fila de `payment_rate` tal y como la acepta
// `POST /payment-concepts/{conceptId}/rates` (ver `CreatePaymentRateRequest`).
// `periodId` nunca se manda desde aquí: el registro no captura periodo.
// `validFrom` tampoco se captura — la tarifa no tiene vigencia propia, se
// deriva de la ventana del concepto (ver `rateValidFrom()`).
// Los `undefined` desaparecen en `JSON.stringify` y el backend los recibe
// como `null` real.
interface PaymentRatePayload {
  programId?: string
  level?: AcademicLevel
  amount: number
  validFrom: string
}

let tarifaSeq = 0
function newTarifaDraft(): TarifaDraft {
  tarifaSeq += 1
  return { key: `tarifa-${tarifaSeq}`, level: '', programIds: [], amount: '' }
}

// `PaymentArea` — catálogo independiente (módulo de Áreas). El dropdown muestra
// "clave — nombre".
interface PaymentAreaSummary {
  id: string
  code: string
  name: string
}

interface PaymentAreasPageResponse {
  items: PaymentAreaSummary[]
}

// `PaymentConcept` — para el multi-select de conceptos vinculados.
interface ConceptSummary {
  id: string
  name: string
}

interface ConceptsPageResponse {
  items: ConceptSummary[]
}

interface ProgramSummary {
  id: string
  name: string
  code: string
}

interface ProgramsPageResponse {
  items: ProgramSummary[]
}

interface PeriodSummary {
  id: string
  name: string
}

interface PeriodsPageResponse {
  items: PeriodSummary[]
}

// `PaymentRate` — append-only history (sección Tarifas, view/edit).
interface PaymentRateItem {
  id: string
  conceptId: string
  programId: string | null
  level: AcademicLevel | null
  amount: number
  periodId: string | null
  validFrom: string
  validTo: string | null
}

interface PaymentRateListResponse {
  items: PaymentRateItem[]
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = y && m && d ? new Date(y, m - 1, d) : new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
// La API trabaja con ISO (YYYY-MM-DD); el DatePicker muestra dd/mm/yyyy.
function isoToDisplay(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : ''
}

function displayToIso(display: string): string {
  if (!display) return ''
  const [d, m, y] = display.split('/')
  return y && m && d ? `${y}-${m}-${d}` : ''
}

/**
 * Hoy en ISO local (`YYYY-MM-DD`).
 *
 * <p>Se construye con `new Date(y, m, d)` a partir de las partes locales en
 * lugar de `toISOString()`, que convierte a UTC: cerca de medianoche en
 * México (−06:00) `toISOString()` devuelve el día siguiente y la fecha mandada
 * al backend sería incorrecta.
 */
function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// `PaymentConceptResponse` / `PaymentConceptFormPayload` — espejo exacto de los
// DTOs del backend, incluidos los campos de la extensión 2026-09-19.
interface PaymentConceptResponse {
  id: string
  name: string
  description: string | null
  policies: string | null
  type: PaymentConceptType
  isTuition: boolean
  isStandalone: boolean
  maxPerStudent: number | null
  maxPerPeriod: number | null
  requiresValidation: boolean
  availableFrom: string | null
  availableUntil: string | null
  status: PaymentConceptStatus
  areaId: string | null
  cost: number | null
  isExternal: boolean
  costExternal: number | null
  isAccumulable: boolean
  isMulticoncept: boolean
  quotaLimit: number | null
  linkedConceptIds: string[]
}

interface PaymentConceptFormPayload {
  name: string
  description: string | null
  policies: string | null
  type: PaymentConceptType
  isTuition: boolean
  isStandalone: boolean
  maxPerStudent: number | null
  maxPerPeriod: number | null
  requiresValidation: boolean
  availableFrom: string | null
  availableUntil: string | null
  areaId: string | null
  cost: number | null
  isExternal: boolean
  costExternal: number | null
  isAccumulable: boolean
  isMulticoncept: boolean
  quotaLimit: number | null
  linkedConceptIds: string[]
}

interface FormErrors {
  nombre?: string
  areaId?: string
  costoExterno?: string
  limiteCuotas?: string
  vigencia?: string
  /** Alcance de las tarifas sin elegir. */
  alcance?: string
  /** Lista de tarifas vacía. */
  tarifas?: string
  /** Error por fila del editor, indexado por `TarifaDraft.key`, con el campo
   *  al que pertenece para pintarlo junto al control que lo produjo. */
  tarifasByKey?: Record<string, { field: TarifaField; message: string }>
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-2 border-b border-[#E5E7EB] pb-2">
      <h3 className="text-sm font-semibold text-[#333333]">{children}</h3>
      {hint && <span className="text-xs text-[#9CA3AF]">{hint}</span>}
    </div>
  )
}

function SwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled,
  children,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  children?: ReactNode
}) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="block text-sm font-medium text-[#333333]">{label}</span>
          {description && <p className="mt-0.5 text-[11px] leading-snug text-[#6B7280]">{description}</p>}
        </div>
        <Switch checked={checked} onChange={onChange} disabled={disabled} />
      </div>
      {checked && children && (
        <div className="mt-3 border-t border-[#F3F4F6] pt-3">{children}</div>
      )}
    </div>
  )
}

// Multi-select con popover, búsqueda y chips.
function MultiSelectField({
  label,
  options,
  selected,
  onChange,
  placeholder,
  disabled,
  error,
  help,
}: {
  label: string
  options: { id: string; label: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  disabled?: boolean
  error?: string
  help?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const { openUp, measureAndSet } = useOpenDirection(ref)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selectedOptions = options.filter((o) => selected.includes(o.id))
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  return (
    <div ref={ref} className="relative">
      <FieldLabel>{label}</FieldLabel>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (disabled) return; if (!open) measureAndSet(); setOpen((v) => !v) }}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm transition ${
          disabled ? 'cursor-not-allowed bg-[#F3F4F6] text-[#9CA3AF]' : 'text-[#333333] hover:border-[#009574]'
        } ${error ? 'border-red-400' : 'border-[#E5E7EB]'}`}
      >
        <span className={selectedOptions.length ? 'text-[#333333]' : 'text-[#9CA3AF]'}>
          {selectedOptions.length ? `${selectedOptions.length} seleccionado(s)` : placeholder ?? 'Seleccionar...'}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
      </button>

      {selectedOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedOptions.map((o) => (
            <span
              key={o.id}
              className="inline-flex items-center gap-1 rounded-full bg-[#e6f5f1] px-2 py-0.5 text-xs text-[#007a5e]"
            >
              {o.label}
              {!disabled && (
                <button type="button" onClick={() => toggle(o.id)} className="hover:text-[#009574]">
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {open && !disabled && (
        <div className={`absolute z-30 w-full ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'} rounded-lg border border-[#E5E7EB] bg-white shadow-lg`}>
          <div className="flex items-center gap-2 border-b border-[#F3F4F6] px-3 py-2">
            <Search className="h-4 w-4 text-[#9CA3AF]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-[#9CA3AF]"
            />
          </div>
          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-[#9CA3AF]">Sin resultados</p>
            ) : (
              filtered.map((o) => {
                const active = selected.includes(o.id)
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(o.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm text-[#333333] hover:bg-[#F8F9FA]"
                  >
                    <span>{o.label}</span>
                    {active && <Check className="h-4 w-4 text-[#009574]" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}

      {error ? <FieldError>{error}</FieldError> : help ? <FieldHelp>{help}</FieldHelp> : null}
    </div>
  )
}

// Selector de alcance de la sección. Son tres opciones excluyentes y todas
// tienen el peso de una decisión ("un monto para todo" vs "uno por nivel" vs
// "uno por carreras"), así que van como tarjetas y no como dropdown: un select
// obligaría a abrirlo para leer qué hace cada una.
function ScopePicker({
  value,
  onChange,
  disabled,
  error,
}: {
  value: TarifaScope | ''
  onChange: (scope: TarifaScope) => void
  disabled?: boolean
  error?: string
}) {
  return (
    <div>
      <FieldLabel required>Alcance de las tarifas</FieldLabel>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {SCOPES.map(scope => {
          const active = value === scope
          return (
            <button
              key={scope}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onChange(scope)}
              className={`rounded-lg border px-3 py-2.5 text-left transition ${
                disabled
                  ? 'cursor-not-allowed bg-[#F8F9FA] text-[#9CA3AF]'
                  : active
                    ? 'border-[#009574] bg-[#e6f5f1] ring-1 ring-[#009574]'
                    : 'border-[#E5E7EB] bg-white hover:border-[#009574]'
              }`}
            >
              <span className={`block text-[13px] font-semibold ${active && !disabled ? 'text-[#007a5e]' : 'text-[#333333]'}`}>
                {SCOPE_LABELS[scope]}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-[#6B7280]">
                {SCOPE_DESCRIPTIONS[scope]}
              </span>
            </button>
          )
        })}
      </div>
      {error && <div className="mt-1.5"><FieldError>{error}</FieldError></div>}
    </div>
  )
}

// Una fila del editor de Tarifas. El alcance es el de la sección, así que solo
// muestra el destino que corresponde: General no muestra nada (programId y
// level quedan null), Por nivel el select de nivel, Por carreras el multiselect
// con buscador.
function TarifaRow({
  index,
  scope,
  canRemove,
  draft,
  nivelOptions,
  carreraOptions,
  error,
  onChange,
  onRemove,
}: {
  index: number
  scope: TarifaScope
  canRemove: boolean
  draft: TarifaDraft
  /** Niveles todavía libres: los que ya tomó otra fila se retiran de la lista. */
  nivelOptions: AcademicLevel[]
  /** Carreras todavía libres, con la selección propia de la fila incluida. */
  carreraOptions: { id: string; label: string }[]
  error?: { field: TarifaField; message: string }
  onChange: (patch: Partial<TarifaDraft>) => void
  onRemove: () => void
}) {
  const errFor = (field: TarifaField) => (error?.field === field ? error.message : undefined)

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">
          Tarifa {index + 1}
        </span>
        {canRemove && (
          <Button variant="danger" size="sm" onClick={onRemove}>
            <Trash2 size={13} />Quitar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {scope === 'LEVEL' && (
          <SelectField
            label="Nivel"
            required
            value={draft.level}
            onChange={v => onChange({ level: v as AcademicLevel | '' })}
            error={errFor('level')}
            options={nivelOptions.map(l => ({ value: l, label: LEVEL_LABELS[l] }))}
            placeholder={
              nivelOptions.length === 0 ? 'No hay niveles disponibles' : 'Seleccionar nivel…'
            }
            className="col-span-12"
          />
        )}
        {scope === 'PROGRAMS' && (
          <div className="col-span-12">
            <MultiSelectField
              label="Carreras"
              options={carreraOptions}
              selected={draft.programIds}
              onChange={ids => onChange({ programIds: ids })}
              error={errFor('programIds')}
              placeholder="Seleccionar carreras…"
            />
          </div>
        )}
        <TextField
          label="Monto"
          required
          value={draft.amount}
          onChange={v => onChange({ amount: v })}
          error={errFor('amount')}
          type="number"
          min={0}
          step="0.01"
          numeric
          prefix="$"
          placeholder="0.00"
          className="col-span-12"
        />
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ConceptosForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isView = mode === 'view'
  const isRegister = mode === 'register'

  // ─── Datos Generales ───────────────────────────────────────────────────────
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<PaymentConceptType | ''>('')
  const [areaId, setAreaId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [politicas, setPoliticas] = useState('')

  // Costo que ya tiene el concepto guardado. En Registrar se deriva de la
  // tarifa GENERAL; en Ver/Editar no hay drafts que editar (el historial de
  // tarifas es append-only), así que el valor cargado se reenvía tal cual:
  // mandarlo en `null` borraría el precio de todo lo que aún lee
  // `PaymentConcept.cost`.
  const [conceptCost, setConceptCost] = useState<number | null>(null)

  // ─── Tarifas ──────────────────────────────────────────────────────────────
  // En Registrar el editor es la única forma de capturar el precio. En Editar
  // el bloque es el historial de `GET /payment-concepts/{id}/rates` (append-only,
  // no se borra ni se sobrescribe) MÁS el mismo editor, que se abre a demanda
  // para repricing: capturar una tarifa nueva para una combinación que ya
  // tiene precio hace que `SetPaymentRateUseCase` cierre la anterior en vez de
  // dejarla vigente. En Ver no hay editor — el historial es de solo lectura.
  //
  // `tarifaScope` es el paso 1 y es de la sección: todas las filas lo
  // comparten. `tarifas` (el paso 2) arranca vacío hasta que hay alcance.
  const [tarifaScope, setTarifaScope] = useState<TarifaScope | ''>('')
  const [tarifas, setTarifas] = useState<TarifaDraft[]>([])
  // En Editar el editor arranca colapsado detrás de un botón, para no insinuar
  // que las tarifas guardadas se van a reescribir al guardar el concepto.
  const [rateEditorOpen, setRateEditorOpen] = useState(false)
  // Concepto ya creado durante un submit fallido a medias: permite reintentar
  // SOLO las tarifas faltantes sin duplicar el concepto. `pendingRates` guarda
  // el lote exacto que quedó en el aire, para que el reintento no vuelva a
  // expandir los drafts (que ya could've cambiado) ni a duplicar filas.
  const [createdConceptId, setCreatedConceptId] = useState<string | null>(null)
  const [pendingRates, setPendingRates] = useState<PaymentRatePayload[]>([])
  const [ratesProgress, setRatesProgress] = useState<{ done: number; total: number } | null>(null)

  // ─── Configuración del Concepto ───────────────────────────────────────────
  const [esExterno, setEsExterno] = useState(false)
  const [costoExterno, setCostoExterno] = useState('')
  const [esAcumulable, setEsAcumulable] = useState(false)
  const [esMulticoncepto, setEsMulticoncepto] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [esVinculados, setEsVinculados] = useState(false)
  const [vinculados, setVinculados] = useState<string[]>([])
  const [esCuotaCuatrimestral, setEsCuotaCuatrimestral] = useState(false)
  const [limiteCuotasOn, setLimiteCuotasOn] = useState(false)
  const [limiteCuotas, setLimiteCuotas] = useState('')
  const [maxPerStudent, setMaxPerStudent] = useState('')
  const [maxPerPeriod, setMaxPerPeriod] = useState('')
  const [requiereValidacion, setRequiereValidacion] = useState(false)
  const [tieneVigencia, setTieneVigencia] = useState(false)
  const [availableFrom, setAvailableFrom] = useState('')
  const [availableUntil, setAvailableUntil] = useState('')

  // ─── Catálogos para los selectores ────────────────────────────────────────
  const [areas, setAreas] = useState<PaymentAreaSummary[]>([])
  const [concepts, setConcepts] = useState<ConceptSummary[]>([])
  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [periods, setPeriods] = useState<PeriodSummary[]>([])

  // ─── Tarifas (view/edit) ──────────────────────────────────────────────────
  const [rates, setRates] = useState<PaymentRateItem[]>([])
  const [ratesLoadStatus, setRatesLoadStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  // ─── Estados de carga/envío ───────────────────────────────────────────────
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(isRegister ? 'idle' : 'loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})

  const disabled = isView || loadStatus === 'loading'
  const isSubmitting = submitStatus === 'submitting'

  function clearErr(field: keyof FormErrors) {
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  // ─── Tarifas: edición del editor ──────────────────────────────────────────

  function updateTarifa(key: string, patch: Partial<TarifaDraft>) {
    setTarifas(prev => prev.map(t => (t.key === key ? { ...t, ...patch } : t)))
  }

  function removeTarifa(key: string) {
    setTarifas(prev => prev.filter(t => t.key !== key))
    setErrors(prev => {
      if (!prev.tarifasByKey?.[key]) return prev
      const next = { ...prev.tarifasByKey }
      delete next[key]
      return { ...prev, tarifasByKey: next }
    })
  }

  function addTarifa() {
    setTarifas(prev => [...prev, newTarifaDraft()])
    setErrors(prev => ({ ...prev, tarifas: undefined }))
  }

  /**
   * Paso 1 del editor: fija el alcance de TODAS las tarifas.
   *
   * Al cambiar de alcance el destino de cada fila deja de tener sentido — un
   * nivel no significa nada en un alcance de carreras y viceversa — así que se
   * limpia. El monto sí se conserva: es lo caro de volver a capturarlo y
   * sobrevive el cambio en ambos sentidos.
   *
   * La excepción es GENERAL, que por definición es un único monto sin destino:
   * ahí la lista se colapsa a una fila. Si el usuario venía de varios destinos
   * y elige General, se queda el primer monto capturado y el resto se descarta,
   * porque varias filas generales generarían combinaciones idénticas
   * (programId = null, level = null) que el backend cerraría como solapadas.
   */
  function selectScope(scope: TarifaScope) {
    if (scope === tarifaScope) return
    setTarifaScope(scope)
    setTarifas(prev => {
      if (prev.length === 0) return [newTarifaDraft()]
      if (scope === 'GENERAL') return [{ ...newTarifaDraft(), amount: prev[0].amount }]
      return prev.map(t => ({ ...t, level: '' as AcademicLevel | '', programIds: [] as string[] }))
    })
    // Los errores de fila son del alcance anterior: se descartan enteros, no
    // se reasignan (el destino puede no existir ya en la fila que falló).
    setErrors(prev => ({ ...prev, alcance: undefined, tarifas: undefined, tarifasByKey: undefined }))
  }

  /** Limpia el error de una fila concreta al tocar cualquiera de sus campos. */
  function clearTarifaErr(key: string) {
    setErrors(prev => {
      if (!prev.tarifasByKey?.[key]) return prev
      const next = { ...prev.tarifasByKey }
      delete next[key]
      return { ...prev, tarifasByKey: next }
    })
  }

  /**
   * Niveles que ya tienen dueño en OTRA fila.
   *
   * Un nivel repetido produce dos filas de `payment_rate` para la misma
   * combinación (concepto + programId + level) y `SetPaymentRateUseCase`
   * cierra la anterior con `validTo = validFrom - 1`: un rango vacío, es decir
   * una tarifa muerta que el usuario cree vigente. Es un fallo silencioso —
   * el guardado responde 201 — así que el editor lo evita en lugar de dejar que
   * `validate()` lo descubra al pulsar Registrar. La fila se excluye a sí
   * misma para que su propia selección siga disponible.
   */
  function takenLevelsBy(key: string): Set<AcademicLevel> {
    return new Set(
      tarifas.filter(t => t.key !== key && t.level).map(t => t.level as AcademicLevel)
    )
  }

  /** Carreras ya tomadas por otra fila. Misma razón que `takenLevelsBy()`. */
  function takenProgramsBy(key: string): Set<string> {
    return new Set(tarifas.filter(t => t.key !== key).flatMap(t => t.programIds))
  }

  /**
   * Combos (programa, nivel) que ya tienen una tarifa VIGENTE en el historial.
   *
   * Solo cuentan las que no tienen `validTo`: una tarifa ya cerrada es
   * historial, no un destino que una fila nueva vaya a pisar. En Registrar el
   * historial está vacío y el set sale vacío, así que el mismo aviso sirve para
   * los tres modos.
   */
  function activeCombos(): Set<string> {
    return new Set(rates.filter(r => !r.validTo).map(r => comboKey(r.programId, r.level)))
  }

  /**
   * Abre el editor en modo repricing sobre una tarifa del historial.
   *
   * `PaymentRate` es append-only: no hay PUT ni DELETE, así que "editar el
   * monto" no es una operación de guardado, es capturar una tarifa nueva para
   * el mismo combo. El POST resultante hace que `SetPaymentRateUseCase` cierre
   * la anterior con `validTo = validFrom - 1` y abra la nueva. Si el usuario
   * abandona el editor, el historial queda igual que estaba.
   */
  function startRepricing(rate: PaymentRateItem) {
    const draft = newTarifaDraft()
    draft.amount = String(rate.amount)
    if (rate.programId) {
      draft.programIds = [rate.programId]
      setTarifaScope('PROGRAMS')
    } else if (rate.level) {
      draft.level = rate.level
      setTarifaScope('LEVEL')
    } else {
      setTarifaScope('GENERAL')
    }
    setTarifas([draft])
    setErrors(prev => ({ ...prev, alcance: undefined, tarifas: undefined, tarifasByKey: undefined }))
    setRateEditorOpen(true)
  }

  /**
   * Abre el editor para capturar una tarifa que no existía.
   *
   * Si el concepto ya tiene tarifas, su alcance NO se vuelve a preguntar: se
   * deduce de las guardadas y el `ScopePicker` queda bloqueado (ver
   * `lockedScope`). Preguntarlo de nuevo era lo que en la pantalla anterior
   * hacía dudar de un alcance que en realidad ya estaba decidido, y cambiarlo
   * habría borrado los destinos de las filas.
   */
  function openRateEditor() {
    setRateEditorOpen(true)
    const deduced = inferScopeFromRates(rates)
    if (deduced) {
      setTarifaScope(deduced)
      setTarifas([newTarifaDraft()])
    } else if (tarifaScope === '' && tarifas.length === 0) {
      setTarifas([newTarifaDraft()])
    }
  }

  /** Cierra el editor y tira los drafts: el historial no se toca. */
  function closeRateEditor() {
    setRateEditorOpen(false)
    setTarifas([])
    setTarifaScope('')
    setPendingRates([])
    setErrors(prev => ({ ...prev, alcance: undefined, tarifas: undefined, tarifasByKey: undefined }))
  }

  /**
   * Si guardar esta fila cambiaría el precio de algo que ya está en el
   * historial, en vez de agregar una tarifa nueva.
   *
   * Se calcula desde el destino ACTUAL de la fila y no desde el combo con el
   * que se abrió, porque el usuario puede mover el nivel o las carreras
   * después de venir del historial. En alcance PROGRAMS una fila se expande a
   * una tarifa por carrera, así que basta con que una sola coincida.
   */
  function wouldReprice(t: TarifaDraft): boolean {
    const active = activeCombos()
    if (tarifaScope === 'LEVEL') return Boolean(t.level) && active.has(comboKey(null, t.level))
    if (tarifaScope === 'PROGRAMS') {
      return t.programIds.some(pid => active.has(comboKey(pid, null)))
    }
    return active.has(comboKey(null, null))
  }

  /**
   * Monto del concepto cuando el alcance es GENERAL: ese monto no liga a
   * nivel ni a carrera, así que es exactamente `PaymentConcept.cost`. Con
   * alcance LEVEL o PROGRAMS el precio depende del destino y no hay un costo
   * único que defender — se deja en `null`.
   *
   * En Ver/Editar esto no aplica: no hay drafts (el historial de tarifas es
   * append-only) y el costo se reenvía tal cual lo_trajo `data.cost`.
   */
  function generalAmount(): number | null {
    if (tarifaScope !== 'GENERAL') return null
    const t = tarifas[0]
    return t && t.amount.trim() !== '' ? Number(t.amount) : null
  }

  /**
   * Las tarifas no tienen vigencia propia: se rigen por la ventana del
   * concepto, así que `validFrom` se deriva de ella. Sin "¿Tiene vigencia?" la
   * tarifa aplica desde hoy, que es lo único que `CreatePaymentRateRequest`
   * admite (el campo es `@NotNull`) sin inventar una fecha que nadie eligió.
   */
  function rateValidFrom(): string {
    if (tieneVigencia && availableFrom) return availableFrom
    return todayIso()
  }

  /**
   * Aplana los drafts del editor a filas de `payment_rate`: una fila por
   * combinación exacta (concepto, programId, level) que el backend entiende.
   * Todas las filas usan el alcance de la sección, así que aquí no hay decisión
   * por fila. `undefined` en `programId`/`level` es la combinación "no liga a
   * ninguno" y desaparece del JSON al enviarse.
   */
  function expandTarifas(): PaymentRatePayload[] {
    const validFrom = rateValidFrom()
    return tarifas.flatMap(t => {
      const amount = Number(t.amount)
      if (tarifaScope === 'LEVEL') return [{ level: t.level as AcademicLevel, amount, validFrom }]
      if (tarifaScope === 'PROGRAMS') return t.programIds.map(pid => ({ programId: pid, amount, validFrom }))
      return [{ amount, validFrom }]
    })
  }

  // Resetea el formulario al cambiar de modo/registro (mismo patrón que el
  // resto de forms CRUD del proyecto).
  useEffect(() => {
    setSubmitStatus('idle')
    setSubmitErrorMsg('')
    setErrors({})
    setNombre('')
    setTipo('')
    setAreaId('')
    setDescripcion('')
    setPoliticas('')
    setTarifaScope('')
    setTarifas([])
    setCreatedConceptId(null)
    setPendingRates([])
    setRatesProgress(null)
    setConceptCost(null)
    setEsExterno(false)
    setCostoExterno('')
    setEsAcumulable(false)
    setEsMulticoncepto(false)
    setIsStandalone(false)
    setEsVinculados(false)
    setVinculados([])
    setEsCuotaCuatrimestral(false)
    setLimiteCuotasOn(false)
    setLimiteCuotas('')
    setMaxPerStudent('')
    setMaxPerPeriod('')
    setRequiereValidacion(false)
    setTieneVigencia(false)
    setAvailableFrom('')
    setAvailableUntil('')
    setRates([])
    if (isRegister) {
      setLoadStatus('idle')
      setLoadErrorMsg('')
    }
  }, [mode, id, isRegister])

  // Catálogos base: áreas (dropdown), conceptos (vinculados), programas
  // (carreras / tarifas). No críticos — si fallan, el selector queda vacío.
  useEffect(() => {
    apiGet<PaymentAreasPageResponse>('/payment-areas', { status: 'ACTIVE', size: 100 })
      .then(data => setAreas(data.items))
      .catch(() => {/* no crítico */})
    apiGet<ConceptsPageResponse>('/payment-concepts', { status: 'ACTIVE', size: 100 })
      .then(data => setConcepts(data.items))
      .catch(() => {/* no crítico */})
    apiGet<ProgramsPageResponse>('/programs', { size: 100 })
      .then(data => setPrograms(data.items))
      .catch(() => {/* no crítico */})
  }, [])

  // Periodos — solo se usan para etiquetar las tarifas (view/edit).
  useEffect(() => {
    if (isRegister) return
    apiGet<PeriodsPageResponse>('/periods', { size: 100 })
      .then(data => setPeriods(data.items))
      .catch(() => {/* no crítico — periodLabel() cae a '—' */})
  }, [isRegister])

  // Tarifas: historial append-only, solo lectura, nunca en Registrar.
  useEffect(() => {
    if (isRegister || !id) return
    let cancelled = false
    setRatesLoadStatus('loading')
    apiGet<PaymentRateListResponse>(`/payment-concepts/${id}/rates`)
      .then(data => {
        if (cancelled) return
        setRates(data.items)
        setRatesLoadStatus('idle')
      })
      .catch(() => { if (!cancelled) setRatesLoadStatus('error') })
    return () => { cancelled = true }
  }, [id, isRegister])

  function programLabel(programId: string | null): string {
    if (!programId) return 'Todas las carreras'
    const p = programs.find(p => p.id === programId)
    return p ? `${p.code} — ${p.name}` : '—'
  }

  function levelLabel(level: AcademicLevel | null): string {
    if (!level) return 'Todos los niveles'
    return LEVEL_LABELS[level]
  }

  function periodLabel(periodId: string | null): string {
    if (!periodId) return 'General — sin periodo'
    const per = periods.find(per => per.id === periodId)
    return per ? per.name : '—'
  }

  // Carga del concepto en view/edit.
  useEffect(() => {
    if (isRegister || !id) return
    let cancelled = false
    setLoadStatus('loading')
    setLoadErrorMsg('')
    apiGet<PaymentConceptResponse>(`/payment-concepts/${id}`)
      .then(data => {
        if (cancelled) return
        setNombre(data.name)
        setTipo(data.type)
        setDescripcion(data.description ?? '')
        setPoliticas(data.policies ?? '')
        setConceptCost(data.cost)
        setEsCuotaCuatrimestral(data.isTuition)
        setIsStandalone(data.isStandalone)
        setRequiereValidacion(data.requiresValidation)
        setMaxPerStudent(data.maxPerStudent != null ? String(data.maxPerStudent) : '')
        setMaxPerPeriod(data.maxPerPeriod != null ? String(data.maxPerPeriod) : '')
        setTieneVigencia(!!(data.availableFrom || data.availableUntil))
        setAvailableFrom(data.availableFrom ?? '')
        setAvailableUntil(data.availableUntil ?? '')
        setAreaId(data.areaId ?? '')
        setEsExterno(data.isExternal)
        setCostoExterno(data.costExternal != null ? String(data.costExternal) : '')
        setEsAcumulable(data.isAccumulable)
        setEsMulticoncepto(data.isMulticoncept)
        setLimiteCuotasOn(data.quotaLimit != null)
        setLimiteCuotas(data.quotaLimit != null ? String(data.quotaLimit) : '')
        const linked = data.linkedConceptIds ?? []
        setEsVinculados(linked.length > 0)
        setVinculados(linked)
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 404) {
          setLoadErrorMsg('No se encontró el concepto de pago solicitado.')
        } else if (apiErr.status === 401) {
          setLoadErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        } else if (apiErr.status === 403) {
          setLoadErrorMsg('No tienes permiso para consultar este concepto de pago.')
        } else {
          setLoadErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode])

  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!nombre.trim()) e.nombre = 'El nombre es obligatorio.'
    if (!areaId) e.areaId = 'Selecciona un área.'

    // ── Tarifas ──
    // El alcance se valida primero y por separado: sin él no hay nada que
    // revisar en las filas, y el mensaje "agrega una tarifa" sería engañoso
    // (la fila no puede existir todavía). Las reglas de "una sola tarifa
    // general" y de destinos duplicados ya no viven aquí — el alcance único
    // hace imposible la primera, y el destino es ahora el mismo tipo en todas
    // las filas, lo que hace la segunda verificable fila a fila.
    //
    // En Registrar las tarifas son obligatorias: un concepto sin precio no
    // sirve para cotizar nada. En Editar son OPCIONALES — editar el nombre de
    // un concepto no debe exigir meterse a tocar precios — así que la sección
    // solo se valida si el usuario la abrió. `tarifaScope !== ''` es
    // precisamente eso: el editor está colapsado hasta que se elige alcance.
    if (isRegister || tarifaScope !== '') {
      if (!tarifaScope) {
        e.alcance = 'Selecciona el alcance de las tarifas.'
      } else if (tarifas.length === 0) {
        e.tarifas = isRegister
          ? 'Agrega al menos una tarifa para poder registrar el concepto.'
          : 'Agrega al menos una tarifa para poder guardar los cambios.'
      }

      const byKey: Record<string, { field: TarifaField; message: string }> = {}
      for (const t of tarifas) {
        const amount = Number(t.amount)
        if (!t.amount.trim() || Number.isNaN(amount) || amount <= 0) {
          byKey[t.key] = { field: 'amount', message: 'Ingresa un monto válido mayor a 0.' }
        } else if (tarifaScope === 'LEVEL' && !t.level) {
          byKey[t.key] = { field: 'level', message: 'Selecciona el nivel de esta tarifa.' }
        } else if (tarifaScope === 'PROGRAMS' && t.programIds.length === 0) {
          byKey[t.key] = { field: 'programIds', message: 'Selecciona al menos una carrera.' }
        }
      }

      // Red de seguridad, no camino normal: el editor ya retira de cada fila
      // los destinos que otra fila tomó (ver `takenLevelsBy`/`takenProgramsBy`),
      // así que aquí no se puede llegar por interacción normal. Se conserva
      // porque la consecuencia del fallo es silenciosa — `SetPaymentRateUseCase`
      // responde 201 y guarda la primera tarifa con `validTo = validFrom - 1`,
      // un rango vacío que el usuario cree vigente — y `validate()` no depende
      // de que el editor se haya comportado bien.
      const owner = new Map<string, number>()
      tarifas.forEach((t, i) => {
        if (tarifaScope === 'PROGRAMS') t.programIds.forEach(pid => { if (!owner.has(pid)) owner.set(pid, i) })
        if (tarifaScope === 'LEVEL' && t.level) { const k = `lvl:${t.level}`; if (!owner.has(k)) owner.set(k, i) }
      })
      tarifas.forEach((t, i) => {
        if (byKey[t.key]) return
        if (tarifaScope === 'PROGRAMS' && t.programIds.some(pid => owner.get(pid) !== i)) {
          byKey[t.key] = { field: 'programIds', message: 'Alguna de estas carreras ya está incluida en otra tarifa.' }
        } else if (tarifaScope === 'LEVEL' && t.level && owner.get(`lvl:${t.level}`) !== i) {
          byKey[t.key] = { field: 'level', message: 'Este nivel ya está incluido en otra tarifa.' }
        }
      })

      if (Object.keys(byKey).length > 0) e.tarifasByKey = byKey
    }

    if (esExterno) {
      if (!costoExterno.trim()) e.costoExterno = 'El costo externo es obligatorio.'
      else if (Number.isNaN(Number(costoExterno)) || Number(costoExterno) < 0) e.costoExterno = 'Ingresa un costo válido.'
    }
    if (limiteCuotasOn) {
      if (!limiteCuotas.trim()) e.limiteCuotas = 'Indica el límite de cuotas.'
      else if (!Number.isInteger(Number(limiteCuotas)) || Number(limiteCuotas) <= 0) e.limiteCuotas = 'Ingresa un número entero mayor a 0.'
    }
    if (tieneVigencia && availableFrom && availableUntil && availableFrom > availableUntil) {
      e.vigencia = 'La fecha "desde" no puede ser posterior a la fecha "hasta".'
    }
    return e
  }

  async function handleSubmit() {
    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors({})
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    setRatesProgress(null)

    // Mapeo completo al backend (extensión 2026-09-19): los switches que
    // agrupan un valor secundario (externo, límite de cuotas, vinculados) lo
    // mandan solo cuando están encendidos; apagados van a null / [].
    //
    // `cost` ya no se captura: se deriva de la tarifa de alcance GENERAL
    // (la única que aplica a todos los niveles y carreras). Con alcance
    // POR NIVEL o POR CARRERAS el precio depende del destino, así que no hay
    // un costo único que defender y queda null: el precio vive solo en
    // `payment_rate`.
    //
    // En Ver no hay drafts de tarifa (el historial es de solo lectura) y en
    // Editar solo los hay si el usuario abrió el editor, así que el costo se
    // reenvía tal como vino de la API en vez de degradar a null — un PUT con
    // `cost: null` borraría el precio de todo lo que aún lee
    // `PaymentConcept.cost`.
    //
    // La excepción en Editar es el alcance GENERAL: si el usuario capturó una
    // tarifa general nueva, ese monto ES el costo del concepto, y dejarlo con
    // el valor viejo dejaría el concepto y su historial de precios
    // discrepantes. Solo se sustituye si la fila trae monto: abrir el editor y
    // dejarlo a medias no debe borrar el precio.
    const generalCost = generalAmount()
    const cost = isRegister
      ? generalCost
      : generalCost !== null ? generalCost : conceptCost
    const payload: PaymentConceptFormPayload = {
      name: nombre.trim(),
      description: descripcion.trim() ? sanitizeHtml(descripcion) : null,
      policies: politicas.trim() ? sanitizeHtml(politicas) : null,
      type: (tipo || 'OTHER') as PaymentConceptType,
      isTuition: esCuotaCuatrimestral,
      isStandalone,
      maxPerStudent: maxPerStudent.trim() === '' ? null : Number(maxPerStudent),
      maxPerPeriod: maxPerPeriod.trim() === '' ? null : Number(maxPerPeriod),
      requiresValidation: requiereValidacion,
      availableFrom: tieneVigencia && availableFrom ? availableFrom : null,
      availableUntil: tieneVigencia && availableUntil ? availableUntil : null,
      areaId: areaId || null,
      cost,
      isExternal: esExterno,
      costExternal: esExterno && costoExterno.trim() !== '' ? Number(costoExterno) : null,
      isAccumulable: esAcumulable,
      isMulticoncept: esMulticoncepto,
      quotaLimit: limiteCuotasOn && limiteCuotas.trim() !== '' ? Number(limiteCuotas) : null,
      linkedConceptIds: esVinculados ? vinculados : [],
    }

    // `conceptId` se declara fuera del try a propósito: el `catch` lo necesita
    // para distinguir "el concepto ya existe, falló una tarifa" de "el concepto
    // ni se pudo crear". Leer `createdConceptId` del estado en el `catch`
    // serviría de nada en el primer intento, porque `setCreatedConceptId` todavía
    // no se ha aplicado cuando se lanza el error.
    let conceptId: string | null = createdConceptId
    // El lote en vuelo se fija al crear el concepto y solo se acorta con cada
    // tarifa confirmada. Un reintento reenvía exactamente lo que falta, con los
    // montos con los que se unsubió: volver a expandir los drafts podría
    // mandar montos ya corregidos para filas que sí se guardaron, y el backend
    // cerraría la fila vieja con un rango vacío.
    let batch: PaymentRatePayload[] = pendingRates

    try {
      if (isRegister) {
        // Las tarifas cuelgan de un concepto real, así que el registro es
        // secuencial: primero el concepto, después una fila de `payment_rate`
        // por cada combinación.
        if (!conceptId) {
          const created = await apiPost<PaymentConceptResponse>('/payment-concepts', payload)
          conceptId = created.id
          setCreatedConceptId(conceptId)
          batch = expandTarifas()
          setPendingRates(batch)
        }
        if (batch.length === 0) batch = expandTarifas()

        setRatesProgress({ done: 0, total: batch.length })
        for (let i = 0; i < batch.length; i++) {
          await apiPost(`/payment-concepts/${conceptId}/rates`, batch[i])
          setPendingRates(batch.slice(i + 1))
          setRatesProgress({ done: i + 1, total: batch.length })
        }

        navigate(`/conceptos/form?mode=view&id=${conceptId}`, { state: { toast: 'Concepto de pago registrado exitosamente.' } })
      } else if (id) {
        await apiPut<PaymentConceptResponse>(`/payment-concepts/${id}`, payload)

        // En Editar las tarifas son un bloque opcional encima de un concepto que
        // ya existe: el PUT va primero y las filas que el usuario capturó se
        // mandan después, con el mismo bucle secuencial y el mismo reintento
        // parcial que en Registrar. El lote se fija ANTES del PUT para que, si
        // una tarifa falla, el reintento reenvíe exactamente las que faltan en
        // vez de volver a expandir los drafts — que para entonces el usuario
        // pudo corregir, y mandar el monto viejo cerraría la fila previa con un
        // rango vacío.
        if (batch.length === 0) batch = expandTarifas()
        if (batch.length > 0) {
          setPendingRates(batch)
          conceptId = id
          setRatesProgress({ done: 0, total: batch.length })
          for (let i = 0; i < batch.length; i++) {
            await apiPost(`/payment-concepts/${id}/rates`, batch[i])
            setPendingRates(batch.slice(i + 1))
            setRatesProgress({ done: i + 1, total: batch.length })
          }
        }

        navigate(`/conceptos/form?mode=view&id=${id}`, { state: { toast: 'Concepto de pago actualizado exitosamente.' } })
      }
    } catch (err) {
      setSubmitStatus('error')
      setRatesProgress(null)
      const apiErr = err as Partial<ApiError>
      const baseMessage = apiErr.status === 400
        ? (apiErr.message ?? 'Revisa los datos capturados: hay un valor inválido.')
        : apiErr.status === 401
          ? 'Tu sesión expiró. Vuelve a iniciar sesión.'
          : apiErr.status === 403
            ? 'No tienes permiso para realizar esta acción.'
            : 'No se pudo conectar con el servidor. Intenta de nuevo más tarde.'
      if (isRegister && conceptId) {
        setSubmitErrorMsg(`El concepto se registró, pero falló el guardado de sus tarifas. ${baseMessage} Vuelve a guardar para reintentar solo las tarifas que faltan.`)
      } else if (!isRegister && conceptId && pendingRates.length > 0) {
        setSubmitErrorMsg(`El concepto se actualizó, pero falló el guardado de sus tarifas. ${baseMessage} Vuelve a guardar para reintentar solo las tarifas que faltan.`)
      } else {
        setSubmitErrorMsg(baseMessage)
      }
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const areaOptions = areas.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))
  const conceptOptions = concepts.filter(c => c.id !== id).map(c => ({ id: c.id, label: c.name }))
  const carreraOptions = programs.map(p => ({ id: p.id, label: `${p.code} — ${p.name}` }))

  // En Registrar el editor de tarifas es el cuerpo de la sección. En Editar
  // conviven las dos cosas: el historial siempre visible y el editor debajo,
  // colapsado hasta que se pide — así no se insinúa que guardar el concepto
  // reescribe las tarifas que ya están. En Ver no hay editor: el historial es
  // de solo lectura y no hay nada que capturar.
  const rateEditorVisible = isRegister || rateEditorOpen

  /**
   * Alcance ya fijado por el historial, que se muestra en vez del `ScopePicker`
   * cuando existe. Solo en Editar: en Registrar no hay historial y el alcance se
   * elige ahí; en Ver no hay editor.
   *
   * `null` cuando las tarifas guardadas son de destinos mezclados o no hay
   * ninguna: en ese caso no se puede deducir y el `ScopePicker` se muestra para
   * que la sección siga teniendo un alcance con el que trabajar.
   */
  const lockedScope = !isRegister ? inferScopeFromRates(rates) : null

  return (
    <FormPage>
      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Conceptos de Pago', to: '/conceptos' },
          { label: isRegister ? 'Registrar Concepto' : isView ? 'Ver Concepto' : 'Editar Concepto' },
        ]}
      />

      <FormHeader
        title={isRegister ? 'Registrar Concepto de Pago' : isView ? 'Ver Concepto de Pago' : 'Editar Concepto de Pago'}
        subtitle={
          isRegister ? 'Completa los campos para registrar un nuevo concepto de pago.' :
          isView ? 'Información del concepto de pago.' :
          'Modifica los datos del concepto de pago.'
        }
        right={
          <ModeSwitcher
            mode={mode}
            id={id}
            registerUrl="/conceptos/new"
            formUrl={m => `/conceptos/form?mode=${m}&id=${id}`}
          />
        }
      />

      {loadStatus === 'error' && loadErrorMsg && <ErrorBanner message={loadErrorMsg} />}
      {submitStatus === 'error' && submitErrorMsg && <ErrorBanner message={submitErrorMsg} />}

      {loadStatus === 'loading' ? (
        <FormCard loading loadingLabel="Cargando concepto de pago..." />
      ) : loadStatus === 'error' ? null : (
        <>
          {/* ── Datos Generales ──────────────────────────────────────────────── */}
          <FormCard>
            <SectionTitle>Datos Generales</SectionTitle>

            <div className="grid grid-cols-12 gap-4">
              <TextField
                label="Nombre"
                required={!isView}
                value={nombre}
                onChange={v => { setNombre(v); clearErr('nombre') }}
                disabled={disabled}
                error={errors.nombre}
                placeholder="Ej. Cuota Cuatrimestral"
                className="col-span-12 sm:col-span-8"
              />
              <SelectField
                label="Tipo"
                required={!isView}
                value={tipo}
                onChange={v => setTipo(v as PaymentConceptType)}
                disabled={disabled}
                options={(Object.keys(TYPE_LABELS) as PaymentConceptType[]).map(t => ({ value: t, label: TYPE_LABELS[t] }))}
                placeholder="Seleccionar tipo…"
                className="col-span-12 sm:col-span-4"
              />
              <SelectField
                label="Área"
                required={!isView}
                value={areaId}
                onChange={v => { setAreaId(v); clearErr('areaId') }}
                disabled={disabled}
                error={errors.areaId}
                options={areaOptions}
                placeholder="Selecciona una opción"
                className="col-span-12"
              />
            </div>

            <div className="mt-4">
              <RichTextEditor
                label="Descripción del concepto"
                value={descripcion}
                onChange={setDescripcion}
                readonly={isView}
              />
            </div>

            <div className="mt-4">
              <RichTextEditor
                label="Políticas del concepto"
                value={politicas}
                onChange={setPoliticas}
                readonly={isView}
              />
            </div>
          </FormCard>

          {/* ── Tarifas ────────────────────────────────────────────────────────
              En Registrar es el editor del precio (alcance de la sección + una
              fila por monto). En Ver es el historial append-only de
              `payment_rate`. En Editar son las dos: el historial arriba —nunca
              se borra ni se sobrescribe— y el mismo editor debajo, para
              capturar una tarifa nueva o cambiar el precio de una existente. */}
          <FormCard>
            <SectionTitle>Tarifas</SectionTitle>

            {!isRegister && (
              // ── Historial (Ver/Editar) — append-only ───────────────────────
              <div className={rateEditorVisible ? 'mb-6 border-b border-[#E5E7EB] pb-6' : ''}>
                {ratesLoadStatus === 'loading' ? (
                  <div className="flex flex-col items-center gap-2 text-[#6B7280] py-8">
                    <Loader2 size={20} className="animate-spin text-[#009574]" />
                    <p className="text-[12px] font-medium">Cargando tarifas...</p>
                  </div>
                ) : ratesLoadStatus === 'error' ? (
                  <p className="text-[12px] text-red-600 text-center py-6">No se pudieron cargar las tarifas. Intenta de nuevo más tarde.</p>
                ) : rates.length === 0 ? (
                  <p className="text-[12px] text-[#6B7280] text-center py-6">Sin tarifas registradas todavía.</p>
                ) : (
                  <>
                    {/* La ventana se muestra UNA vez, arriba: las tarifas no tienen
                        vigencia propia, así que repetirla por fila mostraría la
                        misma fecha en todas. */}
                    <p className="mb-3 text-[11px] text-[#6B7280]">
                      <span className="font-medium text-[#333333]">Disponible para pagos:</span>{' '}
                      {tieneVigencia && (availableFrom || availableUntil)
                        ? [
                            availableFrom ? formatDate(availableFrom) : 'sin fecha inicial',
                            availableUntil ? formatDate(availableUntil) : 'sin fecha final',
                          ].join(' – ')
                        : 'sin vigencia — disponible siempre'}
                      . Aplica a todas las tarifas del concepto.
                    </p>

                    <div className="hidden md:block border border-[#E5E7EB] rounded-lg overflow-hidden">
                      <MiniTable
                        columns={[
                          { key: 'programa', header: 'Carrera', render: r => <span className="text-[#333333]">{programLabel(r.programId)}</span> },
                          { key: 'nivel', header: 'Nivel', render: r => <span className="text-[#333333]">{levelLabel(r.level)}</span> },
                          { key: 'periodo', header: 'Periodo', render: r => <span className="text-[#333333]">{periodLabel(r.periodId)}</span> },
                          { key: 'monto', header: 'Monto', className: 'text-right tabular-nums', render: r => <span className="font-medium text-[#333333]">{formatCurrency(r.amount)}</span> },
                          ...(isView ? [] : [{
                            key: 'accion',
                            header: '',
                            className: 'w-10',
                            render: (r: PaymentRateItem) => (
                              <button
                                type="button"
                                onClick={() => startRepricing(r)}
                                disabled={isSubmitting || Boolean(r.validTo)}
                                title={r.validTo
                                  ? 'Esta tarifa ya fue reemplazada por otra más reciente.'
                                  : 'Cambiar el monto de esta tarifa'}
                                className="text-[#009574] hover:text-[#007a60] disabled:text-[#D1D5DB] disabled:cursor-not-allowed"
                              >
                                <Pencil size={13} />
                              </button>
                            ),
                          }]),
                        ]}
                        items={rates}
                        keyFor={r => r.id}
                      />
                    </div>

                    <div className="md:hidden space-y-3">
                      {rates.map(r => (
                        <div key={r.id} className="border border-[#E5E7EB] rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[13px] font-semibold text-[#333333]">{formatCurrency(r.amount)}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-[#6B7280]">{programLabel(r.programId)}</span>
                              {!isView && (
                                <button
                                  type="button"
                                  onClick={() => startRepricing(r)}
                                  disabled={isSubmitting || Boolean(r.validTo)}
                                  className="text-[#009574] disabled:text-[#D1D5DB]"
                                >
                                  <Pencil size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-[12px] text-[#6B7280]">{levelLabel(r.level)}</p>
                          <p className="text-[12px] text-[#6B7280]">{periodLabel(r.periodId)}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {rateEditorVisible ? (
              // ── Editor (Registrar, y Editar cuando se abre) ────────────────
              <>
                {!isRegister && (
                  <p className="mb-4 text-[11px] leading-snug text-[#6B7280]">
                    Las tarifas ya registradas no se sobrescriben. Al guardar, cada
                    monto de este bloque se registra como una tarifa nueva y la
                    anterior queda cerrada con su fecha, así que el historial de
                    precios se conserva.
                  </p>
                )}

                <p className="mb-4 text-[11px] leading-snug text-[#6B7280]">
                  {lockedScope
                    ? 'El alcance es el mismo para todas las tarifas del concepto, y las que ya tiene registradas ya lo fijaron. Solo define los montos nuevos.'
                    : 'El alcance es el mismo para todas las tarifas del concepto: primero elige a quién aplican y después define el monto de cada una. En alcance general basta con un monto, que además es el costo del concepto. Las tarifas no tienen vigencia propia: se rigen por la vigencia del concepto.'}
                </p>

                {lockedScope ? (
                  // El alcance ya está en el historial, así que se informa en vez
                  // de preguntarse. `selectScope()` vacía los destinos de las
                  // filas, así que dejarlo elegible en editar había producido
                  // pantallas donde cambiar de tarjeta vaciaba lo capturado.
                  <div className="rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2.5">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                      Alcance de las tarifas
                    </span>
                    <span className="mt-0.5 block text-[13px] font-semibold text-[#333333]">
                      {SCOPE_LABELS[lockedScope]}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-[#6B7280]">
                      {SCOPE_DESCRIPTIONS[lockedScope]}
                    </span>
                  </div>
                ) : (
                  <ScopePicker
                    value={tarifaScope}
                    onChange={selectScope}
                    disabled={isSubmitting}
                    error={errors.alcance}
                  />
                )}

                {tarifaScope === '' ? (
                  <div className="mt-4 rounded-lg border border-dashed border-[#D1D5DB] py-8 text-center">
                    <p className="text-[12px] text-[#6B7280]">
                      Selecciona un alcance para empezar a capturar tus tarifas.
                    </p>
                  </div>
                ) : (
                  <>
                    {errors.tarifas && <div className="mt-4"><FieldError>{errors.tarifas}</FieldError></div>}

                    <div className="mt-4 space-y-3">
                      {tarifas.map((t, i) => {
                        // Cada fila ve el catálogo menos lo que ya tomaron las
                        // demás, más su propia selección (si se filtrara, el
                        // `<select>` la perdería y se vería en blanco).
                        const takenLevels = takenLevelsBy(t.key)
                        const takenPrograms = takenProgramsBy(t.key)
                        return (
                          <div key={t.key}>
                            <TarifaRow
                              index={i}
                              scope={tarifaScope}
                              canRemove={tarifaScope !== 'GENERAL' && tarifas.length > 1}
                              draft={t}
                              nivelOptions={(Object.keys(LEVEL_LABELS) as AcademicLevel[]).filter(
                                l => l === t.level || !takenLevels.has(l)
                              )}
                              carreraOptions={carreraOptions.filter(
                                o => t.programIds.includes(o.id) || !takenPrograms.has(o.id)
                              )}
                              error={errors.tarifasByKey?.[t.key]}
                              onChange={patch => { updateTarifa(t.key, patch); clearTarifaErr(t.key) }}
                              onRemove={() => removeTarifa(t.key)}
                            />
                            {/* Aviso de repricing. El POST es idéntico al de una
                                fila nueva — el que cierra la tarifa anterior es
                                `SetPaymentRateUseCase` — pero el usuario tiene
                                que saber que no está agregando una tarifa, la
                                está cambiando. */}
                            {!isRegister && wouldReprice(t) && (
                              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-[#B45309]">
                                <Info size={12} className="mt-0.5 shrink-0" />
                                Esta combinación ya tiene tarifa. Al guardar se
                                registra un monto nuevo y el anterior queda
                                cerrado con su fecha.
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {tarifaScope === 'GENERAL' ? (
                      <p className="mt-3 text-[11px] text-[#6B7280]">
                        El alcance general es un solo monto, sin nivel ni carrera.
                      </p>
                    ) : (
                      <div className="mt-3">
                        <Button size="sm" onClick={addTarifa} disabled={isSubmitting}>
                          <Plus size={13} />Agregar tarifa
                        </Button>
                      </div>
                    )}

                    {!isRegister && (
                      <div className="mt-4">
                        <Button variant="secondary" size="sm" onClick={closeRateEditor} disabled={isSubmitting}>
                          Descartar tarifas
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {ratesProgress && (
                  <p className="mt-3 flex items-center gap-2 text-[12px] font-medium text-[#009574]">
                    <Loader2 size={14} className="animate-spin" />
                    Guardando tarifas… {ratesProgress.done} de {ratesProgress.total}
                  </p>
                )}
              </>
            ) : (
              // ── Editar, editor colapsado ───────────────────────────────────
              <div className="mt-1">
                {/* El alcance se deduce del historial, así que abrir el editor
                    antes de que las tarifas carguen lo dejaría sin deduce
                    (parecería un concepto sin tarifas) y al terminar la carga
                    la vista cambiaría sola bajo el usuario. Con historial en
                    error tampoco se puede deducir. */}
                <Button
                  size="sm"
                  onClick={openRateEditor}
                  disabled={isSubmitting || ratesLoadStatus === 'loading' || ratesLoadStatus === 'error'}
                >
                  <Plus size={13} />Agregar tarifa
                </Button>
                <p className="mt-2 text-[11px] text-[#6B7280]">
                  Opcional: si solo cambias datos del concepto, puedes guardar
                  sin tocar las tarifas.
                </p>
              </div>
            )}
          </FormCard>

          {/* ── Configuración del Concepto ───────────────────────────────────── */}
          <FormCard>
            <SectionTitle>Configuración del Concepto</SectionTitle>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SwitchRow
                label="¿Lo pueden pagar personas externas?"
                description="Si el concepto puede ser pagado por gente externa a la UTEZ, debes indicar el costo que tendría para ellos."
                checked={esExterno}
                onChange={setEsExterno}
                disabled={disabled}
              >
                <TextField
                  label="Costo para externos"
                  value={costoExterno}
                  onChange={v => { setCostoExterno(v); clearErr('costoExterno') }}
                  disabled={disabled}
                  error={errors.costoExterno}
                  type="number"
                  min={0}
                  step="0.01"
                  numeric
                  prefix="$"
                  placeholder="0.00"
                />
              </SwitchRow>

              <SwitchRow
                label="¿Es acumulable?"
                description="Si el concepto es acumulable, los usuarios que realicen el pago de este concepto podrán colocar la cantidad en el formulario de pago."
                checked={esAcumulable}
                onChange={setEsAcumulable}
                disabled={disabled}
              />

              <SwitchRow
                label="¿Es multiconcepto?"
                description="Si el concepto es multiconcepto, los usuarios podrán seleccionar más de un concepto al realizar el pago."
                checked={esMulticoncepto}
                onChange={setEsMulticoncepto}
                disabled={disabled}
              />

              <SwitchRow
                label="Es exclusivo del carrito"
                description="No se puede combinar con otros conceptos en el mismo carrito de pago."
                checked={isStandalone}
                onChange={setIsStandalone}
                disabled={disabled}
              />

              <SwitchRow
                label="¿Tiene conceptos vinculados?"
                description="Si el concepto tiene conceptos vinculados, al realizar el pago de este concepto, se mostrarán los conceptos vinculados para que el usuario pueda seleccionarlos y, en caso de ser obligatorios, se seleccionarán automáticamente."
                checked={esVinculados}
                onChange={setEsVinculados}
                disabled={disabled}
              >
                <MultiSelectField
                  label="Conceptos vinculados"
                  options={conceptOptions}
                  selected={vinculados}
                  onChange={setVinculados}
                  disabled={disabled}
                  placeholder="Seleccionar conceptos…"
                />
              </SwitchRow>

              <SwitchRow
                label="¿Es cuota cuatrimestral?"
                description="Es importante indicar si el concepto se trata de una cuota cuatrimestral para la aplicación de becas y prórrogas."
                checked={esCuotaCuatrimestral}
                onChange={setEsCuotaCuatrimestral}
                disabled={disabled}
              />

              <SwitchRow
                label="¿Tiene límite de cuotas cuatrimestrales?"
                description="Si el concepto tiene límite de cuotas por cuatrimestre, debes indicar el límite de cuotas."
                checked={limiteCuotasOn}
                onChange={setLimiteCuotasOn}
                disabled={disabled}
              >
                <TextField
                  label="Límite de cuotas"
                  value={limiteCuotas}
                  onChange={v => { setLimiteCuotas(v); clearErr('limiteCuotas') }}
                  disabled={disabled}
                  error={errors.limiteCuotas}
                  type="number"
                  min={1}
                  step={1}
                  numeric
                  placeholder="Ej. 12"
                />
              </SwitchRow>

              <SwitchRow
                label="¿Requiere validación?"
                description="Si el concepto requiere validación, el usuario responsable del área correspondiente deberá validar el pago."
                checked={requiereValidacion}
                onChange={setRequiereValidacion}
                disabled={disabled}
              />

              <SwitchRow
                label="¿Tiene vigencia?"
                description="Si el concepto tiene vigencia, debes indicar el período en el que estará disponible para realizar pagos."
                checked={tieneVigencia}
                onChange={setTieneVigencia}
                disabled={disabled}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Disponible desde</FieldLabel>
                    <DatePicker
                      value={isoToDisplay(availableFrom)}
                      onChange={v => { setAvailableFrom(displayToIso(v)); clearErr('vigencia') }}
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <FieldLabel>Disponible hasta</FieldLabel>
                    <DatePicker
                      value={isoToDisplay(availableUntil)}
                      onChange={v => { setAvailableUntil(displayToIso(v)); clearErr('vigencia') }}
                      disabled={disabled}
                    />
                  </div>
                  {errors.vigencia && (
                    <div className="sm:col-span-2"><FieldError>{errors.vigencia}</FieldError></div>
                  )}
                </div>
              </SwitchRow>
            </div>

            {/* Campos del catálogo original (contrato actual del backend) */}
            <div className="mt-6">
              <SectionTitle hint="Vacío = ilimitado">Límites</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextField
                  label="Máximo por Estudiante"
                  value={maxPerStudent}
                  onChange={setMaxPerStudent}
                  disabled={disabled}
                  type="number"
                  min={1}
                  numeric
                  placeholder="Sin límite"
                  help="Cantidad máxima de veces que un estudiante puede pagar este concepto."
                />
                <TextField
                  label="Máximo por Periodo"
                  value={maxPerPeriod}
                  onChange={setMaxPerPeriod}
                  disabled={disabled}
                  type="number"
                  min={1}
                  numeric
                  placeholder="Sin límite"
                  help="Cantidad máxima de veces que se puede pagar este concepto por periodo académico."
                />
              </div>
            </div>
          </FormCard>

          {/* ── Acciones ──────────────────────────────────────────────────────── */}
          <FormActions
            isView={isView}
            onBack={() => navigate('/conceptos')}
            onPrimary={isView ? () => navigate(`/conceptos/form?mode=edit&id=${id}`) : handleSubmit}
            primaryLabel={isView ? 'Editar' : isRegister ? 'Registrar' : 'Guardar Cambios'}
            isSubmitting={isSubmitting}
          />
        </>
      )}
    </FormPage>
  )
}
