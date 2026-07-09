import { useEffect, useState } from 'react'
import { ChevronRight, Pencil, Save, X, ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { FieldLabel, FieldHelp, FieldError, inputCls, ModeSwitcher, SearchSelectField } from '../shared/ui'
import type { SelectOption } from '../shared/ui'
import { useNavigate } from 'react-router'
import { useFormMode } from '../shared/hooks'
import { apiGet, apiPost, apiPut } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────

type AcademicLevel = 'TSU' | 'CONTINUIDAD' | 'INGENIERIA' | 'LICENCIATURA' | 'POSGRADO'
type ProgramModality = 'PRESENCIAL' | 'MIXTA'

const LEVEL_LABELS: Record<AcademicLevel, string> = {
  TSU: 'TSU (Técnico Superior Universitario)',
  CONTINUIDAD: 'Continuidad de estudios (Ing/Lic)',
  INGENIERIA: 'Ingeniería',
  LICENCIATURA: 'Licenciatura',
  POSGRADO: 'Posgrado',
}

const MODALITY_LABELS: Record<ProgramModality, string> = {
  PRESENCIAL: 'Presencial',
  MIXTA: 'Mixta',
}

interface DivisionsPageResponse {
  items: { id: string; name: string; code: string }[]
}

interface AcademicProgramDetail {
  id: string
  divisionId: string
  name: string
  offerName: string
  code: string
  level: AcademicLevel
  modality: ProgramModality
  continuityProgramId: string | null
  description: string | null
  dgpCode: string | null
  status: string
}

interface ProgramFormPayload {
  divisionId: string
  name: string
  offerName: string
  code: string
  level: AcademicLevel
  modality: ProgramModality
  continuityProgramId: string | null
  description: string | null
  dgpCode: string | null
}

type FormErrors = Partial<Record<'name' | 'offerName' | 'code' | 'divisionId' | 'level' | 'modality', string>>

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ProgramasForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isView = mode === 'view'
  const isRegister = mode === 'register'

  // ─── Field state ───────────────────────────────────────────────────────────
  const [name, setName] = useState('')
  const [offerName, setOfferName] = useState('')
  const [code, setCode] = useState('')
  const [level, setLevel] = useState<AcademicLevel | ''>('')
  const [modality, setModality] = useState<ProgramModality | ''>('')
  const [divisionId, setDivisionId] = useState('')
  const [dgpCode, setDgpCode] = useState('')
  const [description, setDescription] = useState('')

  // ─── Auxiliary state ───────────────────────────────────────────────────────
  const [divisions, setDivisions] = useState<SelectOption[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(isRegister ? 'idle' : 'loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  // ─── Load divisions (dropdown) ─────────────────────────────────────────────
  useEffect(() => {
    apiGet<DivisionsPageResponse>('/divisions', { size: 100 })
      .then(data => setDivisions(data.items.map(d => ({ value: d.id, label: `${d.code} — ${d.name}` }))))
      .catch(() => {/* non-critical — select will be empty */})
  }, [])

  // ─── Load program (view / edit) ────────────────────────────────────────────
  useEffect(() => {
    if (isRegister || !id) return
    let cancelled = false
    setLoadStatus('loading')
    setLoadErrorMsg('')
    apiGet<AcademicProgramDetail>(`/programs/${id}`)
      .then(data => {
        if (cancelled) return
        setName(data.name)
        setOfferName(data.offerName)
        setCode(data.code)
        setLevel(data.level)
        setModality(data.modality)
        setDivisionId(data.divisionId)
        setDgpCode(data.dgpCode ?? '')
        setDescription(data.description ?? '')
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 404) {
          setLoadErrorMsg('No se encontró el programa solicitado.')
        } else if (apiErr.status === 401) {
          setLoadErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        } else if (apiErr.status === 403) {
          setLoadErrorMsg('No tienes permiso para consultar este programa.')
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
  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!name.trim()) e.name = 'El nombre del programa es requerido.'
    if (!offerName.trim()) e.offerName = 'El nombre de oferta es requerido.'
    if (!code.trim()) e.code = 'La clave es requerida.'
    if (!divisionId) e.divisionId = 'Selecciona una división académica.'
    if (!level) e.level = 'Selecciona el nivel académico.'
    if (!modality) e.modality = 'Selecciona la modalidad.'
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

    const payload: ProgramFormPayload = {
      divisionId,
      name: name.trim(),
      offerName: offerName.trim(),
      code: code.trim(),
      level: level as AcademicLevel,
      modality: modality as ProgramModality,
      continuityProgramId: null,
      description: description.trim() || null,
      dgpCode: dgpCode.trim() || null,
    }

    try {
      if (isRegister) {
        await apiPost<AcademicProgramDetail>('/programs', payload)
        navigate('/programas', { state: { toast: 'Programa registrado exitosamente.' } })
      } else if (id) {
        await apiPut<AcademicProgramDetail>(`/programs/${id}`, payload)
        navigate('/programas', { state: { toast: 'Programa actualizado exitosamente.' } })
      }
    } catch (err) {
      setSubmitStatus('error')
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 409) {
        setSubmitErrorMsg(apiErr.message ?? 'La clave o el nombre de oferta + modalidad ya están en uso por otro programa.')
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

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/programas')} className="hover:text-[#009574] transition-colors">Programas Educativos</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">
          {isRegister ? 'Registrar Programa' : isView ? 'Ver Programa' : 'Editar Programa'}
        </span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">
            {isRegister ? 'Registrar Programa' : isView ? 'Ver Programa' : 'Editar Programa'}
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {isRegister
              ? 'Completa los campos para registrar un nuevo programa educativo.'
              : isView
              ? 'Información del programa educativo.'
              : 'Modifica los datos del programa educativo.'}
          </p>
        </div>
        <ModeSwitcher
          mode={mode}
          registerUrl="/programas/new"
          formUrl={m => `/programas/form?mode=${m}&id=${id}`}
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
            <p className="text-[13px] font-medium">Cargando programa...</p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">

            {/* Nombre del programa */}
            <div className="col-span-12 sm:col-span-8">
              <FieldLabel required={!isView}>Nombre del Programa</FieldLabel>
              <input
                value={name}
                onChange={e => { setName(e.target.value); setErrors(prev => ({ ...prev, name: undefined })) }}
                disabled={disabled}
                className={inputCls(disabled, !!errors.name)}
                placeholder="Ej. Ingeniería en Desarrollo y Gestión de Software"
              />
              {errors.name
                ? <FieldError>{errors.name}</FieldError>
                : <FieldHelp>Nombre oficial y completo del programa educativo.</FieldHelp>}
            </div>

            {/* Clave */}
            <div className="col-span-12 sm:col-span-4">
              <FieldLabel required={!isView}>Clave</FieldLabel>
              <input
                value={code}
                onChange={e => { setCode(e.target.value); setErrors(prev => ({ ...prev, code: undefined })) }}
                disabled={disabled}
                className={inputCls(disabled, !!errors.code)}
                placeholder="Ej. IDGS"
              />
              {errors.code
                ? <FieldError>{errors.code}</FieldError>
                : <FieldHelp>Identificador corto único del programa.</FieldHelp>}
            </div>

            {/* Nombre de oferta */}
            <div className="col-span-12 sm:col-span-8">
              <FieldLabel required={!isView}>Nombre de Oferta</FieldLabel>
              <input
                value={offerName}
                onChange={e => { setOfferName(e.target.value); setErrors(prev => ({ ...prev, offerName: undefined })) }}
                disabled={disabled}
                className={inputCls(disabled, !!errors.offerName)}
                placeholder="Ej. Ingeniería en Desarrollo y Gestión de Software Presencial"
              />
              {errors.offerName
                ? <FieldError>{errors.offerName}</FieldError>
                : <FieldHelp>Nombre oficial de la oferta educativa (único junto con la modalidad).</FieldHelp>}
            </div>

            {/* Nivel académico */}
            <div className="col-span-12 sm:col-span-4">
              <FieldLabel required={!isView}>Nivel Académico</FieldLabel>
              <select
                value={level}
                onChange={e => { setLevel(e.target.value as AcademicLevel); setErrors(prev => ({ ...prev, level: undefined })) }}
                disabled={disabled}
                className={inputCls(disabled, !!errors.level) + ' appearance-none'}
              >
                <option value="">Seleccionar nivel…</option>
                {(Object.keys(LEVEL_LABELS) as AcademicLevel[]).map(l => (
                  <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
                ))}
              </select>
              {errors.level
                ? <FieldError>{errors.level}</FieldError>
                : <FieldHelp>Nivel del plan de estudios.</FieldHelp>}
            </div>

            {/* Modalidad */}
            <div className="col-span-12 sm:col-span-4">
              <FieldLabel required={!isView}>Modalidad</FieldLabel>
              <select
                value={modality}
                onChange={e => { setModality(e.target.value as ProgramModality); setErrors(prev => ({ ...prev, modality: undefined })) }}
                disabled={disabled}
                className={inputCls(disabled, !!errors.modality) + ' appearance-none'}
              >
                <option value="">Seleccionar modalidad…</option>
                {(Object.keys(MODALITY_LABELS) as ProgramModality[]).map(m => (
                  <option key={m} value={m}>{MODALITY_LABELS[m]}</option>
                ))}
              </select>
              {errors.modality
                ? <FieldError>{errors.modality}</FieldError>
                : <FieldHelp>Modalidad de impartición.</FieldHelp>}
            </div>

            {/* División académica */}
            <div className="col-span-12 sm:col-span-4">
              <FieldLabel required={!isView}>División Académica</FieldLabel>
              <SearchSelectField
                options={divisions}
                value={divisionId}
                onChange={v => { setDivisionId(v); setErrors(prev => ({ ...prev, divisionId: undefined })) }}
                placeholder="Seleccionar división…"
                disabled={disabled}
                hasError={!!errors.divisionId}
                searchPlaceholder="Buscar división…"
              />
              {errors.divisionId
                ? <FieldError>{errors.divisionId}</FieldError>
                : <FieldHelp>División a la que pertenece el programa.</FieldHelp>}
            </div>

            {/* Clave DGP */}
            <div className="col-span-12 sm:col-span-4">
              <FieldLabel>Clave DGP</FieldLabel>
              <input
                value={dgpCode}
                onChange={e => setDgpCode(e.target.value)}
                disabled={disabled}
                className={inputCls(disabled, false)}
                placeholder="Ej. 220740067"
              />
              <FieldHelp>Clave asignada por la Dirección General de Profesiones. Opcional.</FieldHelp>
            </div>

            {/* Descripción */}
            <div className="col-span-12">
              <FieldLabel>Descripción</FieldLabel>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={disabled}
                rows={3}
                className={inputCls(disabled, false) + ' resize-none'}
                placeholder="Descripción breve del programa y su enfoque académico."
              />
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
                onClick={() => navigate('/programas')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
              >
                <ArrowLeft size={14} />Regresar
              </button>
              <button
                onClick={() => navigate(`/programas/form?mode=edit&id=${id}`)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
              >
                <Pencil size={14} />Editar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/programas')}
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
                {isRegister ? 'Registrar Programa' : 'Guardar Cambios'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
