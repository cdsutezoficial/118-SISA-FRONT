import { useEffect, useState } from 'react'
import { Receipt } from 'lucide-react'
import { FieldLabel, FieldHelp, FieldError, SearchSelectField, DatePicker } from '@app/core/components/ui'
import type { SelectOption } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField, SelectField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate, useSearchParams } from 'react-router'
import { apiGet, apiPost } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────
// Registers a new `PaymentRate` for a `PaymentConcept` — Fase 4 of 4 (final
// phase) of "Conceptos de Pago". There is NO edit mode for this resource: the
// history is append-only (see `118-SISA-BACK/docs/plans/2026-07-28-payment-rate.md`),
// so this screen is always registration, unlike `PlanMateriaForm.tsx`/
// `PlanEscalaForm.tsx` which support both register and edit via `?mode=`.

// `AcademicLevel` — same shared-kernel enum/labels already established in
// `ProgramasForm.tsx`/`ConceptosForm.tsx` (do not invent a second label set).
type AcademicLevel = 'TSU' | 'CONTINUIDAD' | 'INGENIERIA' | 'LICENCIATURA' | 'POSGRADO'

const LEVEL_LABELS: Record<AcademicLevel, string> = {
  TSU: 'TSU (Técnico Superior Universitario)',
  CONTINUIDAD: 'Continuidad de estudios (Ing/Lic)',
  INGENIERIA: 'Ingeniería',
  LICENCIATURA: 'Licenciatura',
  POSGRADO: 'Posgrado',
}

interface PaymentConceptSummary {
  id: string
  name: string
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

// Shape sent to `POST /payment-concepts/{conceptId}/rates` — mirrors
// `CreatePaymentRateRequest`. Optional fields are omitted (not sent as empty
// strings) when not selected, per the backend contract.
interface PaymentRateFormPayload {
  programId?: string
  level?: AcademicLevel
  amount: number
  periodId?: string
  validFrom: string
}

type FormErrors = Partial<Record<'amount' | 'validFrom', string>>

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

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ConceptosTarifaForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const conceptId = searchParams.get('conceptId')

  // ─── Field state ───────────────────────────────────────────────────────────
  const [programId, setProgramId] = useState('')
  const [level, setLevel] = useState<AcademicLevel | ''>('')
  const [periodId, setPeriodId] = useState('')
  const [amount, setAmount] = useState('')
  const [validFrom, setValidFrom] = useState('')

