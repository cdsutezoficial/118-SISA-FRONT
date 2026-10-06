import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Plus, Trash2 } from 'lucide-react'
import { FieldLabel, FieldHelp, FieldError, inputCls, SearchSelectField, Switch } from '@app/core/components/ui'
import type { SelectOption } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, FormActions, Button, IconButton, TextField } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { useNavigate, useSearchParams } from 'react-router'
import { apiGet, apiPost, apiPut, getApiErrorMessage, type ApiError } from '@app/core/infra/apiClient'
import { useFieldValidation } from '@app/core/validation/useFieldValidation'
import {
  required,
  selectionRequired,
  decimal,
  maxLength,
  noControlChars,
  applyRules,
  normalizeText,
  type FieldRule,
} from '@app/core/validation/fieldRules'

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

// ─── Schema de validación ──────────────────────────────────────────────────────
// Se declara fuera del componente para que su identidad sea estable: el hook lo
// usa como dependencia de sus callbacks.
//
// `numericMin` y `numericMax` replican el `@Digits(integer = 4, fraction = 1)`
// de `SetGradeScaleRequest`, que es lo que permite la columna (precision = 5,
// scale = 1): sin ese tope el navegador dejaría pasar `12345.6`, que el backend
// rechaza con 400. El rango [0, 100] que usan las escalas reales se acepta
// entero, de ahí los 4 dígitos.
//
// El array `entries` **no** entra al schema: es una tabla dinámica y su
// validación **cross-fila** —cobertura sin huecos ni traslapes, paso de 0.1— no
// se puede expresar como reglas por campo. Conserva `validateEntries`, que es el
// espejo del `GradeScale.validateEntries` del backend.
//
// Eso no significa que sus celdas no tengan reglas: cada una tiene las suyas,
// declaradas en `ENTRY_CELL_RULES` más abajo.
const SCALE_SCHEMA = {
  classificationId: { rules: [selectionRequired('la clasificación')] },
  numericMin: {
    rules: [required('calificación mínima', 'f'), decimal({ label: 'calificación mínima', gender: 'f', intDigits: 4, fraction: 1 })],
  },
  numericMax: {
    rules: [required('calificación máxima', 'f'), decimal({ label: 'calificación máxima', gender: 'f', intDigits: 4, fraction: 1 })],
  },
} as const

const SCALE_INITIAL_VALUES = {
  classificationId: '',
  numericMin: '',
  numericMax: '',
}

// `numericMax > numericMin` es la única regla entre campos: la ve el backend en
// `SetGradeScaleUseCaseImpl` y no la puede expresar `@Min`, porque depende del
// otro valor. Vive en `crossRules` para que el error se actualice en vivo y para
// que `isValid` (y por lo tanto el botón) la tenga en cuenta.
const SCALE_CROSS_RULES = (values: typeof SCALE_INITIAL_VALUES) => {
  const min = Number(values.numericMin)
  const max = Number(values.numericMax)
  if (values.numericMin.trim() && values.numericMax.trim() && !Number.isNaN(min) && !Number.isNaN(max) && min >= max) {
    return { numericMax: 'La calificación máxima debe ser mayor que la mínima.' }
  }
  return {}
}

// ─── Reglas por celda de la tabla de rangos ───────────────────────────────────
//
// Las filas de la tabla no entran al schema porque su validación **cross-fila**
// no se puede expresar como reglas por campo. Pero eso no dice nada de sus
// celdas, que sí tienen reglas propias, y que antes no tenían ninguna:
// `GradeScaleEntryRequest` declara `@Digits`, `@Size` y `@Pattern` sobre las
// cuatro columnas. Se componen con `applyRules` —que para eso está— en vez de
// con un schema del hook, porque no hay un conjunto fijo de campos: hay las
// mismas cuatro columnas repetidas en un número de filas que el usuario decide.
//
//   fromValue, toValue → @NotNull + @Digits(integer = 4, fraction = 1)
//   letter              → @NotBlank + @Pattern(Cc)
//   description         → @NotBlank + @Size(255) + @Pattern(Cc)
//
// `letter` no lleva `maxLength`: el input limita a 4, más estricto que los 255
// del backend, y una letra de nomenclatura no ocupa 255 caracteres.
//
// `fraction: 1` es lo que hace falta aquí. Sin él, `Desde`/`Hasta` aceptaban
// `6.95` y el usuario recibía un 400 del servidor sin haber visto nada: la
// cobertura con paso de 0.1 lo daba por bueno, porque `6.95 + 0.1` cae en
// `7.05` dentro del épsilon de `1e-9` que usa la comparación.
const ENTRY_CELL_RULES = {
  fromValue: [
    required('valor inicial del rango'),
    decimal({ label: 'valor inicial del rango', intDigits: 4, fraction: 1 }),
  ],
  toValue: [
    required('valor final del rango'),
    decimal({ label: 'valor final del rango', intDigits: 4, fraction: 1 }),
  ],
  letter: [
    required('letra del rango'),
    noControlChars('letra del rango'),
  ],
  description: [
    required('descripción del rango', 'f'),
    maxLength(255, 'descripción del rango', 'f'),
    noControlChars('descripción del rango', 'f'),
  ],
} as const satisfies Record<string, readonly FieldRule[]>

