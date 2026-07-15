import { useEffect, useState } from 'react'
import { ChevronRight, Pencil, Save, X, ArrowLeft, Loader2, AlertCircle, Plus, Trash2, Info } from 'lucide-react'
import { FieldLabel, FieldHelp, FieldError, inputCls, ModeSwitcher, SearchSelectField, Switch } from '../shared/ui'
import type { SelectOption } from '../shared/ui'
import { useNavigate } from 'react-router'
import { useFormMode } from '../shared/hooks'
import { apiGet, apiPost, apiPut, apiDelete } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────

type PlanLevelType = 'REGULAR' | 'INTERNSHIP'

const LEVEL_TYPE_LABELS: Record<PlanLevelType, string> = {
  REGULAR: 'Clases regulares',
  INTERNSHIP: 'Estadías',
}

const LEVEL_TYPE_STYLE: Record<PlanLevelType, string> = {
  REGULAR: 'bg-blue-50 text-blue-700 border border-blue-200',
  INTERNSHIP: 'bg-amber-50 text-amber-700 border border-amber-200',
}

interface ProgramSummary {
  id: string
  name: string
  code: string
}

interface ProgramsPageResponse {
  items: ProgramSummary[]
}

interface PlanLevelDetail {
  id: string
  levelNumber: number
  type: PlanLevelType
  description: string | null
}

interface AcademicPlanDetail {
  id: string
  programId: string
  version: string
  validityPeriod: string
  titulationKey: string
  effectiveFrom: string
  totalLevels: number
  minPassingGrade: number
  maxExtraordinaryExamsPerPeriod: number
  requiresSocialService: boolean
  socialServiceMinLevelId: string | null
  status: 'ACTIVE' | 'INACTIVE'
  levels: PlanLevelDetail[]
}

interface PlanScalarsPayload {
  version: string
  validityPeriod: string
  titulationKey: string
  effectiveFrom: string
  totalLevels: number
  minPassingGrade: number
  maxExtraordinaryExamsPerPeriod: number
  requiresSocialService: boolean
  socialServiceMinLevelId: string | null
}

interface CreatePlanPayload extends PlanScalarsPayload {
  programId: string
}

interface LevelPayload {
  levelNumber: number
  type: PlanLevelType
  description: string | null
}

// Client-side working copy of a plan level. `originalId` is `null` for rows
// added in this editing session (not yet persisted); it is set to the
// backend `PlanLevel.id` once loaded from `GET /plans/{id}` or created.
interface LevelRow {
  key: string
  originalId: string | null
  levelNumber: number
  type: PlanLevelType
  description: string
}

interface LevelFailure {
  levelNumber: number
  message: string
}

interface PartialSaveResult {
  savedPlanId: string
  failedLevels: LevelFailure[]
}

type FormErrors = Partial<Record<
  | 'programId' | 'version' | 'validityPeriod' | 'titulationKey' | 'effectiveFrom'
  | 'totalLevels' | 'minPassingGrade' | 'maxExtraordinaryExamsPerPeriod' | 'levels',
  string
>>

function newLevelRow(levelNumber: number): LevelRow {
  return { key: crypto.randomUUID(), originalId: null, levelNumber, type: 'REGULAR', description: '' }
}

function levelErrorMessage(apiErr: Partial<ApiError>): string {
  if (apiErr.status === 409) return apiErr.message ?? 'El número de nivel ya está en uso en este plan.'
  if (apiErr.status === 400) return apiErr.message ?? 'Datos de nivel inválidos.'
  if (apiErr.status === 404) return 'El plan ya no existe.'
  return 'No se pudo guardar este nivel.'
}

// Backend messages for the two 409 causes on DELETE (AcademicPlan.java):
// "Plan level still has subjects: {id}" (PlanLevelHasSubjectsException) vs
// "Plan level is referenced as socialServiceMinLevelId and cannot be
// removed: {id}" (PlanLevelInUseException). We match on the raw message text
// to give a precise Spanish message when possible, falling back to a single
// accurate combined message when the body doesn't let us tell them apart.
function deleteLevelErrorMessage(apiErr: Partial<ApiError>): string {
  if (apiErr.status === 409) {
    const raw = apiErr.message ?? ''
    const hasSubjects = /subjects/i.test(raw)
    const inUse = /socialServiceMinLevelId|referenced|servicio social/i.test(raw)
    if (hasSubjects && !inUse) {
      return 'No se puede eliminar este nivel porque tiene materias asignadas. Quítalas primero desde el detalle del plan.'
    }
    if (inUse && !hasSubjects) {
      return 'No se puede eliminar este nivel porque está definido como el nivel mínimo de servicio social del plan.'
    }
    return 'No se puede eliminar este nivel: tiene materias asignadas o está referenciado como nivel mínimo de servicio social del plan.'
  }
  if (apiErr.status === 404) return 'El nivel ya no existe (puede que ya haya sido eliminado).'
  return 'No se pudo eliminar este nivel.'
}