  // ─── Auxiliary state ───────────────────────────────────────────────────────
  const [concept, setConcept] = useState<PaymentConceptSummary | null>(null)
  const [programs, setPrograms] = useState<SelectOption[]>([])
  const [periods, setPeriods] = useState<SelectOption[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  // Missing route param — can't do anything on this screen without it.
  const missingParams = !conceptId

  // Parent concept — only needed for the header/breadcrumb context (mirrors
  // how `PlanMateriaForm.tsx` shows the parent plan's context).
  useEffect(() => {
    if (missingParams) {
      setLoadStatus('error')
      setLoadErrorMsg('Falta el concepto de pago para continuar.')
      return
    }
    let cancelled = false
    setLoadStatus('loading')
    setLoadErrorMsg('')
    apiGet<PaymentConceptSummary>(`/payment-concepts/${conceptId}`)
      .then(data => {
        if (cancelled) return
        setConcept(data)
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
  }, [conceptId, missingParams])

  // Program/period catalogs for the search-selects — same call shape as
  // ConceptosForm.tsx's Tarifas section.
  useEffect(() => {
    apiGet<ProgramsPageResponse>('/programs', { size: 100 })
      .then(data => setPrograms(data.items.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` }))))
      .catch(() => {/* non-critical — search-select will be empty */})
    apiGet<PeriodsPageResponse>('/periods', { size: 100 })
      .then(data => setPeriods(data.items.map(p => ({ value: p.id, label: p.name }))))
      .catch(() => {/* non-critical — search-select will be empty */})
  }, [])

  const disabled = loadStatus === 'loading' || loadStatus === 'error'
  const isSubmitting = submitStatus === 'submitting'

  function clearErr(field: keyof FormErrors) {
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function validate(): FormErrors {
    const e: FormErrors = {}
    const amt = Number(amount)
    if (!amount.trim()) e.amount = 'El monto es obligatorio.'
    else if (isNaN(amt) || amt <= 0) e.amount = 'Ingresa un monto válido mayor a 0.'
    if (!validFrom) e.validFrom = 'La fecha de vigencia es obligatoria.'
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

    const payload: PaymentRateFormPayload = {
      programId: programId || undefined,
      level: level || undefined,
      amount: Number(amount),
      periodId: periodId || undefined,
      validFrom,
    }

    try {
      await apiPost(`/payment-concepts/${conceptId}/rates`, payload)
      navigate(`/conceptos/form?mode=edit&id=${conceptId}`, { state: { toast: 'Tarifa registrada exitosamente.' } })
    } catch (err) {
      setSubmitStatus('error')
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 409) {
        // Backend: DuplicatePaymentRateException — exact same
        // concept/program/level/period combination already has a rate.
        setSubmitErrorMsg(apiErr.message ?? 'Ya existe una tarifa registrada para ese periodo exacto con la misma combinación de programa y nivel.')
      } else if (apiErr.status === 400) {
        // Covers InvalidPaymentRateDataException (amount<=0) and the
        // reference-not-found exceptions for conceptId/programId/periodId.
        setSubmitErrorMsg(apiErr.message ?? 'Revisa los datos capturados: el monto debe ser mayor a 0, y el concepto, programa o periodo seleccionados deben existir.')
      } else if (apiErr.status === 401) {
        setSubmitErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
      } else if (apiErr.status === 403) {
        setSubmitErrorMsg('No tienes permiso para realizar esta acción.')
      } else {
        setSubmitErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
      }
    }
  }

  function cancelUrl(): string {
    return conceptId ? `/conceptos/form?mode=edit&id=${conceptId}` : '/conceptos'
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <FormPage>
      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Conceptos de Pago', to: '/conceptos' },
          { label: concept ? concept.name : 'Detalle del Concepto', to: cancelUrl() },
          { label: 'Registrar Tarifa' },
        ]}
      />

      <FormHeader
        title="Registrar Tarifa"
        subtitle="Agrega una nueva tarifa al historial de este concepto de pago. El historial es de solo lectura: una vez registrada, una tarifa no se edita ni se borra."
      />

      {/* Load error banner */}
      {loadStatus === 'error' && loadErrorMsg && <ErrorBanner message={loadErrorMsg} />}

      {/* Submit error banner */}
      {submitStatus === 'error' && submitErrorMsg && <ErrorBanner message={submitErrorMsg} />}

      {loadStatus === 'loading' ? (
        <FormCard loading loadingLabel="Cargando información del concepto..." />
      ) : loadStatus === 'error' ? null : (
        <>
          {/* Context card */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg px-5 py-4 mb-6 flex items-center gap-3">
            <div className="p-2 rounded-md bg-[#e6f5f1]">
              <Receipt size={16} className="text-[#009574]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-0.5">Concepto de Pago</p>
              <p className="text-[13px] font-semibold text-[#333333]">{concept?.name ?? '—'}</p>
            </div>
          </div>

          {/* Form card */}
          <FormCard>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-4">Alcance de la Tarifa</p>

            <div className="grid grid-cols-12 gap-4 mb-2">
              {/* Programa */}
              <div className="col-span-12 sm:col-span-6">
                <FieldLabel>Programa</FieldLabel>
                <SearchSelectField
                  options={programs}
                  value={programId}
                  onChange={setProgramId}
                  placeholder="Todos los programas"
                  disabled={disabled}
                  searchPlaceholder="Buscar programa…"
                />
                <FieldHelp>Vacío = aplica a todos los programas.</FieldHelp>
              </div>
              {/* Nivel */}
              <SelectField
                label="Nivel"
                value={level}
                onChange={v => setLevel(v as AcademicLevel | '')}
                disabled={disabled}
                options={(Object.keys(LEVEL_LABELS) as AcademicLevel[]).map(l => ({ value: l, label: LEVEL_LABELS[l] }))}
                placeholder="Todos los niveles"
                help="Vacío = aplica a todos los niveles."
                className="col-span-12 sm:col-span-6"
              />
              {/* Periodo Académico */}
              <div className="col-span-12">
                <FieldLabel>Periodo Académico</FieldLabel>
                <SearchSelectField
                  options={periods}
                  value={periodId}
                  onChange={setPeriodId}
                  placeholder="General — sin periodo, ver ayuda"
                  disabled={disabled}
                  searchPlaceholder="Buscar periodo…"
                />
                <FieldHelp>
                  Si eliges un periodo, esta tarifa aplica SOLO a ese periodo y no afecta ninguna otra tarifa.
                  Si lo dejas vacío, esta tarifa reemplaza la vigente para la misma combinación de Programa+Nivel.
                </FieldHelp>
              </div>
            </div>

            <div className="flex items-center gap-4 my-6">
              <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest whitespace-nowrap">Monto y Vigencia</p>
              <div className="flex-1 h-px bg-[#E5E7EB]" />
            </div>

            <div className="grid grid-cols-12 gap-4">
              {/* Monto */}
              <TextField
                label="Monto"
                required
                value={amount}
                onChange={v => { setAmount(v); clearErr('amount') }}
                disabled={disabled}
                error={errors.amount}
                type="number"
                min={0}
                step="0.01"
                numeric
                placeholder="Ej. 3500.00"
                className="col-span-12 sm:col-span-6"
              />
              {/* Vigente desde */}
              <div className="col-span-12 sm:col-span-6">
                <FieldLabel required>Vigente desde</FieldLabel>
                <DatePicker
                  value={isoToDisplay(validFrom)}
                  onChange={v => { setValidFrom(displayToIso(v)); clearErr('validFrom') }}
                  disabled={disabled}
                />
                {errors.validFrom && <FieldError>{errors.validFrom}</FieldError>}
              </div>
            </div>
          </FormCard>

          {/* Actions */}
          <FormActions
            isView={false}
            onBack={() => navigate(cancelUrl())}
            onPrimary={handleSubmit}
            primaryLabel="Registrar Tarifa"
            isSubmitting={isSubmitting}
          />
        </>
      )}
    </FormPage>
  )
}