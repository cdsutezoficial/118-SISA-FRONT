import { useEffect, useState } from 'react'
import { ChevronRight, Save, X, Loader2, AlertCircle } from 'lucide-react'
import { FieldLabel, FieldHelp, inputCls } from '../shared/ui'
import { useNavigate } from 'react-router'
import { useFormMode } from '../shared/hooks'
import { apiGet, apiPost, apiPut } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────

type ClassificationStatus = 'ACTIVE' | 'INACTIVE'

interface ClassificationResponse {
  id: string
  name: string
  code: string
  status: ClassificationStatus
}

interface ClassificationFormPayload {
  name: string
  code: string
}

// ─── Page ──────────────────────────────────────────────────────────────────────
// No "Ver Detalle" mode here — per the Figma spec (Pantalla 21), two fields
// don't justify a third read-only view, unlike DivisionesForm. This screen
// only ever handles register/edit; any `mode` other than `register` is
// treated as edit.

export default function ClasificacionesForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isRegister = mode === 'register'

  const [nombre, setNombre] = useState('')
  const [clave, setClave] = useState('')

  // `loadStatus` covers the edit GET-by-id fetch; `submitStatus` covers the
  // register/edit POST-PUT submit — separate so a slow initial fetch doesn't
  // fight with the submit button's own loading state.
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(isRegister ? 'idle' : 'loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  useEffect(() => {
    if (isRegister || !id) return
    let cancelled = false
    setLoadStatus('loading')
    setLoadErrorMsg('')
    apiGet<ClassificationResponse>(`/subject-classifications/${id}`)
      .then(data => {
        if (cancelled) return
        setNombre(data.name)
        setClave(data.code)
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 404) {
          setLoadErrorMsg('No se encontró la clasificación solicitada.')
        } else if (apiErr.status === 401) {
          setLoadErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        } else if (apiErr.status === 403) {
          setLoadErrorMsg('No tienes permiso para consultar esta clasificación.')
        } else {
          setLoadErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode])

  const disabled = loadStatus === 'loading'
  const isSubmitting = submitStatus === 'submitting'

  async function handleSubmit() {
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    const payload: ClassificationFormPayload = {
      name: nombre,
      code: clave,
    }
    try {
      if (isRegister) {
        await apiPost<ClassificationResponse>('/subject-classifications', payload)
        navigate('/clasificaciones', { state: { toast: 'Clasificación registrada exitosamente.' } })
      } else if (id) {
        await apiPut<ClassificationResponse>(`/subject-classifications/${id}`, payload)
        navigate('/clasificaciones', { state: { toast: 'Clasificación actualizada exitosamente.' } })
      }
    } catch (err) {
      setSubmitStatus('error')
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 409) {
        // Unlike Division, `name` is NOT unique here — the backend only
        // checks `code`, so the message must not say "el nombre o la clave".
        setSubmitErrorMsg(apiErr.message ?? 'La clave ya está en uso por otra clasificación.')
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

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/clasificaciones')} className="hover:text-[#009574] transition-colors">Clasificaciones de Materias</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">
          {isRegister ? 'Registrar Clasificación' : 'Editar Clasificación'}
        </span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">
            {isRegister ? 'Registrar Clasificación de Materia' : 'Editar Clasificación de Materia'}
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {isRegister
              ? 'Completa la información para registrar una nueva clasificación de materia.'
              : 'Modifica los datos de la clasificación de materia.'}
          </p>
        </div>
      </div>

      {/* Load error banner (edit fetch failed) */}
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
            <p className="text-[13px] font-medium">Cargando clasificación...</p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {/* Nombre */}
            <div className="col-span-12 sm:col-span-8">
              <FieldLabel required>Nombre de la Clasificación</FieldLabel>
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                disabled={disabled}
                className={inputCls(disabled, false)}
                placeholder="Ej. Integradora"
              />
            </div>
            {/* Clave */}
            <div className="col-span-12 sm:col-span-4">
              <FieldLabel required>Clave</FieldLabel>
              <input
                value={clave}
                onChange={e => setClave(e.target.value.toUpperCase())}
                disabled={disabled}
                maxLength={10}
                className={inputCls(disabled, false)}
                placeholder="Ej. INT"
              />
              <FieldHelp>Identificador corto único.</FieldHelp>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {loadStatus !== 'loading' && (
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            onClick={() => navigate('/clasificaciones')}
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
            {isRegister ? 'Registrar Clasificación' : 'Guardar Cambios'}
          </button>
        </div>
      )}
    </div>
  )
}
