import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Loader2, Plus, Search, Trash2, X, Check, ChevronDown, Pencil, Info } from 'lucide-react'
import { FieldLabel, FieldHelp, FieldError, Switch, ModeSwitcher, DatePicker } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, Button, TextField, SelectField } from '@app/core/components/form'
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

type PaymentConceptType =
  | 'ADMISSION'
  | 'ENROLLMENT'
  | 'REINSCRIPTION'
  | 'PERIODIC_QUOTA'
  | 'EXTRAORDINARY'
  | 'DOCUMENT'
  | 'OTHER'
type PaymentConceptStatus = 'ACTIVE' | 'INACTIVE'
type PaymentRateStatus = 'ACTIVE' | 'INACTIVE'

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
  PERIODIC_QUOTA: 'Cuota cuatrimestral',
  EXTRAORDINARY: 'Extraordinario',
  DOCUMENT: 'Documento',
  OTHER: 'Otro',
}

// `code` — clave corta y única del concepto. No es el `id`: es la referencia que
// el usuario escribe al momento de capturar una cuota, así que se muestra siempre
// y se manda en mayúsculas para que dos personas que lo escriban a mano coincidan
// sin depender de la collation de MySQL.
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,29}$/

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
  /**
   * Id de la tarifa `ACTIVE` que esta fila representa, si ya existe en el
   * servidor. La marca como fila guardada: su destino no se elige —es parte de la
   * identidad de la fila en `payment_rate`— y lo único que se edita es el monto.
   * Sin este flag la fila es nueva: se agregó en esta sesión y todavía no existe.
   */
  rateId?: string
  /**
   * Marca la fila que el usuario está reescribiendo: las que ya tienen monto y
   * no son nuevas se muestran como dato y se abren con el lápiz. Una fila sin
   * monto, o nueva, se edita siempre, así que para ellas el flag no dice nada.
   */
  editing?: boolean
}

/**
 * Identidad de una combinación destino de `payment_rate`: (programa, nivel).
 * El backend no lleva un id de combo, pero la reconciliación empareja el
 * conjunto enviado contra la tarifa vigente que comparta esta tupla, así que es
 * la clave con la que el front tiene que razonar para saber si una fila agrega
 * un precio o lo cambia.
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
 *
 * Solo miran las tarifas `ACTIVE`: una fila retirada por un guardado anterior
 * sigue en el historial pero ya no dice nada del alcance vigente, y contarla
 * hacía que un concepto con un solo destino cobrado pareciera "de destinos
 * mezclados" y bloquease el editor.
 */
function inferScopeFromRates(items: PaymentRateItem[]): TarifaScope | null {
  const active = items.filter(r => r.status === 'ACTIVE')
  if (active.length === 0) return null
  // Por truthiness y no por `!== null`: el destino ausente llega como `null`
  // pero una clave omitida llegaría como `undefined`, y comparar contra `null`
  // la tomaría por una tarifa de carrera.
  const counts = {
    PROGRAMS: active.filter(r => !!r.programId).length,
    LEVEL: active.filter(r => !r.programId && !!r.level).length,
    GENERAL: active.filter(r => !r.programId && !r.level).length,
  }
  const match = (['GENERAL', 'LEVEL', 'PROGRAMS'] as TarifaScope[]).filter(
    scope => counts[scope] === active.length
  )
  return match.length === 1 ? match[0] : null
}