type EntryCellKey = keyof typeof ENTRY_CELL_RULES

/** Errores por fila y columna: `{ 0: { toValue: '…' } }`. */
type EntryCellErrors = Partial<Record<number, Partial<Record<EntryCellKey, string>>>>

/**
 * Evalúa las cuatro celdas de cada fila con `normalizeText` antes de las reglas.
 * Es lo mismo que hace el payload con `letter` y `description`: si la regla
 * midiera el texto crudo y el payload mandara el compacto, un texto de 260
 * espacios daría un error de longitud que el servidor nunca vería. A los
 * números el `normalizeText` no les hace nada útil ni dañino.
 */
function entryCellErrors(entries: EntryRow[]): EntryCellErrors {
  const errors: EntryCellErrors = {}
  const keys = Object.keys(ENTRY_CELL_RULES) as EntryCellKey[]
  entries.forEach((row, index) => {
    keys.forEach(key => {
      const error = applyRules(normalizeText(row[key]), ...ENTRY_CELL_RULES[key])
      if (error) errors[index] = { ...errors[index], [key]: error }
    })
  })
  return errors
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PlanEscalaForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const planId = searchParams.get('planId')
  const scaleId = searchParams.get('scaleId')
  const isRegister = (searchParams.get('mode') ?? 'register') !== 'edit'

  // ─── Field state ───────────────────────────────────────────────────────────
  // Los tres escalares de la escala viven en `useFieldValidation`; las filas de
  // rangos (`entries`) siguen en su propio estado, con su validación aparte.
  const [entries, setEntries] = useState<EntryRow[]>([emptyRow()])

  // ─── Auxiliary state ───────────────────────────────────────────────────────
  const [classifications, setClassifications] = useState<SelectOption[]>([])
  const [plan, setPlan] = useState<AcademicPlanSummary | null>(null)
  const [entriesError, setEntriesError] = useState<string | undefined>(undefined)
  // Las celdas no llevan `touched` individual como los campos del schema: se
  // enmascara todo el conjunto con un solo interruptor que se activa al primer
  // intento de envío. Sin él, la tabla arranca con una fila vacía y
  // mostraría "El valor inicial del rango es requerido." antes de que el usuario
  // haya escrito nada.
  const [rowsTouched, setRowsTouched] = useState(false)

  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
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
    validate,
    isValid,
  } = useFieldValidation(SCALE_SCHEMA, SCALE_INITIAL_VALUES, { crossRules: SCALE_CROSS_RULES })

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
          setFieldValue('classificationId', scale.classificationId)
          setFieldValue('numericMin', String(scale.numericMin))
          setFieldValue('numericMax', String(scale.numericMax))
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
        setLoadErrorMsg(getApiErrorMessage(err))
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

  function updateRow(index: number, patch: Partial<EntryRow>) {
    setEntries(prev => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
    setEntriesError(undefined)
  }

  function addRow() {
    setEntries(prev => [...prev, emptyRow()])
  }

  function removeRow(index: number) {
    setEntries(prev => prev.filter((_, i) => i !== index))
  }

  // Los errores de celda se derivan del estado, no se guardan: así se
  // recalculan en cada tecla una vez que las filas están tocadas, que es el
  // mismo comportamiento que `fieldError` tiene en los campos del schema.
  const cellErrors = useMemo(() => (rowsTouched ? entryCellErrors(entries) : {}), [rowsTouched, entries])

  // Las filas de rangos se validan en dos capas, y el orden importa.
  //
  // Capa 1 — cada celda contra sus reglas (`ENTRY_CELL_RULES`).
  // Capa 2 — la cobertura de la tabla entera: sin huecos ni traslapes, el primer
  //          rango inicia en el mínimo y el último termina en el máximo, con paso
  //          de 0.1 entre rangos adyacentes. Espejo del
  //          `GradeScale.validateEntries` del backend.
  //
  // Si hay un error de celda, la capa 2 **no** corre. Comparar rangos con
  // valores que ya son inválidos produce un segundo error que confunde: con
  // `6.95` como "Hasta", la regla de paso espera `7.05` y lo presentaría como
  // un hueco, cuando lo que está mal es que el valor lleva dos decimales.
  //
  // `boundsOk` indica que los dos extremos de la escala ya son números válidos
  // (los valida el schema), porque la cobertura se compara contra ellos.
  function validateEntries(boundsOk: boolean): { cellErrors: EntryCellErrors; error?: string } {
    const cellErrors = entryCellErrors(entries)
    const flag = (index: number, key: EntryCellKey, message: string) => {
      cellErrors[index] = { ...cellErrors[index], [key]: message }
    }
    if (entries.length === 0) {
      // No hay celda a la que colgarlo: la tabla está vacía y no existe fila.
      return { cellErrors, error: 'Agrega al menos un rango.' }
    }
    if (Object.keys(cellErrors).length > 0 || !boundsOk) return { cellErrors }

    const min = Number(values.numericMin)
    const max = Number(values.numericMax)
    const STEP = 0.1
    const around = (a: number, b: number) => Math.abs(a - b) < 1e-9
    const fmt = (n: number) => (Math.round(n * 10) / 10).toFixed(1)
    const nums = entries.map((row, i) => ({ index: i, from: Number(row.fromValue), to: Number(row.toValue) }))

    const inverted = nums.find(r => r.from > r.to)
    if (inverted) {
      flag(inverted.index, 'fromValue', 'El valor "Desde" es mayor que su valor "Hasta".')
      return { cellErrors }
    }

    const sorted = [...nums].sort((a, b) => a.from - b.from)
    const first = sorted[0]
    if (!around(first.from, min)) {
      flag(first.index, 'fromValue', `El primer rango debe iniciar en la calificación mínima (${fmt(min)}).`)
      return { cellErrors }
    }

    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i]
      if (i === sorted.length - 1) {
        if (!around(cur.to, max)) {
          flag(cur.index, 'toValue', `El último rango debe terminar en la calificación máxima (${fmt(max)}).`)
        }
        break
      }
      const next = sorted[i + 1]
      const expected = cur.to + STEP
      if (around(next.from, expected)) continue
      // El mensaje va en la celda "Desde" de la fila siguiente, que es donde está
      // el número que está mal. Antes se marcaba la fila entera y el resaltado
      // sólo se aplicaba a celdas vacías, así que un hueco — donde la celda no
      // está vacía — no pintaba nada.
      flag(
        next.index,
        'fromValue',
        next.from > expected
          ? `Hueco: el rango anterior termina en ${fmt(cur.to)} y este inicia en ${fmt(next.from)}. Debe iniciar en ${fmt(expected)}.`
          : `Traslape: el rango anterior termina en ${fmt(cur.to)} y este inicia en ${fmt(next.from)}. Debe iniciar en ${fmt(expected)}.`,
      )
      break
    }

    return { cellErrors }
  }

  async function handleSubmit() {
    // El schema cubre la clasificación y los dos extremos; las filas se validan
    // aparte y su error se pinta en la celda que falló. La cobertura sólo se
    // comprueba cuando los dos extremos son números: comparar contra el `0`
    // implícito de un campo vacío daría un "hueco inicial" que no es el
    // problema real.
    const boundsOk = values.numericMin.trim() !== '' && values.numericMax.trim() !== ''
      && Number.isFinite(Number(values.numericMin)) && Number.isFinite(Number(values.numericMax))
    const { cellErrors, error: entriesInvalid } = validateEntries(boundsOk)
    const hasCellErrors = Object.keys(cellErrors).length > 0
    if (!validate() || entriesInvalid || hasCellErrors) {
      // A partir de aquí las filas ya están "tocadas": sus celdas muestran error
      // y se recalculan con cada tecla, sin esperar otro intento de envío.
      setRowsTouched(true)
      // El mensaje de la tabla sólo se usa para el caso sin celda a la que
      // colgarlo (no hay ninguna fila). Los demás errores ya van en su celda.
      setEntriesError(entriesInvalid && !hasCellErrors ? entriesInvalid : undefined)
      return
    }
    setEntriesError(undefined)
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')

    const payload: GradeScaleRequestPayload = {
      classificationId: values.classificationId,
      numericMin: Number(values.numericMin),
      numericMax: Number(values.numericMax),
      entries: entries.map(row => ({
        fromValue: Number(row.fromValue),
        toValue: Number(row.toValue),
        letter: normalizeText(row.letter),
        description: normalizeText(row.description),
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
      const apiErr = err as ApiError
      if (apiErr?.status === 409 && typeof apiErr.backendMessage === 'string') {
        if (apiErr.backendMessage.includes('clasificación')) {
          setFieldError('classificationId', apiErr.backendMessage)
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
                  value={values.classificationId}
                  onChange={handleChange('classificationId')}
                  placeholder="Selecciona la clasificación…"
                  disabled={disabled}
                  hasError={!!fieldError('classificationId')}
                  searchPlaceholder="Buscar clasificación…"
                />
                {fieldError('classificationId')
                  ? <FieldError>{fieldError('classificationId')}</FieldError>
                  : <FieldHelp>Las clasificaciones que ya tienen una escala en este plan no aparecen aquí.</FieldHelp>}
              </div>
              {/* Calificación Mínima */}
              <TextField
                label="Calificación Mínima"
                required
                value={values.numericMin}
                onChange={handleChange('numericMin')}
                onBlur={handleBlur('numericMin')}
                disabled={disabled}
                error={fieldError('numericMin')}
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
                value={values.numericMax}
                onChange={handleChange('numericMax')}
                onBlur={handleBlur('numericMax')}
                disabled={disabled}
                error={fieldError('numericMax')}
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
                    const err = cellErrors[i] ?? {}
                    return (
                      <tr key={i} className="border-b border-[#E5E7EB] last:border-0 align-top">
                        <td className="px-2 py-2">
                          <input
                            type="number" step="0.1"
                            value={row.fromValue}
                            onChange={e => updateRow(i, { fromValue: e.target.value })}
                            disabled={disabled}
                            className={inputCls(disabled, !!err.fromValue) + ' tabular-nums'}
                            placeholder="Ej. 0.0"
                          />
                          {err.fromValue && <FieldError>{err.fromValue}</FieldError>}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number" step="0.1"
                            value={row.toValue}
                            onChange={e => updateRow(i, { toValue: e.target.value })}
                            disabled={disabled}
                            className={inputCls(disabled, !!err.toValue) + ' tabular-nums'}
                            placeholder="Ej. 6.9"
                          />
                          {err.toValue && <FieldError>{err.toValue}</FieldError>}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={row.letter}
                            maxLength={4}
                            onChange={e => updateRow(i, { letter: e.target.value.toUpperCase() })}
                            disabled={disabled}
                            className={inputCls(disabled, !!err.letter)}
                            placeholder="Ej. NA"
                          />
                          {err.letter && <FieldError>{err.letter}</FieldError>}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={row.description}
                            maxLength={255}
                            onChange={e => updateRow(i, { description: e.target.value })}
                            disabled={disabled}
                            className={inputCls(disabled, !!err.description)}
                            placeholder="Ej. No Aprobatorio"
                          />
                          {err.description && <FieldError>{err.description}</FieldError>}
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
                const err = cellErrors[i] ?? {}
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
                          className={inputCls(disabled, !!err.fromValue) + ' tabular-nums'}
                          placeholder="Ej. 0.0"
                        />
                        {err.fromValue && <FieldError>{err.fromValue}</FieldError>}
                      </div>
                      <div>
                        <FieldLabel>Hasta</FieldLabel>
                        <input
                          type="number" step="0.1"
                          value={row.toValue}
                          onChange={e => updateRow(i, { toValue: e.target.value })}
                          disabled={disabled}
                          className={inputCls(disabled, !!err.toValue) + ' tabular-nums'}
                          placeholder="Ej. 6.9"
                        />
                        {err.toValue && <FieldError>{err.toValue}</FieldError>}
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
                          className={inputCls(disabled, !!err.letter)}
                          placeholder="Ej. NA"
                        />
                        {err.letter && <FieldError>{err.letter}</FieldError>}
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
                        maxLength={255}
                        onChange={e => updateRow(i, { description: e.target.value })}
                        disabled={disabled}
                        className={inputCls(disabled, !!err.description)}
                        placeholder="Ej. No Aprobatorio"
                      />
                      {err.description && <FieldError>{err.description}</FieldError>}
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

            {entriesError && <FieldError>{entriesError}</FieldError>}

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
            primaryDisabled={!isValid}
          />
        </>
      )}
    </FormPage>
  )
}