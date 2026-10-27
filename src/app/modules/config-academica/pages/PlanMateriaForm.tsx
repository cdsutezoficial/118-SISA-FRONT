import { useEffect, useState } from 'react'
import { BookOpen, Layers } from 'lucide-react'
import { FieldLabel, FieldHelp, FieldError, SearchSelectField, Switch } from '@app/core/components/ui'
import type { SelectOption } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField, SelectField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate, useSearchParams } from 'react-router'
import { apiGet, apiPost, apiPut, getApiErrorMessage, type ApiError } from '@app/core/infra/apiClient'
import { useFieldValidation } from '@app/core/validation/useFieldValidation'
import {
  required,
  selectionRequired,
  maxLength,
  noControlChars,
  numeric,
  normalizeCode,
  normalizeText,
} from '@app/core/validation/fieldRules'

// ─── Types ─────────────────────────────────────────────────────────────────────
// This screen registers/edits a Subject *inside a plan level* — there is no
// standalone GET /subjects/{id}, so edit mode loads the whole plan
// (GET /plans/{planId}) and locates the subject inside
// levels[].subjects[]. See docs/plans/2026-07-20-planes-materias-escalas-wiring.md.

type SubjectType = 'CORE' | 'ELECTIVE' | 'INTERNSHIP'

const TYPE_LABELS: Record<SubjectType, string> = {
  CORE: 'Troncal (CORE)',
  ELECTIVE: 'Optativa (ELECTIVE)',
  INTERNSHIP: 'Estadías (INTERNSHIP)',
}

interface SubjectDetail {
  id: string
  code: string
  name: string
  credits: number
  weeklyHours: number
  evaluationUnits: number
  displayOrder: number
  type: SubjectType
  isRetakeable: boolean
  classificationId: string
}

interface PlanLevelDetail {
  id: string
  levelNumber: number
  description: string | null
  subjects: SubjectDetail[]
}

interface AcademicPlanSummary {
  id: string
  version: string
  levels: PlanLevelDetail[]
}

interface ClassificationListItem {
  id: string
  name: string
  code: string
}

interface ClassificationsPageResponse {
  items: ClassificationListItem[]
}

interface SubjectFormPayload {
  code: string
  name: string
  credits: number
  weeklyHours: number
  evaluationUnits: number
  displayOrder: number
  type: SubjectType
  isRetakeable: boolean
  classificationId: string
}

// ─── Schema de validación ──────────────────────────────────────────────────────
// Se declara fuera del componente para que su identidad sea estable: el hook lo
// usa como dependencia de sus callbacks.
//
// Los límites son los de `AddSubjectRequest` / `UpdateSubjectRequest`, para que
// el navegador no deje pasar nada que el servidor vaya a rechazar con 400:
//   code, name           → @NotBlank + @Size(max = 255) + @Pattern(^[^\p{Cc}]*$)
//   credits              → @Min(0)
//   weeklyHours          → @Min(0)
//   evaluationUnits      → @Min(1)
//   displayOrder         → @Min(1)
//   type                 → @NotNull, es un select
//   classificationId     → @NotNull, es un select
//
// `code` lleva `normalize: normalizeCode` (recortar y mayúsculas al teclear),
// igual que antes lo hacía `v.toUpperCase()` a mano, y ahora también recorta.
// El backend normaliza el código con mayúsculas y compara sin distinguir caja
// (`equalsIgnoreCase`), así que el navegador no puede dejar una variante.
//
// `name` es texto libre: `validateOn: normalizeText` y ningún `normalize`, para
// que el cursor no salte al escribir un espacio entre palabras. El payload se
// arma con el mismo `normalizeText`.
const SUBJECT_SCHEMA = {
  code: {
    normalize: normalizeCode,
    rules: [
      required('código de la materia'),
      maxLength(255, 'código de la materia'),
      noControlChars('código de la materia'),
    ],
  },
  name: {
    validateOn: normalizeText,
    rules: [
      required('nombre de la materia'),
      maxLength(255, 'nombre de la materia'),
      noControlChars('nombre de la materia'),
    ],
  },
  credits: {
    // Opcional: si se deja vacío se envía `0`, y el backend lo acepta
    // (@Min(0) int sin @NotNull). `numeric` pasa de largo el vacío.
    rules: [numeric({ label: 'créditos', gender: 'mp', min: 0 })],
  },
  weeklyHours: {
    rules: [required('horas semanales', 'fp'), numeric({ label: 'horas semanales', gender: 'fp', min: 0 })],
  },
  evaluationUnits: {
    rules: [
      required('unidades de evaluación', 'fp'),
      numeric({ label: 'unidades de evaluación', gender: 'fp', min: 1 }),
    ],
  },
  displayOrder: { rules: [required('orden en kardex'), numeric({ label: 'orden en kardex', min: 1 })] },
  type: { rules: [selectionRequired('el tipo de materia')] },
  classificationId: { rules: [selectionRequired('la clasificación')] },
} as const

