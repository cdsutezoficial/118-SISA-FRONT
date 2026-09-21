import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Loader2, Plus, Search, X, Check, ChevronDown } from 'lucide-react'
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
// spec del usuario: Datos Generales (Nombre, Área, Costo, Descripción,
// Políticas) + Configuración del Concepto (switches) + Tarifas (view/edit).
//
// El API ya persiste TODOS los campos del spec (ver plan backend
// `2026-09-19-payment-concept-extension.md`): areaId, cost, costExternal,
// isExternal, isAccumulable, isMulticoncept, linkedConceptIds, programIds y
// quotaLimit. El mapeo estado local ↔ payload está en `handleSubmit`/carga.

type PaymentConceptType = 'ENROLLMENT' | 'REINSCRIPTION' | 'EXTRAORDINARY' | 'DOCUMENT' | 'OTHER'
type PaymentConceptStatus = 'ACTIVE' | 'INACTIVE'

// `AcademicLevel` — shared-kernel enum, mismo set de labels que
// `ProgramasForm.tsx` (usado solo por la tabla de Tarifas).
type AcademicLevel = 'TSU' | 'CONTINUIDAD' | 'INGENIERIA' | 'LICENCIATURA' | 'POSGRADO'

const LEVEL_LABELS: Record<AcademicLevel, string> = {
  TSU: 'TSU (Técnico Superior Universitario)',
  CONTINUIDAD: 'Continuidad de estudios (Ing/Lic)',
  INGENIERIA: 'Ingeniería',
  LICENCIATURA: 'Licenciatura',
  POSGRADO: 'Posgrado',
}

const TYPE_LABELS: Record<PaymentConceptType, string> = {
  ENROLLMENT: 'Inscripción',
  REINSCRIPTION: 'Reinscripción',
  EXTRAORDINARY: 'Extraordinario',
  DOCUMENT: 'Documento',
  OTHER: 'Otro',
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
  programIds: string[]
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
  programIds: string[]
}

interface FormErrors {
  nombre?: string
  areaId?: string
  costo?: string
  costoExterno?: string
  limiteCuotas?: string
  vigencia?: string
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
  const [costo, setCosto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [politicas, setPoliticas] = useState('')

  // ─── Configuración del Concepto ───────────────────────────────────────────
  const [esExterno, setEsExterno] = useState(false)
  const [costoExterno, setCostoExterno] = useState('')
  const [esAcumulable, setEsAcumulable] = useState(false)
  const [esMulticoncepto, setEsMulticoncepto] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [esVinculados, setEsVinculados] = useState(false)
  const [vinculados, setVinculados] = useState<string[]>([])
  const [esCuotaCuatrimestral, setEsCuotaCuatrimestral] = useState(false)
  const [aplicaCarrera, setAplicaCarrera] = useState(false)
  const [carreras, setCarreras] = useState<string[]>([])
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

  // Resetea el formulario al cambiar de modo/registro (mismo patrón que el
  // resto de forms CRUD del proyecto).
  useEffect(() => {
    setSubmitStatus('idle')
    setSubmitErrorMsg('')
    setErrors({})
    setNombre('')
    setTipo('')
    setAreaId('')
    setCosto('')
    setDescripcion('')
    setPoliticas('')
    setEsExterno(false)
    setCostoExterno('')
    setEsAcumulable(false)
    setEsMulticoncepto(false)
    setIsStandalone(false)
    setEsVinculados(false)
    setVinculados([])
    setEsCuotaCuatrimestral(false)
    setAplicaCarrera(false)
    setCarreras([])
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
    if (!programId) return 'Todos los programas'
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
        setEsCuotaCuatrimestral(data.isTuition)
        setIsStandalone(data.isStandalone)
        setRequiereValidacion(data.requiresValidation)
        setMaxPerStudent(data.maxPerStudent != null ? String(data.maxPerStudent) : '')
        setMaxPerPeriod(data.maxPerPeriod != null ? String(data.maxPerPeriod) : '')
        setTieneVigencia(!!(data.availableFrom || data.availableUntil))
        setAvailableFrom(data.availableFrom ?? '')
        setAvailableUntil(data.availableUntil ?? '')
        setAreaId(data.areaId ?? '')
        setCosto(data.cost != null ? String(data.cost) : '')
        setEsExterno(data.isExternal)
        setCostoExterno(data.costExternal != null ? String(data.costExternal) : '')
        setEsAcumulable(data.isAccumulable)
        setEsMulticoncepto(data.isMulticoncept)
        setLimiteCuotasOn(data.quotaLimit != null)
        setLimiteCuotas(data.quotaLimit != null ? String(data.quotaLimit) : '')
        const linked = data.linkedConceptIds ?? []
        const carrerasSeleccionadas = data.programIds ?? []
        setEsVinculados(linked.length > 0)
        setVinculados(linked)
        setAplicaCarrera(carrerasSeleccionadas.length > 0)
        setCarreras(carrerasSeleccionadas)
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
    if (!costo.trim()) e.costo = 'El costo es obligatorio.'
    else if (Number.isNaN(Number(costo)) || Number(costo) < 0) e.costo = 'Ingresa un costo válido.'
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

    // Mapeo completo al backend (extensión 2026-09-19): los switches que
    // agrupan un valor secundario (externo, límite de cuotas, vinculados,
    // carreras) lo mandan solo cuando están encendidos; apagados van a
    // null / [].
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
      cost: costo.trim() === '' ? null : Number(costo),
      isExternal: esExterno,
      costExternal: esExterno && costoExterno.trim() !== '' ? Number(costoExterno) : null,
      isAccumulable: esAcumulable,
      isMulticoncept: esMulticoncepto,
      quotaLimit: limiteCuotasOn && limiteCuotas.trim() !== '' ? Number(limiteCuotas) : null,
      linkedConceptIds: esVinculados ? vinculados : [],
      programIds: aplicaCarrera ? carreras : [],
    }

    try {
      if (isRegister) {
        const created = await apiPost<PaymentConceptResponse>('/payment-concepts', payload)
        navigate(`/conceptos/form?mode=view&id=${created.id}`, { state: { toast: 'Concepto de pago registrado exitosamente.' } })
      } else if (id) {
        await apiPut<PaymentConceptResponse>(`/payment-concepts/${id}`, payload)
        navigate(`/conceptos/form?mode=view&id=${id}`, { state: { toast: 'Concepto de pago actualizado exitosamente.' } })
      }
    } catch (err) {
      setSubmitStatus('error')
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 400) {
        setSubmitErrorMsg(apiErr.message ?? 'Revisa los datos capturados: hay un valor inválido.')
      } else if (apiErr.status === 401) {
        setSubmitErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
      } else if (apiErr.status === 403) {
        setSubmitErrorMsg('No tienes permiso para realizar esta acción.')
      } else {
        setSubmitErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
      }
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const areaOptions = areas.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))
  const conceptOptions = concepts.filter(c => c.id !== id).map(c => ({ id: c.id, label: c.name }))
  const carreraOptions = programs.map(p => ({ id: p.id, label: `${p.code} — ${p.name}` }))

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
                className="col-span-12 sm:col-span-6"
              />
              <TextField
                label="Costo del concepto"
                required={!isView}
                value={costo}
                onChange={v => { setCosto(v); clearErr('costo') }}
                disabled={disabled}
                error={errors.costo}
                type="number"
                min={0}
                step="0.01"
                numeric
                prefix="$"
                placeholder="0.00"
                className="col-span-12 sm:col-span-6"
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
                label="¿Aplica para alguna carrera en específico?"
                description="Si el concepto aplica para ciertas carreras en específico, debes indicar las carreras a las que aplica."
                checked={aplicaCarrera}
                onChange={setAplicaCarrera}
                disabled={disabled}
              >
                <MultiSelectField
                  label="Carreras"
                  options={carreraOptions}
                  selected={carreras}
                  onChange={setCarreras}
                  disabled={disabled}
                  placeholder="Seleccionar carreras…"
                />
              </SwitchRow>

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

