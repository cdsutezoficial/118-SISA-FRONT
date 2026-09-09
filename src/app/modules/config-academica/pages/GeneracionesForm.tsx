import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { FieldLabel, SearchSelectField } from '@app/core/components/ui'
import type { SelectOption } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate } from 'react-router'
import { useFormMode } from '@app/core/infra/hooks'
import { apiGet, apiPost, apiPut } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────
// No "Ver Detalle" mode here — per the Figma spec (Pantalla 23), this screen
// only ever handles register/edit; any `mode` other than `register` is
// treated as edit. `code` and `status` are server-computed/assigned — the
// client NEVER sends them (unlike GruposForm.tsx's `clavePreview`, which
// computes a client-side key preview; here the code is only known once the
// backend resolves it, so on edit it's shown read-only from the GET
// response and on create it isn't shown at all).

type GenerationStatus = 'ACTIVE' | 'FINISHED'

interface GenerationResponse {
  id: string
  planId: string
  startPeriodId: string
  programId: string
  number: number
  code: string
  status: GenerationStatus
}

interface GenerationFormPayload {
  planId: string
  startPeriodId: string
  number: number
}

interface ProgramSummary {
  id: string
  name: string
  code: string
}

interface ProgramsPageResponse {
  items: ProgramSummary[]
}

interface PlanSummary {
  id: string
  programId: string
  version: string
}

interface PlansPageResponse {
  items: PlanSummary[]
}

interface PeriodSummary {
  id: string
  name: string
}

interface PeriodsPageResponse {
  items: PeriodSummary[]
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function GeneracionesForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isRegister = mode === 'register'

  const [programId, setProgramId] = useState('')
  const [planId, setPlanId] = useState('')
  const [startPeriodId, setStartPeriodId] = useState('')
  const [number, setNumber] = useState('')
  const [code, setCode] = useState('') // read-only, edit mode only — server-computed

  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [periods, setPeriods] = useState<PeriodSummary[]>([])

