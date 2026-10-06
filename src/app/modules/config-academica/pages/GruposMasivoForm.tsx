import { useEffect, useState } from 'react'
import { Info, Loader2 } from 'lucide-react'
import { FieldLabel, FieldHelp, FieldError, SearchSelectField } from '@app/core/components/ui'
import type { SelectOption } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField, SelectField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate } from 'react-router'
import { apiGet, apiPost, getApiErrorMessage, type ApiError } from '@app/core/infra/apiClient'
import { useFieldValidation } from '@app/core/validation/useFieldValidation'
import { required, selectionRequired, numeric } from '@app/core/validation/fieldRules'

// ─── Types ─────────────────────────────────────────────────────────────────────
// Creación masiva de grupos — la Fase 8 pide "seleccionar carrera, generación,
// cantidad de grupos, turno y cupo", detectar las letras libres y ejecutarlo
// "dentro de una transacción atómica".
//
// El campo `code` no existe aquí, y esa es la diferencia con GruposForm: aquí las
// claves las asigna el backend (`GroupCodeSequence`, A–Z a partir de la primera
// libre del nivel). Por eso el endpoint es `POST /groups/bulk` y no un bucle de
// `POST /groups`: hacerlo desde el cliente dejaría huecos y, si el grupo 7 de 20
// fallara, dejaría 6 huérfanos ya persistidos. El backend lo hace en una
// transacción, o entran los 20 o ninguno.
//
// El aviso de letras se pide al servidor (`GET /groups/next-codes`) en vez de
// calcularlo aquí: si el cliente replicara la regla de "primera letra libre",
// serían dos implementaciones de la misma regla que divergen. El preview y la
// ejecución comparten el asignador, así que lo que se muestra es lo que sale —
// salvo que otra transacción tome las letras en medio, y entonces el 409 de la
// creación lo dice.

type Shift = 'MORNING' | 'AFTERNOON' | 'MIXED'

const SHIFT_OPTIONS: { value: Shift; label: string }[] = [
  { value: 'MORNING', label: 'Matutino' },
  { value: 'AFTERNOON', label: 'Vespertino' },
  { value: 'MIXED', label: 'Mixto' },
]

interface GroupResponse {
  id: string
  code: string
}

