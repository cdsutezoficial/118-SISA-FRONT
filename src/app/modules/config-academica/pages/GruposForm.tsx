import { useEffect, useState } from 'react'
import { FieldLabel, FieldHelp, ModeSwitcher, SearchSelectField } from '@app/core/components/ui'
import type { SelectOption } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField, SelectField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate } from 'react-router'
import { useFormMode } from '@app/core/infra/hooks'
import { apiGet, apiPost, apiPut } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'

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

  useEffect(() => {
    setSubmitStatus('idle')
    setSubmitErrorMsg('')
    if (isRegister) {
      setProgramId('')
      setGenerationId('')
      setPeriodId('')
      setPlanLevelId('')
      setShift('')
      setCode('')
      setMaxCapacity('')
      setLoadStatus('idle')
      setLoadErrorMsg('')
    }
  }, [mode, id])

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
        const created = await apiPost<GroupResponse>('/groups', payload)
        navigate(`/grupos/form?mode=view&id=${created.id}`, { state: { toast: 'Grupo registrado exitosamente.' } })
      } else if (id) {
        await apiPut<GroupResponse>(`/groups/${id}`, payload)
        navigate(`/grupos/form?mode=view&id=${id}`, { state: { toast: 'Grupo actualizado exitosamente.' } })
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
    <FormPage>
      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Grupos', to: '/grupos' },
          { label: title },
        ]}
      />

      <FormHeader
        title={title}
        subtitle={description}
        right={<ModeSwitcher mode={mode} id={id} registerUrl="/grupos/new" formUrl={m => `/grupos/form?mode=${m}&id=${id}`} />}
      />

      {/* Load error banner (edit/view fetch failed) */}
      {loadStatus === 'error' && loadErrorMsg && <ErrorBanner message={loadErrorMsg} />}

      {/* Submit error banner */}
      {submitStatus === 'error' && submitErrorMsg && <ErrorBanner message={submitErrorMsg} />}

      {/* Form card */}
      <FormCard loading={loadStatus === 'loading'} loadingLabel="Cargando grupo...">
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
          <SelectField
            label="Turno"
            required={!isView}
            value={shift}
            onChange={v => setShift(v as Shift)}
            disabled={disabled}
            options={SHIFT_OPTIONS}
            placeholder="Selecciona el turno"
            className="col-span-12 sm:col-span-4"
          />
          <TextField
            label="Clave del Grupo"
            required={!isView}
            value={code}
            onChange={v => setCode(v.toUpperCase())}
            disabled={disabled}
            placeholder="Ej. A"
            maxLength={20}
            help="Se generará como: IDGS-101-A."
            className="col-span-6 sm:col-span-4"
          />
          <TextField
            label="Capacidad Máxima"
            required={!isView}
            type="number"
            min={1}
            value={maxCapacity}
            onChange={setMaxCapacity}
            disabled={disabled}
            numeric
            placeholder="Ej. 30"
            className="col-span-6 sm:col-span-4"
          />
        </div>
      </FormCard>

      {/* Actions */}
      {loadStatus !== 'loading' && (
        <FormActions
          isView={isView}
          onBack={() => navigate('/grupos')}
          onPrimary={isView ? () => navigate(`/grupos/form?mode=edit&id=${id}`) : handleSubmit}
          primaryLabel={isView ? 'Editar' : isRegister ? 'Registrar Grupo' : 'Guardar Cambios'}
          isSubmitting={isSubmitting}
        />
      )}
    </FormPage>
  )
}