          {/* ── Tarifas — view/edit únicamente, historial de solo lectura ─────── */}
          {!isRegister && (
            <FormCard>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest">Tarifas</p>
                <Button size="sm" onClick={() => navigate(`/conceptos/tarifa/form?conceptId=${id}`)}>
                  <Plus size={13} />Agregar Tarifa
                </Button>
              </div>

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
                  <div className="hidden md:block border border-[#E5E7EB] rounded-lg overflow-hidden">
                    <MiniTable
                      columns={[
                        { key: 'programa', header: 'Programa', render: r => <span className="text-[#333333]">{programLabel(r.programId)}</span> },
                        { key: 'nivel', header: 'Nivel', render: r => <span className="text-[#333333]">{levelLabel(r.level)}</span> },
                        { key: 'periodo', header: 'Periodo', render: r => <span className="text-[#333333]">{periodLabel(r.periodId)}</span> },
                        { key: 'monto', header: 'Monto', className: 'text-right tabular-nums', render: r => <span className="font-medium text-[#333333]">{formatCurrency(r.amount)}</span> },
                        {
                          key: 'vigencia', header: 'Vigencia',
                          render: r => (
                            r.validTo ? (
                              <span className="tabular-nums text-[#333333]">{formatDate(r.validFrom)} – {formatDate(r.validTo)}</span>
                            ) : (
                              <span className="inline-flex items-center gap-2">
                                <span className="tabular-nums text-[#333333]">{formatDate(r.validFrom)}</span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Vigente</span>
                              </span>
                            )
                          ),
                        },
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
                          {r.validTo ? (
                            <span className="text-[11px] text-[#6B7280] tabular-nums">{formatDate(r.validFrom)} – {formatDate(r.validTo)}</span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Vigente</span>
                          )}
                        </div>
                        <p className="text-[12px] text-[#6B7280]">{programLabel(r.programId)} · {levelLabel(r.level)}</p>
                        <p className="text-[12px] text-[#6B7280]">{periodLabel(r.periodId)}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </FormCard>
          )}

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
