import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { FieldLabel, FieldHelp, FieldError, ModeSwitcher, SearchSelectField } from '@app/core/components/ui'
import type { SelectOption } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate } from 'react-router'
import { useFormMode } from '@app/core/infra/hooks'
import { apiGet, apiPost, apiPut, getApiErrorMessage, type ApiError } from '@app/core/infra/apiClient'
import { programLabel } from '@app/core/infra/programLabel'
import { useFieldValidation } from '@app/core/validation/useFieldValidation'
import { required, selectionRequired, numeric } from '@app/core/validation/fieldRules'

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
  modality?: string
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

// ─── Schema de validación ──────────────────────────────────────────────────────
// Se declara fuera del componente para que su identidad sea estable: el hook lo
// usa como dependencia de sus callbacks.
//
// A diferencia de las otras fases de este módulo, aquí NO hay ni una regla de
// texto. `Generation` no tiene ningún campo de nombre: el único texto de la
// entidad es `code`, que el backend calcula siempre desde el año del periodo de
// inicio y el número, y que por diseño el cliente nunca manda
// (`CreateGenerationRequest` ni siquiera lo declara). Por eso no hay
// normalizador de texto ni aquí ni en el DTO: no hay nada que normalizar.
//
//   programId      → selección obligatoria. No viaja en el payload —el backend
//                     lo deduce de `planId`— pero la cascada de selects depende
//                     de él, así que se valida igual.
//   planId         → selección obligatoria.
//   startPeriodId  → selección obligatoria.
//   number         → entero desde 1, sin tope. Es un contador consecutivo por
//                     carrera que nunca reinicia (ver el javadoc de `Generation`),
//                     así que un techo sería arbitrario. El `@Min(1)` nuevo del
//                     backend es lo que hoy impedía que un 0 —el resultado de
//                     `Number('')` al mandar el campo vacío— llegara a la base.
//
// No hay `crossRules`: nada en este formulario depende de dos campos a la vez.

const GENERACION_INITIAL_VALUES = {
  programId: '',
  planId: '',
  startPeriodId: '',
  number: '',
} as const

