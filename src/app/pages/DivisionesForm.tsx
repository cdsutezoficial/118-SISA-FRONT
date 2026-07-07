import { useEffect, useState } from 'react'
import { ChevronRight, Pencil, Save, X, ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { FieldLabel, FieldHelp, inputCls, ModeSwitcher } from '../shared/ui'
import { useNavigate } from 'react-router'
import { useFormMode } from '../shared/hooks'
import { apiGet, apiPost, apiPut } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────

type DivisionStatus = 'ACTIVE' | 'INACTIVE'

interface DivisionResponse {
  id: string
  name: string
  code: string
  description: string
  directorPersonId: string | null
  status: DivisionStatus
}

interface DivisionFormPayload {
  name: string
  code: string
  description: string
  directorPersonId: string | null
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DivisionesForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isView = mode === 'view'
  const isRegister = mode === 'register'

  const [nombre, setNombre] = useState('')
  const [clave, setClave] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [directorPersonId, setDirectorPersonId] = useState('')

  // `loadStatus` covers the edit/view GET-by-id fetch; `submitStatus` covers
  // the register/edit POST-PUT submit — separate so a slow initial fetch
  // doesn't fight with the submit button's own loading state.
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(isRegister ? 'idle' : 'loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  useEffect(() => {
    if (isRegister || !id) return
    let cancelled = false
    setLoadStatus('loading')
    setLoadErrorMsg('')
    apiGet<DivisionResponse>(`/divisions/${id}`)
      .then(data => {
        if (cancelled) return
        setNombre(data.name)
        setClave(data.code)
        setDescripcion(data.description)
        setDirectorPersonId(data.directorPersonId ?? '')
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 404) {
          setLoadErrorMsg('No se encontró la división solicitada.')
        } else if (apiErr.status === 401) {
          setLoadErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        } else if (apiErr.status === 403) {
          setLoadErrorMsg('No tienes permiso para consultar esta división.')
        } else {
          setLoadErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode])

  const disabled = isView || loadStatus === 'loading'
  const isSubmitting = submitStatus === 'submitting'

  async function handleSubmit() {
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    const payload: DivisionFormPayload = {
      name: nombre,
      code: clave,
      description: descripcion,
      directorPersonId: directorPersonId.trim() || null,
    }
    try {
      if (isRegister) {
        await apiPost<DivisionResponse>('/divisions', payload)
        navigate('/divisiones', { state: { toast: 'División registrada exitosamente.' } })
      } else if (id) {
        await apiPut<DivisionResponse>(`/divisions/${id}`, payload)
        navigate('/divisiones', { state: { toast: 'División actualizada exitosamente.' } })
      }
    } catch (err) {
      setSubmitStatus('error')
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 409) {
        setSubmitErrorMsg(apiErr.message ?? 'El nombre o la clave ya están en uso por otra división.')
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
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/divisiones')} className="hover:text-[#009574] transition-colors">Divisiones Académicas</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">
          {isRegister ? 'Registrar División' : isView ? 'Ver División' : 'Editar División'}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">
            {isRegister ? 'Registrar División' : isView ? 'Ver División' : 'Editar División'}
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {isRegister ? 'Completa los campos para registrar una nueva división académica.' :
             isView ? 'Información de la división académica.' :
             'Modifica los datos de la división académica.'}
          </p>
        </div>
        <ModeSwitcher
          mode={mode}
          registerUrl="/divisiones/new"
          formUrl={m => `/divisiones/form?mode=${m}&id=${id}`}
        />
      </div>

      {/* Load error banner (edit/view fetch failed) */}
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
            <p className="text-[13px] font-medium">Cargando división...</p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {/* Nombre */}
            <div className="col-span-8">
              <FieldLabel required={!isView}>Nombre de la División</FieldLabel>
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                disabled={disabled}
                className={inputCls(disabled, false)}
                placeholder="Ej. División de Tecnologías de la Información"
              />
              <FieldHelp>Nombre completo y oficial de la división académica.</FieldHelp>
            </div>
            {/* Clave */}
            <div className="col-span-4">
              <FieldLabel required={!isView}>Clave</FieldLabel>
              <input
                value={clave}
                onChange={e => setClave(e.target.value)}
                disabled={disabled}
                className={inputCls(disabled, false)}
                placeholder="Ej. DTI"
              />
              <FieldHelp>Identificador corto único.</FieldHelp>
            </div>
            {/* Descripción */}
            <div className="col-span-12">
              <FieldLabel>Descripción</FieldLabel>
              <textarea
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                disabled={disabled}
                rows={4}
                className={inputCls(disabled, false) + ' resize-none'}
                placeholder="Descripción breve de la división y su enfoque académico."
              />
            </div>
            {/* Director (persona) — raw UUID input: no person-search/picker exists yet in the system. */}
            <div className="col-span-12">
              <FieldLabel>Director de División (id de persona)</FieldLabel>
              <input
                value={directorPersonId}
                onChange={e => setDirectorPersonId(e.target.value)}
                disabled={disabled}
                className={inputCls(disabled, false) + ' font-mono'}
                placeholder="Ej. 3f2a9c1e-4b8d-4e2a-9c0a-7f1d5e6b2a3c"
              />
              <FieldHelp>
                Identificador (UUID) de la persona que dirige la división. Opcional. No existe aún un buscador de
                personas en el sistema — este campo es un valor temporal mientras esa capacidad se construye.
              </FieldHelp>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {loadStatus !== 'loading' && (
        <div className="flex items-center justify-end gap-3">
          {isView ? (
            <>
              <button
                onClick={() => navigate('/divisiones')}
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
              >
                <ArrowLeft size={14} />Regresar
              </button>
              <button
                onClick={() => navigate(`/divisiones/form?mode=edit&id=${id}`)}
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
              >
                <Pencil size={14} />Editar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/divisiones')}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X size={14} />Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {isRegister ? 'Registrar División' : 'Guardar Cambios'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
