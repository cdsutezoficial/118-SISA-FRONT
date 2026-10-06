import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { ModeSwitcher, DatePicker, FieldLabel, FieldError } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField, SelectField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate } from 'react-router'
import { useFormMode } from '@app/core/infra/hooks'
import { apiGet, apiPost, apiPut, getApiErrorMessage, type ApiError } from '@app/core/infra/apiClient'
import { useFieldValidation } from '@app/core/validation/useFieldValidation'
import {
  required,
  maxLength,
  noControlChars,
  numeric,
  selectionRequired,
  lettersNumbersSpacesAndHyphens,
  normalizeText,
} from '@app/core/validation/fieldRules'

// ─── Types ─────────────────────────────────────────────────────────────────────

type PeriodType = 'CUATRIMESTRAL' | 'SEMESTRAL' | 'BIMESTRAL'
type PeriodStatus = 'CONFIGURATION' | 'ENROLLMENT' | 'ACTIVE' | 'CLOSED'

const TYPE_LABELS: Record<PeriodType, string> = {
  CUATRIMESTRAL: 'Cuatrimestral',
  SEMESTRAL: 'Semestral',
  BIMESTRAL: 'Bimestral',
}

interface AcademicPeriodDetail {
  id: string
  name: string
  year: number
  periodNumber: number
  type: PeriodType
  startDate: string
  endDate: string
  enrollmentStart: string
  enrollmentEnd: string
  status: PeriodStatus
}

// `status` is deliberately absent — it is never sent from this form. New
// periods default to CONFIGURATION server-side; existing ones only advance
// via the contextual action on PeriodosList.tsx (PATCH /periods/{id}/status),
// same separation of concerns as PlanEscalaForm.tsx/DivisionesForm.tsx not
// editing status from their own forms.
interface PeriodFormPayload {
  name: string
  year: number
  periodNumber: number
  type: PeriodType
  startDate: string
  endDate: string
  enrollmentStart: string
  enrollmentEnd: string
}

type FormErrors = Partial<Record<
  'name' | 'year' | 'periodNumber' | 'type' | 'startDate' | 'endDate' | 'enrollmentStart' | 'enrollmentEnd',
  string
>>

// ─── Schema de validación ──────────────────────────────────────────────────────
// Se declara fuera del componente para que su identidad sea estable: el hook lo
// usa como dependencia de sus callbacks.
//
// Contrato de cada campo, alineado con `CreateAcademicPeriodRequest`:
//   name    → letras, números, espacios y guiones. La misma regla que usan las
//              clasificaciones de materia, y el mismo `@Pattern` en el backend:
//              el guion acepta espacios a cada lado porque el ejemplo del propio
//              dominio es "Enero – Abril 2026", con raya.
//   year    → entero entre 1900 y 2100. No había rango antes: el 0 de un campo
//              vacío o un 99999 llegaban hasta la base.
//   periodNumber → entero desde 1 y SIN tope. El dominio dice "1, 2, 3 dentro del
//              año", pero el mismo documento exige "100% configurable" y soporte para
//              bimestrales: un bimestral necesita más de tres periodos al año, así
//              que un tope de 3 contradiría al dominio.
//   type    → selección obligatoria.
//   Las 4 fechas → obligatorias. Esto cambia el requisito original de la fase 6,
//              que pedía hacer opcionales las dos de inscripción; el usuario decidió
//              el 2026-10-05 que las cuatro se llenan.
//
// `name` es texto libre y NO lleva `normalize`: recortar en cada pulsación
// impediría escribir un espacio entre palabras. Se usa `validateOn: normalizeText`,
// que compacta y recorta **sólo al evaluar las reglas**, sin escribir de vuelta en
// el input: el usuario ve lo que escribió y el cursor nunca le salta, mientras lo
// que se valida y lo que se manda es el texto limpio. El payload se arma con el
// mismo `normalizeText`, igual que en el resto del módulo.
//
// Ojo con las fechas: el estado guarda **dd/mm/yyyy** (lo que muestra el
// DatePicker) y la conversión a ISO ocurre al mandar. Por eso las comparaciones de
// `crossRules` pueden hacerse sobre el texto de pantalla: son ordenables
// lexicográficamente porque el formato es de ancho fijo y los separadores son fijos.

