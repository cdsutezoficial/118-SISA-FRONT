import { useEffect, useState } from 'react'
import { ModeSwitcher } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField, SelectField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate } from 'react-router'
import { useFormMode } from '@app/core/infra/hooks'
import { apiGet, apiPost, apiPut } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'

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

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PeriodosForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isView = mode === 'view'
  const isRegister = mode === 'register'

  // ─── Field state ───────────────────────────────────────────────────────────
  const [name, setName] = useState('')
  const [year, setYear] = useState('')
  const [periodNumber, setPeriodNumber] = useState('')
  const [type, setType] = useState<PeriodType | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [enrollmentStart, setEnrollmentStart] = useState('')
  const [enrollmentEnd, setEnrollmentEnd] = useState('')

  // ─── Auxiliary state ───────────────────────────────────────────────────────
  const [errors, setErrors] = useState<FormErrors>({})
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(isRegister ? 'idle' : 'loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  useEffect(() => {
    setSubmitStatus('idle')
    setSubmitErrorMsg('')
    setErrors({})
    if (isRegister) {
      setName('')
      setYear('')
      setPeriodNumber('')
      setType('')
      setStartDate('')
      setEndDate('')
      setEnrollmentStart('')
      setEnrollmentEnd('')
      setLoadStatus('idle')
      setLoadErrorMsg('')
    }
  }, [mode, id])

  // ─── Load period (view / edit) ─────────────────────────────────────────────
  useEffect(() => {
    if (isRegister || !id) return
    let cancelled = false
    setLoadStatus('loading')
    setLoadErrorMsg('')
    apiGet<AcademicPeriodDetail>(`/periods/${id}`)
      .then(data => {
        if (cancelled) return
        setName(data.name)
        setYear(String(data.year))
        setPeriodNumber(String(data.periodNumber))
        setType(data.type)
        setStartDate(data.startDate)
        setEndDate(data.endDate)
        setEnrollmentStart(data.enrollmentStart)
        setEnrollmentEnd(data.enrollmentEnd)
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 404) {
          setLoadErrorMsg('No se encontró el periodo solicitado.')
        } else if (apiErr.status === 401) {
          setLoadErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        } else if (apiErr.status === 403) {
          setLoadErrorMsg('No tienes permiso para consultar este periodo.')
        } else {
          setLoadErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode])

  const disabled = isView || loadStatus === 'loading'
  const isSubmitting = submitStatus === 'submitting'

  // ─── Validation ────────────────────────────────────────────────────────────
  // Mirrors AcademicPeriod's server-side invariants (validateDateRanges in
  // 118-SISA-BACK) so the user sees the problem before the 400 round-trip:
  // startDate < endDate, enrollmentStart < enrollmentEnd, enrollmentEnd <= endDate.
  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!name.trim()) e.name = 'El nombre del periodo es requerido.'
    if (!year.trim()) e.year = 'El año es requerido.'
    if (!periodNumber.trim()) e.periodNumber = 'El número de periodo es requerido.'
    if (!type) e.type = 'Selecciona el tipo de periodo.'
    if (!startDate) e.startDate = 'La fecha de inicio es requerida.'
    if (!endDate) e.endDate = 'La fecha de fin es requerida.'
    if (!enrollmentStart) e.enrollmentStart = 'El inicio de inscripciones es requerido.'
    if (!enrollmentEnd) e.enrollmentEnd = 'El fin de inscripciones es requerido.'

    if (startDate && endDate && !(startDate < endDate)) {
      e.endDate = 'La fecha de fin debe ser posterior a la fecha de inicio.'
    }
    if (enrollmentStart && enrollmentEnd && !(enrollmentStart < enrollmentEnd)) {
      e.enrollmentEnd = 'El fin de inscripciones debe ser posterior al inicio de inscripciones.'
    }
    if (enrollmentEnd && endDate && enrollmentEnd > endDate) {
      e.enrollmentEnd = 'El fin de inscripciones no puede ser posterior a la fecha de fin del periodo.'
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

    const payload: PeriodFormPayload = {
      name: name.trim(),
      year: Number(year),
      periodNumber: Number(periodNumber),
      type: type as PeriodType,
      startDate,
      endDate,
      enrollmentStart,
      enrollmentEnd,
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
      setSubmitStatus('error')
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 409) {
        setSubmitErrorMsg(apiErr.message ?? 'Ya existe un periodo registrado para ese año y número de periodo.')
      } else if (apiErr.status === 400) {
        setSubmitErrorMsg(apiErr.message ?? 'Revisa los datos capturados: hay un valor inválido o un rango de fechas incorrecto.')
      } else if (apiErr.status === 401) {
        setSubmitErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
      } else if (apiErr.status === 403) {
        setSubmitErrorMsg('No tienes permiso para realizar esta acción.')
      } else {
        setSubmitErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
      }
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
          { label: isRegister ? 'Registrar Periodo' : isView ? 'Ver Periodo' : 'Editar Periodo' },
        ]}
      />

      <FormHeader
        title={isRegister ? 'Registrar Periodo' : isView ? 'Ver Periodo' : 'Editar Periodo'}
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
          />
        }
      />

      {/* Load error banner */}
      {loadStatus === 'error' && loadErrorMsg && <ErrorBanner message={loadErrorMsg} />}

      {/* Submit error banner */}
      {submitStatus === 'error' && submitErrorMsg && <ErrorBanner message={submitErrorMsg} />}

      {/* Form card */}
      <FormCard loading={loadStatus === 'loading'} loadingLabel="Cargando periodo...">
        <div className="grid grid-cols-12 gap-4">
          <TextField
            label="Nombre del Periodo"
            required={!isView}
            value={name}
            onChange={v => { setName(v); setErrors(prev => ({ ...prev, name: undefined })) }}
            disabled={disabled}
            error={errors.name}
            placeholder="Ej. Enero – Abril 2026"
            help="Nombre descriptivo del periodo académico."
            className="col-span-12"
          />
          <TextField
            label="Año"
            required={!isView}
            type="number"
            value={year}
            onChange={v => { setYear(v); setErrors(prev => ({ ...prev, year: undefined })) }}
            disabled={disabled}
            error={errors.year}
            numeric
            placeholder="Ej. 2026"
            className="col-span-6 sm:col-span-3"
          />
          <TextField
            label="Número de Periodo"
            required={!isView}
            type="number"
            value={periodNumber}
            onChange={v => { setPeriodNumber(v); setErrors(prev => ({ ...prev, periodNumber: undefined })) }}
            disabled={disabled}
            error={errors.periodNumber}
            numeric
            placeholder="Ej. 1"
            help="Normalmente 1, 2 o 3 dentro del año."
            className="col-span-6 sm:col-span-3"
          />
          <SelectField
            label="Tipo de Periodo"
            required={!isView}
            value={type}
            onChange={v => { setType(v as PeriodType); setErrors(prev => ({ ...prev, type: undefined })) }}
            disabled={disabled}
            error={errors.type}
            options={(Object.keys(TYPE_LABELS) as PeriodType[]).map(t => ({ value: t, label: TYPE_LABELS[t] }))}
            placeholder="Seleccionar tipo…"
            className="col-span-12 sm:col-span-6"
          />
          <TextField
            label="Fecha de Inicio"
            required={!isView}
            type="date"
            value={startDate}
            onChange={v => { setStartDate(v); setErrors(prev => ({ ...prev, startDate: undefined })) }}
            disabled={disabled}
            error={errors.startDate}
            className="col-span-6 sm:col-span-3"
          />
          <TextField
            label="Fecha de Fin"
            required={!isView}
            type="date"
            value={endDate}
            onChange={v => { setEndDate(v); setErrors(prev => ({ ...prev, endDate: undefined })) }}
            disabled={disabled}
            error={errors.endDate}
            className="col-span-6 sm:col-span-3"
          />
          <TextField
            label="Inicio de Inscripciones"
            required={!isView}
            type="date"
            value={enrollmentStart}
            onChange={v => { setEnrollmentStart(v); setErrors(prev => ({ ...prev, enrollmentStart: undefined })) }}
            disabled={disabled}
            error={errors.enrollmentStart}
            className="col-span-6 sm:col-span-3"
          />
          <TextField
            label="Fin de Inscripciones"
            required={!isView}
            type="date"
            value={enrollmentEnd}
            onChange={v => { setEnrollmentEnd(v); setErrors(prev => ({ ...prev, enrollmentEnd: undefined })) }}
            disabled={disabled}
            error={errors.enrollmentEnd}
            className="col-span-6 sm:col-span-3"
          />
        </div>
      </FormCard>

      {/* Actions */}
      {loadStatus !== 'loading' && (
        <FormActions
          isView={isView}
          onBack={() => navigate('/periodos')}
          onPrimary={isView ? () => navigate(`/periodos/form?mode=edit&id=${id}`) : handleSubmit}
          primaryLabel={isView ? 'Editar' : isRegister ? 'Registrar Periodo' : 'Guardar Cambios'}
          isSubmitting={isSubmitting}
        />
      )}
    </FormPage>
  )
}
