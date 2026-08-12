import { useEffect, useState } from 'react'
import { ChevronRight, Pencil, Save, X, ArrowLeft, Loader2, AlertCircle, Plus } from 'lucide-react'
import { FieldLabel, FieldHelp, inputCls, ModeSwitcher, Switch } from '../shared/ui'
import { useNavigate } from 'react-router'
import { useFormMode } from '../shared/hooks'
import { apiGet, apiPost, apiPut } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────
// `PaymentConcept` (academic_config bounded context) — Fase 3 of 4: only the
// catalog form is wired here. Tarifas (`PaymentRate`) are Fase 4 (this
// change), added as their own read-only section fed by
// `GET /payment-concepts/{id}/rates` — view/edit mode only, since a real
// `conceptId` must exist first. Estado is never edited here — same
// convention as every other wired form (Generaciones/Divisiones/Periodos):
// status changes only from the list's `Switch`.

type PaymentConceptType = 'ENROLLMENT' | 'REINSCRIPTION' | 'EXTRAORDINARY' | 'DOCUMENT' | 'OTHER'
type PaymentConceptStatus = 'ACTIVE' | 'INACTIVE'

const TYPE_LABELS: Record<PaymentConceptType, string> = {
  ENROLLMENT: 'Inscripción',
  REINSCRIPTION: 'Reinscripción',
  EXTRAORDINARY: 'Extraordinario',
  DOCUMENT: 'Documento',
  OTHER: 'Otro',
}

// `AcademicLevel` — shared-kernel enum, same labels already established in
// `ProgramasForm.tsx` (do not invent a second label set here).
type AcademicLevel = 'TSU' | 'CONTINUIDAD' | 'INGENIERIA' | 'LICENCIATURA' | 'POSGRADO'

const LEVEL_LABELS: Record<AcademicLevel, string> = {
  TSU: 'TSU (Técnico Superior Universitario)',
  CONTINUIDAD: 'Continuidad de estudios (Ing/Lic)',
  INGENIERIA: 'Ingeniería',
  LICENCIATURA: 'Licenciatura',
  POSGRADO: 'Posgrado',
}

// `PaymentRate` — append-only history, see `PaymentRateResponse` on the
// backend. `GET /payment-concepts/{id}/rates` returns a flat array, no
// pagination (low expected volume per concept).
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

// Date-only ISO strings parse as UTC midnight; build a local date to avoid
// showing the previous day in timezones west of UTC (same helper as
// `PlanDetalle.tsx`'s `formatDate`).
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = y && m && d ? new Date(y, m - 1, d) : new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

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
}