const GENERACION_SCHEMA = {
  programId: { rules: [selectionRequired('la carrera')] },
  planId: { rules: [selectionRequired('el plan de estudios')] },
  startPeriodId: { rules: [selectionRequired('el periodo de inicio')] },
  number: {
    rules: [required('el número de generación'), numeric({ label: 'número de generación', min: 1 })],
  },
} as const

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function GeneracionesForm() {
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
  } = useFieldValidation(GENERACION_SCHEMA, GENERACION_INITIAL_VALUES)

  // `code` no es un campo validable: lo calcula el servidor y sólo se muestra en
  // edición, de sólo lectura. Vive fuera del hook a propósito.
  const [code, setCode] = useState('')

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
    setCode('')
    if (isRegister) {
      reset(GENERACION_INITIAL_VALUES)
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
        setFieldValue('programId', data.programId)
        setFieldValue('planId', data.planId)
        setFieldValue('startPeriodId', data.startPeriodId)
        setFieldValue('number', String(data.number))
        setCode(data.code)
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

  const disabled = isView || loadStatus === 'loading'
  const isSubmitting = submitStatus === 'submitting'

  const programOptions: SelectOption[] = programs.map(p => ({ value: p.id, label: programLabel(p) }))
  // Plan options are scoped to the selected Programa — cascading select,
  // same interaction pattern as GruposForm.tsx's Programa → Nivel cascade.
  const planOptions: SelectOption[] = plans
    .filter(p => p.programId === values.programId)
    .map(p => ({ value: p.id, label: p.version }))
  const periodOptions: SelectOption[] = periods.map(p => ({ value: p.id, label: p.name }))

  function handleProgramChange(v: string) {
    // Si se vuelve a elegir la misma carrera no se toca el plan: el reset es
    // sólo para el cambio real, que deja huérfano el plan filtrado anterior.
    if (v === values.programId) return
    setFieldValue('programId', v)
    setFieldValue('planId', '')
  }

  async function handleSubmit() {
    // `validate()` marca todos los campos como tocados, así que un error que
    // hasta ahora estaba oculto sale a la pantalla en vez de ir al API.
    if (!validate()) return
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    clearErrors()
    const payload: GenerationFormPayload = {
      planId: values.planId,
      startPeriodId: values.startPeriodId,
      number: Number(values.number),
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
      // Cualquier 409 de POST/PUT /generations es, sin excepción, el duplicado
      // de (programId, number): es la única clave única de la tabla y el único
      // handler que devuelve 409 aquí. Se atribuye a `number` —la carrera es el
      // otro miembro de la clave, pero es un campo que el usuario no elige
      // libremente, lo deduce el backend del plan—. No se busca el nombre del
      // campo en el texto: `backendMessage` es el `message` de ErrorResponse, que
      // el handler fija en copy en español, y nunca menciona "number".
      const apiErr = err as ApiError
      if (apiErr?.status === 409) {
        const msg = getApiErrorMessage(err)
        setFieldError('number', msg)
        setSubmitStatus('error')
        setSubmitErrorMsg(msg)
        return
      }
      setSubmitStatus('error')
      setSubmitErrorMsg(getApiErrorMessage(err))
    }
  }

  return (
    <FormPage>
      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Generaciones', to: '/generaciones' },
          { label: isRegister ? 'Registrar Generación' : isView ? 'Ver Generación' : 'Editar Generación' },
        ]}
      />

      <FormHeader
        title={isRegister ? 'Registrar Generación' : isView ? 'Ver Generación' : 'Editar Generación'}
        subtitle={isRegister
          ? 'Define una nueva cohorte de ingreso para un plan de estudios.'
          : isView
          ? 'Información de la generación.'
          : 'Modifica los datos de la generación.'}
        right={
          <ModeSwitcher
            mode={mode}
            id={id}
            registerUrl="/generaciones/new"
            formUrl={m => `/generaciones/form?mode=${m}&id=${id}`}
          />
        }
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
              : <FieldHelp>Determina los planes de estudios disponibles.</FieldHelp>}
          </div>
          {/* Plan de Estudios */}
          <div className="col-span-12 sm:col-span-6">
            <FieldLabel required={!isView}>Plan de Estudios</FieldLabel>
            <SearchSelectField
              options={planOptions}
              value={values.planId}
              onChange={handleChange('planId')}
              placeholder="Selecciona el plan"
              disabled={disabled || !values.programId}
              hasError={!!fieldError('planId')}
              searchPlaceholder="Buscar plan…"
            />
            {fieldError('planId')
              ? <FieldError>{fieldError('planId')}</FieldError>
              : <FieldHelp>De aquí se deduce la carrera de la generación.</FieldHelp>}
          </div>
          {/* Periodo de Inicio */}
          <div className="col-span-12 sm:col-span-6">
            <FieldLabel required={!isView}>Periodo de Inicio</FieldLabel>
            <SearchSelectField
              options={periodOptions}
              value={values.startPeriodId}
              onChange={handleChange('startPeriodId')}
              placeholder="Selecciona el periodo"
              disabled={disabled}
              hasError={!!fieldError('startPeriodId')}
              searchPlaceholder="Buscar periodo…"
            />
            {fieldError('startPeriodId')
              ? <FieldError>{fieldError('startPeriodId')}</FieldError>
              : <FieldHelp>Su año es la primera parte del código generado.</FieldHelp>}
          </div>
          {/* Número de Generación */}
          <TextField
            label="Número de Generación"
            required={!isView}
            type="number"
            min={1}
            value={values.number}
            onChange={handleChange('number')}
            onBlur={handleBlur('number')}
            disabled={disabled}
            numeric
            error={fieldError('number')}
            placeholder="Ej. 7"
            help="Consecutivo dentro de la carrera — no reinicia por año."
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
          isView={isView}
          onBack={() => navigate('/generaciones')}
          onPrimary={isView ? () => navigate(`/generaciones/form?mode=edit&id=${id}`) : handleSubmit}
          primaryLabel={isView ? 'Editar' : isRegister ? 'Registrar Generación' : 'Guardar Cambios'}
          isSubmitting={isSubmitting}
          primaryDisabled={disabled || !isValid}
        />
      )}
    </FormPage>
  )
}