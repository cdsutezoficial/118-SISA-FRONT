import { useCallback, useEffect, useState } from 'react'
import { FieldLabel, FieldHelp, FieldError, ModeSwitcher, SearchSelectField } from '@app/core/components/ui'
import type { SelectOption } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField, SelectField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate } from 'react-router'
import { useFormMode } from '@app/core/infra/hooks'
import { apiGet, apiPost, apiPut, getApiErrorMessage, type ApiError } from '@app/core/infra/apiClient'
import { programLabel } from '@app/core/infra/programLabel'
import { useFieldValidation, type FieldErrors } from '@app/core/validation/useFieldValidation'
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
//                 "Ej. A" y el md de la fase 8 hablaba de "la letra". Se adoptó
//                 el formato del doc y se corrigió el placeholder. El `\p{L}` acepta
//                 minúsculas, así que "3a" pasa la regla y lo sube a mayúscula el
//                 backend (`GroupTextNormalizer`); el frontend lo pasa a mayúscula
//                 al teclear, que es sólo cortesía visual.
//   maxCapacity → entero desde 1, sin techo (decisión del usuario, 2026-10-05).
//   Los selects → obligatorios.
//
// El `\p{N}+` inicial es lo que hace la regla coherente con la clave única
// (generationId, code): dos grupos del mismo nivel no pueden diferir sólo en la
// letra, y el nivel forma parte del código justamente por eso.
//
// `quantity` NO tiene reglas aquí, y es a propósito. Las reglas del lote dependen
// de un dato que no es un campo del formulario — si el check de "crear masivamente"
// está marcado o no — y el schema no puede ser dinámico: `runFieldRules` depende
// de `fieldNames`, no de la identidad del schema, así que unas reglas cambiadas
// en caliente no se aplicarían (el hook lo advierte en un comentario). Por eso la
// validación del lote va en `crossRules`, que sí ve todos los valores.

const GRUPOS_INITIAL_VALUES = {
  programId: '',
  generationId: '',
  periodId: '',
  planLevelId: '',
  shift: '',
  code: '',
  maxCapacity: '',
  quantity: '',
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
      pattern(/^\p{N}+\p{L}$/u, 'La clave debe ser el nivel seguido de una sola letra, por ejemplo 3A.'),
    ],
  },
  maxCapacity: {
    rules: [required('la capacidad máxima'), numeric({ label: 'capacidad máxima', min: 1 })],
  },
  quantity: { rules: [] },
} as const

type GruposField = keyof typeof GRUPOS_INITIAL_VALUES
type GruposValues = Record<GruposField, string>

// Techo de la letra: el backend asigna A–Z y su `@Max(26)` en
// `CreateGroupsBulkRequest` corta en la misma cifra. El 26 no es un capricho: el
// `^\p{N}+\p{L}$` que comparten los DTO y este form exige **una sola** letra, así
// que no hay convención de qué sigue a la Z y no se inventa una.
///
/// El cuantificador `+` en la letra fue un descuido que sobrevivió a la revisión:
// el comentario de abajo ya razonaba como si la regla fuera de una letra, pero
// el patrón aceptaba "3AA". Corregido el 2026-10-05 en los tres sitios —los dos
// DTO y este form— para que el contrato real sea el que el documento pedía
// ("3A", "3B") y el que el alta masiva genera.
const MAX_BULK = 26

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

/** Cuerpo de `POST /groups/bulk`: sin `code`, porque las claves las asigna el servidor. */
interface GroupBulkPayload {
  generationId: string
  periodId: string
  planLevelId: string
  quantity: number
  maxCapacity: number
  shift: Shift
}

interface CodesPreviewResponse {
  levelPrefix: string
  codes: string[]
}

interface ProgramSummary {
  id: string
  name: string
  code: string
  modality?: string
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

  // El modo masivo es estado de UI, no un campo del formulario: no se manda ni se
  // guarda, sólo decide cuál de los dos endpoints se usa y si `quantity` cuenta.
  const [isBulk, setIsBulk] = useState(false)
  const [preview, setPreview] = useState<CodesPreviewResponse | null>(null)
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [previewErrorMsg, setPreviewErrorMsg] = useState('')

