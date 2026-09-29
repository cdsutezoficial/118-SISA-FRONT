import { useEffect, useState } from 'react'
import { FormPage, FormHeader, FormCard, FormActions, TextField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate } from 'react-router'
import { useFormMode } from '@app/core/infra/hooks'
import { apiGet, apiPost, apiPut } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'

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
    setSubmitStatus('idle')
    setSubmitErrorMsg('')
    if (isRegister) {
      setNombre('')
      setClave('')
      setLoadStatus('idle')
      setLoadErrorMsg('')
    }
  }, [mode, id])

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
    <FormPage>
      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Clasificaciones de Materias', to: '/clasificaciones' },
          { label: isRegister ? 'Registrar Clasificación' : 'Editar Clasificación' },
        ]}
      />

      <FormHeader
        title={isRegister ? 'Registrar Clasificación de Materia' : 'Editar Clasificación de Materia'}
        subtitle={isRegister
          ? 'Completa la información para registrar una nueva clasificación de materia.'
          : 'Modifica los datos de la clasificación de materia.'}
      />

      {/* Load error banner (edit fetch failed) */}
      {loadStatus === 'error' && loadErrorMsg && <ErrorBanner message={loadErrorMsg} />}

      {/* Submit error banner */}
      {submitStatus === 'error' && submitErrorMsg && <ErrorBanner message={submitErrorMsg} />}

      {/* Form card */}
      <FormCard loading={loadStatus === 'loading'} loadingLabel="Cargando clasificación...">
        <div className="grid grid-cols-12 gap-4">
          <TextField
            label="Nombre de la Clasificación"
            required
            value={nombre}
            onChange={setNombre}
            disabled={disabled}
            placeholder="Ej. Integradora"
            className="col-span-12 sm:col-span-8"
          />
          <TextField
            label="Clave"
            required
            value={clave}
            onChange={v => setClave(v.toUpperCase())}
            disabled={disabled}
            maxLength={10}
            placeholder="Ej. INT"
            help="Identificador corto único."
            className="col-span-12 sm:col-span-4"
          />
        </div>
      </FormCard>

      {/* Actions */}
      {loadStatus !== 'loading' && (
        <FormActions
          isView={false}
          onBack={() => navigate('/clasificaciones')}
          onPrimary={handleSubmit}
          primaryLabel={isRegister ? 'Registrar Clasificación' : 'Guardar Cambios'}
          isSubmitting={isSubmitting}
        />
      )}
    </FormPage>
  )
}
