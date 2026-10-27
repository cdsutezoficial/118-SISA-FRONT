import { useEffect, useState } from 'react'
import { FieldLabel, FieldError, FieldHelp, ModeSwitcher, SearchSelectField } from '@app/core/components/ui'
import type { SelectOption } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField, TextAreaField, SelectField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate } from 'react-router'
import { useFormMode } from '@app/core/infra/hooks'
import { apiGet, apiPost, apiPut, getApiErrorMessage, type ApiError } from '@app/core/infra/apiClient'
import { MODALITY_LABELS } from '@app/core/infra/programLabel'
import { useFieldValidation } from '@app/core/validation/useFieldValidation'
import {
  required,
  selectionRequired,
  maxLength,
  lengthBetween,
  noControlChars,
  lettersSpacesHyphensAndCommas,
  codePattern,
  normalizeCode,
  normalizeText,
} from '@app/core/validation/fieldRules'

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

// ─── Schema de validación ──────────────────────────────────────────────────────
// Se declara fuera del componente para que su identidad sea estable: el hook lo
// usa como dependencia de sus callbacks.
//
// Contenido permitido por campo (decisión de negocio 2026-10-04):
//   name        → letras y acentos, separados por espacios o guiones; admite
//                 comas (los nombres oficiales pueden llevarlas, p.ej.
//                 "Ingeniería en Software, TSU")
//   offerName   → igual que `name`; además forma parte de la unicidad
//                 (offerName, modality), así que admite lo mismo
//   code        → segmentos alfanuméricos unidos por guiones simples. A
//                 diferencia de División, aquí SÍ admite números: es la clave
//                 corta de la carrera (IDGS, ISW-ADMIN-01, FRB-01)
//   divisionId  → obligatorio, es un select
//   level       → obligatorio, es un select
//   modality    → obligatorio, es un select
//   dgpCode     → clave numérica de la DGP. Opcional y sin patrón: es un
//                 número, no un nombre. Sólo lleva techo de longitud
//   description → letras, números, acentos y símbolos; sólo se rechazan los
//                 caracteres de control (C0, DEL y C1)
//
// `name`, `offerName`, `dgpCode` y `description` son textos libres: NO llevan
// `normalize`, porque recortar en cada pulsación impediría escribir un espacio
// entre palabras. Se usa `validateOn: normalizeText`, que compacta los espacios
// de más y recorta **sólo al evaluar las reglas**, sin escribir de vuelta en el
// input: el usuario ve lo que escribió (y el cursor nunca le salta) mientras lo
// que se valida y lo que se manda es el texto limpio. El payload se arma con el
// mismo `normalizeText`.
//
// `code` sí lleva `normalize: normalizeCode` — recortar y pasar a mayúsculas
// mientras se teclea es exactamente lo que se hacía antes a mano.
//
// `continuityProgramId` NO entra al schema: es nullable y sin reglas, igual que
// `directorPersonId` en División. Vive en un `useState` propio.

const PROGRAM_SCHEMA = {
  name: {
    validateOn: normalizeText,
    rules: [
      required('nombre de la carrera'),
      maxLength(150, 'nombre'),
      noControlChars('nombre'),
      lettersSpacesHyphensAndCommas('nombre'),
    ],
  },
  offerName: {
    validateOn: normalizeText,
    rules: [
      required('nombre de oferta'),
      maxLength(200, 'nombre de oferta'),
      noControlChars('nombre de oferta'),
      lettersSpacesHyphensAndCommas('nombre de oferta'),
    ],
  },
  code: {
    normalize: normalizeCode,
    rules: [required('clave', 'f'), lengthBetween(2, 41, 'clave', 'f'), codePattern('clave', 'f')],
  },
  divisionId: { rules: [selectionRequired('una división académica')] },
  level: { rules: [selectionRequired('el nivel académico')] },
  modality: { rules: [selectionRequired('la modalidad')] },
  dgpCode: {
    validateOn: normalizeText,
    rules: [maxLength(100, 'clave DGP', 'f')],
  },
  description: {
    validateOn: normalizeText,
    rules: [maxLength(500, 'descripción', 'f'), noControlChars('descripción', 'f')],
  },
} as const

