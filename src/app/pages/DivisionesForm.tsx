import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Pencil, Save, X, ArrowLeft, Loader2, AlertCircle, Search, UserX, Info } from 'lucide-react'
import { FieldLabel, FieldHelp, inputCls, ModeSwitcher } from '../shared/ui'
import { useNavigate } from 'react-router'
import { useFormMode } from '../shared/hooks'
import { apiGet, apiPost, apiPut } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────

type DivisionStatus = 'ACTIVE' | 'INACTIVE'

interface DivisionResponse {
  id: string
  name: string
  code: string
  description: string
  directorPersonId: string | null
  status: DivisionStatus
}

interface DivisionFormPayload {
  name: string
  code: string
  description: string
  directorPersonId: string | null
}

// Only the users search needs — `GET /users?role=DIRECTOR_DIVISION&divisionId=`
// (added 2026-07-28, plan `118-SISA-BACK/docs/plans/2026-07-28-director-division-role-filter.md`)
// resolves candidates who already hold that role scoped to THIS division. There
// is no `GET /persons/{id}` to resolve a stale `directorPersonId` whose role was
// later revoked — if the currently-saved director no longer appears in this
// list, we show the raw id with an explanatory note instead of a name (see
// `DirectorField` below).
interface DirectorCandidate {
  userId: string
  personId: string
  fullName: string
  username: string
}

interface UsersPageResponse {
  items: DirectorCandidate[]
}

// ─── DirectorField ──────────────────────────────────────────────────────────────
// Edit-mode-only picker: shows ONLY persons who already hold `DIRECTOR_DIVISION`
// scoped to this division (José, 2026-07-28) — never a free person search, and
// never shown in Registrar mode, since the role cannot be assigned before the
// division exists (chicken-and-egg: `UserRole.divisionId` needs a real division).