interface LevelDiff {
  removed: LevelRow[]
  changed: LevelRow[]
  added: LevelRow[]
}

// Diffs the working `levels` array against the baseline loaded from
// `GET /plans/{id}`. Shared by validate() (for pre-submit cycle detection)
// and handleEditSave() (for actual execution) so both always agree on what
// counts as removed/changed/added.
function computeLevelDiff(levels: LevelRow[], originalLevels: LevelRow[]): LevelDiff {
  const removed = originalLevels.filter(orig => !levels.some(l => l.originalId === orig.originalId))
  const changed = levels.filter(l => {
    if (l.originalId === null) return false
    const orig = originalLevels.find(o => o.originalId === l.originalId)
    return !!orig && (orig.levelNumber !== l.levelNumber || orig.type !== l.type || orig.description !== l.description)
  })
  const added = levels.filter(l => l.originalId === null)
  return { removed, changed, added }
}

// Orders the PUT /plans/{id}/levels/{levelId} calls for `changed` rows so
// that each one only targets a levelNumber that is free at the moment it
// runs (there is no batch/transactional endpoint, so a naive left-to-right
// loop 409s on any swap). Greedy topological sort: repeatedly execute any
// pending row whose target levelNumber is not currently occupied (or is its
// own current number — a no-op renumber), track the levelNumber it frees up,
// and repeat. Rows that can never become free-to-move (pure cycles, e.g.
// swapping 1↔2 with no free slot) are returned in `blocked` — resolving
// those requires the user to free a number first and save in two steps, not
// something this form can safely reorder on its own (delete+recreate would
// destroy the level's materias).
function orderLevelUpdates(
  changed: LevelRow[],
  occupiedInitial: Set<number>,
  originalLevels: LevelRow[],
): { ordered: LevelRow[]; blocked: LevelRow[] } {
  const occupied = new Set(occupiedInitial)
  const pending = [...changed]
  const ordered: LevelRow[] = []

  let progressed = true
  while (pending.length > 0 && progressed) {
    progressed = false
    for (let i = 0; i < pending.length; i++) {
      const row = pending[i]
      const orig = originalLevels.find(o => o.originalId === row.originalId)
      const oldNumber = orig ? orig.levelNumber : row.levelNumber
      if (!occupied.has(row.levelNumber) || row.levelNumber === oldNumber) {
        occupied.delete(oldNumber)
        occupied.add(row.levelNumber)
        ordered.push(row)
        pending.splice(i, 1)
        progressed = true
        break
      }
    }
  }

  return { ordered, blocked: pending }
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PlanForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isView = mode === 'view'
  const isRegister = mode === 'register'
  const isEdit = mode === 'edit'

  // ─── Field state ───────────────────────────────────────────────────────────
  const [programId, setProgramId] = useState('')
  const [version, setVersion] = useState('')
  const [validityPeriod, setValidityPeriod] = useState('')
  const [titulationKey, setTitulationKey] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [totalLevels, setTotalLevels] = useState('')
  const [minPassingGrade, setMinPassingGrade] = useState('')
  const [maxExtraordinaryExamsPerPeriod, setMaxExtraordinaryExamsPerPeriod] = useState('')
  const [requiresSocialService, setRequiresSocialService] = useState(false)
  const [socialServiceMinLevelId, setSocialServiceMinLevelId] = useState<string | null>(null)

  // ─── Levels state ──────────────────────────────────────────────────────────
  const [levels, setLevels] = useState<LevelRow[]>(isRegister ? [newLevelRow(1)] : [])
  const [originalLevels, setOriginalLevels] = useState<LevelRow[]>([])

  // ─── Auxiliary state ───────────────────────────────────────────────────────
  const [programs, setPrograms] = useState<SelectOption[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(isRegister ? 'idle' : 'loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')
  const [partialResult, setPartialResult] = useState<PartialSaveResult | null>(null)
  // True right after removeLevel() auto-clears socialServiceMinLevelId because
  // the level it pointed to was just removed from the working set.
  const [socialServiceClearedHint, setSocialServiceClearedHint] = useState(false)

  // ─── Load programs (dropdown) ──────────────────────────────────────────────
  useEffect(() => {
    apiGet<ProgramsPageResponse>('/programs', { size: 100 })
      .then(data => setPrograms(data.items.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` }))))
      .catch(() => {/* non-critical — select will be empty */})
  }, [])

  // ─── Load plan (view / edit) ───────────────────────────────────────────────
  useEffect(() => {
    if (isRegister || !id) return
    let cancelled = false
    setLoadStatus('loading')
    setLoadErrorMsg('')
    apiGet<AcademicPlanDetail>(`/plans/${id}`)
      .then(data => {
        if (cancelled) return
        applyPlanDetail(data)
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 404) {
          setLoadErrorMsg('No se encontró el plan de estudios solicitado.')
        } else if (apiErr.status === 401) {
          setLoadErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        } else if (apiErr.status === 403) {
          setLoadErrorMsg('No tienes permiso para consultar este plan de estudios.')
        } else {
          setLoadErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode])

  function applyPlanDetail(data: AcademicPlanDetail) {
    setProgramId(data.programId)
    setVersion(data.version)
    setValidityPeriod(data.validityPeriod)
    setTitulationKey(data.titulationKey)
    setEffectiveFrom(data.effectiveFrom)
    setTotalLevels(String(data.totalLevels))
    setMinPassingGrade(String(data.minPassingGrade))
    setMaxExtraordinaryExamsPerPeriod(String(data.maxExtraordinaryExamsPerPeriod))
    setRequiresSocialService(data.requiresSocialService)
    setSocialServiceMinLevelId(data.socialServiceMinLevelId)
    const loadedLevels: LevelRow[] = data.levels
      .slice()
      .sort((a, b) => a.levelNumber - b.levelNumber)
      .map(l => ({ key: l.id, originalId: l.id, levelNumber: l.levelNumber, type: l.type, description: l.description ?? '' }))
    setLevels(loadedLevels)
    setOriginalLevels(loadedLevels)
  }

  const disabled = isView || loadStatus === 'loading'
  const isSubmitting = submitStatus === 'submitting'
  // programId is immutable once the plan exists — the backend PUT does not accept it.
  const programDisabled = disabled || isEdit

  // Only levels already persisted on the backend can be referenced as the
  // social-service minimum level (a brand-new, unsaved row has no real id yet).
  const socialServiceLevelOptions: SelectOption[] = levels
    .filter(l => l.originalId !== null)
    .map(l => ({
      value: l.originalId as string,
      label: `Nivel ${l.levelNumber} — ${LEVEL_TYPE_LABELS[l.type]}${l.description ? ` (${l.description})` : ''}`,
    }))

  // ─── Level row helpers ─────────────────────────────────────────────────────
  function updateLevel(key: string, patch: Partial<Pick<LevelRow, 'levelNumber' | 'type' | 'description'>>) {
    setLevels(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r))
    setErrors(prev => ({ ...prev, levels: undefined }))
  }
  function removeLevel(key: string) {
    // If the level being removed is currently set as the plan's
    // social-service minimum level, clear that selection now. Otherwise the
    // scalar PUT would keep re-sending a UUID for a level that's about to be
    // deleted, and DELETE would always 409 (PlanLevelInUseException) while
    // the select silently showed blank (stale id still held in state).
    const removedRow = levels.find(r => r.key === key)
    if (removedRow && removedRow.originalId !== null && removedRow.originalId === socialServiceMinLevelId) {
      setSocialServiceMinLevelId(null)
      setSocialServiceClearedHint(true)
    }
    setLevels(prev => prev.filter(r => r.key !== key))
  }
  function addLevel() {
    setLevels(prev => [...prev, newLevelRow(prev.length + 1)])
  }
  function handleRequiresSocialServiceChange(v: boolean) {
    setRequiresSocialService(v)
    if (!v) setSocialServiceMinLevelId(null)
    setSocialServiceClearedHint(false)
  }

  // ─── Validation ────────────────────────────────────────────────────────────
  function validate(): FormErrors {
    const e: FormErrors = {}
    if (isRegister && !programId) e.programId = 'Selecciona el programa educativo.'
    if (!version.trim()) e.version = 'La versión del plan es requerida.'
    if (!validityPeriod.trim()) e.validityPeriod = 'El periodo de vigencia es requerido.'
    if (!titulationKey.trim()) e.titulationKey = 'La clave de titulación es requerida.'
    if (!effectiveFrom) e.effectiveFrom = 'La fecha de vigencia es requerida.'

    const totalLevelsNum = Number(totalLevels)
    if (!totalLevels.trim() || !Number.isInteger(totalLevelsNum) || totalLevelsNum < 1) {
      e.totalLevels = 'Ingresa un número entero mayor o igual a 1.'
    }

    const minGradeNum = Number(minPassingGrade)
    if (!minPassingGrade.trim() || Number.isNaN(minGradeNum) || minGradeNum < 0 || minGradeNum > 10) {
      e.minPassingGrade = 'Ingresa un valor entre 0 y 10.'
    }

    const maxExamsNum = Number(maxExtraordinaryExamsPerPeriod)
    if (!maxExtraordinaryExamsPerPeriod.trim() || !Number.isInteger(maxExamsNum) || maxExamsNum < 0) {
      e.maxExtraordinaryExamsPerPeriod = 'Ingresa un número entero mayor o igual a 0.'
    }

    const seen = new Set<number>()
    for (const row of levels) {
      if (!Number.isInteger(row.levelNumber) || row.levelNumber < 1) {
        e.levels = 'Todos los niveles deben tener un número entero mayor o igual a 1.'
        break
      }
      if (seen.has(row.levelNumber)) {
        e.levels = `El número de nivel ${row.levelNumber} está repetido.`
        break
      }
      seen.add(row.levelNumber)
      if (Number.isInteger(totalLevelsNum) && totalLevelsNum >= 1 && row.levelNumber > totalLevelsNum) {
        e.levels = `El nivel ${row.levelNumber} excede el total de niveles definido (${totalLevelsNum}).`
        break
      }
    }

    // Edit mode only: the backend has no batch endpoint, so renumbered
    // levels are PUT one at a time. A pure cycle (e.g. swapping levelNumber
    // 1↔2 with no free slot in between) can never be ordered without a
    // transient collision — detect it here instead of letting the user hit
    // an unrecoverable 409 mid-save.
    if (isEdit && !e.levels) {
      const { removed, changed } = computeLevelDiff(levels, originalLevels)
      const occupiedInitial = new Set(
        originalLevels.filter(o => !removed.some(r => r.originalId === o.originalId)).map(o => o.levelNumber),
      )
      const { blocked } = orderLevelUpdates(changed, occupiedInitial, originalLevels)
      if (blocked.length > 0) {
        const nums = blocked.map(b => b.levelNumber).join(', ')
        e.levels = `No es posible intercambiar números de nivel directamente (nivel${blocked.length !== 1 ? 'es' : ''} ${nums}). Asigna primero un número libre (puedes aumentar temporalmente el total de niveles) y guarda en dos pasos.`
      }
    }

    return e
  }

  // ─── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors({})
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    setPartialResult(null)

    const scalars: PlanScalarsPayload = {
      version: version.trim(),
      validityPeriod: validityPeriod.trim(),
      titulationKey: titulationKey.trim(),
      effectiveFrom,
      totalLevels: Number(totalLevels),
      minPassingGrade: Number(minPassingGrade),
      maxExtraordinaryExamsPerPeriod: Number(maxExtraordinaryExamsPerPeriod),
      requiresSocialService,
      socialServiceMinLevelId: null,
    }

    try {
      if (isRegister) {
        await handleRegister(scalars)
      } else if (id) {
        await handleEditSave(scalars)
      }
    } catch (err) {
      setSubmitStatus('error')
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 409) {
        setSubmitErrorMsg(apiErr.message ?? 'La versión ya está en uso por otro plan de este programa.')
      } else if (apiErr.status === 400) {
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

  // Create flow: POST /plans (socialServiceMinLevelId always null), then
  // sequential POST /plans/{id}/levels per row. Level failures are collected
  // rather than aborting the loop, so the user sees exactly which levels
  // saved and which didn't (design.md has no batch/transactional endpoint).
  async function handleRegister(scalars: PlanScalarsPayload) {
    const payload: CreatePlanPayload = { ...scalars, programId }
    const created = await apiPost<AcademicPlanDetail>('/plans', payload)

    const failedLevels: LevelFailure[] = []
    for (const row of levels) {
      try {
        const levelPayload: LevelPayload = { levelNumber: row.levelNumber, type: row.type, description: row.description.trim() || null }
        await apiPost<PlanLevelDetail>(`/plans/${created.id}/levels`, levelPayload)
      } catch (err) {
        const apiErr = err as Partial<ApiError>
        failedLevels.push({ levelNumber: row.levelNumber, message: levelErrorMessage(apiErr) })
      }
    }

    if (failedLevels.length === 0) {
      navigate('/planes', { state: { toast: 'Plan de estudios registrado exitosamente.' } })
      return
    }

    setSubmitStatus('error')
    setPartialResult({ savedPlanId: created.id, failedLevels })
    setSubmitErrorMsg(
      `El plan se registró, pero ${failedLevels.length} nivel${failedLevels.length !== 1 ? 'es' : ''} no se pudo${failedLevels.length !== 1 ? 'ieron' : ''} guardar. Continúa desde la edición del plan para corregirlo.`,
    )
  }

  // Edit flow: PUT /plans/{id} for scalars, then diff levels against the
  // originally-loaded set — new rows are created, changed rows updated,
  // removed rows deleted. Order (delete → ordered update → create) avoids
  // transient level-number collisions: deletes free up numbers first, then
  // renumber PUTs are topologically ordered (orderLevelUpdates) so a swap
  // like 1↔2 only proceeds if the diff is actually resolvable one PUT at a
  // time — validate() already blocks the submit otherwise.
  async function handleEditSave(scalars: PlanScalarsPayload) {
    if (!id) return
    const payload: PlanScalarsPayload = {
      ...scalars,
      socialServiceMinLevelId: requiresSocialService ? socialServiceMinLevelId : null,
    }
    await apiPut<AcademicPlanDetail>(`/plans/${id}`, payload)

    const { removed, changed, added } = computeLevelDiff(levels, originalLevels)

    const failedLevels: LevelFailure[] = []
    let attempted = 0
    const successfullyDeletedIds = new Set<string>()

    for (const row of removed) {
      attempted++
      try {
        await apiDelete<void>(`/plans/${id}/levels/${row.originalId}`)
        if (row.originalId) successfullyDeletedIds.add(row.originalId)
      } catch (err) {
        failedLevels.push({ levelNumber: row.levelNumber, message: deleteLevelErrorMessage(err as Partial<ApiError>) })
      }
    }

    // What's still actually on the backend after the deletes above — a
    // failed delete still occupies its levelNumber, so it must stay in the
    // occupied set the renumber ordering starts from.
    const occupiedAfterDeletes = new Set(
      originalLevels
        .filter(o => !(o.originalId && successfullyDeletedIds.has(o.originalId)))
        .map(o => o.levelNumber),
    )
    const { ordered: orderedChanged, blocked } = orderLevelUpdates(changed, occupiedAfterDeletes, originalLevels)

    // Should be empty in practice — validate() already blocks unorderable
    // cycles pre-submit — but guard defensively in case the working set
    // drifted (e.g. a resync) between validation and this call.
    for (const row of blocked) {
      attempted++
      failedLevels.push({
        levelNumber: row.levelNumber,
        message: 'No se pudo reordenar este nivel: su nuevo número choca con otro nivel existente. Corrige la numeración y vuelve a guardar.',
      })
    }

    for (const row of orderedChanged) {
      attempted++
      try {
        const levelPayload: LevelPayload = { levelNumber: row.levelNumber, type: row.type, description: row.description.trim() || null }
        await apiPut<PlanLevelDetail>(`/plans/${id}/levels/${row.originalId}`, levelPayload)
      } catch (err) {
        failedLevels.push({ levelNumber: row.levelNumber, message: levelErrorMessage(err as Partial<ApiError>) })
      }
    }
    for (const row of added) {
      attempted++
      try {
        const levelPayload: LevelPayload = { levelNumber: row.levelNumber, type: row.type, description: row.description.trim() || null }
        await apiPost<PlanLevelDetail>(`/plans/${id}/levels`, levelPayload)
      } catch (err) {
        failedLevels.push({ levelNumber: row.levelNumber, message: levelErrorMessage(err as Partial<ApiError>) })
      }
    }

    if (failedLevels.length === 0) {
      navigate('/planes', { state: { toast: 'Plan de estudios actualizado exitosamente.' } })
      return
    }

    // Re-sync with the backend so the working state (and the next diff
    // attempt) reflects what actually persisted, since some level changes
    // may have succeeded even though others failed.
    if (attempted > failedLevels.length) {
      await resyncFromServer()
    }
    setSubmitStatus('error')
    setPartialResult({ savedPlanId: id, failedLevels })
    setSubmitErrorMsg(
      `Los datos del plan se guardaron, pero ${failedLevels.length} cambio${failedLevels.length !== 1 ? 's' : ''} de nivel no se pudo${failedLevels.length !== 1 ? 'ieron' : ''} aplicar. Revisa los detalles y vuelve a intentar.`,
    )
  }

  async function resyncFromServer() {
    if (!id) return
    try {
      const data = await apiGet<AcademicPlanDetail>(`/plans/${id}`)
      applyPlanDetail(data)
    } catch {
      // Best-effort resync — if it fails the local working state is kept
      // as-is and the user can retry the save, which re-runs the same diff.
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/planes')} className="hover:text-[#009574] transition-colors">Planes de Estudio</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">
          {isRegister ? 'Registrar Plan' : isView ? 'Ver Plan' : 'Editar Plan'}
        </span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">
            {isRegister ? 'Registrar Plan de Estudios' : isView ? 'Ver Plan de Estudios' : 'Editar Plan de Estudios'}
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {isRegister
              ? 'Completa los campos para registrar un nuevo plan de estudios y sus niveles.'
              : isView
              ? 'Información del plan de estudios.'
              : 'Modifica el plan de estudios y sus niveles.'}
          </p>
        </div>
        <ModeSwitcher
          mode={mode}
          registerUrl="/planes/new"
          formUrl={m => `/planes/form?mode=${m}&id=${id}`}
        />
      </div>

      {/* Load error banner */}
      {loadStatus === 'error' && loadErrorMsg && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mb-4">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {loadErrorMsg}
        </div>
      )}

      {/* Submit error banner */}
      {submitStatus === 'error' && submitErrorMsg && (
        <div className="flex flex-col gap-2 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mb-4">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{submitErrorMsg}</span>
          </div>
          {partialResult && partialResult.failedLevels.length > 0 && (
            <ul className="ml-6 list-disc text-[12px] text-red-600">
              {partialResult.failedLevels.map((f, i) => (
                <li key={`${f.levelNumber}-${i}`}>Nivel {f.levelNumber}: {f.message}</li>
              ))}
            </ul>
          )}
          {isRegister && partialResult && (
            <button
              type="button"
              onClick={() => navigate(`/planes/form?mode=edit&id=${partialResult.savedPlanId}`)}
              className="self-start mt-1 text-[12px] font-semibold text-red-700 underline hover:text-red-800"
            >
              Continuar desde edición
            </button>
          )}
        </div>
      )}

      {/* Form card */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
        {loadStatus === 'loading' ? (
          <div className="flex flex-col items-center gap-3 text-[#6B7280] py-12">
            <Loader2 size={24} className="animate-spin text-[#009574]" />
            <p className="text-[13px] font-medium">Cargando plan de estudios...</p>
          </div>
        ) : (
          <>
            {/* ── Sección 1: Datos del Plan ── */}
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-4">Datos del Plan</p>
            <div className="grid grid-cols-12 gap-4 mb-6">

              {/* Programa Educativo */}
              <div className="col-span-12 sm:col-span-8">
                <FieldLabel required={isRegister}>Programa Educativo</FieldLabel>
                <SearchSelectField
                  options={programs}
                  value={programId}
                  onChange={v => { setProgramId(v); setErrors(prev => ({ ...prev, programId: undefined })) }}
                  placeholder="Seleccionar programa…"
                  disabled={programDisabled}
                  hasError={!!errors.programId}
                  searchPlaceholder="Buscar programa…"
                />
                {errors.programId
                  ? <FieldError>{errors.programId}</FieldError>
                  : <FieldHelp>{isEdit ? 'El programa no se puede modificar una vez creado el plan.' : 'Programa educativo al que pertenece este plan.'}</FieldHelp>}
              </div>

              {/* Versión */}
              <div className="col-span-12 sm:col-span-4">
                <FieldLabel required={!isView}>Versión</FieldLabel>
                <input
                  value={version}
                  onChange={e => { setVersion(e.target.value); setErrors(prev => ({ ...prev, version: undefined })) }}
                  disabled={disabled}
                  className={inputCls(disabled, !!errors.version)}
                  placeholder="Ej. 2024-1"
                />
                {errors.version
                  ? <FieldError>{errors.version}</FieldError>
                  : <FieldHelp>Identifica el plan dentro del programa (único por programa).</FieldHelp>}
              </div>

              {/* Periodo de vigencia */}
              <div className="col-span-12 sm:col-span-6">
                <FieldLabel required={!isView}>Periodo de Vigencia</FieldLabel>
                <input
                  value={validityPeriod}
                  onChange={e => { setValidityPeriod(e.target.value); setErrors(prev => ({ ...prev, validityPeriod: undefined })) }}
                  disabled={disabled}
                  className={inputCls(disabled, !!errors.validityPeriod)}
                  placeholder="Ej. 2024-2028"
                />
                {errors.validityPeriod && <FieldError>{errors.validityPeriod}</FieldError>}
              </div>

              {/* Clave de titulación */}
              <div className="col-span-12 sm:col-span-6">
                <FieldLabel required={!isView}>Clave de Titulación</FieldLabel>
                <input
                  value={titulationKey}
                  onChange={e => { setTitulationKey(e.target.value); setErrors(prev => ({ ...prev, titulationKey: undefined })) }}
                  disabled={disabled}
                  className={inputCls(disabled, !!errors.titulationKey)}
                  placeholder="Ej. IDGS-TIT-2024"
                />
                {errors.titulationKey && <FieldError>{errors.titulationKey}</FieldError>}
              </div>

              {/* Vigente desde */}
              <div className="col-span-12 sm:col-span-4">
                <FieldLabel required={!isView}>Vigente Desde</FieldLabel>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={e => { setEffectiveFrom(e.target.value); setErrors(prev => ({ ...prev, effectiveFrom: undefined })) }}
                  disabled={disabled}
                  className={inputCls(disabled, !!errors.effectiveFrom)}
                />
                {errors.effectiveFrom && <FieldError>{errors.effectiveFrom}</FieldError>}
              </div>

              {/* Total de niveles */}
              <div className="col-span-12 sm:col-span-4">
                <FieldLabel required={!isView}>Total de Niveles</FieldLabel>
                <input
                  type="number"
                  min={1}
                  value={totalLevels}
                  onChange={e => { setTotalLevels(e.target.value); setErrors(prev => ({ ...prev, totalLevels: undefined })) }}
                  disabled={disabled}
                  className={inputCls(disabled, !!errors.totalLevels) + ' tabular-nums'}
                  placeholder="Ej. 10"
                />
                {errors.totalLevels
                  ? <FieldError>{errors.totalLevels}</FieldError>
                  : <FieldHelp>Cantidad total de niveles que tendrá el plan.</FieldHelp>}
              </div>
            </div>

            {/* ── Sección 2: Parámetros de Evaluación ── */}
            <div className="flex items-center gap-4 my-6">
              <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest whitespace-nowrap">Parámetros de Evaluación</p>
              <div className="flex-1 h-px bg-[#E5E7EB]" />
            </div>

            <div className="grid grid-cols-12 gap-4 mb-4">
              {/* Calificación mínima aprobatoria */}
              <div className="col-span-12 sm:col-span-4">
                <FieldLabel required={!isView}>Calificación Mínima Aprobatoria</FieldLabel>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step="0.1"
                  value={minPassingGrade}
                  onChange={e => { setMinPassingGrade(e.target.value); setErrors(prev => ({ ...prev, minPassingGrade: undefined })) }}
                  disabled={disabled}
                  className={inputCls(disabled, !!errors.minPassingGrade) + ' tabular-nums'}
                  placeholder="Ej. 7.0"
                />
                {errors.minPassingGrade
                  ? <FieldError>{errors.minPassingGrade}</FieldError>
                  : <FieldHelp>Escala de 0 a 10.</FieldHelp>}
              </div>

              {/* Extraordinarios máximos por periodo */}
              <div className="col-span-12 sm:col-span-4">
                <FieldLabel required={!isView}>Extraordinarios Máx. por Periodo</FieldLabel>
                <input
                  type="number"
                  min={0}
                  value={maxExtraordinaryExamsPerPeriod}
                  onChange={e => { setMaxExtraordinaryExamsPerPeriod(e.target.value); setErrors(prev => ({ ...prev, maxExtraordinaryExamsPerPeriod: undefined })) }}
                  disabled={disabled}
                  className={inputCls(disabled, !!errors.maxExtraordinaryExamsPerPeriod) + ' tabular-nums'}
                  placeholder="Ej. 2"
                />
                {errors.maxExtraordinaryExamsPerPeriod
                  ? <FieldError>{errors.maxExtraordinaryExamsPerPeriod}</FieldError>
                  : <FieldHelp>Número máximo de exámenes extraordinarios por periodo.</FieldHelp>}
              </div>

              {/* Requiere servicio social */}
              <div className="col-span-12 sm:col-span-4">
                <FieldLabel>Requiere Servicio Social</FieldLabel>
                <div className="flex items-center gap-2 h-[38px]">
                  <Switch checked={requiresSocialService} disabled={disabled} onChange={handleRequiresSocialServiceChange} />
                  <span className="text-[13px] text-[#333333]">{requiresSocialService ? 'Sí' : 'No'}</span>
                </div>
              </div>

              {/* Nivel mínimo para servicio social — edit-only, only when requiresSocialService */}
              {!isRegister && requiresSocialService && (
                <div className="col-span-12">
                  <FieldLabel>Nivel Mínimo para Servicio Social</FieldLabel>
                  <SearchSelectField
                    options={socialServiceLevelOptions}
                    value={socialServiceMinLevelId ?? ''}
                    onChange={v => { setSocialServiceMinLevelId(v || null); setSocialServiceClearedHint(false) }}
                    placeholder="Selecciona un nivel del plan…"
                    disabled={disabled}
                    searchPlaceholder="Buscar nivel…"
                  />
                  {socialServiceClearedHint ? (
                    <p className="mt-1 text-[11px] text-amber-600">
                      Se limpió el nivel mínimo de servicio social porque el nivel fue eliminado. Selecciona otro si aplica.
                    </p>
                  ) : (
                    <FieldHelp>Solo puede referenciar niveles ya guardados de este mismo plan.</FieldHelp>
                  )}
                </div>
              )}
              {isRegister && requiresSocialService && (
                <div className="col-span-12">
                  <div className="flex items-start gap-2 text-[12px] text-[#6B7280] bg-[#F8F9FA] border border-[#E5E7EB] rounded-md px-3 py-2.5">
                    <Info size={13} className="text-[#009574] flex-shrink-0 mt-0.5" />
                    El nivel mínimo para servicio social se define después de registrar el plan, desde la edición.
                  </div>
                </div>
              )}
            </div>

            {/* ── Sección 3: Niveles del Plan ── */}
            <div className="flex items-center gap-4 my-6">
              <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest whitespace-nowrap">Niveles del Plan</p>
              <div className="flex-1 h-px bg-[#E5E7EB]" />
            </div>

            {errors.levels && <FieldError>{errors.levels}</FieldError>}

            {/* Desktop table (md+) */}
            <div className="hidden md:block border border-[#E5E7EB] rounded-lg overflow-hidden mt-2">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-20">Nivel #</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-52">Tipo</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Descripción</th>
                    {!isView && <th className="w-12" />}
                  </tr>
                </thead>
                <tbody>
                  {levels.length === 0 ? (
                    <tr>
                      <td colSpan={isView ? 3 : 4} className="py-8 text-center text-[12px] text-[#6B7280]">
                        Sin niveles. Agrega al menos uno para continuar.
                      </td>
                    </tr>
                  ) : (
                    levels.map(row => (
                      <tr key={row.key} className="border-b border-[#E5E7EB] last:border-0 group hover:bg-[#FAFAFA] transition-colors">
                        <td className="px-4 py-2.5">
                          {isView ? (
                            <span className="text-[13px] font-medium text-[#333333] tabular-nums">{row.levelNumber}</span>
                          ) : (
                            <input
                              type="number"
                              min={1}
                              value={row.levelNumber}
                              onChange={e => updateLevel(row.key, { levelNumber: Number(e.target.value) })}
                              className="w-16 px-2 py-1.5 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-[#333333] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
                            />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isView ? (
                            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${LEVEL_TYPE_STYLE[row.type]}`}>{LEVEL_TYPE_LABELS[row.type]}</span>
                          ) : (
                            <select
                              value={row.type}
                              onChange={e => updateLevel(row.key, { type: e.target.value as PlanLevelType })}
                              className="px-2.5 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-md text-[#333333] appearance-none focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
                            >
                              {(Object.keys(LEVEL_TYPE_LABELS) as PlanLevelType[]).map(t => (
                                <option key={t} value={t}>{LEVEL_TYPE_LABELS[t]}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isView ? (
                            <span className="text-[13px] text-[#333333]">{row.description || '—'}</span>
                          ) : (
                            <input
                              type="text"
                              placeholder="Ej. Estadía I (opcional)"
                              value={row.description}
                              onChange={e => updateLevel(row.key, { description: e.target.value })}
                              className="w-full px-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-[#333333] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
                            />
                          )}
                        </td>
                        {!isView && (
                          <td className="px-3 py-2 w-12">
                            <button
                              type="button"
                              onClick={() => removeLevel(row.key)}
                              className="p-1.5 rounded-md text-[#6B7280] hover:bg-red-50 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {!isView && (
                <div className="border-t border-[#E5E7EB] px-4 py-2.5">
                  <button
                    type="button"
                    onClick={addLevel}
                    className="flex items-center gap-1.5 text-[12px] font-medium text-[#009574] hover:text-[#007a5e] transition-colors"
                  >
                    <Plus size={14} />Agregar Nivel
                  </button>
                </div>
              )}
            </div>

            {/* Mobile cards (< md) */}
            <div className="md:hidden space-y-3 mt-2">
              {levels.length === 0 ? (
                <div className="border border-[#E5E7EB] rounded-lg px-4 py-8 text-center text-[12px] text-[#6B7280]">
                  Sin niveles. Agrega al menos uno para continuar.
                </div>
              ) : (
                levels.map(row => (
                  <div key={row.key} className="border border-[#E5E7EB] rounded-lg p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[12px] font-semibold text-[#333333]">Nivel {row.levelNumber}</span>
                      {!isView && (
                        <button
                          type="button"
                          onClick={() => removeLevel(row.key)}
                          className="p-1 rounded text-[#6B7280] hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    {isView ? (
                      <>
                        <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full mb-2 ${LEVEL_TYPE_STYLE[row.type]}`}>
                          {LEVEL_TYPE_LABELS[row.type]}
                        </span>
                        {row.description && <p className="text-[13px] text-[#333333]">{row.description}</p>}
                      </>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <FieldLabel>Número de Nivel</FieldLabel>
                          <input
                            type="number"
                            min={1}
                            value={row.levelNumber}
                            onChange={e => updateLevel(row.key, { levelNumber: Number(e.target.value) })}
                            className={inputCls(false, false)}
                          />
                        </div>
                        <div>
                          <FieldLabel>Tipo</FieldLabel>
                          <select
                            value={row.type}
                            onChange={e => updateLevel(row.key, { type: e.target.value as PlanLevelType })}
                            className={inputCls(false, false) + ' appearance-none'}
                          >
                            {(Object.keys(LEVEL_TYPE_LABELS) as PlanLevelType[]).map(t => (
                              <option key={t} value={t}>{LEVEL_TYPE_LABELS[t]}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <FieldLabel>Descripción</FieldLabel>
                          <input
                            type="text"
                            placeholder="Opcional"
                            value={row.description}
                            onChange={e => updateLevel(row.key, { description: e.target.value })}
                            className={inputCls(false, false)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              {!isView && (
                <button
                  type="button"
                  onClick={addLevel}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium text-[#009574] border border-[#009574]/30 rounded-md hover:bg-[#e6f5f1] transition-colors"
                >
                  <Plus size={14} />Agregar Nivel
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      {loadStatus !== 'loading' && (
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          {isView ? (
            <>
              <button
                onClick={() => navigate('/planes')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
              >
                <ArrowLeft size={14} />Regresar
              </button>
              <button
                onClick={() => navigate(`/planes/form?mode=edit&id=${id}`)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
              >
                <Pencil size={14} />Editar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/planes')}
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
                {isRegister ? 'Registrar Plan' : 'Guardar Cambios'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
