import { useEffect, useState } from 'react'
import { ChevronRight, Pencil, Save, X, ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { FieldLabel, FieldHelp, FieldError, inputCls, ModeSwitcher } from '../shared/ui'
import { useNavigate } from 'react-router'
import { useFormMode } from '../shared/hooks'
import { apiGet, apiPost, apiPut } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'

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
        await apiPost<AcademicPeriodDetail>('/periods', payload)
        navigate('/periodos', { state: { toast: 'Periodo registrado exitosamente.' } })
      } else if (id) {
        await apiPut<AcademicPeriodDetail>(`/periods/${id}`, payload)
        navigate('/periodos', { state: { toast: 'Periodo actualizado exitosamente.' } })
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
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/periodos')} className="hover:text-[#009574] transition-colors">Periodos Académicos</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">
          {isRegister ? 'Registrar Periodo' : isView ? 'Ver Periodo' : 'Editar Periodo'}
        </span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">
            {isRegister ? 'Registrar Periodo' : isView ? 'Ver Periodo' : 'Editar Periodo'}
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {isRegister ? 'Completa los campos para registrar un nuevo periodo académico.' :
             isView ? 'Información del periodo académico.' :
             'Modifica los datos del periodo académico.'}
          </p>
        </div>
        <ModeSwitcher
          mode={mode}
          registerUrl="/periodos/new"
          formUrl={m => `/periodos/form?mode=${m}&id=${id}`}
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
            <p className="text-[13px] font-medium">Cargando periodo...</p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">

            {/* Nombre del periodo */}
            <div className="col-span-12">
              <FieldLabel required={!isView}>Nombre del Periodo</FieldLabel>
              <input
                value={name}
                onChange={e => { setName(e.target.value); setErrors(prev => ({ ...prev, name: undefined })) }}
                disabled={disabled}
                className={inputCls(disabled, !!errors.name)}
                placeholder="Ej. Enero – Abril 2026"
              />
              {errors.name
                ? <FieldError>{errors.name}</FieldError>
                : <FieldHelp>Nombre descriptivo del periodo académico.</FieldHelp>}
            </div>

            {/* Año */}
            <div className="col-span-6 sm:col-span-3">
              <FieldLabel required={!isView}>Año</FieldLabel>
              <input
                type="number"
                value={year}
                onChange={e => { setYear(e.target.value); setErrors(prev => ({ ...prev, year: undefined })) }}
                disabled={disabled}
                className={inputCls(disabled, !!errors.year)}
                placeholder="Ej. 2026"
              />
              {errors.year && <FieldError>{errors.year}</FieldError>}
            </div>

            {/* Número de periodo */}
            <div className="col-span-6 sm:col-span-3">
              <FieldLabel required={!isView}>Número de Periodo</FieldLabel>
              <input
                type="number"
                value={periodNumber}
                onChange={e => { setPeriodNumber(e.target.value); setErrors(prev => ({ ...prev, periodNumber: undefined })) }}
                disabled={disabled}
                className={inputCls(disabled, !!errors.periodNumber)}
                placeholder="Ej. 1"
              />
              {errors.periodNumber
                ? <FieldError>{errors.periodNumber}</FieldError>
                : <FieldHelp>Normalmente 1, 2 o 3 dentro del año.</FieldHelp>}
            </div>

            {/* Tipo de periodo */}
            <div className="col-span-12 sm:col-span-6">
              <FieldLabel required={!isView}>Tipo de Periodo</FieldLabel>
              <select
                value={type}
                onChange={e => { setType(e.target.value as PeriodType); setErrors(prev => ({ ...prev, type: undefined })) }}
                disabled={disabled}
                className={inputCls(disabled, !!errors.type) + ' appearance-none'}
              >
                <option value="">Seleccionar tipo…</option>
                {(Object.keys(TYPE_LABELS) as PeriodType[]).map(t => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
              {errors.type && <FieldError>{errors.type}</FieldError>}
            </div>

            {/* Fecha de inicio */}
            <div className="col-span-6 sm:col-span-3">
              <FieldLabel required={!isView}>Fecha de Inicio</FieldLabel>
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setErrors(prev => ({ ...prev, startDate: undefined })) }}
                disabled={disabled}
                className={inputCls(disabled, !!errors.startDate)}
              />
              {errors.startDate && <FieldError>{errors.startDate}</FieldError>}
            </div>

            {/* Fecha de fin */}
            <div className="col-span-6 sm:col-span-3">
              <FieldLabel required={!isView}>Fecha de Fin</FieldLabel>
              <input
                type="date"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setErrors(prev => ({ ...prev, endDate: undefined })) }}
                disabled={disabled}
                className={inputCls(disabled, !!errors.endDate)}
              />
              {errors.endDate && <FieldError>{errors.endDate}</FieldError>}
            </div>

            {/* Inicio de inscripciones */}
            <div className="col-span-6 sm:col-span-3">
              <FieldLabel required={!isView}>Inicio de Inscripciones</FieldLabel>
              <input
                type="date"
                value={enrollmentStart}
                onChange={e => { setEnrollmentStart(e.target.value); setErrors(prev => ({ ...prev, enrollmentStart: undefined })) }}
                disabled={disabled}
                className={inputCls(disabled, !!errors.enrollmentStart)}
              />
              {errors.enrollmentStart && <FieldError>{errors.enrollmentStart}</FieldError>}
            </div>

            {/* Fin de inscripciones */}
            <div className="col-span-6 sm:col-span-3">
              <FieldLabel required={!isView}>Fin de Inscripciones</FieldLabel>
              <input
                type="date"
                value={enrollmentEnd}
                onChange={e => { setEnrollmentEnd(e.target.value); setErrors(prev => ({ ...prev, enrollmentEnd: undefined })) }}
                disabled={disabled}
                className={inputCls(disabled, !!errors.enrollmentEnd)}
              />
              {errors.enrollmentEnd && <FieldError>{errors.enrollmentEnd}</FieldError>}
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
                onClick={() => navigate('/periodos')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
              >
                <ArrowLeft size={14} />Regresar
              </button>
              <button
                onClick={() => navigate(`/periodos/form?mode=edit&id=${id}`)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
              >
                <Pencil size={14} />Editar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/periodos')}
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
                {isRegister ? 'Registrar Periodo' : 'Guardar Cambios'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