interface CodesPreviewResponse {
  levelPrefix: string
  codes: string[]
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

/**
 * El rango de letras del backend: `GroupCodeSequence` va de A a Z, y su tamaño
 * (26) es el `@Max` de `CreateGroupsBulkRequest`. Se repite aquí sólo para
 * validar antes del viaje; el backend sigue siendo la autoridad.
 */
const MAX_QUANTITY = 26

// ─── Schema ────────────────────────────────────────────────────────────────────
//   programId   → filtro de UI para cascadear la generación. No viaja en el
//                 payload —el backend lo deduce de generationId— pero se valida
//                 porque la cascada depende de él.
//   quantity    → entero 1..26, el tamaño del rango A–Z.
//   maxCapacity → entero desde 1, sin techo (decisión del usuario 2026-10-05).
//   El resto    → selecciones obligatorias.
//
// No hay `crossRules`. El 409 de la masiva (no quedan letras, u otra transacción
// se las llevó) no es atribuible a un campo concreto, así que va al banner y no
// a un `setFieldError`: marcar "cantidad" cuando el problema fue una carrera
// ajena sería mentir.

const MASIVO_INITIAL_VALUES = {
  programId: '',
  generationId: '',
  periodId: '',
  planLevelId: '',
  quantity: '',
  maxCapacity: '',
  shift: '',
} as const

const MASIVO_SCHEMA = {
  programId: { rules: [required('la carrera')] },
  generationId: { rules: [required('la generación')] },
  periodId: { rules: [selectionRequired('el periodo académico')] },
  planLevelId: { rules: [selectionRequired('el nivel del plan')] },
  quantity: {
    rules: [
      required('la cantidad de grupos'),
      numeric({ label: 'cantidad de grupos', min: 1, max: MAX_QUANTITY }),
    ],
  },
  maxCapacity: {
    rules: [required('la capacidad máxima'), numeric({ label: 'capacidad máxima', min: 1 })],
  },
  shift: { rules: [selectionRequired('el turno')] },
} as const

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function GruposMasivoForm() {
  const navigate = useNavigate()

  const {
    values,
    fieldError,
    handleChange,
    handleBlur,
    setFieldValue,
    clearErrors,
    isValid,
    validate,
  } = useFieldValidation(MASIVO_SCHEMA, MASIVO_INITIAL_VALUES)

  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [generations, setGenerations] = useState<GenerationSummary[]>([])
  const [periods, setPeriods] = useState<PeriodSummary[]>([])
  const [planLevels, setPlanLevels] = useState<PlanLevelSummary[]>([])

  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  // Preview: `null` mientras no haya generación + nivel + cantidad, y el string
  // de error aparte del 409 del submit (que es de otra fase de la interacción).
  const [preview, setPreview] = useState<CodesPreviewResponse | null>(null)
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [previewErrorMsg, setPreviewErrorMsg] = useState('')

  // Catálogos. La lógica de cascada está copiada de GruposForm: los dos forms
  // compartenla casi entera. Extraer un hook sería lo correcto, pero mete un
  // refactor de dos archivos en el mismo commit que cambia el contrato del
  // módulo; queda anotado como deuda en el md de la fase 8.
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

  // Niveles del plan de la generación elegida.
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

  // Cuántos grupos quiere el usuario, ya validado como entero en [1, 26].
  const quantity = Number(values.quantity)

  // El preview pide generación, nivel y cantidad. Se dispara sólo cuando las
  // tres están completas y la cantidad es un entero dentro del rango; antes de
  // eso el endpoint respondería 400 y no aportaría nada.
  const canPreview =
    values.generationId !== '' &&
    values.planLevelId !== '' &&
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= MAX_QUANTITY

  useEffect(() => {
    if (!canPreview) {
      setPreview(null)
      setPreviewStatus('idle')
      setPreviewErrorMsg('')
      return
    }
    let cancelled = false
    setPreviewStatus('loading')
    setPreviewErrorMsg('')
    apiGet<CodesPreviewResponse>('/groups/next-codes', {
      generationId: values.generationId,
      planLevelId: values.planLevelId,
      quantity,
    })
      .then(data => { if (!cancelled) { setPreview(data); setPreviewStatus('idle') } })
      .catch((err: unknown) => {
        if (cancelled) return
        // Un 409 aquí significa que no quedan letras libres: es el aviso que
        // evita que el usuario llene el formulario para que el submit falle.
        setPreview(null)
        setPreviewStatus('error')
        setPreviewErrorMsg(getApiErrorMessage(err))
      })
    return () => { cancelled = true }
  }, [canPreview, values.generationId, values.planLevelId, quantity])

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
    if (v === values.programId) return
    setFieldValue('programId', v)
    setFieldValue('generationId', '')
    setFieldValue('planLevelId', '')
  }

  function handleGenerationChange(v: string) {
    setFieldValue('generationId', v)
    setFieldValue('planLevelId', '')
  }

  async function handleSubmit() {
    if (!validate()) return
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    clearErrors()
    try {
      const created = await apiPost<GroupResponse[]>('/groups/bulk', {
        generationId: values.generationId,
        periodId: values.periodId,
        planLevelId: values.planLevelId,
        quantity,
        maxCapacity: Number(values.maxCapacity),
        shift: values.shift,
      })
      navigate('/grupos', {
        state: {
          toast: `${created.length} ${created.length === 1 ? 'grupo creado' : 'grupos creados'} exitosamente.`,
        },
      })
    } catch (err) {
      // El 409 va al banner, no a un campo: puede ser por falta de letras o por
      // otra transacción que las tomó, y en ninguno de los dos casos el culpable
      // es un campo concreto del formulario.
      const apiErr = err as ApiError
      setSubmitStatus('error')
      setSubmitErrorMsg(
        apiErr?.status === 409
          ? `${getApiErrorMessage(err)} Vuelve a revisar la vista previa antes de reintentar.`
          : getApiErrorMessage(err),
      )
    }
  }