const SUBJECT_INITIAL_VALUES = {
  code: '',
  name: '',
  credits: '',
  weeklyHours: '',
  evaluationUnits: '',
  displayOrder: '',
  // El tipo viene preseleccionado como antes: es el valor por defecto que
  // asumía el `useState` de este campo, y el backend exige uno. Forzar al
  // usuario a elegirlo sería un paso extra sin ganancia.
  type: 'CORE',
  classificationId: '',
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PlanMateriaForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const planId = searchParams.get('planId')
  const levelId = searchParams.get('levelId')
  const subjectId = searchParams.get('subjectId')
  const isRegister = (searchParams.get('mode') ?? 'register') !== 'edit'

  // ─── Field state ───────────────────────────────────────────────────────────
  // Los ocho campos de la materia viven en `useFieldValidation`.
  // `isRetakeable` no: es un switch sin reglas.
  const [isRetakeable, setIsRetakeable] = useState(true)

  // ─── Auxiliary state ───────────────────────────────────────────────────────
  const [classifications, setClassifications] = useState<SelectOption[]>([])
  const [plan, setPlan] = useState<AcademicPlanSummary | null>(null)

  const {
    values,
    fieldError,
    handleChange,
    handleBlur,
    setFieldValue,
    setFieldError,
    validate,
    isValid,
  } = useFieldValidation(SUBJECT_SCHEMA, SUBJECT_INITIAL_VALUES)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  // Missing route params — can't do anything on this screen without them.
  const missingParams = !planId || !levelId || (!isRegister && !subjectId)

  // Classification catalog for the search-select — same call shape as
  // ClasificacionesList.tsx (`apiGet` with status/search/page/size).
  useEffect(() => {
    apiGet<ClassificationsPageResponse>('/subject-classifications', { size: 100 })
      .then(data => setClassifications(data.items.map(c => ({ value: c.id, label: `${c.code} — ${c.name}` }))))
      .catch(() => {/* non-critical — search-select will be empty */})
  }, [])

  // Plan + level context (both modes need it for the context card; edit mode
  // also needs it to locate the subject inside levels[].subjects[]).
  useEffect(() => {
    if (missingParams) {
      setLoadStatus('error')
      setLoadErrorMsg('Faltan datos del plan o del nivel para continuar.')
      return
    }
    let cancelled = false
    setLoadStatus('loading')
    setLoadErrorMsg('')
    apiGet<AcademicPlanSummary>(`/plans/${planId}`)
      .then(data => {
        if (cancelled) return
        setPlan(data)
        if (!isRegister && subjectId) {
          const level = data.levels.find(l => l.id === levelId)
          const subject = level?.subjects.find(s => s.id === subjectId)
          if (!subject) {
            setLoadStatus('error')
            setLoadErrorMsg('No se encontró la materia solicitada en este nivel.')
            return
          }
          setFieldValue('code', subject.code)
          setFieldValue('name', subject.name)
          setFieldValue('credits', String(subject.credits))
          setFieldValue('weeklyHours', String(subject.weeklyHours))
          setFieldValue('evaluationUnits', String(subject.evaluationUnits))
          setFieldValue('displayOrder', String(subject.displayOrder))
          setFieldValue('type', subject.type)
          setFieldValue('classificationId', subject.classificationId)
          setIsRetakeable(subject.isRetakeable)
        }
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        setLoadErrorMsg(getApiErrorMessage(err))
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, levelId, subjectId, isRegister, missingParams])

  const disabled = loadStatus === 'loading' || loadStatus === 'error'
  const isSubmitting = submitStatus === 'submitting'
  const level = plan?.levels.find(l => l.id === levelId)

  async function handleSubmit() {
    // Marca todos los campos como tocados y valida. Si algo falla, no sale
    // ninguna petición.
    if (!validate()) return
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')

    const payload: SubjectFormPayload = {
      code: values.code,
      name: normalizeText(values.name),
      credits: Number(values.credits),
      weeklyHours: Number(values.weeklyHours),
      evaluationUnits: Number(values.evaluationUnits),
      displayOrder: Number(values.displayOrder),
      type: values.type as SubjectType,
      isRetakeable,
      classificationId: values.classificationId,
    }

    try {
      if (isRegister) {
        await apiPost(`/plans/${planId}/levels/${levelId}/subjects`, payload)
        navigate(`/planes/detalle?id=${planId}`, { state: { toast: 'Materia registrada en el nivel exitosamente.' } })
      } else if (subjectId) {
        await apiPut(`/plans/${planId}/levels/${levelId}/subjects/${subjectId}`, payload)
        navigate(`/planes/detalle?id=${planId}`, { state: { toast: 'Materia actualizada exitosamente.' } })
      }
    } catch (err) {
      const apiErr = err as ApiError
      if (apiErr?.status === 409 && typeof apiErr.backendMessage === 'string') {
        if (apiErr.backendMessage.includes('código')) {
          setFieldError('code', apiErr.backendMessage)
          setSubmitStatus('error')
          setSubmitErrorMsg(apiErr.backendMessage)
          return
        }
      }
      setSubmitStatus('error')
      setSubmitErrorMsg(getApiErrorMessage(err))
    }
  }

  function cancelUrl(): string {
    return planId ? `/planes/detalle?id=${planId}` : '/planes'
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <FormPage>
      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Planes de Estudio', to: '/planes' },
          { label: plan ? plan.version : 'Detalle del Plan', to: cancelUrl() },
          { label: isRegister ? 'Registrar Materia' : 'Editar Materia' },
        ]}
      />

      <FormHeader
        title={isRegister ? 'Registrar Materia en el Nivel' : 'Editar Materia del Nivel'}
        subtitle="Completa los datos de la materia y configura cómo se evaluará y mostrará dentro de este nivel del plan."
      />

      {loadStatus === 'error' && loadErrorMsg && <ErrorBanner message={loadErrorMsg} />}
      {submitStatus === 'error' && submitErrorMsg && <ErrorBanner message={submitErrorMsg} />}

      {loadStatus === 'loading' ? (
        <FormCard loading loadingLabel="Cargando información del plan..." />
      ) : loadStatus === 'error' ? null : (
        <>
          {/* Context card */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg px-5 py-4 mb-6 flex items-center gap-8 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-[#e6f5f1]">
                <BookOpen size={16} className="text-[#009574]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-0.5">Plan</p>
                <p className="text-[13px] font-semibold text-[#333333] font-mono">{plan?.version ?? '—'}</p>
              </div>
            </div>
            <div className="w-px h-8 bg-[#E5E7EB] flex-shrink-0" />
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-violet-50">
                <Layers size={16} className="text-violet-600" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-0.5">Nivel</p>
                <p className="text-[13px] font-semibold text-[#333333]">
                  {level ? `Nivel ${level.levelNumber}${level.description ? ` — ${level.description}` : ''}` : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Form card */}
          <FormCard>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-4">Datos de la Materia</p>

            <div className="grid grid-cols-12 gap-4 mb-6">
              {/* Código */}
              <TextField
                label="Código"
                required
                value={values.code}
                onChange={handleChange('code')}
                onBlur={handleBlur('code')}
                disabled={disabled}
                error={fieldError('code')}
                maxLength={255}
                placeholder="Ej. FP-101"
                mono
                className="col-span-12 sm:col-span-4"
              />
              {/* Nombre */}
              <TextField
                label="Nombre"
                required
                value={values.name}
                onChange={handleChange('name')}
                onBlur={handleBlur('name')}
                disabled={disabled}
                error={fieldError('name')}
                maxLength={255}
                placeholder="Ej. Fundamentos de Programación"
                className="col-span-12 sm:col-span-8"
              />

              {/* Créditos */}
              <TextField
                label="Créditos"
                required
                value={values.credits}
                onChange={handleChange('credits')}
                onBlur={handleBlur('credits')}
                disabled={disabled}
                error={fieldError('credits')}
                type="number"
                min={0}
                numeric
                placeholder="Ej. 5"
                className="col-span-6 sm:col-span-3"
              />
              {/* Horas Semanales */}
              <TextField
                label="Horas Semanales"
                required
                value={values.weeklyHours}
                onChange={handleChange('weeklyHours')}
                onBlur={handleBlur('weeklyHours')}
                disabled={disabled}
                error={fieldError('weeklyHours')}
                type="number"
                min={0}
                numeric
                placeholder="Ej. 4"
                className="col-span-6 sm:col-span-3"
              />
              {/* Clasificación */}
              <div className="col-span-12 sm:col-span-6">
                <FieldLabel required>Clasificación</FieldLabel>
                <SearchSelectField
                  options={classifications}
                  value={values.classificationId}
                  onChange={handleChange('classificationId')}
                  placeholder="Selecciona clasificación…"
                  disabled={disabled}
                  hasError={!!fieldError('classificationId')}
                  searchPlaceholder="Buscar clasificación…"
                />
                {fieldError('classificationId')
                  ? <FieldError>{fieldError('classificationId')}</FieldError>
                  : <FieldHelp>Determina la escala de calificaciones aplicable al evaluar esta materia.</FieldHelp>}
              </div>
            </div>

            {/* Separador */}
            <div className="flex items-center gap-4 mb-6">
              <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest whitespace-nowrap">Configuración en este Plan</p>
              <div className="flex-1 h-px bg-[#E5E7EB]" />
            </div>

            <div className="grid grid-cols-12 gap-4">
              {/* Unidades de Evaluación */}
              <TextField
                label="Unidades de Evaluación"
                required
                value={values.evaluationUnits}
                onChange={handleChange('evaluationUnits')}
                onBlur={handleBlur('evaluationUnits')}
                disabled={disabled}
                error={fieldError('evaluationUnits')}
                type="number"
                min={1}
                numeric
                placeholder="Ej. 3"
                help="Número de parciales que registrará el docente."
                className="col-span-6 sm:col-span-3"
              />

              {/* Tipo */}
              <SelectField
                label="Tipo"
                required
                value={values.type}
                onChange={handleChange('type')}
                disabled={disabled}
                error={fieldError('type')}
                options={(Object.keys(TYPE_LABELS) as SubjectType[]).map(t => ({ value: t, label: TYPE_LABELS[t] }))}
                placeholder="Selecciona el tipo…"
                className="col-span-12 sm:col-span-4"
              />

              {/* Orden en Kardex */}
              <TextField
                label="Orden en Kardex"
                required
                value={values.displayOrder}
                onChange={handleChange('displayOrder')}
                onBlur={handleBlur('displayOrder')}
                disabled={disabled}
                error={fieldError('displayOrder')}
                type="number"
                min={1}
                numeric
                placeholder="Ej. 1"
                help="Posición en kardex y certificados de estudios."
                className="col-span-6 sm:col-span-3"
              />

              {/* ¿Recursable? */}
              <div className="col-span-6 sm:col-span-2 flex flex-col">
                <span className="block text-[12px] font-semibold text-[#333333] mb-1">¿Recursable?</span>
                <div className={`flex items-center gap-2 h-[38px] px-3 rounded-md border transition-colors ${isRetakeable ? 'bg-[#e6f5f1] border-[#009574]/30' : 'bg-white border-[#E5E7EB]'}`}>
                  <Switch checked={isRetakeable} onChange={setIsRetakeable} disabled={disabled} />
                  <span className={`text-[12px] font-medium ${isRetakeable ? 'text-[#009574]' : 'text-[#6B7280]'}`}>
                    {isRetakeable ? 'Sí' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          </FormCard>

          {/* Actions */}
          <FormActions
            isView={false}
            onBack={() => navigate(cancelUrl())}
            onPrimary={handleSubmit}
            primaryLabel={isRegister ? 'Registrar Materia' : 'Guardar Cambios'}
            isSubmitting={isSubmitting}
            primaryDisabled={!isValid}
          />
        </>
      )}
    </FormPage>
  )
}