const PERIODO_INITIAL_VALUES = {
  name: '',
  year: '',
  periodNumber: '',
  type: '',
  startDate: '',
  endDate: '',
  enrollmentStart: '',
  enrollmentEnd: '',
} as const

const PERIODO_SCHEMA = {
  name: {
    validateOn: normalizeText,
    rules: [
      required('el nombre del periodo'),
      maxLength(150, 'nombre'),
      noControlChars('nombre'),
      lettersNumbersSpacesAndHyphens('nombre'),
    ],
  },
  year: {
    rules: [required('el año'), numeric({ label: 'año', min: 1900, max: 2100 })],
  },
  periodNumber: {
    rules: [required('el número de periodo'), numeric({ label: 'número de periodo', min: 1 })],
  },
  type: {
    rules: [selectionRequired('el tipo de periodo')],
  },
  startDate: { rules: [required('la fecha de inicio')] },
  endDate: { rules: [required('la fecha de fin')] },
  enrollmentStart: { rules: [required('la fecha de inicio de inscripciones')] },
  enrollmentEnd: { rules: [required('la fecha de fin de inscripciones')] },
} as const

// Las tres reglas de orden de fechas no las puede expresar el schema, porque cada
// una depende de dos campos a la vez. El backend las ve en
// `AcademicPeriod.validateDateRanges`; aquí se declaran para que el error aparezca
// sin el viaje de ida y vuelta, y para que `isValid` —y por lo tanto el botón de
// guardar— las tenga en cuenta. La comparación de fechas va en el orden en que las
// compara `validateDateRanges`: primero el rango del periodo, luego el rango de las
// inscripciones, y por último que las inscripciones no cierren después del periodo.
const PERIODO_CROSS_RULES = (values: typeof PERIODO_INITIAL_VALUES): FormErrors => {
  const errors: FormErrors = {}

  if (values.startDate && values.endDate && values.startDate >= values.endDate) {
    errors.endDate = 'La fecha de fin debe ser posterior a la fecha de inicio.'
  }
  if (values.enrollmentStart && values.enrollmentEnd && values.enrollmentStart >= values.enrollmentEnd) {
    errors.enrollmentEnd = 'El fin de inscripciones debe ser posterior al inicio de inscripciones.'
  }
  if (values.enrollmentEnd && values.endDate && values.enrollmentEnd > values.endDate) {
    errors.enrollmentEnd = 'El fin de inscripciones no puede ser posterior a la fecha de fin del periodo.'
  }
  return errors
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

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PeriodosForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isView = mode === 'view'
  const isRegister = mode === 'register'

  // ─── Field state ───────────────────────────────────────────────────────────
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
  } = useFieldValidation(PERIODO_SCHEMA, PERIODO_INITIAL_VALUES, { crossRules: PERIODO_CROSS_RULES })

  // Status se lee en view/edit para replicar la regla de PeriodosList.tsx: un
  // periodo CLOSED es terminal y NO puede editarse (ni desde este form).
  const [status, setStatus] = useState<PeriodStatus | ''>('')

  // ─── Auxiliary state ───────────────────────────────────────────────────────
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(isRegister ? 'idle' : 'loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  useEffect(() => {
    setSubmitStatus('idle')
    setSubmitErrorMsg('')
    if (isRegister) {
      reset()
      setStatus('')
      setLoadStatus('idle')
      setLoadErrorMsg('')
    }
  }, [mode, id, reset])

  // ─── Load period (view / edit) ─────────────────────────────────────────────
  useEffect(() => {
    if (isRegister || !id) return
    let cancelled = false
    setLoadStatus('loading')
    setLoadErrorMsg('')
    apiGet<AcademicPeriodDetail>(`/periods/${id}`)
      .then(data => {
        if (cancelled) return
        setFieldValue('name', data.name)
        setFieldValue('year', String(data.year))
        setFieldValue('periodNumber', String(data.periodNumber))
        setFieldValue('type', data.type)
        setFieldValue('startDate', isoToDisplay(data.startDate))
        setFieldValue('endDate', isoToDisplay(data.endDate))
        setFieldValue('enrollmentStart', isoToDisplay(data.enrollmentStart))
        setFieldValue('enrollmentEnd', isoToDisplay(data.enrollmentEnd))
        setStatus(data.status)
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

  const closed = status === 'CLOSED'
  const disabled = isView || closed || loadStatus === 'loading'
  const isSubmitting = submitStatus === 'submitting'
  const periodLabel = isRegister ? 'Registrar Periodo' : isView ? 'Ver Periodo' : 'Editar Periodo'

  // ─── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    // Un periodo CLOSED es terminal: por si acaso alguien dispara el submit
    // (el botón ya queda disabled), no se envía nada.
    if (closed) return
    // Marca todos los campos como tocados y valida, incluidas las reglas de orden
    // de fechas. Si algo falla, no se dispara ninguna petición.
    if (!validate()) return
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')

    const payload: PeriodFormPayload = {
      name: normalizeText(values.name),
      year: Number(values.year),
      periodNumber: Number(values.periodNumber),
      type: values.type as PeriodType,
      startDate: displayToIso(values.startDate),
      endDate: displayToIso(values.endDate),
      enrollmentStart: displayToIso(values.enrollmentStart),
      enrollmentEnd: displayToIso(values.enrollmentEnd),
    }

    try {
      if (isRegister) {
        const created = await apiPost<AcademicPeriodDetail>('/periods', payload)
        navigate(`/periodos/form?mode=view&id=${created.id}`, { state: { toast: 'Periodo registrado exitosamente.' } })
      } else if (id) {
        await apiPut<AcademicPeriodDetail>(`/periods/${id}`, payload)
        navigate(`/periodos/form?mode=view&id=${id}`, { state: { toast: 'Periodo actualizado exitosamente.' } })
      }
    } catch (err) {
      // Cualquier 409 de POST/PUT /periods es, sin excepción, el duplicado de
      // (year, periodNumber): es la única clave única de la tabla y el único
      // handler que devuelve 409 en este módulo. Se atribuye a `periodNumber` sin
      // inspeccionar el texto del mensaje.
      //
      // Ojo con `backendMessage`: viene del campo `message` de ErrorResponse, y
      // `GlobalExceptionHandler#handlePeriodConflict` lo fija en copy en español
      // ("Ya existe un periodo académico con la información proporcionada."). El
      // mensaje en inglés que menciona "periodNumber" es el de la excepción, y ese
      // no viaja al cliente. Buscar el nombre del campo en el mensaje era, por
      // tanto, código muerto: la condición nunca se cumplía y el error inline no
      // se llegaba a pintar.
      const apiErr = err as ApiError
      if (apiErr?.status === 409) {
        const msg = getApiErrorMessage(err)
        setFieldError('periodNumber', msg)
        setSubmitStatus('error')
        setSubmitErrorMsg(msg)
        return
      }
      setSubmitStatus('error')
      setSubmitErrorMsg(getApiErrorMessage(err))
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <FormPage>
      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Periodos Académicos', to: '/periodos' },
          { label: periodLabel },
        ]}
      />

      <FormHeader
        title={periodLabel}
        subtitle={isRegister
          ? 'Completa los campos para registrar un nuevo periodo académico.'
          : isView
          ? 'Información del periodo académico.'
          : 'Modifica los datos del periodo académico.'}
        right={
          <ModeSwitcher
            mode={mode}
            id={id}
            registerUrl="/periodos/new"
            formUrl={m => `/periodos/form?mode=${m}&id=${id}`}
            canEdit={!closed}
          />
        }
      />

      {/* Load error banner */}
      {loadStatus === 'error' && loadErrorMsg && <ErrorBanner message={loadErrorMsg} />}

      {/* Submit error banner */}
      {submitStatus === 'error' && submitErrorMsg && <ErrorBanner message={submitErrorMsg} />}

      {/* Periodo cerrado: terminal, no editable (misma regla que PeriodosList) */}
      {closed && (
        <div className="mb-6 flex items-start gap-2 text-[12px] text-[#6B7280] bg-[#F8F9FA] border border-[#E5E7EB] rounded-md px-3 py-2.5">
          <Info size={13} className="text-[#009574] flex-shrink-0 mt-0.5" />
          Este periodo está cerrado y ya no puede editarse.
        </div>
      )}

      {/* Form card */}
      <FormCard loading={loadStatus === 'loading'} loadingLabel="Cargando periodo...">
        <div className="grid grid-cols-12 gap-4">
          <TextField
            label="Nombre del Periodo"
            required={!isView}
            value={values.name}
            onChange={handleChange('name')}
            onBlur={handleBlur('name')}
            disabled={disabled}
            error={fieldError('name')}
            maxLength={150}
            placeholder="Ej. Enero – Abril 2026"
            help="Letras, números, espacios y guiones. Hasta 150 caracteres."
            className="col-span-12"
          />
          <TextField
            label="Año"
            required={!isView}
            type="number"
            value={values.year}
            onChange={handleChange('year')}
            onBlur={handleBlur('year')}
            disabled={disabled}
            error={fieldError('year')}
            numeric
            placeholder="Ej. 2026"
            help="No puede ser menos a 1900"
            className="col-span-6 sm:col-span-3"
          />
          <TextField
            label="Número de Periodo"
            required={!isView}
            type="number"
            value={values.periodNumber}
            onChange={handleChange('periodNumber')}
            onBlur={handleBlur('periodNumber')}
            disabled={disabled}
            error={fieldError('periodNumber')}
            numeric
            placeholder="Ej. 1"
            help="Normalmente 1, 2 o 3"
            className="col-span-6 sm:col-span-3"
          />
          <SelectField
            label="Tipo de Periodo"
            required={!isView}
            value={values.type}
            onChange={handleChange('type')}
            disabled={disabled}
            error={fieldError('type')}
            options={(Object.keys(TYPE_LABELS) as PeriodType[]).map(t => ({ value: t, label: TYPE_LABELS[t] }))}
            placeholder="Seleccionar tipo…"
            className="col-span-12 sm:col-span-6"
          />
          <div className="col-span-6 sm:col-span-3">
            <FieldLabel required={!isView}>Fecha de Inicio</FieldLabel>
            <DatePicker
              value={values.startDate}
              onChange={handleChange('startDate')}
              onBlur={handleBlur('startDate')}
              disabled={disabled}
              error={!!fieldError('startDate')}
            />
            {fieldError('startDate') && <FieldError>{fieldError('startDate')}</FieldError>}
          </div>
          <div className="col-span-6 sm:col-span-3">
            <FieldLabel required={!isView}>Fecha de Fin</FieldLabel>
            <DatePicker
              value={values.endDate}
              onChange={handleChange('endDate')}
              onBlur={handleBlur('endDate')}
              disabled={disabled}
              error={!!fieldError('endDate')}
            />
            {fieldError('endDate') && <FieldError>{fieldError('endDate')}</FieldError>}
          </div>
          <div className="col-span-6 sm:col-span-3">
            <FieldLabel required={!isView}>Inicio de Inscripciones</FieldLabel>
            <DatePicker
              value={values.enrollmentStart}
              onChange={handleChange('enrollmentStart')}
              onBlur={handleBlur('enrollmentStart')}
              disabled={disabled}
              error={!!fieldError('enrollmentStart')}
            />
            {fieldError('enrollmentStart') && <FieldError>{fieldError('enrollmentStart')}</FieldError>}
          </div>
          <div className="col-span-6 sm:col-span-3">
            <FieldLabel required={!isView}>Fin de Inscripciones</FieldLabel>
            <DatePicker
              value={values.enrollmentEnd}
              onChange={handleChange('enrollmentEnd')}
              onBlur={handleBlur('enrollmentEnd')}
              disabled={disabled}
              error={!!fieldError('enrollmentEnd')}
            />
            {fieldError('enrollmentEnd') && <FieldError>{fieldError('enrollmentEnd')}</FieldError>}
          </div>
        </div>
      </FormCard>

      {/* Actions */}
      {loadStatus !== 'loading' && (
        <FormActions
          isView={isView || closed}
          onBack={() => navigate('/periodos')}
          onPrimary={isView ? () => navigate(`/periodos/form?mode=edit&id=${id}`) : handleSubmit}
          primaryLabel={isView ? 'Editar' : isRegister ? 'Registrar Periodo' : 'Guardar Cambios'}
          isSubmitting={isSubmitting}
          primaryDisabled={closed || !isValid}
        />
      )}
    </FormPage>
  )
}