// Fila de `payment_rate` tal y como la aceptan `POST /payment-concepts` (dentro
// de `rates`) y `PUT /payment-concepts/{conceptId}/rates` (ver
// `ReconcilePaymentRatesRequest.PaymentRateDraftRequest`).
//
// No lleva vigencia: la tarifa no tiene fechas propias, se rige por la ventana
// del concepto y su estado (`ACTIVE`/`INACTIVE`) lo administra el backend al
// reconciliar. Los `undefined` desaparecen en `JSON.stringify` y el backend los
// recibe como `null` real.
interface PaymentRatePayload {
  programId?: string
  level?: AcademicLevel
  amount: number
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

// Catálogo de referencia (`GET /programs/options`), no la vista de gestión:
// este endpoint devuelve solo carreras `ACTIVE` y es `authenticated()`, mientras
// que `GET /programs` exige ADMIN o SERVICIOS_ESCOLARES. Como
// `/payment-concepts` lo abre ADMIN o PERSONAL_FINANZAS, usar el catálogo de
// gestión dejaba el selector de carreras vacío —con un 403 silencioso en
// consola— justo para el rol que administra las cuotas.
interface ProgramOption {
  id: string
  /** Nombre de la carrera; la opción se muestra como `code — label`. */
  label: string
  code: string
}

// `PaymentRate` — historial de precios. `status` y `createdAt` los administra el
// servidor (no viajan en ningún request) y sustituyen a las fechas de vigencia
// que este módulo ya no captura: `GET` devuelve todas las filas, no solo la
// vigente, para poder mostrar qué costaba antes y cuándo cambió.
interface PaymentRateItem {
  id: string
  conceptId: string
  programId: string | null
  level: AcademicLevel | null
  amount: number
  periodId: string | null
  status: PaymentRateStatus
  /** ISO-8601 con hora; la tabla muestra solo la fecha. */
  createdAt: string
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

// `PaymentConceptResponse` / `CreatePaymentConceptRequest` /
// `UpdatePaymentConceptRequest` — espejo de los DTOs del backend.
//
// Sin `isTuition`: lo que era "cuota cuatrimestral" es ahora el tipo
// `PERIODIC_QUOTA`, que además exige `levelNumber`. Sin `programIds`: el alcance
// lo dicen las tarifas, que es de donde se cobra.
interface PaymentConceptResponse {
  id: string
  name: string
  code: string
  description: string | null
  policies: string | null
  type: PaymentConceptType
  levelNumber: number | null
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

/** Campos comunes a `POST` y `PUT /payment-concepts`. */
interface PaymentConceptFormPayload {
  name: string
  code: string
  description: string | null
  policies: string | null
  type: PaymentConceptType
  levelNumber: number | null
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

/**
 * Alta. `rates` viaja con el concepto para que una cuota periódica nunca quede
 * persistida existiendo pero sin cotizar: el backend valida el conjunto
 * completo y, si algo falla, revierte el concepto con él.
 */
interface CreatePaymentConceptPayload extends PaymentConceptFormPayload {
  rates: PaymentRatePayload[]
}

interface FormErrors {
  nombre?: string
  codigo?: string
  tipo?: string
  nivel?: string
  areaId?: string
  costoExterno?: string
  limiteCuotas?: string
  vigencia?: string
  /** Alcance de las tarifas sin elegir. */
  alcance?: string
  /** Lista de tarifas vacía. */
  tarifas?: string
  /** Carreras activas que la cuota periódica aún no cotiza. */
  cobertura?: string
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
  /** Opcional: dentro de la tabla de tarifas el encabezado ya dice de qué va. */
  label?: string
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
      {label && <FieldLabel>{label}</FieldLabel>}
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
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#e6f5f1] px-2 py-0.5 text-xs text-[#007a5e]"
            >
              <span className="truncate">{o.label}</span>
              {!disabled && (
                <button type="button" onClick={() => toggle(o.id)} className="shrink-0 hover:text-[#009574]">
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

// ─── TarifasLista ─────────────────────────────────────────────────────────────

/**
 * La lista de precios del concepto. Es la misma para la cuota periódica y para
 * los demás tipos, y también en los tres modos: lo que cambia es qué se puede
 * hacer en cada fila, no la pantalla.
 *
 * Las filas llegan de dos maneras, y por eso la fila tiene tres formas:
 *
 * - **Tarifa ya guardada** (`rateId`): su destino no se toca. El destino es parte
 *   de la identidad de la fila en `payment_rate` —cambiarlo no es editar un
 *   precio sino cotizar otro—, así que se muestra como texto y lo único editable
 *   es el monto, con el lápiz.
 * - **Tarifa nueva**: la agrega el botón "Agregar tarifa". Aquí sí se elige el
 *   destino, el monto se captura siempre, y se puede quitar mientras haya otra.
 * - **Fila de cuota sin precio**: la generó el catálogo, no la persona, así que su
 *   input está siempre visible: no hay nada que "abrir".
 *
 * `readOnly` es el modo Ver: los mismos datos sin input ni lápiz, porque el pie de
 * la página ahí dice "Editar" y no "Guardar", y lo capturado ahí se perdería sin
 * aviso.
 */
function TarifasLista({
  filas,
  scope,
  readOnly,
  disabled,
  errores,
  destinoFijo,
  puedeQuitar,
  labelCarrera,
  labelNivel,
  formatMonto,
  nivelOptions,
  carreraOptions,
  onChange,
  onToggleEdicion,
  onRemove,
}: {
  filas: TarifaDraft[]
  scope: TarifaScope | ''
  readOnly: boolean
  disabled: boolean
  errores: Record<string, { field: TarifaField; message: string } | undefined>
  /** El destino lo fija el tipo (cuota) o ya está guardado: no se elige. */
  destinoFijo: boolean
  /** Una fila nueva se puede quitar mientras haya alguna más que capturar. */
  puedeQuitar: boolean
  labelCarrera: (programId: string | null) => string
  labelNivel: (level: AcademicLevel | null) => string
  formatMonto: (amount: string) => string
  /** Niveles libres para esa fila: los que ya tomó otra no se ofrecen. */
  nivelOptions: (key: string) => AcademicLevel[]
  /** Carreras libres para esa fila, más su propia selección. */
  carreraOptions: (key: string) => { id: string; label: string }[]
  onChange: (key: string, patch: Partial<TarifaDraft>) => void
  onToggleEdicion: (key: string) => void
  onRemove: (key: string) => void
}) {
  const esNueva = (t: TarifaDraft) => !t.rateId
  const conPrecio = (t: TarifaDraft) => !!t.amount.trim()
  /** Fila que ya está en modo captura, sin necesidad de abrirla con el lápiz. */
  const abierta = (t: TarifaDraft) => esNueva(t) || (!conPrecio(t) && destinoFijo)

  const errFor = (t: TarifaDraft, field: TarifaField) =>
    errores[t.key]?.field === field ? errores[t.key]?.message : undefined

  function destino(t: TarifaDraft) {
    if (esNueva(t) && !destinoFijo && scope !== 'GENERAL') {
      if (scope === 'LEVEL') {
        const libres = nivelOptions(t.key)
        return (
          <SelectField
            value={t.level}
            onChange={v => onChange(t.key, { level: v as AcademicLevel | '' })}
            error={errFor(t, 'level')}
            options={libres.map(l => ({ value: l, label: LEVEL_LABELS[l] }))}
            placeholder={libres.length === 0 ? 'No hay niveles disponibles' : 'Seleccionar nivel…'}
          />
        )
      }
      return (
        <MultiSelectField
          options={carreraOptions(t.key)}
          selected={t.programIds}
          onChange={ids => onChange(t.key, { programIds: ids })}
          error={errFor(t, 'programIds')}
          placeholder="Seleccionar carreras…"
        />
      )
    }
    // En general no hay destino que nombrar: la fila aplica a todos. Sin este
    // caso caía en `labelNivel(null)` y se leía "Todos los niveles", que es el
    // alcance por nivel, no el general.
    if (scope === 'GENERAL') {
      return <span className="text-[#333333]">Todas las carreras y niveles</span>
    }
    if (t.programIds.length === 1) {
      return <span className="text-[#333333]">{labelCarrera(t.programIds[0])}</span>
    }
    if (t.programIds.length > 1) {
      return <span className="text-[#333333]">{t.programIds.length} carreras</span>
    }
    return <span className="text-[#333333]">{labelNivel(t.level || null)}</span>
  }

  function monto(t: TarifaDraft) {
    const precio = conPrecio(t)
    if (!readOnly && !disabled && (abierta(t) || t.editing)) {
      return (
        <TextField
          value={t.amount}
          onChange={v => onChange(t.key, { amount: v })}
          error={errFor(t, 'amount')}
          type="number"
          min={0}
          step="0.01"
          numeric
          prefix="$"
          placeholder="0.00"
          className="w-full"
        />
      )
    }
    if (readOnly || disabled) {
      return (
        <span className={`tabular-nums ${precio ? 'font-medium text-[#333333]' : 'text-[#9CA3AF]'}`}>
          {precio ? formatMonto(t.amount) : 'Sin cotizar'}
        </span>
      )
    }
    return <span className="tabular-nums font-medium text-[#333333]">{formatMonto(t.amount)}</span>
  }

  function acciones(t: TarifaDraft) {
    return (
      <div className="flex items-center justify-end gap-2">
        {/* Solo las filas nuevas se quitan: una tarifa guardada no se borra desde
            aquí, se cambia su monto o se cotiza otro destino. */}
        {esNueva(t) && puedeQuitar && (
          <button
            type="button"
            onClick={() => onRemove(t.key)}
            disabled={disabled}
            title="Quitar esta tarifa"
            className="text-[#9CA3AF] hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 size={13} />
          </button>
        )}
        {!readOnly && !esNueva(t) && (
          <button
            type="button"
            onClick={() => onToggleEdicion(t.key)}
            disabled={disabled || (!conPrecio(t) && !abierta(t))}
            title={
              !conPrecio(t)
                ? 'Esta fila todavía no tiene precio'
                : t.editing
                  ? 'Terminar de editar'
                  : 'Cambiar el monto'
            }
            className="text-[#009574] hover:text-[#007a60] disabled:text-[#D1D5DB] disabled:cursor-not-allowed"
          >
            {t.editing ? <Check size={14} /> : <Pencil size={13} />}
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Escritorio: la lista densa es lo que hace falta cuando hay muchas
          carreras. Sin `overflow-hidden`: el selector de destino abre un popover
          `absolute` y un recorte lo cortaba contra el borde de la tabla. Las
          esquinas se redondean con `border-separate`, que sí pinta el radio
          sobre las celdas. */}
      <div className="hidden border border-[#E5E7EB] rounded-lg md:block">
        <table className="w-full text-[12px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="rounded-tl-lg bg-[#F8F9FA] border-b border-[#E5E7EB] text-left px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">
                {scope === 'LEVEL' ? 'Nivel' : 'Destino'}
              </th>
              <th className="bg-[#F8F9FA] border-b border-[#E5E7EB] text-left px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider w-52">
                Monto
              </th>
              <th className="rounded-tr-lg bg-[#F8F9FA] border-b border-[#E5E7EB] w-16" />
            </tr>
          </thead>
          <tbody className="[&_tr:last-child_td]:border-b-0">
            {filas.map(t => (
              <tr key={t.key} className="align-top">
                <td className="border-b border-[#E5E7EB] px-3 py-2">{destino(t)}</td>
                <td className="border-b border-[#E5E7EB] px-3 py-2">{monto(t)}</td>
                <td className="border-b border-[#E5E7EB] px-2 py-2">{acciones(t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil: una tarjeta por fila, porque una tabla de tres columnas en un
          teléfono obliga a hacer scroll horizontal para leer el monto. */}
      <div className="md:hidden space-y-2">
        {filas.map(t => (
          <div key={t.key} className="border border-[#E5E7EB] rounded-lg p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">{destino(t)}</div>
              {acciones(t)}
            </div>
            <div className="mt-2">{monto(t)}</div>
          </div>
        ))}
      </div>
    </>
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
  const [codigo, setCodigo] = useState('')
  const [tipo, setTipo] = useState<PaymentConceptType | ''>('')
  // Nivel de la cuota periódica. Solo tiene sentido (y el backend solo lo exige)
  // cuando el tipo es `PERIODIC_QUOTA`; en los demás tipos se manda `null`.
  const [nivelNum, setNivelNum] = useState('')
  const [areaId, setAreaId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [politicas, setPoliticas] = useState('')

  // Costo que ya tiene el concepto guardado. En Registrar se deriva de la
  // tarifa GENERAL; en Ver se reenvía tal cual, y en Editar solo lo sustituye
  // la fila general si su monto cambió: mandarlo en `null` borraría el precio de
  // todo lo que aún lee `PaymentConcept.cost`.
  const [conceptCost, setConceptCost] = useState<number | null>(null)

  // ─── Tarifas ────────────────────────────────────────────────────────────────
  // En Registrar la lista es la única forma de capturar el precio, y viaja con
  // el concepto en un solo POST: el backend valida el conjunto completo y
  // revierte el concepto si algo no cuadra, así que aquí no hace falta reintentar
  // un lote a medias. En Ver y Editar la misma lista se arma con las tarifas
  // `ACTIVE` que devuelve `GET /payment-concepts/{id}/rates`: en Ver de solo
  // lectura, y en Editar con el monto editable mediante el lápiz.
  //
  // `tarifaScope` es el paso 1 y es de la sección: todas las filas lo comparten.
  // `tarifas` (el paso 2) arranca vacío hasta que hay alcance. Para
  // `PERIODIC_QUOTA` el alcance no se pregunta: lo fija el tipo y es "por
  // carreras".
  const [tarifaScope, setTarifaScope] = useState<TarifaScope | ''>('')
  const [tarifas, setTarifas] = useState<TarifaDraft[]>([])
  // Carrera a la que pertenece la última siembra de filas de cuota, para poder
  // re-sembrar solo cuando el catálogo cambia de verdad.
  const cuotaSeedRef = useRef('')
  // Firma de las tarifas guardadas que ya se vertieron a filas, por el mismo
  // motivo que el de arriba: re-sembrar en cada render borraría lo capturado.
  const savedRowsRef = useRef('')

  // ─── Configuración del Concepto ───────────────────────────────────────────
  const [esExterno, setEsExterno] = useState(false)
  const [costoExterno, setCostoExterno] = useState('')
  const [esAcumulable, setEsAcumulable] = useState(false)
  const [esMulticoncepto, setEsMulticoncepto] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [esVinculados, setEsVinculados] = useState(false)
  const [vinculados, setVinculados] = useState<string[]>([])
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
  const [programs, setPrograms] = useState<ProgramOption[]>([])

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

  // `PERIODIC_QUOTA` no es "un concepto más": su alcance lo fija el tipo, así
  // que varias decisiones del editor dejan de ser preguntas. Se deriva de `tipo`
  // y no de un switch propio para que no pueda quedar desalineado del campo que
  // se manda al backend.
  const isQuota = tipo === 'PERIODIC_QUOTA'
  //
  // La lista de tarifas está visible en Registrar y en Editar, siempre. Antes
  // se colapsaba detrás de un botón en Editar y el lápiz abría un editor aparte:
  // eso obligaba a leer los precios dos veces (la tabla de arriba y las tarjetas
  // de abajo) y a decidir en qué bloque se editaba, cuando en realidad es la
  // misma lista con un lápiz por fila.
  //
  // `isView` se excluye a propósito, y no solo para esconder los controles: el
  // pie de la página en Ver dice "Editar" (navega al modo de edición) en vez de
  // guardar. Un input abierto ahí deja capturar montos que después no hay dónde
  // guardar — se pierde lo capturado sin aviso.
  //
  // El precio de que Editar mande siempre el `PUT` del conjunto es que también
  // manda las tarifas que nadie tocó. Es lo correcto: el `PUT` reconcilia contra
  // lo guardado y desactiva lo que no venga, así que omitir las intactas las
  // borraría. `expandTarifas()` las mezcla por eso. Cuando los montos no cambian,
  // la reconciliación conserva los mismos ids y no crea filas.
  const rateEditorVisible = !isView
  //
  // Antes de que terminen de cargar las tarifas no se manda el conjunto: en
  // Editar el `PUT` se arma sobre lo guardado, y mandar solo las filas nuevas
  // con las viejas todavía en el aire las retiraría.
  const ratesReady = isRegister || ratesLoadStatus === 'idle'
  const shouldSendRates = rateEditorVisible && ratesReady
  /** Carreras `ACTIVE` que aún no tienen monto capturado en la cuota. */
  const cuotaFaltantes = isQuota
    ? tarifas.filter(t => !(Number(t.amount) > 0)).length
    : 0

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
   *
   * En `PERIODIC_QUOTA` el alcance no se elige: es siempre "por carreras", una
   * fila por carrera `ACTIVE`. Por eso el `ScopePicker` no se renderiza en ese
   * modo y `selectScope()` no es un camino alcanzable desde la interfaz.
   */
  function selectScope(scope: TarifaScope) {
    if (scope === tarifaScope) return
    setTarifaScope(scope)
    setTarifas(prev => {
      if (scope === 'PROGRAMS' && isQuota) return seedCuotaRows(prev)
      if (prev.length === 0) return [newTarifaDraft()]
      if (scope === 'GENERAL') return [{ ...newTarifaDraft(), amount: prev[0].amount }]
      return prev.map(t => ({ ...t, level: '' as AcademicLevel | '', programIds: [] as string[] }))
    })
    // Los errores de fila son del alcance anterior: se descartan enteros, no
    // se reasignan (el destino puede no existir ya en la fila que falló).
    setErrors(prev => ({ ...prev, alcance: undefined, tarifas: undefined, tarifasByKey: undefined }))
  }

  /**
   * Una fila por carrera `ACTIVE`, que es lo que el backend exige para una
   * cuota periódica (`PaymentQuotaCoverageChecker`).
   *
   * Se siembra desde el catálogo de carreras, no desde lo que el usuario eligió:
   * las filas se generan, no se capturan. Por eso `addTarifa`/`removeTarifa` no
   * tienen sentido aquí —agregar una fila sin carrera y quitar una fila con
   * precio son las dos formas de romper la cobertura— y la UI no ofrece ninguno
   * de los dos.
   *
   * Los montos ya capturados sobreviven a una re-siembra (que ocurre cuando el
   * catálogo llega después de abrir el editor, o cuando cambia), y los que no
   * tienen fila propia caen al precio vigente guardado: recargar la página no
   * obliga a reescribir a mano lo que ya estaba cotizado.
   */
  function seedCuotaRows(prev: TarifaDraft[]): TarifaDraft[] {
    const captured = new Map<string, string>()
    const editingKeys = new Set(prev.filter(t => t.editing).map(t => t.key))
    for (const t of prev) {
      if (t.programIds.length === 1) captured.set(t.programIds[0], t.amount)
    }
    return programs.map(p => {
      const key = `cuota-${p.id}`
      // Si el backend ya tiene una tarifa `ACTIVE` para esta carrera, la fila
      // cuenta como guardada: su monto se muestra como dato y se abre con el
      // lápiz, igual que en los demás tipos. Sin esto, toda fila de cuota
      // parecería nueva y quedaría siempre en edición.
      const guardada = rates.find(r => r.status === 'ACTIVE' && r.programId === p.id)
      return {
        key,
        level: '' as AcademicLevel | '',
        programIds: [p.id],
        amount: captured.get(p.id) ?? vigenteAmountFor(p.id),
        ...(guardada ? { rateId: guardada.id } : {}),
        // Una fila que el usuario tiene abierta se reabre: la re-siembra cambia
        // el arreglo, no lo que la persona estaba haciendo.
        ...(editingKeys.has(key) ? { editing: true } : {}),
      }
    })
  }

  /** Monto de la tarifa `ACTIVE` que el backend tiene guardada para una carrera. */
  function vigenteAmountFor(programId: string): string {
    const current = rates.find(r => r.status === 'ACTIVE' && r.programId === programId)
    return current ? String(current.amount) : ''
  }

  /**
   * Siembra las filas con las tarifas `ACTIVE` del concepto, para los tipos que no
   * son cuota. Es el mismo criterio que sigue la cuota —las filas las define lo
   * guardado, no el usuario—, pero aquí una fila por tarifa que ya existe, y no
   * una por cada carrera: lo que todavía no está cotizado no aparece, y lo que se
   * quiera agregar se agrega con el botón.
   *
   * Cada fila guarda el `id` de su tarifa (`rateId`), que es lo que la marca como
   * fila guardada: su destino se muestra en vez de elegirse y de su monto solo se
   * puede cambiar el número.
   *
   * Lo capturado sobrevive a una re-siembra (que ocurre cuando las tarifas llegan
   * después de abrir el concepto, o cuando cambian): una fila abierta sigue
   * abierta y una fila nueva sigue en la lista. La re-siembra cambia el arreglo,
   * no lo que la persona estaba haciendo.
   */
  function seedSavedRows(prev: TarifaDraft[]): TarifaDraft[] {
    const mine = new Map(prev.map(t => [t.key, t]))
    const guardadas = ratesVigentes.map(r => {
      const key = `rate-${r.id}`
      const previa = mine.get(key)
      return {
        key,
        level: (r.level ?? '') as AcademicLevel | '',
        programIds: r.programId ? [r.programId] : [],
        amount: previa?.amount ?? String(r.amount),
        rateId: r.id,
        ...(previa?.editing ? { editing: true } : {}),
      }
    })
    // Las filas nuevas van detrás: son las que el usuario acaba de agregar y no
    // tienen equivalente guardado que las sustituyan.
    return [...guardadas, ...prev.filter(t => !t.rateId)]
  }

  /**
   * Si el backend ya tiene un precio guardado para esta fila, sea del tipo que
   * sea: por `rateId` cuando viene de la lista de tarifas (que es el caso de los
   * alcances por nivel y general, donde no hay carrera) o por carrera en cuota,
   * cuyas filas las arma el catálogo y todavía no tienen `rateId`.
   */
  function filaTienePrecio(t: TarifaDraft): boolean {
    const porRate = t.rateId ? rates.some(r => r.id === t.rateId && r.status === 'ACTIVE') : false
    return porRate || (!!t.programIds[0] && vigenteAmountFor(t.programIds[0]) !== '')
  }

  /**
   * Abre o cierra la edición de una fila de la lista.
   *
   * Solo aplica a las filas guardadas: una fila nueva se edita siempre, y una de
   * cuota sin precio también, así que para esas no hay nada que abrir.
   */
  function toggleEdicionTarifa(key: string) {
    setTarifas(prev => prev.map(t => (t.key === key ? { ...t, editing: !t.editing } : t)))
  }

  /**
   * Cierra la edición de una fila. Solo se cierra si el monto quedó válido, o si
   * el backend ya tenía un precio al que volver. Una fila que nunca tuvo precio
   * se queda en edición aunque quede vacía: volverla al modo tabla la haría
   * parecer cotizada cuando no lo está, que es justo lo que la cobertura de la
   * cuota va a rechazar después.
   */
  function cerrarEdicionTarifa(key: string) {
    setTarifas(prev => prev.map(t => {
      if (t.key !== key) return t
      const invalido = !(Number(t.amount) > 0)
      if (invalido && !filaTienePrecio(t)) return t
      return { ...t, editing: false }
    }))
  }

  /**
   * Re-siembra las filas de cuota cuando el catálogo de carreras cambia de
   * verdad, y también cuando llegan los precios del backend. La firma compara
   * ids de carrera *y* montos: con solo los ids, una lista sembrada antes de que
   * terminara la petición nunca volvería a correrse y las filas saldrían vacías
   * aunque el backend ya tuviera los precios.
   *
   * Re-siembrar varias veces es inofensivo porque `seedCuotaRows()` conserva lo
   * capturado, así que una llegada tardía de precios rellena huecos sin pisar lo
   * que la persona está escribiendo.
   */
  useEffect(() => {
    // Sin el filtro por `rateEditorVisible`: en Ver la lista también se dibuja,
    // solo que de lectura, y las filas salen del mismo catálogo. Sembrarlas
    // igual evita que la pantalla de consulta dependa de un form que ahí no se
    // puede abrir. No hay riesgo de mandar nada porque Ver no envía.
    if (!isQuota || tarifaScope !== 'PROGRAMS') return
    const signature = [
      programs.map(p => p.id).join(','),
      rates.map(r => `${r.programId}=${r.amount}${r.status}`).sort().join(','),
    ].join('|')
    if (cuotaSeedRef.current === signature) return
    cuotaSeedRef.current = signature
    setTarifas(prev => seedCuotaRows(prev))
    // Solo interesa el cambio del catálogo y del modo; `seedCuotaRows` se
    // recrea en cada render y meterlo en la dependencia lo dispararía siempre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programs, isQuota, tarifaScope, rates])

  /**
   * Siembra las filas con las tarifas guardadas, para los tipos que no son cuota.
   * Es la contraparte del efecto anterior: allá las filas las da el catálogo de
   * carreras, y acá las da lo que ya está guardado. Corre en Ver también, con la
   * lista en solo lectura, para que consultar y editar muestren los mismos datos.
   *
   * El alcance también se deduce aquí y no al abrir un editor que ya no existe: si
   * el concepto tiene tarifas, su alcance está decidido, así que se informa en
   * vez de preguntarse (ver `lockedScope`).
   */
  useEffect(() => {
    if (isRegister || isQuota || ratesLoadStatus !== 'idle') return
    const signature = rates.map(r => `${r.id}:${r.status}:${r.amount}`).sort().join(',')
    if (savedRowsRef.current === signature) return
    savedRowsRef.current = signature
    const deduced = inferScopeFromRates(rates)
    if (deduced) setTarifaScope(deduced)
    setTarifas(prev => seedSavedRows(prev))
    // `seedSavedRows` se recrea en cada render y meterlo en la dependencia lo
    // dispararía en cada uno.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRegister, isQuota, rates, ratesLoadStatus])

  /**
   * Cambio de tipo: al entrar o salir de `PERIODIC_QUOTA` el alcance de las
   * tarifas se define solo. Salir de cuota descarta los drafts porque sus filas
   * (una por carrera, con la carrera fija) no significan nada en un alcance
   * general o por nivel, y mandarlas sería un `programId` con nivel o periodo
   * que el servidor rechaza.
   */
  function changeTipo(next: PaymentConceptType | '') {
    const wasQuota = tipo === 'PERIODIC_QUOTA'
    setTipo(next)
    setErrors(prev => ({ ...prev, nivel: undefined, alcance: undefined, tarifas: undefined, tarifasByKey: undefined }))
    if (next !== 'PERIODIC_QUOTA') {
      setNivelNum('')
      if (wasQuota) {
        setTarifaScope('')
        setTarifas([])
        cuotaSeedRef.current = ''
        savedRowsRef.current = ''
      }
      return
    }
    setTarifaScope('PROGRAMS')
    // Se entra a cuota desde otro tipo: los drafts anteriores no son de cuota,
    // así que se descartan en vez de intentar heredarles un monto.
    setTarifas(seedCuotaRows([]))
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
   * combinación (concepto + programId + level), que la reconciliación rechaza
   * con `DuplicatePaymentRateException`. Es un fallo que solo se ve al guardar,
   * así que el editor lo evita en lugar de dejar que `validate()` lo descubra al
   * pulsar Registrar. La fila se excluye a sí misma para que su propia selección
   * siga disponible.
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
   * Monto del concepto cuando el alcance es GENERAL: ese monto no liga a
   * nivel ni a carrera, así que es exactamente `PaymentConcept.cost`. Con
   * alcance LEVEL o PROGRAMS el precio depende del destino y no hay un costo
   * único que defender — se deja en `null`. Una cuota periódica siempre es
   * "por carreras", así que nunca tiene costo único.
   *
   * En Ver esto no aplica: ahí no hay nada que capturar y el costo se reenvía tal
   * cual lo trajo `data.cost`.
   */
  function generalAmount(): number | null {
    if (tarifaScope !== 'GENERAL') return null
    const t = tarifas[0]
    return t && t.amount.trim() !== '' ? Number(t.amount) : null
  }

  /**
   * Aplana la lista a filas de `payment_rate`: una fila por combinación exacta
   * (concepto, programId, level) que el backend entiende. Todas las filas usan el
   * alcance de la sección, así que aquí no hay decisión por fila.
   * `undefined` en `programId`/`level` es la combinación "no liga a ninguno" y
   * desaparece del JSON al enviarse. Sin fechas: la vigencia es del concepto, y el
   * estado de cada fila lo decide el backend al comparar este conjunto contra lo
   * guardado.
   *
   * En Editar se mezclan dos cosas por destino: lo que ya está guardado y no se
   * tocó, y lo que capturó la lista. El backend reconcilia contra lo guardado y
   * **retira lo que no venga**, así que mandar solo las filas editadas dejaría sin
   * precio a todas las demás —que es justo lo que la lista muestra como si
   * siguieran vigentes—. Con la mezcla, el `PUT` llega completo: lo intacto vuelve
   * con el mismo monto y el backend conserva su id, y lo editado se registra como
   * tarifa nueva dejando la anterior como historial.
   *
   * En Registrar no hay nada guardado, así que la mezcla no aporta nada y solo
   * quedan las filas capturadas.
   */
  function expandTarifas(): PaymentRatePayload[] {
    const destinoDe = (programId: string | null | undefined, level: string | null | undefined, amount: number): PaymentRatePayload => ({
      ...(programId ? { programId } : {}),
      ...(level ? { level: level as AcademicLevel } : {}),
      amount,
    })
    // La clave es la identidad del destino en `payment_rate`: una fila por
    // combinación, no una por fila del editor.
    const porDestino = new Map<string, PaymentRatePayload>()
    for (const r of ratesVigentes) {
      porDestino.set(comboKey(r.programId, r.level), destinoDe(r.programId, r.level, r.amount))
    }
    for (const t of tarifas) {
      const amount = Number(t.amount)
      if (tarifaScope === 'LEVEL') {
        porDestino.set(comboKey(null, t.level), destinoDe(null, t.level, amount))
      } else if (tarifaScope === 'PROGRAMS') {
        for (const pid of t.programIds) porDestino.set(comboKey(pid, null), destinoDe(pid, null, amount))
      } else {
        porDestino.set(comboKey(null, null), destinoDe(null, null, amount))
      }
    }
    return [...porDestino.values()]
  }

  // Resetea el formulario al cambiar de modo/registro (mismo patrón que el
  // resto de forms CRUD del proyecto).
  useEffect(() => {
    setSubmitStatus('idle')
    setSubmitErrorMsg('')
    setErrors({})
    setNombre('')
    setCodigo('')
    setTipo('')
    setNivelNum('')
    setAreaId('')
    setDescripcion('')
    setPoliticas('')
    setTarifaScope('')
    setTarifas([])
    cuotaSeedRef.current = ''
    savedRowsRef.current = ''
    setConceptCost(null)
    setEsExterno(false)
    setCostoExterno('')
    setEsAcumulable(false)
    setEsMulticoncepto(false)
    setIsStandalone(false)
    setEsVinculados(false)
    setVinculados([])
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

  // Catálogos base: áreas (dropdown), conceptos (vinculados) y carreras
  // (tarifas). No críticos — si fallan, el selector queda vacío.
  //
  // Las carreras van por `/programs/options`, no por `/programs`: el catálogo de
  // gestión exige ADMIN o SERVICIOS_ESCOLARES y este formulario lo abre
  // PERSONAL_FINANZAS, que es justamente quien registra las cuotas. Con
  // `/programs` el selector llegaba vacío sin avisar.
  useEffect(() => {
    apiGet<PaymentAreasPageResponse>('/payment-areas', { status: 'ACTIVE', size: 100 })
      .then(data => setAreas(data.items))
      .catch(() => {/* no crítico */})
    apiGet<ConceptsPageResponse>('/payment-concepts', { status: 'ACTIVE', size: 100 })
      .then(data => setConcepts(data.items))
      .catch(() => {/* no crítico */})
    apiGet<ProgramOption[]>('/programs/options')
      .then(data => setPrograms(data))
      .catch(() => {/* no crítico */})
  }, [])

  // Tarifas: historial de precios, solo lectura, nunca en Registrar. Trae
  // tanto las `ACTIVE` como las que se retiraron en un guardado anterior, y el
  // editor de abajo se siembra con las vigentes.
  //
  // `mode` va en las dependencias a propósito, aunque no se use en el cuerpo. El
  // reset de arriba depende de él y vacía `rates`, así que si este efecto no
  // reacciona al mismo cambio, Ver → Editar dejaba el historial en "Sin tarifas
  // registradas todavía" sin volver a pedirlo: el concepto se recargaba (su
  // efecto sí depende de `mode`) y las tarifas no. Las dos cargas cambian
  // juntas o la pantalla queda a medias.
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
  }, [id, isRegister, mode])

  function programLabel(programId: string | null): string {
    if (!programId) return 'Todas las carreras'
    const p = programs.find(p => p.id === programId)
    return p ? `${p.code} — ${p.label}` : '—'
  }

  function levelLabel(level: AcademicLevel | null): string {
    if (!level) return 'Todos los niveles'
    return LEVEL_LABELS[level]
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
        setCodigo(data.code ?? '')
        setTipo(data.type)
        setNivelNum(data.levelNumber != null ? String(data.levelNumber) : '')
        setDescripcion(data.description ?? '')
        setPoliticas(data.policies ?? '')
        setConceptCost(data.cost)
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
        // Una cuota periódica guardada ya tiene su alcance decidido ("por
        // carreras") y su nivel. Se deja fijado aquí para que abrir el editor
        // no tenga que deducirlo de un historial que puede no haber cargado, y
        // para que `generalAmount()` no interprete esas filas como un alcance
        // general y derive un costo único que no existe.
        if (data.type === 'PERIODIC_QUOTA') {
          setTarifaScope('PROGRAMS')
          setTarifas([])
          cuotaSeedRef.current = ''
        }
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
    // El código se compara en mayúsculas y el backend lo guarda único por
    // collation, así que la misma clave escrita de dos formas tiene que
    // rechazarse aquí y no dos pasos más tarde como un 409 sin explicación.
    const code = codigo.trim().toUpperCase()
    if (!code) e.codigo = 'El código es obligatorio.'
    else if (!CODE_PATTERN.test(code)) {
      e.codigo = 'Usa hasta 30 caracteres: letras, números, guion o guion bajo.'
    }
    if (!tipo) e.tipo = 'Selecciona un tipo.'
    // El nivel solo existe para cuota periódica; el backend lo exige ahí y lo
    // ignora en los demás tipos, así que se manda `null` fuera de ese caso.
    if (tipo === 'PERIODIC_QUOTA') {
      if (!nivelNum.trim()) e.nivel = 'El nivel es obligatorio para una cuota periódica.'
      else if (!Number.isInteger(Number(nivelNum)) || Number(nivelNum) < 1) {
        e.nivel = 'Ingresa un número entero mayor o igual a 1.'
      }
    }
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
    // sirve para cotizar nada. En Editar son OPCIONALES —editar el nombre de un
    // concepto no debe exigir meterse a tocar precios— así que basta con que las
    // filas que haya sean válidas. Lo que no se puede es guardar con una fila a
    // medio capturar: eso sí es un error de quien está capturando.
    if (rateEditorVisible) {
      if (!tarifaScope) {
        if (isRegister) e.alcance = 'Selecciona el alcance de las tarifas.'
      } else if (tarifas.length === 0 && (isRegister || isQuota)) {
        e.tarifas = isQuota
          ? 'No hay carreras activas para cotizar. Registra una carrera o cambia el tipo de concepto.'
          : 'Agrega al menos una tarifa para poder registrar el concepto.'
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
      // porque la consecuencia es un 409 en el mejor caso, y `validate()` no
      // depende de que el editor se haya comportado bien.
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

      // Cobertura de la cuota periódica: el backend exige exactamente una tarifa
      // por cada carrera `ACTIVE` y ninguna para las que ya no lo están
      // (`PaymentQuotaCoverageChecker`). Las filas se siembran con el catálogo
      // completo, así que lo único que puede faltar son los montos — y el error
      // dice cuántos, no "algo está mal".
      if (isQuota && cuotaFaltantes > 0) {
        e.cobertura = `Faltan ${cuotaFaltantes} de ${programs.length} carreras por cotizar. Una cuota periódica necesita un monto para cada carrera activa.`
      }
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

    // Mapeo completo al backend: los switches que agrupan un valor secundario
    // (externo, límite de cuotas, vinculados) lo mandan solo cuando están
    // encendidos; apagados van a null / [].
    //
    // `cost` ya no se captura: se deriva de la tarifa de alcance GENERAL
    // (la única que aplica a todos los niveles y carreras). Con alcance
    // POR NIVEL o POR CARRERAS —y siempre en una cuota periódica— el precio
    // depende del destino, así que no hay un costo único que defender y queda
    // null: el precio vive solo en `payment_rate`.
    //
   // En Ver no hay drafts de tarifa (la lista es de solo lectura) y el costo se
   // reenvía tal como vino de la API en vez de degradar a null — un PUT con
   // `cost: null` borraría el precio de todo lo que aún lee
   // `PaymentConcept.cost`.
   //
   // La excepción en Editar es el alcance GENERAL: la fila de la lista es el
   // propio costo del concepto, así que si el usuario lo cambia, ese monto
   // ese monto pasa a ser el viejo —de lo contrario el concepto y su historial
   // de precios quedarían discrepantes.
    const generalCost = generalAmount()
    const cost = isRegister
      ? generalCost
      : generalCost !== null ? generalCost : conceptCost
    const payload: PaymentConceptFormPayload = {
      name: nombre.trim(),
      code: codigo.trim().toUpperCase(),
      description: descripcion.trim() ? sanitizeHtml(descripcion) : null,
      policies: politicas.trim() ? sanitizeHtml(politicas) : null,
      type: (tipo || 'OTHER') as PaymentConceptType,
      // El nivel pertenece al concepto, no a las tarifas: se manda solo en cuota
      // periódica, que es el único tipo que lo exige.
      levelNumber: isQuota && nivelNum.trim() !== '' ? Number(nivelNum) : null,
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

    // Las tarifas se mandan como el conjunto completo, nunca como un POST por
    // fila: el backend valida el conjunto entero antes de escribir y desactiva
    // lo que no venga, lo que además da el alta atómica (una cuota periódica no
    // puede quedar existiendo sin cotizar) y quita la necesidad de reintentar
    // un lote a medias con estado local.
    const rates = shouldSendRates ? expandTarifas() : []

    try {
      if (isRegister) {
        const created = await apiPost<PaymentConceptResponse>('/payment-concepts', {
          ...payload,
          rates,
        } as CreatePaymentConceptPayload)
        navigate(`/conceptos/form?mode=view&id=${created.id}`, { state: { toast: 'Concepto de pago registrado exitosamente.' } })
      } else if (id) {
        // El PUT del concepto y el de las tarifas son operaciones distintas y
        // no comparten transacción: si el segundo falla, el primero ya quedó.
        // Se avisa en consecuencia en vez de fingir que no se guardó nada.
        await apiPut<PaymentConceptResponse>(`/payment-concepts/${id}`, payload)

        let ratesFailed = false
        if (rates.length > 0) {
          try {
            await apiPut(`/payment-concepts/${id}/rates`, { rates })
          } catch {
            ratesFailed = true
          }
        }

        if (ratesFailed) {
          setSubmitStatus('error')
          setSubmitErrorMsg('Los datos del concepto se actualizaron, pero sus tarifas no. Vuelve a guardar para reintentar solo las tarifas.')
          return
        }

        navigate(`/conceptos/form?mode=view&id=${id}`, { state: { toast: 'Concepto de pago actualizado exitosamente.' } })
      }
    } catch (err) {
      setSubmitStatus('error')
      const apiErr = err as Partial<ApiError>
      // El mensaje del backend es el que sabe nombrar la regla que se violó
      // (nivel duplicado, cobertura incompleta, referencia inexistente), así
      // que se conserva cuando viene; los textos genéricos solo sustituyen a
      // los casos de sesión/permisos/red, donde el detalle no ayuda.
      setSubmitErrorMsg(
        apiErr.status === 409
          ? (apiErr.message ?? 'Ya existe un concepto activo con ese código o ese nivel.')
          : apiErr.status === 400
            ? (apiErr.message ?? 'Revisa los datos capturados: hay un valor inválido.')
            : apiErr.status === 401
              ? 'Tu sesión expiró. Vuelve a iniciar sesión.'
              : apiErr.status === 403
                ? 'No tienes permiso para realizar esta acción.'
                : 'No se pudo conectar con el servidor. Intenta de nuevo más tarde.'
      )
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const areaOptions = areas.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))
  const conceptOptions = concepts.filter(c => c.id !== id).map(c => ({ id: c.id, label: c.name }))
  const carreraOptions = programs.map(p => ({ id: p.id, label: `${p.code} — ${p.label}` }))

  /**
   * Solo las tarifas vigentes.
   *
   * Las `INACTIVE` son el precio que un monto anterior tuvo, y se quedan en la
   * base como historial de precios — no se borran nunca. Pero esta pantalla no
   * las muestra: son un registro de cambios, no el precio que aplica hoy, y
   * mezclarlas con las vigentes obligaba a leer la columna Estado para saber
   * cuál de dos filas era la real.
   *
   * `inferScopeFromRates()` ya filtraba por `ACTIVE` antes de este cambio, así
   * que ocultar las retiradas no altera el alcance que se deduce del historial.
   */
  const ratesVigentes = rates.filter(r => r.status === 'ACTIVE')

  /**
   * Carreras `ACTIVE` que no tienen tarifa vigente, para la cuota.
   *
   * El historial anterior se armaba con las filas de `payment_rate`, así que una
   * carrera sin fila `ACTIVE` no aparecía y el listado se veía completo cuando
   * el concepto no lo estaba — justo el estado que la cobertura rechaza al
   * guardar. Con la lista combinada eso ya no hace falta en Editar (la fila sale
   * con el monto vacío), pero en Ver sí: ahí no hay input que señale el hueco y
   * lo único que se vería es un guion.
   */
  const carrerasSinTarifa = isQuota
    ? programs.filter(p => !ratesVigentes.some(r => r.programId === p.id))
    : []

  /**
   * Alcance ya fijado por el historial, que se muestra en vez del `ScopePicker`
   * cuando existe. Solo en Editar: en Registrar no hay historial y el alcance se
   * elige ahí; en Ver no hay editor.
   *
   * `null` cuando las tarifas guardadas son de destinos mezclados o no hay
   * ninguna: en ese caso no se puede deducir y el `ScopePicker` se muestra para
   * que la sección siga teniendo un alcance con el que trabajar.
   *
   * En cuota periódica siempre es "por carreras", lo diga o no el historial: el
   * alcance lo impone el tipo, y mostrar un `ScopePicker` allí sería una
   * pregunta con una sola respuesta válida.
   */
  const lockedScope = isQuota ? 'PROGRAMS' as TarifaScope : !isRegister ? inferScopeFromRates(rates) : null

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
                label="Código"
                required={!isView}
                value={codigo}
                onChange={v => { setCodigo(v.toUpperCase()); clearErr('codigo') }}
                disabled={disabled}
                error={errors.codigo}
                placeholder="Ej. CUOTA_TSU_1"
                help="Clave única del concepto. Se guarda en mayúsculas."
                className="col-span-12 sm:col-span-4"
              />
              <TextField
                label="Nombre"
                required={!isView}
                value={nombre}
                onChange={v => { setNombre(v); clearErr('nombre') }}
                disabled={disabled}
                error={errors.nombre}
                placeholder="Ej. Cuota cuatrimestral"
                className="col-span-12 sm:col-span-8"
              />
              <SelectField
                label="Tipo"
                required={!isView}
                value={tipo}
                onChange={v => { changeTipo(v as PaymentConceptType | ''); clearErr('tipo') }}
                disabled={disabled}
                error={errors.tipo}
                options={(Object.keys(TYPE_LABELS) as PaymentConceptType[]).map(t => ({ value: t, label: TYPE_LABELS[t] }))}
                placeholder="Seleccionar tipo…"
                className="col-span-12 sm:col-span-4"
              />
              {isQuota && (
                <TextField
                  label="Nivel"
                  required={!isView}
                  value={nivelNum}
                  onChange={v => { setNivelNum(v); clearErr('nivel') }}
                  disabled={disabled}
                  error={errors.nivel}
                  type="number"
                  min={1}
                  step={1}
                  numeric
                  placeholder="Ej. 1"
                  help="Solo puede haber una cuota periódica activa por nivel."
                  className="col-span-12 sm:col-span-4"
                />
              )}
              <SelectField
                label="Área"
                required={!isView}
                value={areaId}
                onChange={v => { setAreaId(v); clearErr('areaId') }}
                disabled={disabled}
                error={errors.areaId}
                options={areaOptions}
                placeholder="Selecciona una opción"
                className={isQuota ? 'col-span-12 sm:col-span-4' : 'col-span-12'}
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
              Una sola lista en los tres modos y para todos los tipos. Lo que
              cambia es de dónde salen las filas: en cuota las arma el catálogo
              (una por carrera `ACTIVE`), y en los demás tipos son las que ya
              están guardadas, más las que se agreguen con el botón. */}
          <FormCard>
            <SectionTitle>Tarifas</SectionTitle>

            {isQuota ? (
              // ── Cuota periódica ───────────────────────────────────────────
              <>
                {/* El alcance va arriba de la lista, no debajo de tres párrafos
                    que lo explicaban: en cuota lo fija el tipo, así que no es una
                    decisión que haya que tomar sino un dato. */}
                <div className="mb-4 rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                    Alcance de las tarifas
                  </span>
                  <span className="mt-0.5 block text-[13px] font-semibold text-[#333333]">
                    Por carreras
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[#6B7280]">
                    {cuotaFaltantes === 0
                      ? `Las ${programs.length} carreras activas están cotizadas.`
                      : `${programs.length - cuotaFaltantes} de ${programs.length} carreras activas cotizadas.`}
                  </span>
                </div>

                {errors.cobertura && (
                  <div className="mb-4"><FieldError>{errors.cobertura}</FieldError></div>
                )}

                {/* Solo en Ver: en Editar y Registrar la fila sin monto ya sale
                    con su input vacío, así que el aviso sería repetir lo que la
                    lista muestra. */}
                {isView && carrerasSinTarifa.length > 0 && (
                  <p className="mb-4 flex items-start gap-1.5 text-[11px] leading-snug text-[#B45309]">
                    <Info size={12} className="mt-0.5 shrink-0" />
                    <span>
                      <span className="font-semibold">
                        Faltan tarifas para {carrerasSinTarifa.length}{' '}
                        {carrerasSinTarifa.length === 1 ? 'carrera activa' : 'carreras activas'}.
                      </span>{' '}
                      Se capturan al editar el concepto.
                    </span>
                  </p>
                )}

                {programs.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#D1D5DB] py-8 text-center">
                    <p className="text-[12px] text-[#6B7280]">
                      No hay carreras activas para cotizar. Registra una carrera o cambia el
                      tipo de concepto.
                    </p>
                  </div>
                ) : ratesLoadStatus === 'loading' ? (
                  // Mientras se leen los precios guardados, las filas todavía no
                  // los tienen: mostrarlas como "Sin cotizar" sería mentir.
                  // En Registrar no hay nada que leer y se capturan de una vez.
                  <div className="flex flex-col items-center gap-2 text-[#6B7280] py-8">
                    <Loader2 size={20} className="animate-spin text-[#009574]" />
                    <p className="text-[12px] font-medium">Cargando tarifas...</p>
                  </div>
                ) : ratesLoadStatus === 'error' ? (
                  // Igual que en los demás tipos: sin los precios guardados la
                  // lista se llenaría de "Sin cotizar" y al guardar el conjunto
                  // saldría incompleto.
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
                    No se pudieron cargar las tarifas de este concepto, así que no se pueden
                    ver aquí. Intenta de nuevo más tarde.
                  </p>
                ) : (
                  <TarifasLista
                    filas={tarifas}
                    scope={tarifaScope}
                    readOnly={isView}
                    disabled={isSubmitting}
                    errores={errors.tarifasByKey ?? {}}
                    destinoFijo
                    puedeQuitar={false}
                    labelCarrera={programLabel}
                    labelNivel={levelLabel}
                    formatMonto={a => formatCurrency(Number(a))}
                    nivelOptions={() => []}
                    carreraOptions={() => []}
                    onChange={(key, patch) => { updateTarifa(key, patch); clearTarifaErr(key) }}
                    onToggleEdicion={key => (tarifas.find(t => t.key === key)?.editing ? cerrarEdicionTarifa(key) : toggleEdicionTarifa(key))}
                    onRemove={removeTarifa}
                  />
                )}
              </>
            ) : (
              // ── Demás tipos ───────────────────────────────────────────────
              // La lista muestra las tarifas que ya están creadas, y el botón de
              // agregar está siempre a la vista para capturar otra. El mismo
              // editor de la cuota: el lápiz abre el monto de una fila y nada
              // más, porque el destino de una tarifa guardada no se cambia —se
              // cotiza otro destino como tarifa nueva—.
              <>
                {!isRegister && ratesLoadStatus === 'loading' ? (
                  // Antes de saber qué tarifas hay no se puede deducir el alcance, y
                  // mostrarlo no sería una decisión: es un dato que todavía no llegó.
                  <div className="flex flex-col items-center gap-2 text-[#6B7280] py-8">
                    <Loader2 size={20} className="animate-spin text-[#009574]" />
                    <p className="text-[12px] font-medium">Cargando tarifas...</p>
                  </div>
                ) : !isRegister && ratesLoadStatus === 'error' ? (
                  // Sin el conjunto guardado no se puede armar lo que se manda, así
                  // que la sección se bloquea en vez de capturar sobre una lista
                  // vacía: al guardar, las tarifas que ya existen se retirarían.
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
                    No se pudieron cargar las tarifas de este concepto, así que no se pueden
                    editar aquí. Intenta de nuevo más tarde.
                  </p>
                ) : (
                  <>
                    {isView && !lockedScope ? (
                      // Ver sin tarifas no tiene alcance que deducir, así que no se
                      // pregunta: el `ScopePicker` es un control de captura y en
                      // solo lectura no debe poder tocarse.
                      <div className="rounded-lg border border-dashed border-[#D1D5DB] py-8 text-center">
                        <p className="text-[12px] text-[#6B7280]">
                          Este concepto no tiene tarifas registradas.
                        </p>
                      </div>
                    ) : lockedScope ? (
                      // El alcance ya lo decidió las tarifas guardadas, así que se
                      // informa en vez de preguntarse. `selectScope()` vacía los
                      // destinos de las filas, así que dejarlo elegible en editar
                      // producía pantallas donde cambiar de tarjeta vaciaba lo
                      // capturado.
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
                        disabled={isSubmitting || isView}
                        error={errors.alcance}
                      />
                    )}

                    {tarifaScope === '' ? (
                      <div className="mt-4 rounded-lg border border-dashed border-[#D1D5DB] py-8 text-center">
                        <p className="text-[12px] text-[#6B7280]">
                          {isView
                            ? 'Este concepto no tiene tarifas registradas.'
                            : 'Selecciona un alcance para empezar a capturar tus tarifas.'}
                        </p>
                      </div>
                    ) : (
                      <>
                        {errors.tarifas && <div className="mt-4"><FieldError>{errors.tarifas}</FieldError></div>}

                        {/* La ventana se muestra UNA vez, arriba: las tarifas no tienen
                            vigencia propia, así que repetirla por fila mostraría la misma
                            fecha en todas. */}
                        {!isRegister && tarifas.length > 0 && (
                          <p className="mt-4 mb-3 text-[11px] text-[#6B7280]">
                            <span className="font-medium text-[#333333]">Disponible para pagos:</span>{' '}
                            {tieneVigencia && (availableFrom || availableUntil)
                              ? [
                                  availableFrom ? formatDate(availableFrom) : 'sin fecha inicial',
                                  availableUntil ? formatDate(availableUntil) : 'sin fecha final',
                                ].join(' – ')
                              : 'sin vigencia — disponible siempre'}
                            . Aplica a todas las tarifas del concepto.
                          </p>
                        )}

                        <div className="mt-4">
                          <TarifasLista
                            filas={tarifas}
                            scope={tarifaScope}
                            readOnly={isView}
                            disabled={isSubmitting}
                            errores={errors.tarifasByKey ?? {}}
                            destinoFijo={false}
                            puedeQuitar={!isView && tarifas.length > 1}
                            labelCarrera={programLabel}
                            labelNivel={levelLabel}
                            formatMonto={a => formatCurrency(Number(a))}
                            nivelOptions={key => {
                              const taken = takenLevelsBy(key)
                              const propia = tarifas.find(t => t.key === key)?.level
                              return (Object.keys(LEVEL_LABELS) as AcademicLevel[])
                                .filter(l => l === propia || !taken.has(l))
                            }}
                            carreraOptions={key => {
                              // Cada fila ve el catálogo menos lo que ya tomaron las
                              // demás, más su propia selección: si se filtrara, el
                              // selector la perdería y se vería en blanco.
                              const taken = takenProgramsBy(key)
                              const propias = tarifas.find(t => t.key === key)?.programIds ?? []
                              return carreraOptions.filter(o => propias.includes(o.id) || !taken.has(o.id))
                            }}
                            onChange={(key, patch) => { updateTarifa(key, patch); clearTarifaErr(key) }}
                            onToggleEdicion={key => (tarifas.find(t => t.key === key)?.editing ? cerrarEdicionTarifa(key) : toggleEdicionTarifa(key))}
                            onRemove={removeTarifa}
                          />
                        </div>

                        {/* En alcance general solo cabe un monto: no hay destino que
                            combinar, así que una fila más sería una combinación repetida
                            que el backend rechaza. */}
                        {!isView && tarifaScope !== 'GENERAL' && (
                          <div className="mt-3">
                            <Button size="sm" onClick={addTarifa} disabled={isSubmitting}>
                              <Plus size={13} />Agregar tarifa
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
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
                label="¿Tiene límite de cuotas?"
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
