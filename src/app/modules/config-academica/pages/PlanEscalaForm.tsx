import { useEffect, useState } from 'react'
import { BookOpen, Plus, Trash2 } from 'lucide-react'
import { FieldLabel, FieldHelp, FieldError, inputCls, SearchSelectField, Switch } from '@app/core/components/ui'
import type { SelectOption } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, Button, IconButton, TextField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate, useSearchParams } from 'react-router'
import { apiGet, apiPost, apiPut } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────
// This screen registers/edits a GradeScale *inside a plan* — there is no
// standalone GET /plans/{id}/grade-scales/{scaleId}, so edit mode loads the
// whole plan (GET /plans/{planId}) and locates the scale inside
// gradeScales[]. See docs/plans/2026-07-20-planes-materias-escalas-wiring.md.

interface GradeScaleEntry {
  id: string
  fromValue: number
  toValue: number
  letter: string
  description: string
  passed: boolean
}

interface GradeScaleResponse {
  id: string
  classificationId: string
  numericMin: number
  numericMax: number
  entries: GradeScaleEntry[]
}

interface AcademicPlanSummary {
  id: string
  version: string
  gradeScales: GradeScaleResponse[]
}

interface ClassificationListItem {
  id: string
  name: string
  code: string
}

interface ClassificationsPageResponse {
  items: ClassificationListItem[]
}

// Local editable row shape — values kept as strings while the row is being
// edited, converted to numbers only at submit time (mirrors the rest of the
// form's numeric fields).
interface EntryRow {
  fromValue: string
  toValue: string
  letter: string
  description: string
  passed: boolean
}

interface EntryRequestPayload {
  fromValue: number
  toValue: number
  letter: string
  description: string
  passed: boolean
}

interface GradeScaleRequestPayload {
  classificationId: string
  numericMin: number
  numericMax: number
  entries: EntryRequestPayload[]
}

function emptyRow(): EntryRow {
  return { fromValue: '', toValue: '', letter: '', description: '', passed: false }
}

