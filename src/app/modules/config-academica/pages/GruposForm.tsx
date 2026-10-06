import { useEffect, useState } from 'react'
import { FieldLabel, FieldHelp, FieldError, ModeSwitcher, SearchSelectField } from '@app/core/components/ui'
import type { SelectOption } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField, SelectField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate } from 'react-router'
import { useFormMode } from '@app/core/infra/hooks'
import { apiGet, apiPost, apiPut, getApiErrorMessage, type ApiError } from '@app/core/infra/apiClient'
import { useFieldValidation } from '@app/core/validation/useFieldValidation'
import {
  required,
  selectionRequired,
  maxLength,
  noControlChars,
  numeric,
  pattern,
} from '@app/core/validation/fieldRules'

// ─── Schema de validación ──────────────────────────────────────────────────────
// Se declara fuera del componente para que su identidad sea estable: el hook lo
// usa como dependencia de sus callbacks.
//
//   code        → dígitos seguidos de UNA letra, hasta 10 caracteres: "3A", "12B".
//                 El formato lo fijó el usuario el 2026-10-05: el doc de dominio
//                 dice `Ej: "3A", "3B"`, el placeholder de este form decía
//                 "Ej. A" y el md de la fase 8 hablaba de "la letra". Se adopts
//                 el formato del doc y se corrigió el placeholder. El `\p{L}` acepta
//                 minúsculas, así que "3a" pasa la regla y lo sube a mayúscula el
//                 backend (`GroupTextNormalizer`); el frontend también lo pasa a
//                 mayúscula al teclear, que es sólo cortesía visual.
//   maxCapacity → entero desde 1, sin techo (decisión del usuario, 2026-10-05).
//   Los selects → obligatorios.
//
// El `\p{N}+` inicial es lo que hace la regla coherente con la clave única
// (generationId, code): dos grupos del mismo nivel no pueden diferir sólo en la
// letra, y el nivel forma parte del código justamente por eso.
//
// No hay `crossRules`: nada aquí depende de dos campos a la vez. La unicidad la
// decide el servidor (409) y se pinta en `code`.

const GRUPOS_INITIAL_VALUES = {
  programId: '',
  generationId: '',
  periodId: '',
  planLevelId: '',
  shift: '',
  code: '',
  maxCapacity: '',
} as const

