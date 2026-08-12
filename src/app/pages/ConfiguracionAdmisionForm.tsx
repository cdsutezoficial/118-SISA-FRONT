import { useEffect, useState } from 'react'
import { ChevronRight, Save, X, Loader2, AlertCircle } from 'lucide-react'
import { FieldLabel, FieldHelp, FieldError, inputCls, Switch, SearchSelectField } from '../shared/ui'
import type { SelectOption } from '../shared/ui'
import { useNavigate } from 'react-router'
import { useFormMode } from '../shared/hooks'
import { apiGet, apiPost, apiPut } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────
// No "Ver Detalle" mode here — per Pantalla 25, this screen only ever handles
// register/edit; any `mode` other than `register` is treated as edit. Unlike
// `GruposForm.tsx`'s Programa→Generación cascade (where `programId` is a
// UI-ONLY filter never sent to the backend, resolved server-side from
// `generationId`), here `programId` IS a real field on
// `CreateProgramAdmissionConfigRequest`/`UpdateProgramAdmissionConfigRequest`
// — it travels in the submit payload alongside `targetGenerationId`, it is
// not merely a client-side filter. `status` is never edited here — only from
// the list (`ConfiguracionAdmisionList.tsx`'s Switch), same convention as
// Generaciones/Grupos/Conceptos. `opensAt`/`closesAt` are `Instant` — the
// first date+time field wired in the frontend — so a native
// `<input type="datetime-local">` is used (no shared date+time picker exists
// in `shared/ui.tsx`, and one screen doesn't justify building one).

interface ConfigResponse {
  id: string
  programId: string
  periodId: string
  targetGenerationId: string
  isOffered: boolean
  maxCandidates: number
  opensAt: string
  closesAt: string
  status: 'OPEN' | 'CLOSED'
  selectionStatus: string
}

interface ConfigFormPayload {
  programId: string
  periodId: string
  targetGenerationId: string
  isOffered: boolean
  maxCandidates: number
  opensAt: string
  closesAt: string
}

interface ProgramSummary {
  id: string
  name: string
  code: string
}

interface ProgramsPageResponse {
  items: ProgramSummary[]
}

interface GenerationSummary {
  id: string
  code: string
  programId: string
}

interface GenerationsPageResponse {
  items: GenerationSummary[]
}

interface PeriodSummary {
  id: string
  name: string
}

interface PeriodsPageResponse {
  items: PeriodSummary[]
}