  // `programId` es sólo un filtro de UI para cascadear la Generación: nunca se
  // manda. Se valida igual porque la cascada depende de él, igual que en
  // GeneracionesForm.

  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [generations, setGenerations] = useState<GenerationSummary[]>([])
  const [periods, setPeriods] = useState<PeriodSummary[]>([])
  const [planLevels, setPlanLevels] = useState<PlanLevelSummary[]>([])

  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(isRegister ? 'idle' : 'loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  // La cantidad es el único campo cuya obligatoriedad depende del check, así que
  // su regla vive aquí y no en el schema (ver la nota del schema más arriba).
  // El copy sale de las mismas reglas de la librería que el resto del form, para
  // que "es requerido" no sea una variante escrita a mano.
  const crossRules = useCallback((current: GruposValues): FieldErrors<GruposField> => {
    if (!isBulk) return {}
    const value = current.quantity.trim()
    if (!value) return { quantity: required('la cantidad de grupos', 'f')(value) }
    const error = numeric({ label: 'cantidad de grupos', gender: 'f', min: 1, max: MAX_BULK })(value)
    return error ? { quantity: error } : {}
  }, [isBulk])

  const {
    values: formValues,
    fieldError: fieldErrorOf,
    handleChange: changeField,
    handleBlur: blurField,
    setFieldValue: setValue,
    setFieldError: setError,
    clearErrors: clearFieldErrors,
    reset: resetForm,
    isValid: formIsValid,
    validate: validateForm,
  } = useFieldValidation(GRUPOS_SCHEMA, GRUPOS_INITIAL_VALUES, { crossRules })

  useEffect(() => {
    setSubmitStatus('idle')
    setSubmitErrorMsg('')
    // El check sólo existe en el alta, así que al salir de aquí se apaga. Sin
    // esto, `isBulk` sobrevive a un `reset()` (que no lo toca, no es un campo) y
    // el mismo componente volvería a registrar en lote sin haberlo pedido.
    setIsBulk(false)
    setPreview(null)
    setPreviewStatus('idle')
    setPreviewErrorMsg('')
    resetForm(GRUPOS_INITIAL_VALUES)
    setLoadStatus(isRegister ? 'idle' : 'loading')
    setLoadErrorMsg('')
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
        setValue('programId', data.programId)
        setValue('generationId', data.generationId)
        setValue('periodId', data.periodId)
        setValue('planLevelId', data.planLevelId)
        setValue('shift', data.shift)
        setValue('code', data.code)
        setValue('maxCapacity', String(data.maxCapacity))
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
    if (!formValues.generationId) { setPlanLevels([]); return }
    const generation = generations.find(g => g.id === formValues.generationId)
    if (!generation) return
    let cancelled = false
    apiGet<AcademicPlanDetail>(`/plans/${generation.planId}`)
      .then(data => { if (!cancelled) setPlanLevels(data.levels) })
      .catch(() => { if (!cancelled) setPlanLevels([]) })
    return () => { cancelled = true }
  }, [formValues.generationId, generations])

  // ─── Vista previa de las claves ───────────────────────────────────────────
  // Las letras se piden al servidor (`GET /groups/next-codes`) en vez de
  // calcularlas aquí: si el cliente replicara la regla de "primera letra libre",
  // serían dos implementaciones de la misma regla que divergen. El preview y la
  // ejecución comparten el asignador, así que lo que se muestra es lo que sale —
  // salvo que otra transacción tome las letras en medio, y entonces el 409 de la
  // creación lo dice.
  //
  // De la respuesta sale también `code`: se muestra la primera clave del lote, no
  // el prefijo pelado, porque el campo tiene que seguir cumpliendo el patrón
  // `^\p{N}+\p{L}$` de arriba y "3" no lo cumple. Es el mismo valor que asigna el
  // servidor, así que el campo no puede contradecir al nivel.
  const bulkQuantity = Number(formValues.quantity)
  const canPreview = isBulk && !!formValues.generationId && !!formValues.planLevelId
    && formValues.quantity.trim() !== '' && Number.isInteger(bulkQuantity)
    && bulkQuantity >= 1 && bulkQuantity <= MAX_BULK

  useEffect(() => {
    if (!canPreview) {
      setPreview(null)
      setPreviewStatus('idle')
      setPreviewErrorMsg('')
      // Sin vista previa no hay clave que mostrar, y una clave inventada
      // deshabilitaría el botón de guardar sin explicación.
      if (isBulk) setValue('code', '')
      return
    }
    let cancelled = false
    setPreviewStatus('loading')
    setPreviewErrorMsg('')
    apiGet<CodesPreviewResponse>('/groups/next-codes', {
      generationId: formValues.generationId,
      planLevelId: formValues.planLevelId,
      quantity: bulkQuantity,
    })
      .then(data => {
        if (cancelled) return
        setPreview(data)
        setPreviewStatus('idle')
        setValue('code', data.codes[0] ?? '')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        // Un 409 aquí significa que no quedan letras libres: es el aviso que
        // evita que el usuario llene el formulario para que el submit falle.
        setPreview(null)
        setPreviewStatus('error')
        setPreviewErrorMsg(getApiErrorMessage(err))
        setValue('code', '')
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBulk, canPreview, bulkQuantity, formValues.generationId, formValues.planLevelId])

  const disabled = loadStatus === 'loading' || isView
  const isSubmitting = submitStatus === 'submitting'

  const programOptions: SelectOption[] = programs.map(p => ({ value: p.id, label: programLabel(p) }))
  const generationOptions: SelectOption[] = generations
    .filter(g => g.programId === formValues.programId)
    .map(g => ({ value: g.id, label: g.code }))
  const periodOptions: SelectOption[] = periods.map(p => ({ value: p.id, label: p.name }))
  const planLevelOptions: SelectOption[] = planLevels
    .slice()
    .sort((a, b) => a.levelNumber - b.levelNumber)
    .map(l => ({ value: l.id, label: `Nivel ${l.levelNumber}${l.description ? ` — ${l.description}` : ''}` }))

  function handleProgramChange(v: string) {
    // Reelegir la misma carrera no borra nada: el reset sólo aplica al cambio
    // real, que deja huérfanos la generación y el nivel filtrados antes.
    if (v === formValues.programId) return
    setValue('programId', v)
    setValue('generationId', '') // reset dependent selects
    setValue('planLevelId', '')
  }

  function handleGenerationChange(v: string) {
    setValue('generationId', v)
    // El nivel depende del plan de la generación, así que también se reinicia
    // al elegir la MISMA generación de nuevo.
    setValue('planLevelId', '')
  }

  function handleBulkToggle(checked: boolean) {
    setIsBulk(checked)
    setPreview(null)
    setPreviewStatus('idle')
    setPreviewErrorMsg('')
    // Al apagar el modo masivo, `quantity` se vacía y `code` vuelve a ser del
    // usuario: si no, el formulario queda con la cantidad escrita a la vista
    // mientras ya no hace nada, o con una clave autogenerada que al cambiar el
    // nivel se queda vieja.
    if (!checked) {
      setValue('quantity', '')
      setValue('code', '')
    }
    setSubmitStatus('idle')
    setSubmitErrorMsg('')
  }

  async function handleSubmit() {
    // `validate()` marca todos los campos como tocados: un error que estaba
    // oculto sale a pantalla en vez de irse al API.
    if (!validateForm()) return
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    clearFieldErrors()
    try {
      if (isBulk) {
        const payload: GroupBulkPayload = {
          generationId: formValues.generationId,
          periodId: formValues.periodId,
          planLevelId: formValues.planLevelId,
          quantity: bulkQuantity,
          maxCapacity: Number(formValues.maxCapacity),
          shift: formValues.shift as Shift,
        }
        const created = await apiPost<GroupResponse[]>('/groups/bulk', payload)
        setSubmitStatus('idle')
        // A diferencia del alta individual, aquí no hay un único `id` al que
        // llevar: son N grupos recién creados, así que el destino es el listado.
        // El toast lo lee `GruposList` con `usePendingToast`, igual que en el
        // resto de navegaciones de este módulo.
        navigate('/grupos', { state: { toast: `${created.length} grupos registrados exitosamente.` } })
        return
      }
      const payload: GroupFormPayload = {
        generationId: formValues.generationId,
        periodId: formValues.periodId,
        planLevelId: formValues.planLevelId,
        code: formValues.code,
        maxCapacity: Number(formValues.maxCapacity),
        shift: formValues.shift as Shift,
      }
      if (isRegister) {
        const created = await apiPost<GroupResponse>('/groups', payload)
        navigate(`/grupos/form?mode=view&id=${created.id}`, { state: { toast: 'Grupo registrado exitosamente.' } })
      } else if (id) {
        await apiPut<GroupResponse>(`/groups/${id}`, payload)
        navigate(`/grupos/form?mode=view&id=${id}`, { state: { toast: 'Grupo actualizado exitosamente.' } })
      }
    } catch (err) {
      const apiErr = err as ApiError
      // 400 con código: la clave no describe al nivel elegido (Nivel 3 con
      // `5A`). Es el único 400 con `code` que llega de POST/PUT /groups, así
      // que basta el código para pegarlo al campo `code` sin mirar el texto,
      // igual que el 409 del duplicado de abajo.
      if (apiErr?.code === 'GROUP_CODE_LEVEL_MISMATCH') {
        const msg = getApiErrorMessage(err)
        setError('code', msg)
        setSubmitStatus('error')
        setSubmitErrorMsg(msg)
        return
      }
      // 409 en el alta individual: sin excepción es el duplicado de
      // (generationId, code), la única clave única de la tabla, así que va al
      // campo `code` sin mirar el texto, y también al banner con el mismo
      // mensaje. `backendMessage` es el `message` de ErrorResponse, copy en
      // español que no menciona ningún campo.
      //
      // En el lote NO se adjudica a `code`: allí el 409 es `NotEnoughGroupCodes`,
      // un problema del nivel entero, no de una clave que el usuario escribió. Va
      // sólo al banner, que es donde cabe un error de esa granularidad.
      if (apiErr?.status === 409 && !isBulk) {
        const msg = getApiErrorMessage(err)
        setError('code', msg)
        setSubmitStatus('error')
        setSubmitErrorMsg(msg)
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

  // El check sólo tiene sentido al registrar: editar o ver es siempre un grupo
  // concreto que ya existe, y un lote de edición no tiene a qué aplicarse.
  const bulkAvailable = isRegister && !disabled

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
          {/* 6/6 en desktop y 12/12 en móvil, como pide el md de la fase 8. Antes
              era 4/8: la Generación quedaba comprimida frente a un campo que
              sólo filtra. */}
          <div className="col-span-12 sm:col-span-6">
            <FieldLabel required={!isView}>Carrera</FieldLabel>
            <SearchSelectField
              options={programOptions}
              value={formValues.programId}
              onChange={handleProgramChange}
              placeholder="Selecciona la carrera"
              disabled={disabled}
              hasError={!!fieldErrorOf('programId')}
              searchPlaceholder="Buscar carrera…"
            />
            {fieldErrorOf('programId')
              ? <FieldError>{fieldErrorOf('programId')}</FieldError>
              : <FieldHelp>Filtra las generaciones disponibles.</FieldHelp>}
          </div>
          <div className="col-span-12 sm:col-span-6">
            <FieldLabel required={!isView}>Generación</FieldLabel>
            <SearchSelectField
              options={generationOptions}
              value={formValues.generationId}
              onChange={handleGenerationChange}
              placeholder="Selecciona la generación"
              disabled={disabled || !formValues.programId}
              hasError={!!fieldErrorOf('generationId')}
              searchPlaceholder="Buscar generación…"
            />
            {fieldErrorOf('generationId')
              ? <FieldError>{fieldErrorOf('generationId')}</FieldError>
              : <FieldHelp>Determina el plan de estudios del grupo (ej. &ldquo;2026-7&rdquo;).</FieldHelp>}
          </div>

          {/* Fila 2 */}
          <div className="col-span-12 sm:col-span-6">
            <FieldLabel required={!isView}>Periodo Académico</FieldLabel>
            <SearchSelectField
              options={periodOptions}
              value={formValues.periodId}
              onChange={changeField('periodId')}
              placeholder="Selecciona el periodo"
              disabled={disabled}
              hasError={!!fieldErrorOf('periodId')}
              searchPlaceholder="Buscar periodo…"
            />
            {fieldErrorOf('periodId') && <FieldError>{fieldErrorOf('periodId')}</FieldError>}
          </div>
          <div className="col-span-12 sm:col-span-6">
            <FieldLabel required={!isView}>Nivel del Plan</FieldLabel>
            <SearchSelectField
              options={planLevelOptions}
              value={formValues.planLevelId}
              onChange={changeField('planLevelId')}
              placeholder="Selecciona el nivel"
              disabled={disabled || !formValues.generationId}
              hasError={!!fieldErrorOf('planLevelId')}
              searchPlaceholder="Buscar nivel…"
            />
            {fieldErrorOf('planLevelId') && <FieldError>{fieldErrorOf('planLevelId')}</FieldError>}
          </div>

          {/* Fila 3 */}
          <SelectField
            label="Turno"
            required={!isView}
            value={formValues.shift}
            onChange={changeField('shift')}
            disabled={disabled}
            error={fieldErrorOf('shift')}
            options={SHIFT_OPTIONS}
            placeholder="Selecciona el turno"
            className="col-span-12 sm:col-span-4"
          />
          {/* En alta individual la clave se teclea entera ("3A"). `readOnly`, no
              `disabled`, en lote porque el valor sigue siendo el que se guarda
              (la primera del lote) y un campo gris se lee como irrelevante. */}
          <TextField
            label="Clave del Grupo"
            required={!isView}
            value={formValues.code}
            onChange={changeField('code')}
            onBlur={blurField('code')}
            disabled={disabled}
            readOnly={isBulk}
            placeholder="Ej. 3A"
            error={fieldErrorOf('code')}
            help={isBulk
              ? 'Se genera sola: la primera del lote, a partir del nivel.'
              : 'Nivel seguido de la letra. Es única dentro de la generación.'}
            className="col-span-6 sm:col-span-4"
          />
          <TextField
            label="Capacidad Máxima"
            required={!isView}
            type="number"
            min={1}
            value={formValues.maxCapacity}
            onChange={changeField('maxCapacity')}
            onBlur={blurField('maxCapacity')}
            disabled={disabled}
            numeric
            error={fieldErrorOf('maxCapacity')}
            placeholder="Ej. 30"
            className="col-span-6 sm:col-span-4"
          />

          {/* Fila 4 — sólo en alta: el check que convierte el alta individual en
              un lote.Va fuera de la fila 3 porque el modo masivo necesita su propio
              ancho completo para la vista previa de las letras. */}
          {bulkAvailable && (
            <div className="col-span-12">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={isBulk}
                  onChange={e => handleBulkToggle(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-[#009574]"
                />
                <span className="text-[13px] text-[#333333]">
                  Crear varios grupos de una vez
                  <span className="mt-0.5 block text-[12px] text-gray-500">
                    Las claves se asignan solas a partir del nivel, empezando en la primera letra libre.
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* Fila 5 — cantidad y letras del lote */}
          {isBulk && (
            <>
              <TextField
                label="Cantidad de Grupos"
                required
                type="number"
                min={1}
                max={MAX_BULK}
                value={formValues.quantity}
                onChange={changeField('quantity')}
                onBlur={blurField('quantity')}
                numeric
                error={fieldErrorOf('quantity')}
                placeholder="Ej. 3"
                className="col-span-12 sm:col-span-4"
              />
              <div className="col-span-12 sm:col-span-8">
                <FieldLabel>Claves que se van a crear</FieldLabel>
                {previewStatus === 'error' ? (
                  <FieldError>{previewErrorMsg}</FieldError>
                ) : previewStatus === 'loading' || !preview ? (
                  <FieldHelp>
                    Elige generación, nivel y cantidad para ver las claves.
                  </FieldHelp>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {preview.codes.map(code => (
                      <span
                        key={code}
                        className="rounded border border-[#009574]/30 bg-[#e6f5f1] px-2 py-0.5 font-mono text-[12px] text-[#007a5e]"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </FormCard>

      {/* Actions */}
      {loadStatus !== 'loading' && (
        <FormActions
          isView={isView}
          onBack={() => navigate('/grupos')}
          onPrimary={isView ? () => navigate(`/grupos/form?mode=edit&id=${id}`) : handleSubmit}
          primaryLabel={isView
            ? 'Editar'
            : isBulk
              ? 'Registrar Grupos'
              : isRegister
                ? 'Registrar Grupo'
                : 'Guardar Cambios'}
          isSubmitting={isSubmitting}
          primaryDisabled={disabled || !formIsValid}
        />
      )}
    </FormPage>
  )
}
