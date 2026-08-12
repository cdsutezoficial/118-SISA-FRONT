import { useEffect, useState } from 'react'
import { ChevronRight, Pencil, Save, X, Loader2, AlertCircle } from 'lucide-react'
import { FieldLabel, FieldHelp, inputCls, ModeSwitcher, SearchSelectField } from '../shared/ui'
import type { SelectOption } from '../shared/ui'
import { useNavigate } from 'react-router'
import { useFormMode } from '../shared/hooks'
import { apiGet, apiPost, apiPut } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────
// `Group` per the corrected Pantalla 9 (2026-07-27): Programa Educativo is a
// UI-ONLY cascading filter that narrows the Generación options — it is NEVER
// sent to the backend. `Group.programId` is always resolved server-side from
// `generationId`'s owning `Generation.programId` (denormalized), same as
// `CreateGroupRequest`/`UpdateGroupRequest` deliberately omitting it. Nivel
// del Plan depends on the selected Generación (not on Programa directly),
// because `Generation.planId` already fixes one specific study plan — a
// Generación cannot have levels from a different plan. `PlanLevel` has no
// standalone catalog endpoint; the only way to read a plan's levels is
// `GET /plans/{id}` (see `PlanForm.tsx`), so once a Generación is picked its
// `planId` is used to fetch that one plan and populate the Nivel select.
// Status (Abierto/Cerrado) is never edited here — only from the list
// (`GruposList.tsx`'s Switch), same convention as Generaciones/Periodos.

type Shift = 'MORNING' | 'AFTERNOON' | 'MIXED'
type GroupStatus = 'OPEN' | 'CLOSED'

const SHIFT_OPTIONS: { value: Shift; label: string }[] = [
  { value: 'MORNING', label: 'Matutino' },
  { value: 'AFTERNOON', label: 'Vespertino' },
  { value: 'MIXED', label: 'Mixto' },
]

interface GroupResponse {
  id: string
  generationId: string
  periodId: string
  planLevelId: string
  programId: string
  code: string
  maxCapacity: number
  shift: Shift
  status: GroupStatus
}

interface GroupFormPayload {
  generationId: string
  periodId: string
  planLevelId: string
  code: string
  maxCapacity: number
  shift: Shift
}

interface ProgramSummary {
  id: string
  name: string
  code: string
}

interface ProgramsPageResponse {
  items: ProgramSummary[]
}

interface GenerationSummary {
  id: string
  code: string
  programId: string
  planId: string
}

interface GenerationsPageResponse {
  items: GenerationSummary[]
}

interface PeriodSummary {
  id: string
  name: string
}

interface PeriodsPageResponse {
  items: PeriodSummary[]
}

interface PlanLevelSummary {
  id: string
  levelNumber: number
  description: string | null
}

interface AcademicPlanDetail {
  id: string
  levels: PlanLevelSummary[]
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function GruposForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isRegister = mode === 'register'
  const isView = mode === 'view'

