import { useEffect, useState } from 'react'
import { ModeSwitcher } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField, TextAreaField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate } from 'react-router'
import { useFormMode } from '@app/core/infra/hooks'
import { apiGet, apiPost, apiPut } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────
// `PaymentArea` (academic_config bounded context) — companion catalog to
// `PaymentConcept`. Status is never edited here — same convention as every
// other wired form (División/Periodo/Concepto): status changes only from the
// list's `Switch`.

type AreaStatus = 'ACTIVE' | 'INACTIVE'

interface AreaResponse {
  id: string
  code: string
  name: string
  description: string | null
  status: AreaStatus
}

interface AreaFormPayload {
  name: string
  code: string
  description: string | null
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AreasForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isView = mode === 'view'
  const isRegister = mode === 'register'

  const [nombre, setNombre] = useState('')
  const [clave, setClave] = useState('')
  const [descripcion, setDescripcion] = useState('')

  // `loadStatus` covers the view/edit GET-by-id fetch; `submitStatus` covers
  // the register/edit POST-PUT submit — separate so a slow initial fetch
  // doesn't fight with the submit button's own loading state.
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
      setDescripcion('')
      setLoadStatus('idle')
      setLoadErrorMsg('')
    }
  }, [mode, id])

  useEffect(() => {
    if (isRegister || !id) return
    let cancelled = false
    setLoadStatus('loading')
    setLoadErrorMsg('')
    apiGet<AreaResponse>(`/payment-areas/${id}`)
      .then(data => {
        if (cancelled) return
        setNombre(data.name)
        setClave(data.code)
        setDescripcion(data.description ?? '')
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 404) {
          setLoadErrorMsg('No se encontró el área solicitada.')
        } else if (apiErr.status === 401) {
          setLoadErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        } else if (apiErr.status === 403) {
          setLoadErrorMsg('No tienes permiso para consultar esta área.')
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
    const payload: AreaFormPayload = {
      name: nombre.trim(),
      code: clave.trim(),
      description: descripcion.trim() || null,
    }
    try {
      if (isRegister) {
        const created = await apiPost<AreaResponse>('/payment-areas', payload)
        navigate(`/areas/form?mode=view&id=${created.id}`, { state: { toast: 'Área registrada exitosamente.' } })
      } else if (id) {
        await apiPut<AreaResponse>(`/payment-areas/${id}`, payload)
        navigate(`/areas/form?mode=view&id=${id}`, { state: { toast: 'Área actualizada exitosamente.' } })
      }
    } catch (err) {
      setSubmitStatus('error')
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 409) {
        setSubmitErrorMsg(apiErr.message ?? 'El nombre o la clave ya están en uso por otra área.')
      } else if (apiErr.status === 400) {
        setSubmitErrorMsg(apiErr.message ?? 'Revisa los datos capturados: hay un valor inválido (nombre y clave son obligatorios).')
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
          { label: 'Áreas', to: '/areas' },
          { label: isRegister ? 'Registrar Área' : isView ? 'Ver Área' : 'Editar Área' },
        ]}
      />

      <FormHeader
        title={isRegister ? 'Registrar Área de Conceptos de Pago' : isView ? 'Ver Área de Conceptos de Pago' : 'Editar Área de Conceptos de Pago'}
        subtitle={
          isRegister ? 'Completa los campos para registrar una nueva área de conceptos de pago.' :
          isView ? 'Información del área de conceptos de pago.' :
          'Modifica los datos del área de conceptos de pago.'
        }
        right={
          <ModeSwitcher
            mode={mode}
            id={id}
            registerUrl="/areas/new"
            formUrl={m => `/areas/form?mode=${m}&id=${id}`}
          />
        }
      />

      {/* Load error banner (view/edit fetch failed) */}
      {loadStatus === 'error' && loadErrorMsg && <ErrorBanner message={loadErrorMsg} />}

      {/* Submit error banner */}
      {submitStatus === 'error' && submitErrorMsg && <ErrorBanner message={submitErrorMsg} />}

      {/* Form card */}
      <FormCard loading={loadStatus === 'loading'} loadingLabel="Cargando área...">
        <div className="grid grid-cols-12 gap-4">
          <TextField
            label="Nombre del Área"
            required={!isView}
            value={nombre}
            onChange={setNombre}
            disabled={disabled}
            placeholder="Ej. Cuotas de Inscripción"
            help="Nombre largo del área que agrupa conceptos de pago."
            className="col-span-12 sm:col-span-8"
          />
          <TextField
            label="Clave"
            required={!isView}
            value={clave}
            onChange={setClave}
            disabled={disabled}
            placeholder="Ej. INSC"
            help="Identificador corto único. Se muestra junto al nombre en la selección de conceptos."
            className="col-span-12 sm:col-span-4"
          />
          <TextAreaField
            label="Descripción"
            value={descripcion}
            onChange={setDescripcion}
            disabled={disabled}
            rows={4}
            placeholder="Descripción breve del área y los conceptos que agrupa."
            className="col-span-12"
          />
        </div>
      </FormCard>

      {/* Actions */}
      {loadStatus !== 'loading' && (
        <FormActions
          isView={isView}
          onBack={() => navigate('/areas')}
          onPrimary={isView ? () => navigate(`/areas/form?mode=edit&id=${id}`) : handleSubmit}
          primaryLabel={isView ? 'Editar' : isRegister ? 'Registrar Área' : 'Guardar Cambios'}
          isSubmitting={isSubmitting}
        />
      )}
    </FormPage>
  )
}