const GRUPOS_SCHEMA = {
  programId: { rules: [required('la carrera')] },
  generationId: { rules: [required('la generación')] },
  periodId: { rules: [selectionRequired('el periodo académico')] },
  planLevelId: { rules: [selectionRequired('el nivel del plan')] },
  shift: { rules: [selectionRequired('el turno')] },
  code: {
    rules: [
      required('la clave del grupo'),
      maxLength(10, 'clave del grupo'),
      noControlChars('clave del grupo'),
      pattern(/^\p{N}+\p{L}+$/u, 'La clave debe ser el nivel seguido de la letra, por ejemplo 3A.'),
    ],
  },
  maxCapacity: {
    rules: [required('la capacidad máxima'), numeric({ label: 'capacidad máxima', min: 1 })],
  },
} as const

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

  const {
    values,
    fieldError,
    handleChange,
    handleBlur,
    setFieldValue,
    setFieldError,
    clearErrors,
    reset,
    isValid,
    validate,
  } = useFieldValidation(GRUPOS_SCHEMA, GRUPOS_INITIAL_VALUES)

  // `programId` es solo un filtro de UI para cascadear la Generacion: nunca se
  // manda. Se valida igual porque la cascada depende de el, igual que en
  // GeneracionesForm.

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
      reset(GRUPOS_INITIAL_VALUES)
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
        setFieldValue('programId', data.programId)
        setFieldValue('generationId', data.generationId)
        setFieldValue('periodId', data.periodId)
        setFieldValue('planLevelId', data.planLevelId)
        setFieldValue('shift', data.shift)
        setFieldValue('code', data.code)
        setFieldValue('maxCapacity', String(data.maxCapacity))
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

  // Fetches the selected Generación's plan levels. Re-runs both on a manual
  // Generación change AND once the `generations` catalog finishes loading
  // (needed to backfill on edit, since the GET-by-id fetch above sets
  // `generationId` before the catalog necessarily has that generation yet).
  useEffect(() => {
    if (!values.generationId) { setPlanLevels([]); return }
    const generation = generations.find(g => g.id === values.generationId)
    if (!generation) return
    let cancelled = false
    apiGet<AcademicPlanDetail>(`/plans/${generation.planId}`)
      .then(data => { if (!cancelled) setPlanLevels(data.levels) })
      .catch(() => { if (!cancelled) setPlanLevels([]) })
    return () => { cancelled = true }
  }, [values.generationId, generations])

  const disabled = loadStatus === 'loading' || isView
  const isSubmitting = submitStatus === 'submitting'

  const programOptions: SelectOption[] = programs.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` }))
  const generationOptions: SelectOption[] = generations
    .filter(g => g.programId === values.programId)
    .map(g => ({ value: g.id, label: g.code }))
  const periodOptions: SelectOption[] = periods.map(p => ({ value: p.id, label: p.name }))
  const planLevelOptions: SelectOption[] = planLevels
    .slice()
    .sort((a, b) => a.levelNumber - b.levelNumber)
    .map(l => ({ value: l.id, label: `Nivel ${l.levelNumber}${l.description ? ` — ${l.description}` : ''}` }))

  function handleProgramChange(v: string) {
    // Reelegir la misma carrera no borra nada: el reset solo aplica al cambio
    // real, que deja huérfanos la generación y el nivel filtrados antes.
    if (v === values.programId) return
    setFieldValue('programId', v)
    setFieldValue('generationId', '') // reset dependent selects
    setFieldValue('planLevelId', '')
  }

  function handleGenerationChange(v: string) {
    setFieldValue('generationId', v)
    // El nivel depende del plan de la generación, así que también se reinicia
    // al elegir la MISMA generación de nuevo.
    setFieldValue('planLevelId', '')
  }

  async function handleSubmit() {
    // `validate()` marca todos los campos como tocados: un error que estaba
    // oculto sale a pantalla en vez de irse al API.
    if (!validate()) return
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    clearErrors()
    const payload: GroupFormPayload = {
      generationId: values.generationId,
      periodId: values.periodId,
      planLevelId: values.planLevelId,
      code: values.code,
      maxCapacity: Number(values.maxCapacity),
      shift: values.shift as Shift,
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
      // Cualquier 409 de POST/PUT /groups es, sin excepcion, el duplicado de
      // (generationId, code): es la única clave única de la tabla, y los unicos
      // handlers que devuelven 409 aca son ese y el de la creación masiva, que
      // no pasa por este formulario. Se atribuye a `code` sin mirar el texto:
      // `backendMessage` es el `message` de ErrorResponse, copy en espanol, y no
      // menciona ningun campo.
      const apiErr = err as ApiError
      if (apiErr?.status === 409) {
        setFieldError('code', getApiErrorMessage(err))
        setSubmitStatus('idle')
        return
      }
      setSubmitStatus('error')
      setSubmitErrorMsg(getApiErrorMessage(err))
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
          {/* 6/6 en desktop y 12/12 en movil, como pide el md de la fase 8. Antes
              era 4/8: la Generacion quedaba comprimida frente a un campo que
              solo filtra. */}
          <div className="col-span-12 sm:col-span-6">
            <FieldLabel required={!isView}>Carrera</FieldLabel>
            <SearchSelectField
              options={programOptions}
              value={values.programId}
              onChange={handleProgramChange}
              placeholder="Selecciona la carrera"
              disabled={disabled}
              hasError={!!fieldError('programId')}
              searchPlaceholder="Buscar carrera…"
            />
            {fieldError('programId')
              ? <FieldError>{fieldError('programId')}</FieldError>
              : <FieldHelp>Filtra las generaciones disponibles.</FieldHelp>}
          </div>
          <div className="col-span-12 sm:col-span-6">
            <FieldLabel required={!isView}>Generación</FieldLabel>
            <SearchSelectField
              options={generationOptions}
              value={values.generationId}
              onChange={handleGenerationChange}
              placeholder="Selecciona la generación"
              disabled={disabled || !values.programId}
              hasError={!!fieldError('generationId')}
              searchPlaceholder="Buscar generación…"
            />
            {fieldError('generationId')
              ? <FieldError>{fieldError('generationId')}</FieldError>
              : <FieldHelp>Determina el plan de estudios del grupo (ej. &ldquo;2026-7&rdquo;).</FieldHelp>}
          </div>

          {/* Fila 2 */}
          <div className="col-span-12 sm:col-span-6">
            <FieldLabel required={!isView}>Periodo Académico</FieldLabel>
            <SearchSelectField
              options={periodOptions}
              value={values.periodId}
              onChange={handleChange('periodId')}
              placeholder="Selecciona el periodo"
              disabled={disabled}
              hasError={!!fieldError('periodId')}
              searchPlaceholder="Buscar periodo…"
            />
            {fieldError('periodId') && <FieldError>{fieldError('periodId')}</FieldError>}
          </div>
          <div className="col-span-12 sm:col-span-6">
            <FieldLabel required={!isView}>Nivel del Plan</FieldLabel>
            <SearchSelectField
              options={planLevelOptions}
              value={values.planLevelId}
              onChange={handleChange('planLevelId')}
              placeholder="Selecciona el nivel"
              disabled={disabled || !values.generationId}
              hasError={!!fieldError('planLevelId')}
              searchPlaceholder="Buscar nivel…"
            />
            {fieldError('planLevelId') && <FieldError>{fieldError('planLevelId')}</FieldError>}
          </div>

          {/* Fila 3 */}
          <SelectField
            label="Turno"
            required={!isView}
            value={values.shift}
            onChange={handleChange('shift')}
            disabled={disabled}
            error={fieldError('shift')}
            options={SHIFT_OPTIONS}
            placeholder="Selecciona el turno"
            className="col-span-12 sm:col-span-4"
          />
          {/* El `toUpperCase` es cortesía visual: la regla acepta minúsculas y el
              backend sube a mayúscula igual (`GroupTextNormalizer`). El
              placeholder decía "Ej. A" y el help prometía un "IDGS-101-A" que
              ningún endpoint genera; ambos se corrigen al formato real. */}
          <TextField
            label="Clave del Grupo"
            required={!isView}
            value={values.code}
            onChange={handleChange('code')}
            onBlur={handleBlur('code')}
            disabled={disabled}
            placeholder="Ej. 3A"
            error={fieldError('code')}
            help="Nivel seguido de la letra. Es única dentro de la generación."
            className="col-span-6 sm:col-span-4"
          />
          <TextField
            label="Capacidad Máxima"
            required={!isView}
            type="number"
            min={1}
            value={values.maxCapacity}
            onChange={handleChange('maxCapacity')}
            onBlur={handleBlur('maxCapacity')}
            disabled={disabled}
            numeric
            error={fieldError('maxCapacity')}
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
          primaryDisabled={disabled || !isValid}
        />
      )}
    </FormPage>
  )
}
