import { useEffect, useState } from 'react'
import { Plus, Trash2, Info, AlertCircle } from 'lucide-react'
import { FieldLabel, FieldHelp, FieldError, ModeSwitcher, SearchSelectField, Switch, DatePicker } from '@app/core/components/ui'
import type { SelectOption } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField, SelectField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate } from 'react-router'
import { useFormMode } from '@app/core/infra/hooks'
import { apiGet, apiPost, apiPut, apiDelete, getApiErrorMessage, type ApiError } from '@app/core/infra/apiClient'
import { useFieldValidation } from '@app/core/validation/useFieldValidation'
import {
  required,
  selectionRequired,
  maxLength,
  noControlChars,
  numeric,
  decimal,
  normalizeText,
} from '@app/core/validation/fieldRules'

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

type PlanLevelError = string | undefined

// ─── Schema de validación ──────────────────────────────────────────────────────
// Se declara fuera del componente para que su identidad sea estable: el hook lo
// usa como dependencia de sus callbacks.
//
// Los ocho escalares del plan entran al schema. El array `levels` **no**: es una
// tabla dinámica, no un conjunto fijo de campos, y su validación (números
// repetidos, ciclos de renumeración) sigue siendo la función `validateLevels`
// de más abajo.
//
// Todos los límites son los mismos que declara el backend en
// `CreateAcademicPlanRequest` / `UpdateAcademicPlanRequest`, para que el
// navegador no deje pasar nada que el servidor vaya a rechazar con 400:
//   version                     → @Size(max = 50) + @Pattern(^[^\p{Cc}]*$)
//   validityPeriod              → @Size(max = 100) + @Pattern
//   titulationKey               → @Size(max = 100) + @Pattern
//   effectiveFrom               → @NotNull
//   totalLevels                 → @Min(1)
//   minPassingGrade             → @Digits(integer = 2, fraction = 1) + rango [0, 10]
//   maxExtraordinaryExamsPerPeriod → @Min(0)
//   programId                   → @NotNull (sólo aplica al alta: en edición el
//                                 backend ni siquiera lo acepta)
//
// `version`, `validityPeriod` y `titulationKey` son etiquetas de texto libre:
// llevan `validateOn: normalizeText` (compacta rachas de espacios y recorta
// **sólo al evaluar las reglas**) y ningún `normalize`, porque recortar en cada
// pulsación impediría escribir un espacio entre palabras. El payload se arma con
// el mismo `normalizeText`.
const PLAN_SCHEMA = {
  programId: { rules: [selectionRequired('la carrera')] },
  version: {
    validateOn: normalizeText,
    rules: [required('versión del plan', 'f'), maxLength(50, 'versión', 'f'), noControlChars('versión', 'f')],
  },
  validityPeriod: {
    validateOn: normalizeText,
    rules: [required('periodo de vigencia'), maxLength(100, 'periodo de vigencia'), noControlChars('periodo de vigencia')],
  },
  titulationKey: {
    validateOn: normalizeText,
    rules: [
      required('clave de titulación', 'f'),
      maxLength(100, 'clave de titulación', 'f'),
      noControlChars('clave de titulación', 'f'),
    ],
  },
  // El DatePicker trabaja en dd/mm/yyyy; la conversión a ISO ocurre al mandar
  // el payload (displayToIso). Guardar el formato de pantalla en el hook evita
  // tener dos estados para el mismo campo.
  effectiveFrom: { rules: [required('fecha de vigencia', 'f')] },
  totalLevels: {
    rules: [required('total de niveles'), numeric({ label: 'total de niveles', min: 1 })],
  },
  minPassingGrade: {
    rules: [
      required('calificación mínima aprobatoria', 'f'),
      decimal({ label: 'calificación mínima aprobatoria', gender: 'f', min: 0, max: 10, intDigits: 2, fraction: 1 }),
    ],
  },
  maxExtraordinaryExamsPerPeriod: {
    rules: [
      required('exámenes extraordinarios por periodo', 'mp'),
      numeric({ label: 'exámenes extraordinarios por periodo', gender: 'mp', min: 0 }),
    ],
  },
} as const