// Shape shared by POST and PUT — deliberately no `status` field, mirroring
// `CreatePaymentConceptRequest`/`UpdatePaymentConceptRequest` on the backend.
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
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ConceptosForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isView = mode === 'view'
  const isRegister = mode === 'register'

  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<PaymentConceptType | ''>('')
  const [descripcion, setDescripcion] = useState('')
  const [politicas, setPoliticas] = useState('')
  const [isTuition, setIsTuition] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [maxPerStudent, setMaxPerStudent] = useState('')
  const [maxPerPeriod, setMaxPerPeriod] = useState('')
  const [requiresValidation, setRequiresValidation] = useState(false)
  const [availableFrom, setAvailableFrom] = useState('')
  const [availableUntil, setAvailableUntil] = useState('')

  // `loadStatus` covers the view/edit GET-by-id fetch; `submitStatus` covers
  // the register/edit POST-PUT submit — separate so a slow initial fetch
  // doesn't fight with the submit button's own loading state.
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(isRegister ? 'idle' : 'loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  // ─── Tarifas (Fase 4) ────────────────────────────────────────────────────
  // View/edit mode only — never in Registrar, since a real conceptId must
  // already exist (same reasoning as `DirectorField` in `DivisionesForm.tsx`).
  const [rates, setRates] = useState<PaymentRateItem[]>([])
  const [ratesLoadStatus, setRatesLoadStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [periods, setPeriods] = useState<PeriodSummary[]>([])

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

  // Program/period catalogs to resolve rates[].programId/periodId labels —
  // same in-memory `.find()` pattern already used in
  // GeneracionesList.tsx/GruposList.tsx. Only needed alongside the Tarifas
  // section, so skipped entirely in Registrar mode.
  useEffect(() => {
    if (isRegister) return
    apiGet<ProgramsPageResponse>('/programs', { size: 100 })
      .then(data => setPrograms(data.items))
      .catch(() => {/* non-critical — programLabel() falls back to '—' */})
    apiGet<PeriodsPageResponse>('/periods', { size: 100 })
      .then(data => setPeriods(data.items))
      .catch(() => {/* non-critical — periodLabel() falls back to '—' */})
  }, [isRegister])

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
        setIsTuition(data.isTuition)
        setIsStandalone(data.isStandalone)
        setMaxPerStudent(data.maxPerStudent != null ? String(data.maxPerStudent) : '')
        setMaxPerPeriod(data.maxPerPeriod != null ? String(data.maxPerPeriod) : '')
        setRequiresValidation(data.requiresValidation)
        setAvailableFrom(data.availableFrom ?? '')
        setAvailableUntil(data.availableUntil ?? '')
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

  const disabled = isView || loadStatus === 'loading'
  const isSubmitting = submitStatus === 'submitting'

  async function handleSubmit() {
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    const payload: PaymentConceptFormPayload = {
      name: nombre,
      description: descripcion.trim() || null,
      policies: politicas.trim() || null,
      type: tipo as PaymentConceptType,
      isTuition,
      isStandalone,
      maxPerStudent: maxPerStudent.trim() === '' ? null : Number(maxPerStudent),
      maxPerPeriod: maxPerPeriod.trim() === '' ? null : Number(maxPerPeriod),
      requiresValidation,
      availableFrom: availableFrom || null,
      availableUntil: availableUntil || null,
    }
    try {
      if (isRegister) {
        await apiPost<PaymentConceptResponse>('/payment-concepts', payload)
        navigate('/conceptos', { state: { toast: 'Concepto de pago registrado exitosamente.' } })
      } else if (id) {
        await apiPut<PaymentConceptResponse>(`/payment-concepts/${id}`, payload)
        navigate('/conceptos', { state: { toast: 'Concepto de pago actualizado exitosamente.' } })
      }
    } catch (err) {
      setSubmitStatus('error')
      const apiErr = err as Partial<ApiError>
      // No 409 branch: unlike some siblings (Divisiones, Clasificaciones),
      // `PaymentConcept.name` has no uniqueness constraint — the backend
      // never returns a conflict for this aggregate.
      if (apiErr.status === 400) {
        setSubmitErrorMsg(apiErr.message ?? 'Revisa los datos capturados: hay un valor inválido (máximos por estudiante/periodo deben ser mayores a 0, y la fecha "desde" no puede ser posterior a "hasta").')
      } else if (apiErr.status === 401) {
        setSubmitErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
      } else if (apiErr.status === 403) {
        setSubmitErrorMsg('No tienes permiso para realizar esta acción.')
      } else {
        setSubmitErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
      }
    }
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/conceptos')} className="hover:text-[#009574] transition-colors">Conceptos de Pago</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">
          {isRegister ? 'Registrar Concepto' : isView ? 'Ver Concepto' : 'Editar Concepto'}
        </span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">
            {isRegister ? 'Registrar Concepto de Pago' : isView ? 'Ver Concepto de Pago' : 'Editar Concepto de Pago'}
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {isRegister ? 'Completa los campos para registrar un nuevo concepto de pago.' :
             isView ? 'Información del concepto de pago.' :
             'Modifica los datos del concepto de pago.'}
          </p>
        </div>
        <ModeSwitcher
          mode={mode}
          registerUrl="/conceptos/new"
          formUrl={m => `/conceptos/form?mode=${m}&id=${id}`}
        />
      </div>

      {/* Load error banner (view/edit fetch failed) */}
      {loadStatus === 'error' && loadErrorMsg && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mb-4">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {loadErrorMsg}
        </div>
      )}

      {/* Submit error banner */}
      {submitStatus === 'error' && submitErrorMsg && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mb-4">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {submitErrorMsg}
        </div>
      )}

      {loadStatus === 'loading' ? (
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6 flex flex-col items-center gap-3 text-[#6B7280] py-12">
          <Loader2 size={24} className="animate-spin text-[#009574]" />
          <p className="text-[13px] font-medium">Cargando concepto de pago...</p>
        </div>
      ) : (
        <>
          {/* Section 1: Información básica */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-4">
            <h2 className="text-[13px] font-semibold text-[#333333] mb-4">Información del Concepto</h2>
            <div className="grid grid-cols-12 gap-4">
              {/* Nombre */}
              <div className="col-span-12 sm:col-span-8">
                <FieldLabel required={!isView}>Nombre del Concepto</FieldLabel>
                <input
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  disabled={disabled}
                  className={inputCls(disabled, false)}
                  placeholder="Ej. Cuota Cuatrimestral"
                />
                <FieldHelp>Nombre descriptivo del concepto de pago.</FieldHelp>
              </div>
              {/* Tipo */}
              <div className="col-span-12 sm:col-span-4">
                <FieldLabel required={!isView}>Tipo</FieldLabel>
                <select
                  value={tipo}
                  onChange={e => setTipo(e.target.value as PaymentConceptType)}
                  disabled={disabled}
                  className={inputCls(disabled, false) + ' appearance-none'}
                >
                  <option value="">Seleccionar tipo…</option>
                  {(Object.keys(TYPE_LABELS) as PaymentConceptType[]).map(t => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              {/* Descripción */}
              <div className="col-span-12">
                <FieldLabel>Descripción</FieldLabel>
                <textarea
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  disabled={disabled}
                  rows={3}
                  className={inputCls(disabled, false) + ' resize-none'}
                  placeholder="Descripción breve del concepto de pago."
                />
              </div>
              {/* Políticas */}
              <div className="col-span-12">
                <FieldLabel>Políticas</FieldLabel>
                <textarea
                  value={politicas}
                  onChange={e => setPoliticas(e.target.value)}
                  disabled={disabled}
                  rows={3}
                  className={inputCls(disabled, false) + ' resize-none'}
                  placeholder="Políticas o reglas aplicables a este concepto."
                />
              </div>
            </div>
          </div>

          {/* Section 2: Reglas del concepto */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-4">
            <h2 className="text-[13px] font-semibold text-[#333333] mb-4">Reglas del Concepto</h2>
            <div className="grid grid-cols-12 gap-4">
              {/* Es cuota cuatrimestral */}
              <div className="col-span-12 sm:col-span-6 flex items-start gap-3">
                <Switch checked={isTuition} onChange={setIsTuition} disabled={disabled} />
                <div>
                  <FieldLabel>Es cuota cuatrimestral</FieldLabel>
                  <FieldHelp>Marca este concepto como la cuota periódica regular.</FieldHelp>
                </div>
              </div>
              {/* Es exclusivo del carrito */}
              <div className="col-span-12 sm:col-span-6 flex items-start gap-3">
                <Switch checked={isStandalone} onChange={setIsStandalone} disabled={disabled} />
                <div>
                  <FieldLabel>Es exclusivo del carrito</FieldLabel>
                  <FieldHelp>No se puede combinar con otros conceptos en el mismo carrito de pago.</FieldHelp>
                </div>
              </div>
              {/* Requiere validación de entrega */}
              <div className="col-span-12 sm:col-span-6 flex items-start gap-3">
                <Switch checked={requiresValidation} onChange={setRequiresValidation} disabled={disabled} />
                <div>
                  <FieldLabel>Requiere validación de entrega</FieldLabel>
                  <FieldHelp>El pago requiere que personal de Finanzas valide un comprobante o entrega.</FieldHelp>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Límites y disponibilidad */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
            <h2 className="text-[13px] font-semibold text-[#333333] mb-4">Límites y Disponibilidad</h2>
            <div className="grid grid-cols-12 gap-4">
              {/* Máximo por estudiante */}
              <div className="col-span-12 sm:col-span-6">
                <FieldLabel>Máximo por Estudiante</FieldLabel>
                <input
                  type="number"
                  min={1}
                  value={maxPerStudent}
                  onChange={e => setMaxPerStudent(e.target.value)}
                  disabled={disabled}
                  className={inputCls(disabled, false)}
                  placeholder="Sin límite"
                />
                <FieldHelp>Vacío = ilimitado. Cantidad máxima de veces que un estudiante puede pagar este concepto.</FieldHelp>
              </div>
              {/* Máximo por periodo */}
              <div className="col-span-12 sm:col-span-6">
                <FieldLabel>Máximo por Periodo</FieldLabel>
                <input
                  type="number"
                  min={1}
                  value={maxPerPeriod}
                  onChange={e => setMaxPerPeriod(e.target.value)}
                  disabled={disabled}
                  className={inputCls(disabled, false)}
                  placeholder="Sin límite"
                />
                <FieldHelp>Vacío = ilimitado. Cantidad máxima de veces que se puede pagar este concepto por periodo académico.</FieldHelp>
              </div>
              {/* Disponible desde */}
              <div className="col-span-12 sm:col-span-6">
                <FieldLabel>Disponible desde</FieldLabel>
                <input
                  type="date"
                  value={availableFrom}
                  onChange={e => setAvailableFrom(e.target.value)}
                  disabled={disabled}
                  className={inputCls(disabled, false)}
                />
                <FieldHelp>Opcional. Fecha a partir de la cual el concepto puede pagarse.</FieldHelp>
              </div>
              {/* Disponible hasta */}
              <div className="col-span-12 sm:col-span-6">
                <FieldLabel>Disponible hasta</FieldLabel>
                <input
                  type="date"
                  value={availableUntil}
                  onChange={e => setAvailableUntil(e.target.value)}
                  disabled={disabled}
                  className={inputCls(disabled, false)}
                />
                <FieldHelp>Opcional. Fecha límite en la que el concepto deja de estar disponible.</FieldHelp>
              </div>
            </div>
          </div>

          {/* Section 4: Tarifas — view/edit mode only, read-only history */}
          {!isRegister && (
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[13px] font-semibold text-[#333333]">Tarifas</h2>
                <button
                  type="button"
                  onClick={() => navigate(`/conceptos/tarifa/form?conceptId=${id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
                >
                  <Plus size={13} />Agregar Tarifa
                </button>
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
                  {/* Desktop table */}
                  <div className="hidden md:block border border-[#E5E7EB] rounded-lg overflow-hidden">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="bg-[#F8F9FA] border-b border-[#E5E7EB]">
                          <th className="text-left px-4 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Programa</th>
                          <th className="text-left px-4 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Nivel</th>
                          <th className="text-left px-4 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Periodo</th>
                          <th className="text-right px-4 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Monto</th>
                          <th className="text-left px-4 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Vigencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rates.map(r => (
                          <tr key={r.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                            <td className="px-4 py-2.5 text-[#333333]">{programLabel(r.programId)}</td>
                            <td className="px-4 py-2.5 text-[#333333]">{levelLabel(r.level)}</td>
                            <td className="px-4 py-2.5 text-[#333333]">{periodLabel(r.periodId)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-medium text-[#333333]">{formatCurrency(r.amount)}</td>
                            <td className="px-4 py-2.5">
                              {r.validTo ? (
                                <span className="tabular-nums text-[#333333]">{formatDate(r.validFrom)} – {formatDate(r.validTo)}</span>
                              ) : (
                                <span className="inline-flex items-center gap-2">
                                  <span className="tabular-nums text-[#333333]">{formatDate(r.validFrom)}</span>
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Vigente</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
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
            </div>
          )}
        </>
      )}

      {/* Actions */}
      {loadStatus !== 'loading' && (
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          {isView ? (
            <>
              <button
                onClick={() => navigate('/conceptos')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
              >
                <ArrowLeft size={14} />Regresar
              </button>
              <button
                onClick={() => navigate(`/conceptos/form?mode=edit&id=${id}`)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
              >
                <Pencil size={14} />Editar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/conceptos')}
                disabled={isSubmitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X size={14} />Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {isRegister ? 'Registrar Concepto' : 'Guardar Cambios'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