function DirectorField({ divisionId, value, onChange, disabled }: {
  divisionId: string
  value: string
  onChange: (personId: string) => void
  disabled: boolean
}) {
  const [candidates, setCandidates] = useState<DirectorCandidate[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    apiGet<UsersPageResponse>('/users', { role: 'DIRECTOR_DIVISION', divisionId, status: 'ACTIVE', size: 100 })
      .then(data => { if (!cancelled) { setCandidates(data.items); setStatus('idle') } })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [divisionId])

  useEffect(() => {
    function outside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  const selected = candidates.find(c => c.personId === value)
  // The saved directorPersonId may belong to someone whose DIRECTOR_DIVISION
  // role was revoked after being set as director — they won't be in
  // `candidates` anymore, and there's no `GET /persons/{id}` to resolve their
  // name from just the id.
  const isStaleDirector = !!value && !selected

  if (disabled) {
    return (
      <input value={selected ? `${selected.fullName} — ${selected.username}` : (value || '')} disabled readOnly className={inputCls(true, false)} />
    )
  }

  return (
    <div ref={ref} className="relative w-full">
      {selected ? (
        <div className="flex items-center justify-between gap-3 px-3 py-2 bg-[#e6f5f1] border border-[#009574]/30 rounded-md">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#333333] truncate">{selected.fullName}</p>
            <p className="text-[12px] text-[#6B7280] font-mono truncate">{selected.username}</p>
          </div>
          <button type="button" onClick={() => onChange('')} className="text-[#6B7280] hover:text-[#333333] p-1 rounded flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input
              type="text"
              readOnly
              onFocus={() => setOpen(true)}
              placeholder="Selecciona el director…"
              className="w-full pl-9 pr-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-[#333333] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574] transition"
            />
          </div>
          {open && (
            <div className="absolute top-full mt-1 left-0 w-full bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-50 overflow-hidden">
              <ul className="max-h-56 overflow-y-auto py-1">
                {status === 'loading' ? (
                  <li className="px-3 py-3 text-center text-[12px] text-[#6B7280] flex items-center justify-center gap-2">
                    <Loader2 size={13} className="animate-spin" />Cargando…
                  </li>
                ) : status === 'error' ? (
                  <li className="px-3 py-3 text-center text-[12px] text-red-600">No se pudo consultar. Intenta de nuevo.</li>
                ) : candidates.length === 0 ? (
                  <li className="px-3 py-4 text-center text-[12px] text-[#6B7280] flex flex-col items-center gap-1.5">
                    <UserX size={20} className="text-[#E5E7EB]" />
                    Ningún usuario tiene el rol de Director asignado a esta división todavía.
                  </li>
                ) : (
                  candidates.map(c => (
                    <li key={c.userId}>
                      <button
                        type="button"
                        onClick={() => { onChange(c.personId); setOpen(false) }}
                        className="w-full text-left px-3 py-2 text-[13px] hover:bg-[#F8F9FA] transition-colors"
                      >
                        <div className="font-medium text-[#333333] truncate">{c.fullName}</div>
                        <div className="font-mono text-[11px] text-[#6B7280] truncate">{c.username}</div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </>
      )}
      {isStaleDirector && (
        <div className="flex items-start gap-2 mt-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <Info size={13} className="flex-shrink-0 mt-0.5" />
          <span>El director guardado (id: <span className="font-mono">{value}</span>) ya no tiene el rol de Director activo para esta división. Selecciona uno nuevo o vuelve a asignárselo desde Usuarios.</span>
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DivisionesForm() {
  const navigate = useNavigate()
  const { mode, id } = useFormMode()
  const isView = mode === 'view'
  const isRegister = mode === 'register'

  const [nombre, setNombre] = useState('')
  const [clave, setClave] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [directorPersonId, setDirectorPersonId] = useState('')

  // `loadStatus` covers the edit/view GET-by-id fetch; `submitStatus` covers
  // the register/edit POST-PUT submit — separate so a slow initial fetch
  // doesn't fight with the submit button's own loading state.
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(isRegister ? 'idle' : 'loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  useEffect(() => {
    if (isRegister || !id) return
    let cancelled = false
    setLoadStatus('loading')
    setLoadErrorMsg('')
    apiGet<DivisionResponse>(`/divisions/${id}`)
      .then(data => {
        if (cancelled) return
        setNombre(data.name)
        setClave(data.code)
        setDescripcion(data.description)
        setDirectorPersonId(data.directorPersonId ?? '')
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 404) {
          setLoadErrorMsg('No se encontró la división solicitada.')
        } else if (apiErr.status === 401) {
          setLoadErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        } else if (apiErr.status === 403) {
          setLoadErrorMsg('No tienes permiso para consultar esta división.')
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
    const payload: DivisionFormPayload = {
      name: nombre,
      code: clave,
      description: descripcion,
      directorPersonId: directorPersonId.trim() || null,
    }
    try {
      if (isRegister) {
        await apiPost<DivisionResponse>('/divisions', payload)
        navigate('/divisiones', { state: { toast: 'División registrada exitosamente.' } })
      } else if (id) {
        await apiPut<DivisionResponse>(`/divisions/${id}`, payload)
        navigate('/divisiones', { state: { toast: 'División actualizada exitosamente.' } })
      }
    } catch (err) {
      setSubmitStatus('error')
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 409) {
        setSubmitErrorMsg(apiErr.message ?? 'El nombre o la clave ya están en uso por otra división.')
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
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/divisiones')} className="hover:text-[#009574] transition-colors">Divisiones Académicas</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">
          {isRegister ? 'Registrar División' : isView ? 'Ver División' : 'Editar División'}
        </span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">
            {isRegister ? 'Registrar División' : isView ? 'Ver División' : 'Editar División'}
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {isRegister ? 'Completa los campos para registrar una nueva división académica.' :
             isView ? 'Información de la división académica.' :
             'Modifica los datos de la división académica.'}
          </p>
        </div>
        <ModeSwitcher
          mode={mode}
          registerUrl="/divisiones/new"
          formUrl={m => `/divisiones/form?mode=${m}&id=${id}`}
        />
      </div>

      {/* Load error banner (edit/view fetch failed) */}
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
            <p className="text-[13px] font-medium">Cargando división...</p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {/* Nombre */}
            <div className="col-span-12 sm:col-span-8">
              <FieldLabel required={!isView}>Nombre de la División</FieldLabel>
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                disabled={disabled}
                className={inputCls(disabled, false)}
                placeholder="Ej. División de Tecnologías de la Información"
              />
              <FieldHelp>Nombre completo y oficial de la división académica.</FieldHelp>
            </div>
            {/* Clave */}
            <div className="col-span-12 sm:col-span-4">
              <FieldLabel required={!isView}>Clave</FieldLabel>
              <input
                value={clave}
                onChange={e => setClave(e.target.value)}
                disabled={disabled}
                className={inputCls(disabled, false)}
                placeholder="Ej. DTI"
              />
              <FieldHelp>Identificador corto único.</FieldHelp>
            </div>
            {/* Descripción */}
            <div className="col-span-12">
              <FieldLabel>Descripción</FieldLabel>
              <textarea
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                disabled={disabled}
                rows={4}
                className={inputCls(disabled, false) + ' resize-none'}
                placeholder="Descripción breve de la división y su enfoque académico."
              />
            </div>
            {/* Director (persona) — only in Ver/Editar: the DIRECTOR_DIVISION role
                requires a real divisionId, so it can never be assigned before
                the division exists (José, 2026-07-28) — the field has nothing
                to search in Registrar mode. */}
            {!isRegister && (
              <div className="col-span-12">
                <FieldLabel>Director de División</FieldLabel>
                {id && <DirectorField divisionId={id} value={directorPersonId} onChange={setDirectorPersonId} disabled={disabled} />}
                <FieldHelp>
                  Solo se pueden elegir personas que ya tienen el rol de Director asignado para esta división
                  (pantalla Usuarios → Asignar Rol). Si aún no existe, asígnalo primero desde ahí.
                </FieldHelp>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {loadStatus !== 'loading' && (
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          {isView ? (
            <>
              <button
                onClick={() => navigate('/divisiones')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
              >
                <ArrowLeft size={14} />Regresar
              </button>
              <button
                onClick={() => navigate(`/divisiones/form?mode=edit&id=${id}`)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
              >
                <Pencil size={14} />Editar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/divisiones')}
                disabled={isSubmitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X size={14} />Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {isRegister ? 'Registrar División' : 'Guardar Cambios'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