// ─── datetime-local <-> Instant helpers ────────────────────────────────────
// `<input type="datetime-local">` reads/writes "YYYY-MM-DDTHH:mm" in the
// browser's LOCAL time, with no timezone info. `new Date(iso)` /
// `date.toISOString()` already do the local<->UTC conversion for us — we
// just need to read/write the local Y/M/D/h/m components ourselves instead
// of the UTC ones, since `toISOString()` always reports UTC.
function toDatetimeLocalInput(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocalInput(local: string): string {
  const d = new Date(local)
  return d.toISOString()
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ConfiguracionAdmisionForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isRegister = mode === 'register'

  const [programId, setProgramId] = useState('')
  const [targetGenerationId, setTargetGenerationId] = useState('')
  const [periodId, setPeriodId] = useState('')
  const [isOffered, setIsOffered] = useState(false)
  const [maxCandidates, setMaxCandidates] = useState('')
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [dateOrderError, setDateOrderError] = useState('')

  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [generations, setGenerations] = useState<GenerationSummary[]>([])
  const [periods, setPeriods] = useState<PeriodSummary[]>([])

  // `loadStatus` covers the edit GET-by-id fetch; `submitStatus` covers the
  // register/edit POST/PUT submit — separate so a slow initial fetch doesn't
  // fight with the submit button's own loading state.
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(isRegister ? 'idle' : 'loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  // Programa/Generación/Periodo catalogs — fetched once, used to populate the
  // cascading selects (Programa → filters Generación) and, on edit, to
  // preselect the Programa the loaded config's `programId` belongs to.
  useEffect(() => {
    apiGet<ProgramsPageResponse>('/programs', { size: 100 })
      .then(data => setPrograms(data.items))
      .catch(() => {/* non-critical — select just won't populate */})
    apiGet<GenerationsPageResponse>('/generations', { size: 200 })
      .then(data => setGenerations(data.items))
      .catch(() => {/* non-critical — select just won't populate */})
    apiGet<PeriodsPageResponse>('/periods', { size: 100 })
      .then(data => setPeriods(data.items))
      .catch(() => {/* non-critical — select just won't populate */})
  }, [])

  useEffect(() => {
    if (isRegister || !id) return
    let cancelled = false
    setLoadStatus('loading')
    setLoadErrorMsg('')
    apiGet<ConfigResponse>(`/program-admission-configs/${id}`)
      .then(data => {
        if (cancelled) return
        setProgramId(data.programId)
        setTargetGenerationId(data.targetGenerationId)
        setPeriodId(data.periodId)
        setIsOffered(data.isOffered)
        setMaxCandidates(String(data.maxCandidates))
        setOpensAt(toDatetimeLocalInput(data.opensAt))
        setClosesAt(toDatetimeLocalInput(data.closesAt))
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 404) {
          setLoadErrorMsg('No se encontró la configuración solicitada.')
        } else if (apiErr.status === 401) {
          setLoadErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        } else if (apiErr.status === 403) {
          setLoadErrorMsg('No tienes permiso para consultar esta configuración.')
        } else {
          setLoadErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode])

  const disabled = loadStatus === 'loading'
  const isSubmitting = submitStatus === 'submitting'

  const programOptions: SelectOption[] = programs.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` }))
  // Generación options are scoped to the selected Programa — cascading
  // select, same interaction pattern as GruposForm.tsx's Programa → Generación
  // cascade. Unlike Grupos, `programId` here also travels in the payload.
  const generationOptions: SelectOption[] = generations
    .filter(g => g.programId === programId)
    .map(g => ({ value: g.id, label: g.code }))
  const periodOptions: SelectOption[] = periods.map(p => ({ value: p.id, label: p.name }))

  function handleProgramChange(v: string) {
    setProgramId(v)
    setTargetGenerationId('') // reset dependent select — mirrors GruposForm's Programa → Generación reset
  }

  function handleClosesAtChange(v: string) {
    setClosesAt(v)
    if (opensAt && v && new Date(v) <= new Date(opensAt)) {
      setDateOrderError('El cierre de venta debe ser posterior a la apertura de venta.')
    } else {
      setDateOrderError('')
    }
  }

  function handleOpensAtChange(v: string) {
    setOpensAt(v)
    if (closesAt && v && new Date(closesAt) <= new Date(v)) {
      setDateOrderError('El cierre de venta debe ser posterior a la apertura de venta.')
    } else {
      setDateOrderError('')
    }
  }

  async function handleSubmit() {
    // Client-side date-order check — the backend also validates this
    // (`InvalidProgramAdmissionConfigDataException`), but this gives
    // immediate feedback before a round-trip.
    if (opensAt && closesAt && new Date(closesAt) <= new Date(opensAt)) {
      setDateOrderError('El cierre de venta debe ser posterior a la apertura de venta.')
      return
    }
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    const payload: ConfigFormPayload = {
      programId,
      periodId,
      targetGenerationId,
      isOffered,
      maxCandidates: Number(maxCandidates),
      opensAt: fromDatetimeLocalInput(opensAt),
      closesAt: fromDatetimeLocalInput(closesAt),
    }
    try {
      if (isRegister) {
        await apiPost<ConfigResponse>('/program-admission-configs', payload)
        navigate('/configuracion-admision', { state: { toast: 'Configuración registrada exitosamente.' } })
      } else if (id) {
        await apiPut<ConfigResponse>(`/program-admission-configs/${id}`, payload)
        navigate('/configuracion-admision', { state: { toast: 'Configuración actualizada exitosamente.' } })
      }
    } catch (err) {
      setSubmitStatus('error')
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 409) {
        // Backend: DuplicateProgramAdmissionConfigException — a config
        // already exists for this exact programId+periodId combination.
        setSubmitErrorMsg(apiErr.message ?? 'Ya existe una configuración de admisión para este programa y periodo.')
      } else if (apiErr.status === 400) {
        // Backend: InvalidProgramAdmissionConfigDataException (maxCandidates
        // <= 0, closesAt not after opensAt) or one of the FK-reference-not-
        // found exceptions for programId/periodId/targetGenerationId.
        setSubmitErrorMsg(apiErr.message ?? 'Revisa los datos capturados: hay un valor inválido o una referencia inexistente.')
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
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/configuracion-admision')} className="hover:text-[#009574] transition-colors">Configuración de Admisión</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">
          {isRegister ? 'Configurar Programa' : 'Editar Configuración'}
        </span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">
            {isRegister ? 'Configurar Programa para Admisión' : 'Editar Configuración de Admisión'}
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {isRegister
              ? 'Define el cupo y la ventana de venta de fichas para un programa educativo.'
              : 'Modifica el cupo y la ventana de venta de fichas.'}
          </p>
        </div>
      </div>

      {/* Load error banner (edit fetch failed) */}
      {loadStatus === 'error' && loadErrorMsg && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mb-4">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {loadErrorMsg}
        </div>
      )}

      {/* Submit error banner */}
      {submitStatus === 'error' && submitErrorMsg && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mb-4">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {submitErrorMsg}
        </div>
      )}

      {/* Form card */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
        {loadStatus === 'loading' ? (
          <div className="flex flex-col items-center gap-3 text-[#6B7280] py-12">
            <Loader2 size={24} className="animate-spin text-[#009574]" />
            <p className="text-[13px] font-medium">Cargando configuración...</p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {/* Fila 1 */}
            <div className="col-span-12 sm:col-span-6">
              <FieldLabel required>Programa Educativo</FieldLabel>
              <SearchSelectField
                options={programOptions}
                value={programId}
                onChange={handleProgramChange}
                placeholder="Selecciona el programa"
                disabled={disabled}
                searchPlaceholder="Buscar programa…"
              />
            </div>
            <div className="col-span-12 sm:col-span-6">
              <FieldLabel required>Periodo Destino</FieldLabel>
              <SearchSelectField
                options={periodOptions}
                value={periodId}
                onChange={setPeriodId}
                placeholder="Selecciona el periodo al que ingresarán los aceptados"
                disabled={disabled}
                searchPlaceholder="Buscar periodo…"
              />
            </div>

            {/* Fila 2 */}
            <div className="col-span-12 sm:col-span-8">
              <FieldLabel required>Generación Destino</FieldLabel>
              <SearchSelectField
                options={generationOptions}
                value={targetGenerationId}
                onChange={setTargetGenerationId}
                placeholder="Selecciona la generación"
                disabled={disabled || !programId}
                searchPlaceholder="Buscar generación…"
              />
              <FieldHelp>Generación que recibirá a los aceptados de este proceso.</FieldHelp>
            </div>
            <div className="col-span-12 sm:col-span-4">
              <FieldLabel>¿Está Ofertado?</FieldLabel>
              <div className="flex items-center gap-2 py-2">
                <Switch checked={isOffered} onChange={setIsOffered} disabled={disabled} />
                <span className="text-[13px] text-[#333333]">{isOffered ? 'Sí' : 'No'}</span>
              </div>
              <FieldHelp>Equivalente a marcar el programa como disponible en este proceso.</FieldHelp>
            </div>

            {/* Fila 3 */}
            <div className="col-span-12 sm:col-span-4">
              <FieldLabel required>Cupo Máximo</FieldLabel>
              <input
                type="number"
                min={1}
                value={maxCandidates}
                onChange={e => setMaxCandidates(e.target.value)}
                disabled={disabled}
                className={inputCls(disabled, false) + ' tabular-nums'}
                placeholder="Ej. 120"
              />
              <FieldHelp>Máximo de fichas pagadas antes de que el programa deje de aparecer disponible.</FieldHelp>
            </div>
            <div className="col-span-12 sm:col-span-4">
              <FieldLabel required>Apertura de Venta</FieldLabel>
              <input
                type="datetime-local"
                value={opensAt}
                onChange={e => handleOpensAtChange(e.target.value)}
                disabled={disabled}
                className={inputCls(disabled, !!dateOrderError)}
              />
            </div>
            <div className="col-span-12 sm:col-span-4">
              <FieldLabel required>Cierre de Venta</FieldLabel>
              <input
                type="datetime-local"
                value={closesAt}
                onChange={e => handleClosesAtChange(e.target.value)}
                disabled={disabled}
                className={inputCls(disabled, !!dateOrderError)}
              />
              {dateOrderError ? <FieldError>{dateOrderError}</FieldError> : <FieldHelp>Debe ser posterior a la Apertura de Venta.</FieldHelp>}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {loadStatus !== 'loading' && (
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            onClick={() => navigate('/configuracion-admision')}
            disabled={isSubmitting}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={14} />Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !!dateOrderError}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isRegister ? 'Registrar Configuración' : 'Guardar Cambios'}
          </button>
        </div>
      )}
    </div>
  )
}
