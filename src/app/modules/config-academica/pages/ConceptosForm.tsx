import { useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { FieldLabel, FieldHelp, Switch, ModeSwitcher, DatePicker } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, Button, TextField, TextAreaField, SelectField, MiniTable } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate } from 'react-router'
import { useFormMode } from '@app/core/infra/hooks'
import { apiGet, apiPost, apiPut } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'

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

// ─── Date helpers ─────────────────────────────────────────────────────────────
// La API trabaja con ISO (YYYY-MM-DD); el DatePicker muestra dd/mm/yyyy — same
// pair of helpers as `PeriodosForm.tsx`.
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

  useEffect(() => {
    setSubmitStatus('idle')
    setSubmitErrorMsg('')
    if (isRegister) {
      setNombre('')
      setTipo('')
      setDescripcion('')
      setPoliticas('')
      setIsTuition(false)
      setIsStandalone(false)
      setMaxPerStudent('')
      setMaxPerPeriod('')
      setRequiresValidation(false)
      setAvailableFrom('')
      setAvailableUntil('')
      setRates([])
      setLoadStatus('idle')
      setLoadErrorMsg('')
    }
  }, [mode, id])

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
        const created = await apiPost<PaymentConceptResponse>('/payment-concepts', payload)
        navigate(`/conceptos/form?mode=view&id=${created.id}`, { state: { toast: 'Concepto de pago registrado exitosamente.' } })
      } else if (id) {
        await apiPut<PaymentConceptResponse>(`/payment-concepts/${id}`, payload)
        navigate(`/conceptos/form?mode=view&id=${id}`, { state: { toast: 'Concepto de pago actualizado exitosamente.' } })
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

  // ─── Render ────────────────────────────────────────────────────────────────

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

      {/* Load error banner (view/edit fetch failed) */}
      {loadStatus === 'error' && loadErrorMsg && <ErrorBanner message={loadErrorMsg} />}

      {/* Submit error banner */}
      {submitStatus === 'error' && submitErrorMsg && <ErrorBanner message={submitErrorMsg} />}

      {loadStatus === 'loading' ? (
        <FormCard loading loadingLabel="Cargando concepto de pago..." />
      ) : loadStatus === 'error' ? null : (
        <>
          {/* Section 1: Información básica */}
          <FormCard>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-4">Información del Concepto</p>

            <div className="grid grid-cols-12 gap-4">
              {/* Nombre */}
              <TextField
                label="Nombre del Concepto"
                required={!isView}
                value={nombre}
                onChange={setNombre}
                disabled={disabled}
                placeholder="Ej. Cuota Cuatrimestral"
                help="Nombre descriptivo del concepto de pago."
                className="col-span-12 sm:col-span-8"
              />
              {/* Tipo */}
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
              {/* Descripción */}
              <TextAreaField
                label="Descripción"
                value={descripcion}
                onChange={setDescripcion}
                disabled={disabled}
                rows={3}
                placeholder="Descripción breve del concepto de pago."
                className="col-span-12"
              />
              {/* Políticas */}
              <TextAreaField
                label="Políticas"
                value={politicas}
                onChange={setPoliticas}
                disabled={disabled}
                rows={3}
                placeholder="Políticas o reglas aplicables a este concepto."
                className="col-span-12"
              />
            </div>

            {/* Section 2: Reglas del concepto */}
            <div className="flex items-center gap-4 my-6">
              <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest whitespace-nowrap">Reglas del Concepto</p>
              <div className="flex-1 h-px bg-[#E5E7EB]" />
            </div>

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

            {/* Section 3: Límites y disponibilidad */}
            <div className="flex items-center gap-4 my-6">
              <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest whitespace-nowrap">Límites y Disponibilidad</p>
              <div className="flex-1 h-px bg-[#E5E7EB]" />
            </div>

            <div className="grid grid-cols-12 gap-4">
              {/* Máximo por estudiante */}
              <TextField
                label="Máximo por Estudiante"
                value={maxPerStudent}
                onChange={setMaxPerStudent}
                disabled={disabled}
                type="number"
                min={1}
                numeric
                placeholder="Sin límite"
                help="Vacío = ilimitado. Cantidad máxima de veces que un estudiante puede pagar este concepto."
                className="col-span-12 sm:col-span-6"
              />
              {/* Máximo por periodo */}
              <TextField
                label="Máximo por Periodo"
                value={maxPerPeriod}
                onChange={setMaxPerPeriod}
                disabled={disabled}
                type="number"
                min={1}
                numeric
                placeholder="Sin límite"
                help="Vacío = ilimitado. Cantidad máxima de veces que se puede pagar este concepto por periodo académico."
                className="col-span-12 sm:col-span-6"
              />
              {/* Disponible desde */}
              <div className="col-span-12 sm:col-span-6">
                <FieldLabel>Disponible desde</FieldLabel>
                <DatePicker
                  value={isoToDisplay(availableFrom)}
                  onChange={v => setAvailableFrom(displayToIso(v))}
                  disabled={disabled}
                />
                <FieldHelp>Opcional. Fecha a partir de la cual el concepto puede pagarse.</FieldHelp>
              </div>
              {/* Disponible hasta */}
              <div className="col-span-12 sm:col-span-6">
                <FieldLabel>Disponible hasta</FieldLabel>
                <DatePicker
                  value={isoToDisplay(availableUntil)}
                  onChange={v => setAvailableUntil(displayToIso(v))}
                  disabled={disabled}
                />
                <FieldHelp>Opcional. Fecha límite en la que el concepto deja de estar disponible.</FieldHelp>
              </div>
            </div>
          </FormCard>

          {/* Section 4: Tarifas — view/edit mode only, read-only history */}
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
                  {/* Desktop table */}
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
            </FormCard>
          )}

          {/* Actions */}
          <FormActions
            isView={isView}
            onBack={() => navigate('/conceptos')}
            onPrimary={isView ? () => navigate(`/conceptos/form?mode=edit&id=${id}`) : handleSubmit}
            primaryLabel={isView ? 'Editar' : isRegister ? 'Registrar Concepto' : 'Guardar Cambios'}
            isSubmitting={isSubmitting}
          />
        </>
      )}
    </FormPage>
  )
}