type FormErrors = Partial<Record<'classificationId' | 'numericMin' | 'numericMax' | 'entries', string>>

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PlanEscalaForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const planId = searchParams.get('planId')
  const scaleId = searchParams.get('scaleId')
  const isRegister = (searchParams.get('mode') ?? 'register') !== 'edit'

  // ─── Field state ───────────────────────────────────────────────────────────
  const [classificationId, setClassificationId] = useState('')
  const [numericMin, setNumericMin] = useState('')
  const [numericMax, setNumericMax] = useState('')
  const [entries, setEntries] = useState<EntryRow[]>([emptyRow()])

  // ─── Auxiliary state ───────────────────────────────────────────────────────
  const [classifications, setClassifications] = useState<SelectOption[]>([])
  const [plan, setPlan] = useState<AcademicPlanSummary | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [rowErrors, setRowErrors] = useState<boolean[]>([])
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  // Missing route params — can't do anything on this screen without them.
  const missingParams = !planId || (!isRegister && !scaleId)

  // Classification catalog for the search-select — same call shape as
  // ClasificacionesList.tsx / PlanMateriaForm.tsx (`apiGet` with size).
  useEffect(() => {
    apiGet<ClassificationsPageResponse>('/subject-classifications', { size: 100 })
      .then(data => setClassifications(data.items.map(c => ({ value: c.id, label: `${c.code} — ${c.name}` }))))
      .catch(() => {/* non-critical — search-select will be empty */})
  }, [])

  // Plan context (both modes need it for the context card and to know which
  // classifications already have a scale; edit mode also needs it to locate
  // the scale being edited inside gradeScales[]).
  useEffect(() => {
    if (missingParams) {
      setLoadStatus('error')
      setLoadErrorMsg('Falta el plan de estudios para continuar.')
      return
    }
    let cancelled = false
    setLoadStatus('loading')
    setLoadErrorMsg('')
    apiGet<AcademicPlanSummary>(`/plans/${planId}`)
      .then(data => {
        if (cancelled) return
        setPlan(data)
        if (!isRegister && scaleId) {
          const scale = data.gradeScales.find(gs => gs.id === scaleId)
          if (!scale) {
            setLoadStatus('error')
            setLoadErrorMsg('No se encontró la escala de calificación solicitada en este plan.')
            return
          }
          setClassificationId(scale.classificationId)
          setNumericMin(String(scale.numericMin))
          setNumericMax(String(scale.numericMax))
          setEntries(scale.entries.length > 0
            ? scale.entries.map(e => ({
              fromValue: String(e.fromValue),
              toValue: String(e.toValue),
              letter: e.letter,
              description: e.description,
              passed: e.passed,
            }))
            : [emptyRow()])
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
  }, [planId, scaleId, isRegister, missingParams])

  const disabled = loadStatus === 'loading' || loadStatus === 'error'
  const isSubmitting = submitStatus === 'submitting'

  // Classifications that already have a scale in this plan are excluded from
  // the picker — the backend also rejects duplicates with 409, but hiding
  // them avoids an avoidable round-trip. The scale currently being edited
  // keeps its own classification selectable.
  const usedClassificationIds = new Set(
    (plan?.gradeScales ?? [])
      .filter(gs => gs.id !== scaleId)
      .map(gs => gs.classificationId),
  )
  const availableClassifications = classifications.filter(c => !usedClassificationIds.has(c.value))

  function clearErr(field: keyof FormErrors) {
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function updateRow(index: number, patch: Partial<EntryRow>) {
    setEntries(prev => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
    clearErr('entries')
  }

  function addRow() {
    setEntries(prev => [...prev, emptyRow()])
  }

  function removeRow(index: number) {
    setEntries(prev => prev.filter((_, i) => i !== index))
  }

  function validate(): { errors: FormErrors; rowErrors: boolean[] } {
    const e: FormErrors = {}
    if (!classificationId) e.classificationId = 'Selecciona la clasificación.'

    const min = Number(numericMin)
    const max = Number(numericMax)
    if (!numericMin.trim()) e.numericMin = 'La calificación mínima es obligatoria.'
    else if (isNaN(min)) e.numericMin = 'Ingresa un número válido.'
    if (!numericMax.trim()) e.numericMax = 'La calificación máxima es obligatoria.'
    else if (isNaN(max)) e.numericMax = 'Ingresa un número válido.'
    if (!e.numericMin && !e.numericMax && min >= max) {
      e.numericMax = 'La calificación máxima debe ser mayor que la mínima.'
    }

    const rErrors = entries.map(row => {
      const rowMin = Number(row.fromValue)
      const rowMax = Number(row.toValue)
      const invalid = !row.fromValue.trim() || !row.toValue.trim() || isNaN(rowMin) || isNaN(rowMax)
        || !row.letter.trim() || !row.description.trim()
      return invalid
    })
    if (entries.length === 0) {
      e.entries = 'Agrega al menos un rango.'
    } else if (rErrors.some(Boolean)) {
      e.entries = 'Completa todos los campos de los rangos marcados.'
    }

    return { errors: e, rowErrors: rErrors }
  }

  async function handleSubmit() {
    const { errors: validationErrors, rowErrors: validationRowErrors } = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      setRowErrors(validationRowErrors)
      return
    }
    setErrors({})
    setRowErrors([])
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')

    const payload: GradeScaleRequestPayload = {
      classificationId,
      numericMin: Number(numericMin),
      numericMax: Number(numericMax),
      entries: entries.map(row => ({
        fromValue: Number(row.fromValue),
        toValue: Number(row.toValue),
        letter: row.letter.trim(),
        description: row.description.trim(),
        passed: row.passed,
      })),
    }

    try {
      if (isRegister) {
        await apiPost(`/plans/${planId}/grade-scales`, payload)
        navigate(`/planes/detalle?id=${planId}&tab=escalas`, { state: { toast: 'Escala de calificación registrada exitosamente.' } })
      } else if (scaleId) {
        await apiPut(`/plans/${planId}/grade-scales/${scaleId}`, payload)
        navigate(`/planes/detalle?id=${planId}&tab=escalas`, { state: { toast: 'Escala de calificación actualizada exitosamente.' } })
      }
    } catch (err) {
      setSubmitStatus('error')
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 409) {
        setSubmitErrorMsg(apiErr.message ?? 'Esta clasificación ya tiene una escala registrada en este plan.')
      } else if (apiErr.status === 400) {
        setSubmitErrorMsg(apiErr.message ?? 'Revisa los rangos capturados: deben cubrir exactamente el rango numérico sin huecos ni traslapes.')
      } else if (apiErr.status === 401) {
        setSubmitErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
      } else if (apiErr.status === 403) {
        setSubmitErrorMsg('No tienes permiso para realizar esta acción.')
      } else if (apiErr.status === 404) {
        setSubmitErrorMsg('No se encontró el plan o la escala indicados.')
      } else {
        setSubmitErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
      }
    }
  }

  function cancelUrl(): string {
    return planId ? `/planes/detalle?id=${planId}&tab=escalas` : '/planes'
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
          { label: isRegister ? 'Registrar Escala' : 'Editar Escala' },
        ]}
      />

      <FormHeader
        title={isRegister ? 'Registrar Escala de Calificación' : 'Editar Escala de Calificación'}
        subtitle="Define los rangos numéricos y su equivalencia en letra para una clasificación de materia dentro de este plan."
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
          </div>

          {/* Form card — general config */}
          <FormCard>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-4">Configuración General</p>

            <div className="grid grid-cols-12 gap-4">
              {/* Clasificación */}
              <div className="col-span-12 sm:col-span-6">
                <FieldLabel required>Clasificación de Materia</FieldLabel>
                <SearchSelectField
                  options={availableClassifications}
                  value={classificationId}
                  onChange={v => { setClassificationId(v); clearErr('classificationId') }}
                  placeholder="Selecciona la clasificación…"
                  disabled={disabled}
                  hasError={!!errors.classificationId}
                  searchPlaceholder="Buscar clasificación…"
                />
                {errors.classificationId
                  ? <FieldError>{errors.classificationId}</FieldError>
                  : <FieldHelp>Las clasificaciones que ya tienen una escala en este plan no aparecen aquí.</FieldHelp>}
              </div>
              {/* Calificación Mínima */}
              <TextField
                label="Calificación Mínima"
                required
                value={numericMin}
                onChange={v => { setNumericMin(v); clearErr('numericMin') }}
                disabled={disabled}
                error={errors.numericMin}
                type="number"
                step={0.1}
                numeric
                placeholder="Ej. 0.0"
                help="Valor numérico mínimo válido para esta escala."
                className="col-span-6 sm:col-span-3"
              />
              {/* Calificación Máxima */}
              <TextField
                label="Calificación Máxima"
                required
                value={numericMax}
                onChange={v => { setNumericMax(v); clearErr('numericMax') }}
                disabled={disabled}
                error={errors.numericMax}
                type="number"
                step={0.1}
                numeric
                placeholder="Ej. 10.0"
                help="Valor numérico máximo válido para esta escala."
                className="col-span-6 sm:col-span-3"
              />
            </div>
          </FormCard>

          {/* Entries table */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
            <div className="flex items-center gap-4 mb-2">
              <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest whitespace-nowrap">Rangos y Nomenclatura</p>
              <div className="flex-1 h-px bg-[#E5E7EB]" />
            </div>
            <p className="text-[12px] text-[#6B7280] mb-4">
              Define cada tramo de calificación con su letra equivalente. Al registrar una calificación, el sistema asignará automáticamente la letra del rango que la contenga.
            </p>

            {/* Desktop table */}
            <div className="hidden md:block border border-[#E5E7EB] rounded-lg overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#F8F9FA] border-b border-[#E5E7EB]">
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Desde</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Hasta</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider w-20">Clave</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Descripción</th>
                    <th className="text-center px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">¿Aprueba?</th>
                    <th className="px-3 py-2 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((row, i) => {
                    const rowHasError = !!rowErrors[i]
                    return (
                      <tr key={i} className="border-b border-[#E5E7EB] last:border-0">
                        <td className="px-2 py-2">
                          <input
                            type="number" step="0.1"
                            value={row.fromValue}
                            onChange={e => updateRow(i, { fromValue: e.target.value })}
                            disabled={disabled}
                            className={inputCls(disabled, rowHasError && !row.fromValue.trim()) + ' tabular-nums'}
                            placeholder="Ej. 0.0"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number" step="0.1"
                            value={row.toValue}
                            onChange={e => updateRow(i, { toValue: e.target.value })}
                            disabled={disabled}
                            className={inputCls(disabled, rowHasError && !row.toValue.trim()) + ' tabular-nums'}
                            placeholder="Ej. 6.9"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={row.letter}
                            maxLength={4}
                            onChange={e => updateRow(i, { letter: e.target.value.toUpperCase() })}
                            disabled={disabled}
                            className={inputCls(disabled, rowHasError && !row.letter.trim())}
                            placeholder="Ej. NA"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={row.description}
                            onChange={e => updateRow(i, { description: e.target.value })}
                            disabled={disabled}
                            className={inputCls(disabled, rowHasError && !row.description.trim())}
                            placeholder="Ej. No Aprobatorio"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-center">
                            <Switch checked={row.passed} onChange={v => updateRow(i, { passed: v })} disabled={disabled} />
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <IconButton
                            icon={<Trash2 size={14} />}
                            danger
                            onClick={() => removeRow(i)}
                            disabled={disabled || entries.length === 1}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {entries.map((row, i) => {
                const rowHasError = !!rowErrors[i]
                return (
                  <div key={i} className="border border-[#E5E7EB] rounded-lg p-3">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <FieldLabel>Desde</FieldLabel>
                        <input
                          type="number" step="0.1"
                          value={row.fromValue}
                          onChange={e => updateRow(i, { fromValue: e.target.value })}
                          disabled={disabled}
                          className={inputCls(disabled, rowHasError && !row.fromValue.trim()) + ' tabular-nums'}
                          placeholder="Ej. 0.0"
                        />
                      </div>
                      <div>
                        <FieldLabel>Hasta</FieldLabel>
                        <input
                          type="number" step="0.1"
                          value={row.toValue}
                          onChange={e => updateRow(i, { toValue: e.target.value })}
                          disabled={disabled}
                          className={inputCls(disabled, rowHasError && !row.toValue.trim()) + ' tabular-nums'}
                          placeholder="Ej. 6.9"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <FieldLabel>Clave</FieldLabel>
                        <input
                          value={row.letter}
                          maxLength={4}
                          onChange={e => updateRow(i, { letter: e.target.value.toUpperCase() })}
                          disabled={disabled}
                          className={inputCls(disabled, rowHasError && !row.letter.trim())}
                          placeholder="Ej. NA"
                        />
                      </div>
                      <div className="flex flex-col">
                        <FieldLabel>¿Aprueba?</FieldLabel>
                        <div className="h-[38px] flex items-center">
                          <Switch checked={row.passed} onChange={v => updateRow(i, { passed: v })} disabled={disabled} />
                        </div>
                      </div>
                    </div>
                    <div className="mb-2">
                      <FieldLabel>Descripción</FieldLabel>
                      <input
                        value={row.description}
                        onChange={e => updateRow(i, { description: e.target.value })}
                        disabled={disabled}
                        className={inputCls(disabled, rowHasError && !row.description.trim())}
                        placeholder="Ej. No Aprobatorio"
                      />
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      className="w-full"
                      onClick={() => removeRow(i)}
                      disabled={disabled || entries.length === 1}
                    >
                      <Trash2 size={13} />Eliminar Rango
                    </Button>
                  </div>
                )
              })}
            </div>

            {errors.entries && <FieldError>{errors.entries}</FieldError>}

            <Button variant="ghost" size="sm" className="mt-3" onClick={addRow} disabled={disabled}>
              <Plus size={14} />Agregar Rango
            </Button>
          </div>

          {/* Actions */}
          <FormActions
            isView={false}
            onBack={() => navigate(cancelUrl())}
            onPrimary={handleSubmit}
            primaryLabel={isRegister ? 'Registrar Escala' : 'Guardar Cambios'}
            isSubmitting={isSubmitting}
          />
        </>
      )}
    </FormPage>
  )
}