  // `loadStatus` covers the edit GET-by-id fetch; `submitStatus` covers the
  // register/edit POST-PUT submit — separate so a slow initial fetch doesn't
  // fight with the submit button's own loading state.
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(isRegister ? 'idle' : 'loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  useEffect(() => {
    setSubmitStatus('idle')
    setSubmitErrorMsg('')
    if (isRegister) {
      setProgramId('')
      setPlanId('')
      setStartPeriodId('')
      setNumber('')
      setCode('')
      setLoadStatus('idle')
      setLoadErrorMsg('')
    }
  }, [mode, id])

  // Programa/Plan/Periodo catalogs — fetched once, used to populate the
  // cascading selects (Programa → filters Plan) and, on edit, to preselect
  // the Programa the loaded generation's `planId` belongs to.
  useEffect(() => {
    apiGet<ProgramsPageResponse>('/programs', { size: 100 })
      .then(data => setPrograms(data.items))
      .catch(() => {/* non-critical — select just won't populate */})
    apiGet<PlansPageResponse>('/plans', { size: 200 })
      .then(data => setPlans(data.items))
      .catch(() => {/* non-critical — select just won't populate */})
    apiGet<PeriodsPageResponse>('/periods', { size: 100 })
      .then(data => setPeriods(data.items))
      .catch(() => {/* non-critical — select just won't populate */})
  }, [])

  useEffect(() => {
    if (isRegister || !id) return
    let cancelled = false
    setLoadStatus('loading')
    setLoadErrorMsg('')
    apiGet<GenerationResponse>(`/generations/${id}`)
      .then(data => {
        if (cancelled) return
        // `programId` travels denormalized on the response — no need to
        // resolve it via `planId`/`AcademicPlan`.
        setProgramId(data.programId)
        setPlanId(data.planId)
        setStartPeriodId(data.startPeriodId)
        setNumber(String(data.number))
        setCode(data.code)
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 404) {
          setLoadErrorMsg('No se encontró la generación solicitada.')
        } else if (apiErr.status === 401) {
          setLoadErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        } else if (apiErr.status === 403) {
          setLoadErrorMsg('No tienes permiso para consultar esta generación.')
        } else {
          setLoadErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode])

  const disabled = loadStatus === 'loading'
  const isSubmitting = submitStatus === 'submitting'

  const programOptions: SelectOption[] = programs.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` }))
  // Plan options are scoped to the selected Programa — cascading select,
  // same interaction pattern as GruposForm.tsx's Programa → Nivel cascade.
  const planOptions: SelectOption[] = plans
    .filter(p => p.programId === programId)
    .map(p => ({ value: p.id, label: p.version }))
  const periodOptions: SelectOption[] = periods.map(p => ({ value: p.id, label: p.name }))

  function handleProgramChange(v: string) {
    setProgramId(v)
    setPlanId('') // reset dependent select — mirrors GruposForm's Programa → Nivel reset
  }

  async function handleSubmit() {
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    const payload: GenerationFormPayload = {
      planId,
      startPeriodId,
      number: Number(number),
    }
    try {
      if (isRegister) {
        await apiPost<GenerationResponse>('/generations', payload)
        navigate('/generaciones', { state: { toast: 'Generación registrada exitosamente.' } })
      } else if (id) {
        await apiPut<GenerationResponse>(`/generations/${id}`, payload)
        navigate('/generaciones', { state: { toast: 'Generación actualizada exitosamente.' } })
      }
    } catch (err) {
      setSubmitStatus('error')
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 409) {
        // Backend: "Generation number already in use for this program: " + number.
        // Surfaced verbatim when present, same convention as ClasificacionesForm's 409 handling.
        setSubmitErrorMsg(apiErr.message ?? 'El número de generación ya está en uso para este programa.')
      } else if (apiErr.status === 400) {
        setSubmitErrorMsg(apiErr.message ?? 'Revisa los datos capturados: hay un valor inválido.')
      } else if (apiErr.status === 401) {
        setSubmitErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
      } else if (apiErr.status === 403) {
        setSubmitErrorMsg('No tienes permiso para realizar esta acción.')
      } else if (apiErr.status === 404) {
        setSubmitErrorMsg('No se encontró el plan o el periodo indicados.')
      } else {
        setSubmitErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
      }
    }
  }

  return (
    <FormPage>
      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Generaciones', to: '/generaciones' },
          { label: isRegister ? 'Registrar Generación' : 'Editar Generación' },
        ]}
      />

      <FormHeader
        title={isRegister ? 'Registrar Generación' : 'Editar Generación'}
        subtitle={isRegister
          ? 'Define una nueva cohorte de ingreso para un plan de estudios.'
          : 'Modifica los datos de la generación.'}
      />

      {/* Load error banner (edit fetch failed) */}
      {loadStatus === 'error' && loadErrorMsg && <ErrorBanner message={loadErrorMsg} />}

      {/* Submit error banner */}
      {submitStatus === 'error' && submitErrorMsg && <ErrorBanner message={submitErrorMsg} />}

      {/* Form card */}
      <FormCard loading={loadStatus === 'loading'} loadingLabel="Cargando generación...">
        <div className="grid grid-cols-12 gap-4">
          {/* Programa Educativo */}
          <div className="col-span-12 sm:col-span-6">
            <FieldLabel required>Programa Educativo</FieldLabel>
            <SearchSelectField
              options={programOptions}
              value={programId}
              onChange={handleProgramChange}
              placeholder="Selecciona el programa"
              disabled={disabled}
              searchPlaceholder="Buscar programa…"
            />
          </div>
          {/* Plan de Estudios */}
          <div className="col-span-12 sm:col-span-6">
            <FieldLabel required>Plan de Estudios</FieldLabel>
            <SearchSelectField
              options={planOptions}
              value={planId}
              onChange={setPlanId}
              placeholder="Selecciona el plan"
              disabled={disabled || !programId}
              searchPlaceholder="Buscar plan…"
            />
          </div>
          {/* Periodo de Inicio */}
          <div className="col-span-12 sm:col-span-6">
            <FieldLabel required>Periodo de Inicio</FieldLabel>
            <SearchSelectField
              options={periodOptions}
              value={startPeriodId}
              onChange={setStartPeriodId}
              placeholder="Selecciona el periodo"
              disabled={disabled}
              searchPlaceholder="Buscar periodo…"
            />
          </div>
          {/* Número de Generación */}
          <TextField
            label="Número de Generación"
            required
            type="number"
            min={1}
            value={number}
            onChange={setNumber}
            disabled={disabled}
            numeric
            placeholder="Ej. 7"
            help="Consecutivo dentro del programa — no reinicia por año."
            className="col-span-6 sm:col-span-3"
          />
          {/* Código — read-only, edit mode only (server-computed) */}
          {!isRegister && (
            <TextField
              label="Código"
              value={code}
              disabled
              readOnly
              mono
              help="Generado por el sistema."
              className="col-span-6 sm:col-span-3"
            />
          )}

          {/* Nota informativa */}
          <div className="col-span-12">
            <div className="flex items-start gap-2.5 bg-[#e6f5f1] border border-[#009574]/20 rounded-lg px-3.5 py-2.5 text-[12px] text-[#333333]">
              <Info size={15} className="flex-shrink-0 mt-0.5 text-[#009574]" />
              <span>
                El código de la generación se genera automáticamente (año del periodo de inicio + número), ej. &ldquo;2026-7&rdquo;.
                Un programa puede tener más de una generación en el mismo año.
              </span>
            </div>
          </div>
        </div>
      </FormCard>

      {/* Actions */}
      {loadStatus !== 'loading' && (
        <FormActions
          isView={false}
          onBack={() => navigate('/generaciones')}
          onPrimary={handleSubmit}
          primaryLabel={isRegister ? 'Registrar Generación' : 'Guardar Cambios'}
          isSubmitting={isSubmitting}
        />
      )}
    </FormPage>
  )
}
