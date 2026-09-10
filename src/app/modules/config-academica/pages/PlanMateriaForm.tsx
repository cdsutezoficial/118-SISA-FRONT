import { useEffect, useState } from 'react'
import { BookOpen, Layers } from 'lucide-react'
import { FieldLabel, FieldHelp, FieldError, SearchSelectField, Switch } from '@app/core/components/ui'
import type { SelectOption } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, TextField, SelectField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate, useSearchParams } from 'react-router'
import { apiGet, apiPost, apiPut } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'

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

type FormErrors = Partial<Record<'code' | 'name' | 'credits' | 'weeklyHours' | 'evaluationUnits' | 'displayOrder' | 'type' | 'classificationId', string>>

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PlanMateriaForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const planId = searchParams.get('planId')
  const levelId = searchParams.get('levelId')
  const subjectId = searchParams.get('subjectId')
  const isRegister = (searchParams.get('mode') ?? 'register') !== 'edit'

  // ─── Field state ───────────────────────────────────────────────────────────
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [credits, setCredits] = useState('')
  const [weeklyHours, setWeeklyHours] = useState('')
  const [evaluationUnits, setEvaluationUnits] = useState('')
  const [displayOrder, setDisplayOrder] = useState('')
  const [type, setType] = useState<SubjectType | ''>('CORE')
  const [isRetakeable, setIsRetakeable] = useState(true)
  const [classificationId, setClassificationId] = useState('')

  // ─── Auxiliary state ───────────────────────────────────────────────────────
  const [classifications, setClassifications] = useState<SelectOption[]>([])
  const [plan, setPlan] = useState<AcademicPlanSummary | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
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
          setCode(subject.code)
          setName(subject.name)
          setCredits(String(subject.credits))
          setWeeklyHours(String(subject.weeklyHours))
          setEvaluationUnits(String(subject.evaluationUnits))
          setDisplayOrder(String(subject.displayOrder))
          setType(subject.type)
          setIsRetakeable(subject.isRetakeable)
          setClassificationId(subject.classificationId)
        }
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 404) {
          setLoadErrorMsg('No se encontró el plan de estudios solicitado.')
        } else if (apiErr.status === 401) {
          setLoadErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        } else if (apiErr.status === 403) {
          setLoadErrorMsg('No tienes permiso para consultar este plan de estudios.')
        } else {
          setLoadErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, levelId, subjectId, isRegister, missingParams])

  const disabled = loadStatus === 'loading' || loadStatus === 'error'
  const isSubmitting = submitStatus === 'submitting'
  const level = plan?.levels.find(l => l.id === levelId)

  function clearErr(field: keyof FormErrors) {
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!code.trim()) e.code = 'La clave de la materia es obligatoria.'
    if (!name.trim()) e.name = 'El nombre de la materia es obligatorio.'
    if (!credits.trim()) e.credits = 'Los créditos son obligatorios.'
    else if (isNaN(Number(credits)) || Number(credits) < 0) e.credits = 'Ingresa un número válido.'
    if (!weeklyHours.trim()) e.weeklyHours = 'Las horas semanales son obligatorias.'
    else if (isNaN(Number(weeklyHours)) || Number(weeklyHours) < 0) e.weeklyHours = 'Ingresa un número válido.'
    if (!evaluationUnits.trim()) e.evaluationUnits = 'Las unidades de evaluación son obligatorias.'
    else if (isNaN(Number(evaluationUnits)) || Number(evaluationUnits) < 1) e.evaluationUnits = 'Ingresa un número válido mayor a 0.'
    if (!displayOrder.trim()) e.displayOrder = 'El orden en kardex es obligatorio.'
    else if (isNaN(Number(displayOrder)) || Number(displayOrder) < 1) e.displayOrder = 'Ingresa un número válido mayor a 0.'
    if (!type) e.type = 'Selecciona el tipo de materia.'
    if (!classificationId) e.classificationId = 'Selecciona la clasificación.'
    return e
  }

  async function handleSubmit() {
    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors({})
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')

    const payload: SubjectFormPayload = {
      code: code.trim(),
      name: name.trim(),
      credits: Number(credits),
      weeklyHours: Number(weeklyHours),
      evaluationUnits: Number(evaluationUnits),
      displayOrder: Number(displayOrder),
      type: type as SubjectType,
      isRetakeable,
      classificationId,
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
      setSubmitStatus('error')
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 409) {
        setSubmitErrorMsg(apiErr.message ?? 'La clave ya está en uso por otra materia de este plan.')
      } else if (apiErr.status === 400) {
        setSubmitErrorMsg(apiErr.message ?? 'Revisa los datos capturados: hay un valor inválido.')
      } else if (apiErr.status === 401) {
        setSubmitErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
      } else if (apiErr.status === 403) {
        setSubmitErrorMsg('No tienes permiso para realizar esta acción.')
      } else if (apiErr.status === 404) {
        setSubmitErrorMsg('No se encontró el plan, nivel o materia indicados.')
      } else {
        setSubmitErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
      }
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
                value={code}
                onChange={v => { setCode(v.toUpperCase()); clearErr('code') }}
                disabled={disabled}
                error={errors.code}
                placeholder="Ej. FP-101"
                mono
                className="col-span-12 sm:col-span-4"
              />
              {/* Nombre */}
              <TextField
                label="Nombre"
                required
                value={name}
                onChange={v => { setName(v); clearErr('name') }}
                disabled={disabled}
                error={errors.name}
                placeholder="Ej. Fundamentos de Programación"
                className="col-span-12 sm:col-span-8"
              />

              {/* Créditos */}
              <TextField
                label="Créditos"
                required
                value={credits}
                onChange={v => { setCredits(v); clearErr('credits') }}
                disabled={disabled}
                error={errors.credits}
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
                value={weeklyHours}
                onChange={v => { setWeeklyHours(v); clearErr('weeklyHours') }}
                disabled={disabled}
                error={errors.weeklyHours}
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
                  value={classificationId}
                  onChange={v => { setClassificationId(v); clearErr('classificationId') }}
                  placeholder="Selecciona clasificación…"
                  disabled={disabled}
                  hasError={!!errors.classificationId}
                  searchPlaceholder="Buscar clasificación…"
                />
                {errors.classificationId
                  ? <FieldError>{errors.classificationId}</FieldError>
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
                value={evaluationUnits}
                onChange={v => { setEvaluationUnits(v); clearErr('evaluationUnits') }}
                disabled={disabled}
                error={errors.evaluationUnits}
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
                value={type}
                onChange={v => { setType(v as SubjectType); clearErr('type') }}
                disabled={disabled}
                error={errors.type}
                options={(Object.keys(TYPE_LABELS) as SubjectType[]).map(t => ({ value: t, label: TYPE_LABELS[t] }))}
                placeholder="Selecciona el tipo…"
                className="col-span-12 sm:col-span-4"
              />

              {/* Orden en Kardex */}
              <TextField
                label="Orden en Kardex"
                required
                value={displayOrder}
                onChange={v => { setDisplayOrder(v); clearErr('displayOrder') }}
                disabled={disabled}
                error={errors.displayOrder}
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
          />
        </>
      )}
    </FormPage>
  )
}