const PLAN_INITIAL_VALUES = {
  programId: '',
  version: '',
  validityPeriod: '',
  titulationKey: '',
  effectiveFrom: '',
  totalLevels: '',
  minPassingGrade: '',
  maxExtraordinaryExamsPerPeriod: '',
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

function newLevelRow(levelNumber: number): LevelRow {
  return { key: crypto.randomUUID(), originalId: null, levelNumber, type: 'REGULAR', description: '' }
}

function levelErrorMessage(err: unknown): string {
  return getApiErrorMessage(err, 'No se pudo guardar este nivel.')
}

function deleteLevelErrorMessage(err: unknown): string {
  return getApiErrorMessage(err, 'No se pudo eliminar este nivel.')
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

// ─── Validación de las filas de niveles ────────────────────────────────────────
// El array `levels` no entra al schema de `useFieldValidation`: no son campos
// fijos sino una tabla dinámica, y estas reglas son de fila y de colección
// (números inválidos o repetidos, tope del total, ciclos de renumeración), no
// reglas de campo.
//
// `totalLevelsValue` es el texto crudo del campo del total, para no usar como
// referencia de comparación un total que todavía no es un entero válido.
// `isEdit` activa la detección de ciclos, que sólo aplica cuando el plan ya
// existe en el backend y sus niveles se actualizan uno por uno.
function validateLevels(
  levels: LevelRow[],
  totalLevelsValue: string,
  isEdit: boolean,
  originalLevels: LevelRow[],
): PlanLevelError {
  for (const row of levels) {
    if (!Number.isInteger(row.levelNumber) || row.levelNumber < 1) {
      return 'Todos los niveles deben tener un número entero mayor o igual a 1.'
    }
  }

  const totalLevelsNum = Number(totalLevelsValue)
  const seen = new Set<number>()
  for (const row of levels) {
    if (seen.has(row.levelNumber)) {
      return `El número de nivel ${row.levelNumber} está repetido.`
    }
    seen.add(row.levelNumber)
    if (Number.isInteger(totalLevelsNum) && totalLevelsNum >= 1 && row.levelNumber > totalLevelsNum) {
      return `El nivel ${row.levelNumber} excede el total de niveles definido (${totalLevelsNum}).`
    }
  }

  // Edit mode only: the backend has no batch endpoint, so renumbered
  // levels are PUT one at a time. A pure cycle (e.g. swapping levelNumber
  // 1↔2 with no free slot in between) can never be ordered without a
  // transient collision — detect it here instead of letting the user hit
  // an unrecoverable 409 mid-save.
  if (isEdit) {
    const { removed, changed } = computeLevelDiff(levels, originalLevels)
    const occupiedInitial = new Set(
      originalLevels.filter(o => !removed.some(r => r.originalId === o.originalId)).map(o => o.levelNumber),
    )
    const { blocked } = orderLevelUpdates(changed, occupiedInitial, originalLevels)
    if (blocked.length > 0) {
      const nums = blocked.map(b => b.levelNumber).join(', ')
      return `No es posible intercambiar números de nivel directamente (nivel${blocked.length !== 1 ? 'es' : ''} ${nums}). Asigna primero un número libre (puedes aumentar temporalmente el total de niveles) y guarda en dos pasos.`
    }
  }

  return undefined
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PlanForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isView = mode === 'view'
  const isRegister = mode === 'register'
  const isEdit = mode === 'edit'

  // ─── Field state ───────────────────────────────────────────────────────────
  // Los ocho escalares viven en `useFieldValidation`. Los dos booleanos/id de
  // servicio social no: son un switch y un select sin reglas, igual que
  // `continuityProgramId` en Carreras y `directorPersonId` en División.
  const [requiresSocialService, setRequiresSocialService] = useState(false)
  const [socialServiceMinLevelId, setSocialServiceMinLevelId] = useState<string | null>(null)

  // ─── Levels state ──────────────────────────────────────────────────────────
  const [levels, setLevels] = useState<LevelRow[]>(isRegister ? [newLevelRow(1)] : [])
  const [originalLevels, setOriginalLevels] = useState<LevelRow[]>([])

  // ─── Auxiliary state ───────────────────────────────────────────────────────
  const [programs, setPrograms] = useState<SelectOption[]>([])
  const [levelError, setLevelError] = useState<PlanLevelError>(undefined)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(isRegister ? 'idle' : 'loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')
  const [partialResult, setPartialResult] = useState<PartialSaveResult | null>(null)
  const [socialServiceClearedHint, setSocialServiceClearedHint] = useState(false)

  const {
    values,
    fieldError,
    handleChange,
    handleBlur,
    setFieldValue,
    setFieldError,
    reset,
    validate,
    isValid,
  } = useFieldValidation(PLAN_SCHEMA, PLAN_INITIAL_VALUES)

  useEffect(() => {
    setSubmitStatus('idle')
    setSubmitErrorMsg('')
    setLevelError(undefined)
    setPartialResult(null)
    setSocialServiceClearedHint(false)
    if (isRegister) {
      reset()
      setRequiresSocialService(false)
      setSocialServiceMinLevelId(null)
      setLevels([newLevelRow(1)])
      setOriginalLevels([])
      setLoadStatus('idle')
      setLoadErrorMsg('')
    }
  }, [mode, id, reset])

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
        setLoadErrorMsg(getApiErrorMessage(err))
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode])

  function applyPlanDetail(data: AcademicPlanDetail) {
    setFieldValue('programId', data.programId)
    setFieldValue('version', data.version)
    setFieldValue('validityPeriod', data.validityPeriod)
    setFieldValue('titulationKey', data.titulationKey)
    // El DatePicker muestra dd/mm/yyyy: el estado guarda el formato de pantalla.
    setFieldValue('effectiveFrom', isoToDisplay(data.effectiveFrom))
    setFieldValue('totalLevels', String(data.totalLevels))
    setFieldValue('minPassingGrade', String(data.minPassingGrade))
    setFieldValue('maxExtraordinaryExamsPerPeriod', String(data.maxExtraordinaryExamsPerPeriod))
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
    setLevelError(undefined)
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
  // Mantiene la lista de niveles sincronizada con el campo "Total de Niveles":
  // al escribir un total mayor se agregan filas y, si se reduce, se recortan.
  // Los niveles ya guardados que se recorten limpian la selección de servicio
  // social (igual que removeLevel) para no reenviar un uuid eliminado.
  function syncLevelsToTotal(total: number) {
    if (!Number.isInteger(total) || total < 1) return
    if (levels.length < total) {
      const next: LevelRow[] = [...levels]
      for (let i = levels.length + 1; i <= total; i++) next.push(newLevelRow(i))
      setLevels(next)
    } else if (levels.length > total) {
      const removed = levels.slice(total)
      if (removed.some(r => r.originalId !== null && r.originalId === socialServiceMinLevelId)) {
        setSocialServiceMinLevelId(null)
        setSocialServiceClearedHint(true)
      }
      setLevels(levels.slice(0, total))
    }
  }
  function handleRequiresSocialServiceChange(v: boolean) {
    setRequiresSocialService(v)
    if (!v) setSocialServiceMinLevelId(null)
    setSocialServiceClearedHint(false)
  }

  // ─── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    // `validate()` marca todos los escalares como tocados y valida; si algo
    // falla no sale ninguna petición. Las filas de niveles se validan aparte,
    // porque no son campos del schema (ver validateLevels).
    const invalidLevels = validateLevels(levels, values.totalLevels, isEdit, originalLevels)
    if (!validate() || invalidLevels) {
      setLevelError(invalidLevels)
      return
    }
    setLevelError(undefined)
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    setPartialResult(null)

    const scalars: PlanScalarsPayload = {
      version: normalizeText(values.version),
      validityPeriod: normalizeText(values.validityPeriod),
      titulationKey: normalizeText(values.titulationKey),
      effectiveFrom: displayToIso(values.effectiveFrom),
      totalLevels: Number(values.totalLevels),
      minPassingGrade: Number(values.minPassingGrade),
      maxExtraordinaryExamsPerPeriod: Number(values.maxExtraordinaryExamsPerPeriod),
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
      const apiErr = err as ApiError
      if (apiErr?.status === 409 && typeof apiErr.backendMessage === 'string') {
        // El backend ya dice exactamente qué campo se duplicó; se pinta tal
        // cual junto al campo, no en el banner general.
        if (apiErr.backendMessage.includes('versión')) {
          setFieldError('version', apiErr.backendMessage)
          setSubmitStatus('idle')
          return
        }
      }
      setSubmitStatus('error')
      setSubmitErrorMsg(getApiErrorMessage(err))
    }
  }

  // Create flow: POST /plans (socialServiceMinLevelId always null), then
  // sequential POST /plans/{id}/levels per row. Level failures are collected
  // rather than aborting the loop, so the user sees exactly which levels
  // saved and which didn't (design.md has no batch/transactional endpoint).
  async function handleRegister(scalars: PlanScalarsPayload) {
    const payload: CreatePlanPayload = { ...scalars, programId: values.programId }
    const created = await apiPost<AcademicPlanDetail>('/plans', payload)

    const failedLevels: LevelFailure[] = []
    for (const row of levels) {
      try {
        const levelPayload: LevelPayload = { levelNumber: row.levelNumber, type: row.type, description: normalizeText(row.description) || null }
        await apiPost<PlanLevelDetail>(`/plans/${created.id}/levels`, levelPayload)
      } catch (err) {
        failedLevels.push({ levelNumber: row.levelNumber, message: levelErrorMessage(err) })
      }
    }

    if (failedLevels.length === 0) {
      navigate(`/planes/detalle?id=${created.id}`, { state: { toast: 'Plan de estudios registrado exitosamente.' } })
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
  // time — validateLevels() already blocks the submit otherwise.
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
        failedLevels.push({ levelNumber: row.levelNumber, message: deleteLevelErrorMessage(err) })
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

    // Should be empty in practice — validateLevels() already blocks unorderable
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
        const levelPayload: LevelPayload = { levelNumber: row.levelNumber, type: row.type, description: normalizeText(row.description) || null }
        await apiPut<PlanLevelDetail>(`/plans/${id}/levels/${row.originalId}`, levelPayload)
      } catch (err) {
        failedLevels.push({ levelNumber: row.levelNumber, message: levelErrorMessage(err) })
      }
    }
    for (const row of added) {
      attempted++
      try {
        const levelPayload: LevelPayload = { levelNumber: row.levelNumber, type: row.type, description: normalizeText(row.description) || null }
        await apiPost<PlanLevelDetail>(`/plans/${id}/levels`, levelPayload)
      } catch (err) {
        failedLevels.push({ levelNumber: row.levelNumber, message: levelErrorMessage(err) })
      }
    }
    if (failedLevels.length === 0) {
      navigate(`/planes/detalle?id=${id}`, { state: { toast: 'Plan de estudios actualizado exitosamente.' } })
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
    <FormPage>
      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Planes de Estudio', to: '/planes' },
          { label: isRegister ? 'Registrar Plan' : isView ? 'Ver Plan' : 'Editar Plan' },
        ]}
      />

      <FormHeader
        title={isRegister ? 'Registrar Plan de Estudios' : isView ? 'Ver Plan de Estudios' : 'Editar Plan de Estudios'}
        subtitle={isRegister
          ? 'Completa los campos para registrar un nuevo plan de estudios y sus niveles.'
          : isView
          ? 'Información del plan de estudios.'
          : 'Modifica el plan de estudios y sus niveles.'}
        right={
          <ModeSwitcher
            mode={mode}
            id={id}
            registerUrl="/planes/new"
            formUrl={m => m === 'view' ? `/planes/detalle?id=${id}` : `/planes/form?mode=edit&id=${id}`}
          />
        }
      />

      {/* Load error banner */}
      {loadStatus === 'error' && loadErrorMsg && <ErrorBanner message={loadErrorMsg} />}

      {/* Submit error banner (rich — includes per-level failures) */}
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
      <FormCard loading={loadStatus === 'loading'} loadingLabel="Cargando plan de estudios...">
      <>
            {/* ── Sección 1: Datos del Plan ── */}
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-4">Datos del Plan</p>
            <div className="grid grid-cols-12 gap-4 mb-6">

              {/* Programa Educativo */}
              <div className="col-span-12 sm:col-span-8">
                <FieldLabel required={isRegister}>Carrera</FieldLabel>
                <SearchSelectField
                  options={programs}
                  value={values.programId}
                  onChange={handleChange('programId')}
                  placeholder="Seleccionar carrera…"
                  disabled={programDisabled}
                  hasError={!!fieldError('programId')}
                  searchPlaceholder="Buscar carrera…"
                />
                {fieldError('programId')
                  ? <FieldError>{fieldError('programId')}</FieldError>
                  : <FieldHelp>{isEdit ? 'La carrera no se puede modificar una vez creado el plan.' : 'Carrera a la que pertenece este plan.'}</FieldHelp>}
              </div>

              <TextField
                label="Versión"
                required={!isView}
                value={values.version}
                onChange={handleChange('version')}
                onBlur={handleBlur('version')}
                disabled={disabled}
                error={fieldError('version')}
                maxLength={50}
                placeholder="Ej. 2024-1"
                help="Identifica el plan dentro de la carrera (único por carrera)."
                className="col-span-12 sm:col-span-4"
              />

              {/* Periodo de vigencia */}
              <TextField
                label="Periodo de Vigencia"
                required={!isView}
                value={values.validityPeriod}
                onChange={handleChange('validityPeriod')}
                onBlur={handleBlur('validityPeriod')}
                disabled={disabled}
                error={fieldError('validityPeriod')}
                maxLength={100}
                placeholder="Ej. 2024-2028"
                className="col-span-12 sm:col-span-6"
              />

              {/* Clave de titulación */}
              <TextField
                label="Clave de Titulación"
                required={!isView}
                value={values.titulationKey}
                onChange={handleChange('titulationKey')}
                onBlur={handleBlur('titulationKey')}
                disabled={disabled}
                error={fieldError('titulationKey')}
                maxLength={100}
                placeholder="Ej. IDGS-TIT-2024"
                className="col-span-12 sm:col-span-6"
              />

              {/* Vigente desde */}
              <div className="col-span-12 sm:col-span-4">
                <FieldLabel required={!isView}>Vigente Desde</FieldLabel>
                <DatePicker
                  value={values.effectiveFrom}
                  onChange={handleChange('effectiveFrom')}
                  onBlur={handleBlur('effectiveFrom')}
                  disabled={disabled}
                  error={!!fieldError('effectiveFrom')}
                />
                {fieldError('effectiveFrom') && <FieldError>{fieldError('effectiveFrom')}</FieldError>}
              </div>

              {/* Total de niveles */}
              <TextField
                label="Total de Niveles"
                required={!isView}
                type="number"
                min={1}
                value={values.totalLevels}
                onChange={v => {
                  handleChange('totalLevels')(v)
                  const num = Number(v)
                  if (Number.isInteger(num) && num >= 1) syncLevelsToTotal(num)
                }}
                onBlur={handleBlur('totalLevels')}
                disabled={disabled}
                error={fieldError('totalLevels')}
                numeric
                placeholder="Ej. 10"
                help="Cantidad total de niveles que tendrá el plan."
                className="col-span-12 sm:col-span-4"
              />
            </div>

            {/* ── Sección 2: Parámetros de Evaluación ── */}
            <div className="flex items-center gap-4 my-6">
              <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest whitespace-nowrap">Parámetros de Evaluación</p>
              <div className="flex-1 h-px bg-[#E5E7EB]" />
            </div>

            <div className="grid grid-cols-12 gap-4 mb-4">
              {/* Calificación mínima aprobatoria */}
              <TextField
                label="Calificación Mínima Aprobatoria"
                required={!isView}
                type="number"
                min={0}
                max={10}
                step="0.1"
                value={values.minPassingGrade}
                onChange={handleChange('minPassingGrade')}
                onBlur={handleBlur('minPassingGrade')}
                disabled={disabled}
                error={fieldError('minPassingGrade')}
                numeric
                placeholder="Ej. 7.0"
                help="Escala de 0 a 10."
                className="col-span-12 sm:col-span-4"
              />

              {/* Extraordinarios máximos por periodo */}
              <TextField
                label="Extraordinarios Máx. por Periodo"
                required={!isView}
                type="number"
                min={0}
                value={values.maxExtraordinaryExamsPerPeriod}
                onChange={handleChange('maxExtraordinaryExamsPerPeriod')}
                onBlur={handleBlur('maxExtraordinaryExamsPerPeriod')}
                disabled={disabled}
                error={fieldError('maxExtraordinaryExamsPerPeriod')}
                numeric
                placeholder="Ej. 2"
                help="Número máximo de exámenes extraordinarios por periodo."
                className="col-span-12 sm:col-span-4"
              />

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

            {levelError && <FieldError>{levelError}</FieldError>}

            {/* Desktop table (md+) */}
            <div className="hidden md:block border border-[#E5E7EB] rounded-lg mt-2">
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
                            <SelectField
                              value={row.type}
                              onChange={v => updateLevel(row.key, { type: v as PlanLevelType })}
                              options={(Object.keys(LEVEL_TYPE_LABELS) as PlanLevelType[]).map(t => ({ value: t, label: LEVEL_TYPE_LABELS[t] }))}
                            />
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
                        <TextField
                          label="Número de Nivel"
                          type="number"
                          min={1}
                          value={String(row.levelNumber)}
                          onChange={v => updateLevel(row.key, { levelNumber: Number(v) })}
                          numeric
                        />
                        <SelectField
                          label="Tipo"
                          value={row.type}
                          onChange={v => updateLevel(row.key, { type: v as PlanLevelType })}
                          options={(Object.keys(LEVEL_TYPE_LABELS) as PlanLevelType[]).map(t => ({ value: t, label: LEVEL_TYPE_LABELS[t] }))}
                        />
                        <TextField
                          label="Descripción"
                          value={row.description}
                          onChange={v => updateLevel(row.key, { description: v })}
                          placeholder="Opcional"
                        />
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
      </FormCard>

      {/* Actions */}
      {loadStatus !== 'loading' && (
        <FormActions
          isView={isView}
          onBack={() => navigate('/planes')}
          onPrimary={isView ? () => navigate(`/planes/form?mode=edit&id=${id}`) : handleSubmit}
          primaryLabel={isView ? 'Editar' : isRegister ? 'Registrar Plan' : 'Guardar Cambios'}
          isSubmitting={isSubmitting}
          primaryDisabled={!isView && !isValid}
        />
      )}
    </FormPage>
  )
}