  const [programId, setProgramId] = useState('') // UI-only filter, never submitted
  const [generationId, setGenerationId] = useState('')
  const [periodId, setPeriodId] = useState('')
  const [planLevelId, setPlanLevelId] = useState('')
  const [shift, setShift] = useState<Shift | ''>('')
  const [code, setCode] = useState('')
  const [maxCapacity, setMaxCapacity] = useState('')

  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [generations, setGenerations] = useState<GenerationSummary[]>([])
  const [periods, setPeriods] = useState<PeriodSummary[]>([])
  const [planLevels, setPlanLevels] = useState<PlanLevelSummary[]>([])

  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(isRegister ? 'idle' : 'loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  // Programa/Generación/Periodo catalogs — fetched once, used to populate the
  // cascading selects (Programa → filters Generación) and to resolve the
  // Generación's `planId` for the Nivel select.
  useEffect(() => {
    apiGet<ProgramsPageResponse>('/programs', { size: 100 })
      .then(data => setPrograms(data.items))
      .catch(() => {/* non-critical — select just won't populate */})
    apiGet<GenerationsPageResponse>('/generations', { size: 200 })
      .then(data => setGenerations(data.items))
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
    apiGet<GroupResponse>(`/groups/${id}`)
      .then(data => {
        if (cancelled) return
        // `programId` travels denormalized on the response — used directly
        // to preselect the Programa filter, no extra lookup through
        // Generación needed.
        setProgramId(data.programId)
        setGenerationId(data.generationId)
        setPeriodId(data.periodId)
        setPlanLevelId(data.planLevelId)
        setShift(data.shift)
        setCode(data.code)
        setMaxCapacity(String(data.maxCapacity))
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 404) {
          setLoadErrorMsg('No se encontró el grupo solicitado.')
        } else if (apiErr.status === 401) {
          setLoadErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        } else if (apiErr.status === 403) {
          setLoadErrorMsg('No tienes permiso para consultar este grupo.')
        } else {
          setLoadErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode])

  // Fetches the selected Generación's plan levels. Re-runs both on a manual
  // Generación change AND once the `generations` catalog finishes loading
  // (needed to backfill on edit, since the GET-by-id fetch above sets
  // `generationId` before the catalog necessarily has that generation yet).
  useEffect(() => {
    if (!generationId) { setPlanLevels([]); return }
    const generation = generations.find(g => g.id === generationId)
    if (!generation) return
    let cancelled = false
    apiGet<AcademicPlanDetail>(`/plans/${generation.planId}`)
      .then(data => { if (!cancelled) setPlanLevels(data.levels) })
      .catch(() => { if (!cancelled) setPlanLevels([]) })
    return () => { cancelled = true }
  }, [generationId, generations])

  const disabled = loadStatus === 'loading' || isView
  const isSubmitting = submitStatus === 'submitting'

  const programOptions: SelectOption[] = programs.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` }))
  const generationOptions: SelectOption[] = generations
    .filter(g => g.programId === programId)
    .map(g => ({ value: g.id, label: g.code }))
  const periodOptions: SelectOption[] = periods.map(p => ({ value: p.id, label: p.name }))
  const planLevelOptions: SelectOption[] = planLevels
    .slice()
    .sort((a, b) => a.levelNumber - b.levelNumber)
    .map(l => ({ value: l.id, label: `Nivel ${l.levelNumber}${l.description ? ` — ${l.description}` : ''}` }))

  function handleProgramChange(v: string) {
    setProgramId(v)
    setGenerationId('') // reset dependent selects
    setPlanLevelId('')
  }

  function handleGenerationChange(v: string) {
    setGenerationId(v)
    setPlanLevelId('') // reset dependent select — its plan may have changed
  }

  async function handleSubmit() {
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    const payload: GroupFormPayload = {
      generationId,
      periodId,
      planLevelId,
      code,
      maxCapacity: Number(maxCapacity),
      shift: shift as Shift,
    }
    try {
      if (isRegister) {
        await apiPost<GroupResponse>('/groups', payload)
        navigate('/grupos', { state: { toast: 'Grupo registrado exitosamente.' } })
      } else if (id) {
        await apiPut<GroupResponse>(`/groups/${id}`, payload)
        navigate('/grupos', { state: { toast: 'Grupo actualizado exitosamente.' } })
      }
    } catch (err) {
      setSubmitStatus('error')
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 400) {
        // Backend: GenerationReferenceNotFoundException ("Generation not
        // found: ...") or PeriodNotFoundException ("Period not found: ...")
        // — both map to 400. Message forwarded verbatim when present.
        setSubmitErrorMsg(apiErr.message ?? 'Revisa la Generación y el Periodo seleccionados: alguno no es válido.')
      } else if (apiErr.status === 404) {
        // Backend: PlanLevelNotFoundException — the selected Nivel doesn't
        // belong to the Generación's plan.
        setSubmitErrorMsg(apiErr.message ?? 'El nivel seleccionado no pertenece al plan de la generación.')
      } else if (apiErr.status === 401) {
        setSubmitErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
      } else if (apiErr.status === 403) {
        setSubmitErrorMsg('No tienes permiso para realizar esta acción.')
      } else {
        setSubmitErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
      }
    }
  }

  const title = isRegister ? 'Registrar Grupo' : isView ? 'Ver Grupo' : 'Editar Grupo'
  const description = isRegister
    ? 'Define un nuevo grupo para el periodo académico.'
    : isView
      ? 'Información del grupo académico.'
      : 'Modifica los datos del grupo académico.'

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/grupos')} className="hover:text-[#009574] transition-colors">Grupos</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">{title}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">{title}</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">{description}</p>
        </div>
        {!isRegister && id && (
          <ModeSwitcher mode={mode} registerUrl="/grupos/new" formUrl={m => `/grupos/form?mode=${m}&id=${id}`} />
        )}
      </div>

      {/* Load error banner (edit/view fetch failed) */}
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
            <p className="text-[13px] font-medium">Cargando grupo...</p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {/* Fila 1 */}
            <div className="col-span-12 sm:col-span-4">
              <FieldLabel required={!isView}>Programa Educativo</FieldLabel>
              <SearchSelectField
                options={programOptions}
                value={programId}
                onChange={handleProgramChange}
                placeholder="Selecciona el programa"
                disabled={disabled}
                searchPlaceholder="Buscar programa…"
              />
              <FieldHelp>Filtra las generaciones disponibles.</FieldHelp>
            </div>
            <div className="col-span-12 sm:col-span-8">
              <FieldLabel required={!isView}>Generación</FieldLabel>
              <SearchSelectField
                options={generationOptions}
                value={generationId}
                onChange={handleGenerationChange}
                placeholder="Selecciona la generación"
                disabled={disabled || !programId}
                searchPlaceholder="Buscar generación…"
              />
              <FieldHelp>Determina el plan de estudios del grupo (ej. &ldquo;2026-7&rdquo;).</FieldHelp>
            </div>

            {/* Fila 2 */}
            <div className="col-span-12 sm:col-span-6">
              <FieldLabel required={!isView}>Periodo Académico</FieldLabel>
              <SearchSelectField
                options={periodOptions}
                value={periodId}
                onChange={setPeriodId}
                placeholder="Selecciona el periodo"
                disabled={disabled}
                searchPlaceholder="Buscar periodo…"
              />
            </div>
            <div className="col-span-12 sm:col-span-6">
              <FieldLabel required={!isView}>Nivel del Plan</FieldLabel>
              <SearchSelectField
                options={planLevelOptions}
                value={planLevelId}
                onChange={setPlanLevelId}
                placeholder="Selecciona el nivel"
                disabled={disabled || !generationId}
                searchPlaceholder="Buscar nivel…"
              />
            </div>

            {/* Fila 3 */}
            <div className="col-span-12 sm:col-span-4">
              <FieldLabel required={!isView}>Turno</FieldLabel>
              <select
                value={shift}
                onChange={e => setShift(e.target.value as Shift)}
                disabled={disabled}
                className={inputCls(disabled, false)}
              >
                <option value="">Selecciona el turno</option>
                {SHIFT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="col-span-6 sm:col-span-4">
              <FieldLabel required={!isView}>Clave del Grupo</FieldLabel>
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                disabled={disabled}
                className={inputCls(disabled, false)}
                placeholder="Ej. A"
                maxLength={20}
              />
              <FieldHelp>Se generará como: IDGS-101-A.</FieldHelp>
            </div>
            <div className="col-span-6 sm:col-span-4">
              <FieldLabel required={!isView}>Capacidad Máxima</FieldLabel>
              <input
                type="number"
                min={1}
                value={maxCapacity}
                onChange={e => setMaxCapacity(e.target.value)}
                disabled={disabled}
                className={inputCls(disabled, false) + ' tabular-nums'}
                placeholder="Ej. 30"
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {loadStatus !== 'loading' && (
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          {isView ? (
            <>
              <button
                onClick={() => navigate('/grupos')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
              >
                <X size={14} />Regresar
              </button>
              <button
                onClick={() => navigate(`/grupos/form?mode=edit&id=${id}`)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
              >
                <Pencil size={14} />Editar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/grupos')}
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
                {isRegister ? 'Registrar Grupo' : 'Guardar Cambios'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
