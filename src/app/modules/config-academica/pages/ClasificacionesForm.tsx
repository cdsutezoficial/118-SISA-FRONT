import { useEffect, useState } from 'react'
import { FormPage, FormHeader, FormCard, FormActions, TextField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate } from 'react-router'
import { useFormMode } from '@app/core/infra/hooks'
import { apiGet, apiPost, apiPut, getApiErrorMessage, type ApiError } from '@app/core/infra/apiClient'
import { useFieldValidation } from '@app/core/validation/useFieldValidation'
import {
  required,
  maxLength,
  lengthBetween,
  noControlChars,
  codePattern,
  lettersNumbersSpacesAndHyphens,
  normalizeCode,
  normalizeText,
} from '@app/core/validation/fieldRules'

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

// ─── Schema de validación ──────────────────────────────────────────────────────
// Se declara fuera del componente para que su identidad sea estable: el hook lo
// usa como dependencia de sus callbacks.
//
// Contenido permitido por campo (decisión de negocio 2026-10-05):
//   name → letras, números, espacios y guiones. El usuario pegó
//          `$%&/()=[:_.-2das - =)("OP.-{{-{` en el campo y el formulario lo
//          aceptaba entero, así que los paréntesis, las comas y los signos de
//          puntuación quedan fuera. Los guiones valen con espacios alrededor
//          ("Materia integradora - 1"), y las letras Unicode también
//          ("Práctica", "Español", "Diseño").
//   code → segmentos alfanuméricos unidos por guiones simples: "INT-C-ADM",
//          "REG-UPD-DUP-B". ASCII, sin espacios. El techo es 20 (el dato más
//          largo observado son 12), no 10, que truncaba "REG-UPD-DUP-B" sin avisar.
//
// `name` es texto libre y NO lleva `normalize`: recortar en cada pulsación
// impediría escribir un espacio entre palabras. Se usa `validateOn:
// normalizeText`, que compacta los espacios de más y recorta **sólo al evaluar
// las reglas**, sin escribir de vuelta en el input: el usuario ve lo que escribió
// (y el cursor nunca le salta) mientras lo que se valida y lo que se manda es el
// texto limpio. El payload se arma con el mismo `normalizeText`.
//
// `code` sí lleva `normalize: normalizeCode` — recortar y pasar a mayúsculas
// mientras se teclea es exactamente lo que se hacía antes a mano
// (`v => setClave(v.toUpperCase())`).

const CLASIFICACION_SCHEMA = {
  name: {
    validateOn: normalizeText,
    rules: [
      required('nombre de la clasificación'),
      maxLength(150, 'nombre'),
      noControlChars('nombre'),
      lettersNumbersSpacesAndHyphens('nombre'),
    ],
  },
  code: {
    normalize: normalizeCode,
    rules: [required('clave', 'f'), lengthBetween(2, 20, 'clave', 'f'), codePattern('clave', 'f')],
  },
} as const

const CLASIFICACION_INITIAL_VALUES = { name: '', code: '' }

// ─── Page ──────────────────────────────────────────────────────────────────────
// No "Ver Detalle" mode here — per the Figma spec (Pantalla 21), two fields
// don't justify a third read-only view, unlike DivisionesForm. This screen
// only ever handles register/edit; any `mode` other than `register` is
// treated as edit.

export default function ClasificacionesForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isRegister = mode === 'register'

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
  } = useFieldValidation(CLASIFICACION_SCHEMA, CLASIFICACION_INITIAL_VALUES)

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
      reset()
      setLoadStatus('idle')
      setLoadErrorMsg('')
    }
  }, [mode, id, reset])

  useEffect(() => {
    if (isRegister || !id) return
    let cancelled = false
    setLoadStatus('loading')
    setLoadErrorMsg('')
    apiGet<ClassificationResponse>(`/subject-classifications/${id}`)
      .then(data => {
        if (cancelled) return
        setFieldValue('name', data.name)
        setFieldValue('code', data.code)
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

  const disabled = loadStatus === 'loading'
  const isSubmitting = submitStatus === 'submitting'

  async function handleSubmit() {
    // Marca todos los campos como tocados y valida. Si algo falla, no se
    // dispara ninguna petición.
    if (!validate()) return
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    const payload: ClassificationFormPayload = {
      name: normalizeText(values.name),
      code: values.code,
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
      const apiErr = err as ApiError
      // El único 409 de este módulo es el de código duplicado, y su mensaje
      // ("Ya existe una clasificación con la clave proporcionada.") contiene
      // "clave". Se inyecta inline en el campo en vez de dejarlo sólo en el
      // banner, que queda como fallback si el mensaje cambia y deja de
      // identificar el campo.
      if (apiErr?.status === 409 && typeof apiErr.backendMessage === 'string') {
        if (apiErr.backendMessage.includes('clave')) {
          setFieldError('code', apiErr.backendMessage)
          setSubmitStatus('idle')
          return
        }
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
            value={values.name}
            onChange={handleChange('name')}
            onBlur={handleBlur('name')}
            disabled={disabled}
            error={fieldError('name')}
            maxLength={150}
            placeholder="Ej. Materia integradora - 1"
            help="Letras, números, espacios y guiones. Hasta 150 caracteres."
            className="col-span-12 sm:col-span-8"
          />
          <TextField
            label="Clave"
            required
            value={values.code}
            onChange={handleChange('code')}
            onBlur={handleBlur('code')}
            disabled={disabled}
            error={fieldError('code')}
            maxLength={20}
            mono
            placeholder="Ej. INT-C-ADM"
            help="Identificador corto único. Letras, números y guiones. Hasta 20 caracteres."
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
          primaryDisabled={!isValid}
        />
      )}
    </FormPage>
  )
}
