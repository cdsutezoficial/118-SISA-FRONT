import { useEffect, useState } from 'react'
import { ModeSwitcher } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField, TextAreaField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate } from 'react-router'
import { useFormMode } from '@app/core/infra/hooks'
import { apiGet, apiPost, apiPut } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'
import { useFieldValidation } from '@app/core/validation/useFieldValidation'
import {
  lengthBetween,
  maxLength,
  noControlChars,
  pattern,
  required,
  normalizeCode,
  normalizeText,
} from '@app/core/validation/fieldRules'

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

// ─── Schema ────────────────────────────────────────────────────────────────────
// Los dos 409 de este catálogo se distinguen por `code`, no por el mensaje:
// antes iban fusionados en un handler único, así que el formulario tenía que
// adivinar por copy qué campo había chocado. Ahora cada uno llega con su código
// y se pega a su campo.
const AREA_NAME_DUPLICATE = 'PAYMENT_AREA_NAME_DUPLICATE'
const AREA_CODE_DUPLICATE = 'PAYMENT_AREA_CODE_DUPLICATE'

/**
 * `name` es texto libre: NO lleva `normalize`, porque recortar en cada pulsación
 * impediría escribir el espacio entre palabras ("Cuotas de " se convertiría en
 * "Cuotas de" y nunca se podría teclear "Inscripción"). Se usa
 * `validateOn: normalizeText`, que sólo limpia el valor al evaluar las reglas.
 *
 * `code` sí lleva `normalize: normalizeCode` — recortar y pasar a mayúsculas no
 * estorba al teclear en un identificador corto, y hace que la regla de formato
 * se pueda escribir en mayúsculas sin tener que tolerar la minúscula que el
 * usuario acaba de teclear.
 *
 * `code` acepta **2 a 5 alfanuméricos en mayúscula** (regla de negocio
 * confirmada el 2026-10-05; ejemplos: `COL`, `INS`, `INSC`). Son dos reglas y no
 * un `@Size` con regex combinado para que el mensaje diga si el problema es la
 * longitud o el formato. El `/^[A-Z0-9]+$/` sin cuantificador es
 * intencionalmente laxo en la longitud — de eso se encarga `lengthBetween` — y
 * las anclas `^`/`$` no llevan modificadores: en JavaScript `$` también casa
 * antes de un `\n` final, así que un valor con salto de línea colaría por el
 * patrón; el `noControlChars` del backend es quien corta ese caso.
 */
const AREA_SCHEMA = {
  name: {
    validateOn: normalizeText,
    rules: [required('nombre'), maxLength(150, 'nombre'), noControlChars('nombre')],
  },
  code: {
    normalize: normalizeCode,
    rules: [
      required('clave', 'f'),
      lengthBetween(2, 5, 'clave', 'f'),
      pattern(/^[A-Z0-9]+$/, 'La clave solo puede contener letras mayúsculas y números.'),
    ],
  },
  description: {
    validateOn: normalizeText,
    // Sin `maxLength`, a propósito: el backend tampoco pone techo a la
    // descripción (la columna es TEXT) y un límite puesto sólo aquí dejaría al
    // usuario sin poder editar un área con una descripción más larga de lo que
    // el formulario admite. Si negocio quiere un tope, se fija en los dos lados.
    rules: [noControlChars('descripción', 'f')],
  },
} as const

const AREA_INITIAL_VALUES = { name: '', code: '', description: '' }

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AreasForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isView = mode === 'view'
  const isRegister = mode === 'register'

  // `loadStatus` covers the view/edit GET-by-id fetch; `submitStatus` covers
  // the register/edit POST-PUT submit — separate so a slow initial fetch
  // doesn't fight with the submit button's own loading state.
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(isRegister ? 'idle' : 'loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  const { values, fieldError, handleChange, handleBlur, setFieldValue, setFieldError, reset, validate, isValid } =
    useFieldValidation(AREA_SCHEMA, AREA_INITIAL_VALUES)

  useEffect(() => {
    setSubmitStatus('idle')
    setSubmitErrorMsg('')
    if (isRegister) {
      reset()
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
        // `setFieldValue` y no `handleChange`: es carga inicial, no interacción,
        // y no debe marcar los campos como tocados (si no, el formulario abriría
        // en rojo antes de que el usuario tocara nada).
        setFieldValue('name', data.name)
        setFieldValue('code', data.code)
        setFieldValue('description', data.description ?? '')
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
    // `validate()` marca todos los campos como tocados: si el usuario pulsa
    // "Guardar" con el formulario incompleto, los errores tienen que verse, no
    // sólo impedir el envío.
    if (!validate()) return
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    const payload: AreaFormPayload = {
      name: normalizeText(values.name),
      code: normalizeCode(values.code),
      description: normalizeText(values.description) || null,
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
      // Los 409 se pegan a su campo, no al banner. Un 409 sin código
      // reconocible (un handler que no lo emita, o un proxy) cae al banner en
      // vez de desaparecer: es mejor un mensaje genérico que ningún feedback.
      if (apiErr.status === 409 && apiErr.code === AREA_NAME_DUPLICATE) {
        setFieldError('name', apiErr.message ?? 'El nombre del área ya está en uso.')
      } else if (apiErr.status === 409 && apiErr.code === AREA_CODE_DUPLICATE) {
        setFieldError('code', apiErr.message ?? 'La clave del área ya está en uso.')
      } else if (apiErr.status === 409) {
        setSubmitErrorMsg(apiErr.message ?? 'El nombre o la clave ya están en uso por otra área.')
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

      {/* Submit error banner — sólo para lo que no es error de campo */}
      {submitStatus === 'error' && submitErrorMsg && <ErrorBanner message={submitErrorMsg} />}

      {/* Form card */}
      <FormCard loading={loadStatus === 'loading'} loadingLabel="Cargando área...">
        <div className="grid grid-cols-12 gap-4">
          <TextField
            label="Nombre del Área"
            required={!isView}
            value={values.name}
            onChange={handleChange('name')}
            onBlur={handleBlur('name')}
            error={fieldError('name')}
            disabled={disabled}
            maxLength={150}
            placeholder="Ej. Cuotas de Inscripción"
            help="Nombre largo del área que agrupa conceptos de pago."
            className="col-span-12 sm:col-span-8"
          />
          <TextField
            label="Clave"
            required={!isView}
            value={values.code}
            onChange={handleChange('code')}
            onBlur={handleBlur('code')}
            error={fieldError('code')}
            disabled={disabled}
            maxLength={5}
            placeholder="Ej. INSC"
            help="De 2 a 5 letras mayúsculas o números. Se muestra junto al nombre en la selección de conceptos."
            className="col-span-12 sm:col-span-4"
          />
          <TextAreaField
            label="Descripción"
            value={values.description}
            onChange={handleChange('description')}
            onBlur={handleBlur('description')}
            error={fieldError('description')}
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
          primaryDisabled={!isView && !isValid}
        />
      )}
    </FormPage>
  )
}
