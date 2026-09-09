import { useEffect, useState } from 'react'
import { FieldLabel, FieldError, FieldHelp, ModeSwitcher, SearchSelectField } from '@app/core/components/ui'
import type { SelectOption } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField, TextAreaField, SelectField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate } from 'react-router'
import { useFormMode } from '@app/core/infra/hooks'
import { apiGet, apiPost, apiPut } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'

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
  const [continuityProgramId, setContinuityProgramId] = useState<string | null>(null)

  // ─── Auxiliary state ───────────────────────────────────────────────────────
  const [divisions, setDivisions] = useState<SelectOption[]>([])
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
      setOfferName('')
      setCode('')
      setLevel('')
      setModality('')
      setDivisionId('')
      setDgpCode('')
      setDescription('')
      setContinuityProgramId(null)
      setLoadStatus('idle')
      setLoadErrorMsg('')
    }
  }, [mode, id])

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
        setContinuityProgramId(data.continuityProgramId)
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
      continuityProgramId,
      description: description.trim() || null,
      dgpCode: dgpCode.trim() || null,
    }

    try {
      if (isRegister) {
        const created = await apiPost<AcademicProgramDetail>('/programs', payload)
        navigate(`/programas/form?mode=view&id=${created.id}`, { state: { toast: 'Programa registrado exitosamente.' } })
      } else if (id) {
        await apiPut<AcademicProgramDetail>(`/programs/${id}`, payload)
        navigate(`/programas/form?mode=view&id=${id}`, { state: { toast: 'Programa actualizado exitosamente.' } })
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
    <FormPage>
      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Programas Educativos', to: '/programas' },
          { label: isRegister ? 'Registrar Programa' : isView ? 'Ver Programa' : 'Editar Programa' },
        ]}
      />

      <FormHeader
        title={isRegister ? 'Registrar Programa' : isView ? 'Ver Programa' : 'Editar Programa'}
        subtitle={isRegister
          ? 'Completa los campos para registrar un nuevo programa educativo.'
          : isView
          ? 'Información del programa educativo.'
          : 'Modifica los datos del programa educativo.'}
        right={
          <ModeSwitcher
            mode={mode}
            id={id}
            registerUrl="/programas/new"
            formUrl={m => `/programas/form?mode=${m}&id=${id}`}
          />
        }
      />

      {/* Load error banner */}
      {loadStatus === 'error' && loadErrorMsg && <ErrorBanner message={loadErrorMsg} />}

      {/* Submit error banner */}
      {submitStatus === 'error' && submitErrorMsg && <ErrorBanner message={submitErrorMsg} />}

      {/* Form card */}
      <FormCard loading={loadStatus === 'loading'} loadingLabel="Cargando programa...">
        <div className="grid grid-cols-12 gap-4">
          <TextField
            label="Nombre del Programa"
            required={!isView}
            value={name}
            onChange={v => { setName(v); setErrors(prev => ({ ...prev, name: undefined })) }}
            disabled={disabled}
            error={errors.name}
            placeholder="Ej. Ingeniería en Desarrollo y Gestión de Software"
            help="Nombre oficial y completo del programa educativo."
            className="col-span-12 sm:col-span-8"
          />
          <TextField
            label="Clave"
            required={!isView}
            value={code}
            onChange={v => { setCode(v); setErrors(prev => ({ ...prev, code: undefined })) }}
            disabled={disabled}
            error={errors.code}
            placeholder="Ej. IDGS"
            help="Identificador corto único del programa."
            className="col-span-12 sm:col-span-4"
          />
          <TextField
            label="Nombre de Oferta"
            required={!isView}
            value={offerName}
            onChange={v => { setOfferName(v); setErrors(prev => ({ ...prev, offerName: undefined })) }}
            disabled={disabled}
            error={errors.offerName}
            placeholder="Ej. Ingeniería en Desarrollo y Gestión de Software Presencial"
            help="Nombre oficial de la oferta educativa (único junto con la modalidad)."
            className="col-span-12 sm:col-span-8"
          />
          <SelectField
            label="Nivel Académico"
            required={!isView}
            value={level}
            onChange={v => { setLevel(v as AcademicLevel); setErrors(prev => ({ ...prev, level: undefined })) }}
            disabled={disabled}
            error={errors.level}
            options={(Object.keys(LEVEL_LABELS) as AcademicLevel[]).map(l => ({ value: l, label: LEVEL_LABELS[l] }))}
            placeholder="Seleccionar nivel…"
            help="Nivel del plan de estudios."
            className="col-span-12 sm:col-span-4"
          />
          <SelectField
            label="Modalidad"
            required={!isView}
            value={modality}
            onChange={v => { setModality(v as ProgramModality); setErrors(prev => ({ ...prev, modality: undefined })) }}
            disabled={disabled}
            error={errors.modality}
            options={(Object.keys(MODALITY_LABELS) as ProgramModality[]).map(m => ({ value: m, label: MODALITY_LABELS[m] }))}
            placeholder="Seleccionar modalidad…"
            help="Modalidad de impartición."
            className="col-span-12 sm:col-span-4"
          />
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
          <TextField
            label="Clave DGP"
            value={dgpCode}
            onChange={setDgpCode}
            disabled={disabled}
            placeholder="Ej. 220740067"
            help="Clave asignada por la Dirección General de Profesiones. Opcional."
            className="col-span-12 sm:col-span-4"
          />
          <TextAreaField
            label="Descripción"
            value={description}
            onChange={setDescription}
            disabled={disabled}
            rows={3}
            placeholder="Descripción breve del programa y su enfoque académico."
            className="col-span-12"
          />
        </div>
      </FormCard>

      {/* Actions */}
      {loadStatus !== 'loading' && (
        <FormActions
          isView={isView}
          onBack={() => navigate('/programas')}
          onPrimary={isView ? () => navigate(`/programas/form?mode=edit&id=${id}`) : handleSubmit}
          primaryLabel={isView ? 'Editar' : isRegister ? 'Registrar Programa' : 'Guardar Cambios'}
          isSubmitting={isSubmitting}
        />
      )}
    </FormPage>
  )
}