  return (
    <FormPage>
      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Grupos', to: '/grupos' },
          { label: 'Crear Grupos en Lote' },
        ]}
      />

      <FormHeader
        title="Crear Grupos en Lote"
        subtitle="Genera varios grupos de una vez. Las claves se asignan automáticamente a partir de la primera letra libre del nivel."
      />

      {submitStatus === 'error' && submitErrorMsg && <ErrorBanner message={submitErrorMsg} />}

      <FormCard>
        <div className="grid grid-cols-12 gap-4">
          {/* 6/6, igual que GruposForm tras el ajuste de la fase 8. */}
          <div className="col-span-12 sm:col-span-6">
            <FieldLabel required>Carrera</FieldLabel>
            <SearchSelectField
              options={programOptions}
              value={values.programId}
              onChange={handleProgramChange}
              placeholder="Selecciona la carrera"
              hasError={!!fieldError('programId')}
              searchPlaceholder="Buscar carrera…"
            />
            {fieldError('programId')
              ? <FieldError>{fieldError('programId')}</FieldError>
              : <FieldHelp>Filtra las generaciones disponibles.</FieldHelp>}
          </div>
          <div className="col-span-12 sm:col-span-6">
            <FieldLabel required>Generación</FieldLabel>
            <SearchSelectField
              options={generationOptions}
              value={values.generationId}
              onChange={handleGenerationChange}
              placeholder="Selecciona la generación"
              disabled={!values.programId}
              hasError={!!fieldError('generationId')}
              searchPlaceholder="Buscar generación…"
            />
            {fieldError('generationId') && <FieldError>{fieldError('generationId')}</FieldError>}
          </div>

          <div className="col-span-12 sm:col-span-6">
            <FieldLabel required>Periodo Académico</FieldLabel>
            <SearchSelectField
              options={periodOptions}
              value={values.periodId}
              onChange={handleChange('periodId')}
              placeholder="Selecciona el periodo"
              hasError={!!fieldError('periodId')}
              searchPlaceholder="Buscar periodo…"
            />
            {fieldError('periodId') && <FieldError>{fieldError('periodId')}</FieldError>}
          </div>
          <div className="col-span-12 sm:col-span-6">
            <FieldLabel required>Nivel del Plan</FieldLabel>
            <SearchSelectField
              options={planLevelOptions}
              value={values.planLevelId}
              onChange={handleChange('planLevelId')}
              placeholder="Selecciona el nivel"
              disabled={!values.generationId}
              hasError={!!fieldError('planLevelId')}
              searchPlaceholder="Buscar nivel…"
            />
            {fieldError('planLevelId') && <FieldError>{fieldError('planLevelId')}</FieldError>}
          </div>

          <SelectField
            label="Turno"
            required
            value={values.shift}
            onChange={handleChange('shift')}
            options={SHIFT_OPTIONS}
            placeholder="Selecciona el turno"
            error={fieldError('shift')}
            className="col-span-12 sm:col-span-4"
          />
          <TextField
            label="Cantidad de Grupos"
            required
            type="number"
            min={1}
            max={MAX_QUANTITY}
            value={values.quantity}
            onChange={handleChange('quantity')}
            onBlur={handleBlur('quantity')}
            numeric
            error={fieldError('quantity')}
            placeholder="Ej. 5"
            help={`Entre 1 y ${MAX_QUANTITY}, el tamaño del rango de letras.`}
            className="col-span-6 sm:col-span-4"
          />
          <TextField
            label="Capacidad Máxima"
            required
            type="number"
            min={1}
            value={values.maxCapacity}
            onChange={handleChange('maxCapacity')}
            onBlur={handleBlur('maxCapacity')}
            numeric
            error={fieldError('maxCapacity')}
            placeholder="Ej. 30"
            help="Se aplica a todos los grupos del lote."
            className="col-span-6 sm:col-span-4"
          />

          {/* Vista previa de las claves */}
          <div className="col-span-12">
            <div className="flex items-start gap-2.5 bg-[#e6f5f1] border border-[#009574]/20 rounded-lg px-3.5 py-2.5 text-[12px] text-[#333333]">
              <Info size={15} className="flex-shrink-0 mt-0.5 text-[#009574]" />
              <div className="flex-1">
                <p>
                  Todos los grupos del lote comparten periodo, nivel, turno y capacidad. La clave de
                  cada uno es su nivel seguido de una letra.
                </p>

                {previewStatus === 'loading' && (
                  <p className="mt-2 flex items-center gap-1.5 text-[#666666]">
                    <Loader2 size={13} className="animate-spin" />
                    Calculando claves disponibles…
                  </p>
                )}

                {previewStatus === 'error' && previewErrorMsg && (
                  <p className="mt-2 font-medium text-red-700">{previewErrorMsg}</p>
                )}

                {preview && (
                  <p className="mt-2">
                    <span className="text-[#666666]">Claves que se crearán: </span>
                    <span className="font-mono font-medium">{preview.codes.join(', ')}</span>
                  </p>
                )}

                {!canPreview && (
                  <p className="mt-2 text-[#666666]">
                    Elige generación, nivel y cantidad para ver las claves antes de crearlas.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </FormCard>

      <FormActions
        isView={false}
        onBack={() => navigate('/grupos')}
        onPrimary={handleSubmit}
        primaryLabel="Crear Grupos"
        isSubmitting={submitStatus === 'submitting'}
        primaryDisabled={!isValid || submitStatus === 'submitting'}
      />
    </FormPage>
  )
}