const PROGRAM_INITIAL_VALUES = {
  name: '',
  offerName: '',
  code: '',
  divisionId: '',
  level: '',
  modality: '',
  dgpCode: '',
  description: '',
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CarrerasForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isView = mode === 'view'
  const isRegister = mode === 'register'

  // Nullable y sin reglas — fuera del hook, igual que `directorPersonId` en
  // División.
  const [continuityProgramId, setContinuityProgramId] = useState<string | null>(null)

  const [divisions, setDivisions] = useState<SelectOption[]>([])
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(isRegister ? 'idle' : 'loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

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
  } = useFieldValidation(PROGRAM_SCHEMA, PROGRAM_INITIAL_VALUES)

  useEffect(() => {
    setSubmitStatus('idle')
    setSubmitErrorMsg('')
    if (isRegister) {
      reset()
      setContinuityProgramId(null)
      setLoadStatus('idle')
      setLoadErrorMsg('')
    }
  }, [mode, id, reset])

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
        setFieldValue('name', data.name)
        setFieldValue('code', data.code)
        setFieldValue('offerName', data.offerName)
        setFieldValue('level', data.level)
        setFieldValue('modality', data.modality)
        setFieldValue('divisionId', data.divisionId)
        setFieldValue('dgpCode', data.dgpCode ?? '')
        setFieldValue('description', data.description ?? '')
        setContinuityProgramId(data.continuityProgramId)
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

  const disabled = isView || loadStatus === 'loading'
  const isSubmitting = submitStatus === 'submitting'

  async function handleSubmit() {
    // Marca todos los campos como tocados y valida. Si algo falla, no se
    // dispara ninguna petición.
    if (!validate()) return
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    const payload: ProgramFormPayload = {
      divisionId: values.divisionId,
      name: normalizeText(values.name),
      offerName: normalizeText(values.offerName),
      code: values.code,
      level: values.level as AcademicLevel,
      modality: values.modality as ProgramModality,
      continuityProgramId,
      description: normalizeText(values.description) || null,
      dgpCode: normalizeText(values.dgpCode) || null,
    }
    try {
      if (isRegister) {
        const created = await apiPost<AcademicProgramDetail>('/programs', payload)
        navigate(`/carreras/form?mode=view&id=${created.id}`, { state: { toast: 'Carrera registrada exitosamente.' } })
      } else if (id) {
        await apiPut<AcademicProgramDetail>(`/programs/${id}`, payload)
        navigate(`/carreras/form?mode=view&id=${id}`, { state: { toast: 'Carrera actualizada exitosamente.' } })
      }
    } catch (err) {
      const apiErr = err as ApiError
      if (apiErr?.status === 409 && typeof apiErr.backendMessage === 'string') {
        if (apiErr.backendMessage.includes('clave')) {
          setFieldError('code', apiErr.backendMessage)
          setSubmitStatus('error')
          setSubmitErrorMsg(apiErr.backendMessage)
          return
        }
        if (apiErr.backendMessage.includes('oferta') || apiErr.backendMessage.includes('modalidad')) {
          setFieldError('offerName', apiErr.backendMessage)
          setSubmitStatus('error')
          setSubmitErrorMsg(apiErr.backendMessage)
          return
        }
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
          { label: 'Carreras', to: '/carreras' },
          { label: isRegister ? 'Registrar Carrera' : isView ? 'Ver Carrera' : 'Editar Carrera' },
        ]}
      />

      <FormHeader
        title={isRegister ? 'Registrar Carrera' : isView ? 'Ver Carrera' : 'Editar Carrera'}
        subtitle={isRegister
          ? 'Completa los campos para registrar una nueva carrera.'
          : isView
          ? 'Información de la carrera.'
          : 'Modifica los datos de la carrera.'}
        right={
          <ModeSwitcher
            mode={mode}
            id={id}
            registerUrl="/carreras/new"
            formUrl={m => `/carreras/form?mode=${m}&id=${id}`}
          />
        }
      />

      {/* Load error banner */}
      {loadStatus === 'error' && loadErrorMsg && <ErrorBanner message={loadErrorMsg} />}

      {/* Submit error banner */}
      {submitStatus === 'error' && submitErrorMsg && <ErrorBanner message={submitErrorMsg} />}

      {/* Form card */}
      <FormCard loading={loadStatus === 'loading'} loadingLabel="Cargando carrera...">
        <div className="grid grid-cols-12 gap-4">
          <TextField
            label="Nombre de la Carrera"
            required={!isView}
            value={values.name}
            onChange={handleChange('name')}
            onBlur={handleBlur('name')}
            disabled={disabled}
            error={fieldError('name')}
            maxLength={150}
            placeholder="Ej. Ingeniería en Desarrollo y Gestión de Software"
            help="Nombre oficial y completo de la carrera."
            className="col-span-12 sm:col-span-8"
          />
          <TextField
            label="Clave"
            required={!isView}
            value={values.code}
            onChange={handleChange('code')}
            onBlur={handleBlur('code')}
            disabled={disabled}
            error={fieldError('code')}
            maxLength={41}
            placeholder="Ej. IDGS"
            help="Identificador corto único de la carrera."
            className="col-span-12 sm:col-span-4"
          />
          <TextField
            label="Nombre de Oferta"
            required={!isView}
            value={values.offerName}
            onChange={handleChange('offerName')}
            onBlur={handleBlur('offerName')}
            disabled={disabled}
            error={fieldError('offerName')}
            maxLength={200}
            placeholder="Ej. Ingeniería en Desarrollo y Gestión de Software Presencial"
            help="Nombre oficial de la oferta educativa (único junto con la modalidad)."
            className="col-span-12 sm:col-span-8"
          />
          {/* `SelectField` no expone `onBlur`: el error aparece en cuanto se
              elige un valor, porque `handleChange` marca el campo como tocado. */}
          <SelectField
            label="Nivel Académico"
            required={!isView}
            value={values.level}
            onChange={handleChange('level')}
            disabled={disabled}
            error={fieldError('level')}
            options={(Object.keys(LEVEL_LABELS) as AcademicLevel[]).map(l => ({ value: l, label: LEVEL_LABELS[l] }))}
            placeholder="Seleccionar nivel…"
            help="Nivel del plan de estudios."
            className="col-span-12 sm:col-span-4"
          />
          <SelectField
            label="Modalidad"
            required={!isView}
            value={values.modality}
            onChange={handleChange('modality')}
            disabled={disabled}
            error={fieldError('modality')}
            options={(Object.keys(MODALITY_LABELS) as ProgramModality[]).map(m => ({ value: m, label: MODALITY_LABELS[m] }))}
            placeholder="Seleccionar modalidad…"
            help="Modalidad de impartición."
            className="col-span-12 sm:col-span-4"
          />
          {/* `SearchSelectField` sólo acepta `hasError: boolean` y ningún
              mensaje, así que el texto se pinta a mano como en División. */}
          <div className="col-span-12 sm:col-span-4">
            <FieldLabel required={!isView}>División Académica</FieldLabel>
            <SearchSelectField
              options={divisions}
              value={values.divisionId}
              onChange={handleChange('divisionId')}
              placeholder="Seleccionar división…"
              disabled={disabled}
              hasError={!!fieldError('divisionId')}
              searchPlaceholder="Buscar división…"
            />
            {fieldError('divisionId')
              ? <FieldError>{fieldError('divisionId')}</FieldError>
              : <FieldHelp>División a la que pertenece la carrera.</FieldHelp>}
          </div>
          <TextField
            label="Clave DGP"
            value={values.dgpCode}
            onChange={handleChange('dgpCode')}
            onBlur={handleBlur('dgpCode')}
            disabled={disabled}
            error={fieldError('dgpCode')}
            maxLength={100}
            placeholder="Ej. 220740067"
            help="Clave asignada por la Dirección General de Profesiones. Opcional."
            className="col-span-12 sm:col-span-4"
          />
          <TextAreaField
            label="Descripción"
            value={values.description}
            onChange={handleChange('description')}
            onBlur={handleBlur('description')}
            disabled={disabled}
            error={fieldError('description')}
            rows={3}
            maxLength={500}
            placeholder="Descripción breve de la carrera y su enfoque académico."
            className="col-span-12"
          />
        </div>
      </FormCard>

      {/* Actions */}
      {loadStatus !== 'loading' && (
        <FormActions
          isView={isView}
          onBack={() => navigate('/carreras')}
          onPrimary={isView ? () => navigate(`/carreras/form?mode=edit&id=${id}`) : handleSubmit}
          primaryLabel={isView ? 'Editar' : isRegister ? 'Registrar Carrera' : 'Guardar Cambios'}
          isSubmitting={isSubmitting}
          primaryDisabled={!isView && !isValid}
        />
      )}
    </FormPage>
  )
}
