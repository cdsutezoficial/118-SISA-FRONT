import { useEffect, useState } from 'react'
import { ChevronRight, Save, X, Loader2, AlertCircle, Info } from 'lucide-react'
import { FieldLabel, FieldHelp, inputCls, SearchSelectField } from '../shared/ui'
import type { SelectOption } from '../shared/ui'
import { useNavigate } from 'react-router'
import { useFormMode } from '../shared/hooks'
import { apiGet, apiPost, apiPut } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'

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
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/generaciones')} className="hover:text-[#009574] transition-colors">Generaciones</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">
          {isRegister ? 'Registrar Generación' : 'Editar Generación'}
        </span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">
            {isRegister ? 'Registrar Generación' : 'Editar Generación'}
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {isRegister
              ? 'Define una nueva cohorte de ingreso para un plan de estudios.'
              : 'Modifica los datos de la generación.'}
          </p>
        </div>
      </div>

      {/* Load error banner (edit fetch failed) */}
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

      {/* Form card */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
        {loadStatus === 'loading' ? (
          <div className="flex flex-col items-center gap-3 text-[#6B7280] py-12">
            <Loader2 size={24} className="animate-spin text-[#009574]" />
            <p className="text-[13px] font-medium">Cargando generación...</p>
          </div>
        ) : (
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
            <div className="col-span-6 sm:col-span-3">
              <FieldLabel required>Número de Generación</FieldLabel>
              <input
                type="number"
                min={1}
                value={number}
                onChange={e => setNumber(e.target.value)}
                disabled={disabled}
                className={inputCls(disabled, false) + ' tabular-nums'}
                placeholder="Ej. 7"
              />
              <FieldHelp>Consecutivo dentro del programa — no reinicia por año.</FieldHelp>
            </div>
            {/* Código — read-only, edit mode only (server-computed) */}
            {!isRegister && (
              <div className="col-span-6 sm:col-span-3">
                <FieldLabel>Código</FieldLabel>
                <input
                  value={code}
                  disabled
                  readOnly
                  className={inputCls(true, false) + ' font-mono'}
                />
                <FieldHelp>Generado por el sistema.</FieldHelp>
              </div>
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
        )}
      </div>

      {/* Actions */}
      {loadStatus !== 'loading' && (
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            onClick={() => navigate('/generaciones')}
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
            {isRegister ? 'Registrar Generación' : 'Guardar Cambios'}
          </button>
        </div>
      )}
    </div>
  )
}
