import { useEffect, useState } from 'react'
import { ChevronRight, Info, AlertCircle, UserCircle2, Loader2, Save, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { usePendingToast } from '../shared/hooks'
import { FieldLabel, FieldError, FieldHelp, SearchSelectField, Toast } from '../shared/ui'
import type { SelectOption } from '../shared/ui'
import { apiGet, apiPost } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'
import { ROLE_LABELS, ROLE_BADGE_STYLE, ROLE_OPTIONS, DIVISION_SCOPED_ROLES } from '../shared/identity/roles'
import type { RoleType } from '../shared/identity/roles'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface UserDetail {
  userId: string
  personId: string
  fullName: string
  username: string
}

interface DivisionSummary {
  id: string
  name: string
  code: string
}

interface DivisionsPageResponse {
  items: DivisionSummary[]
}

interface FormErrors {
  rol?: string
  division?: string
}

const rolOptions: SelectOption[] = ROLE_OPTIONS

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AsignarRol() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [params] = useSearchParams()
  const userId = params.get('userId')

  const [user, setUser] = useState<UserDetail | null>(null)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(userId ? 'loading' : 'error')
  const [loadErrorMsg, setLoadErrorMsg] = useState(userId ? '' : 'Falta el usuario. Regresa al listado e intenta de nuevo.')

  const [divisions, setDivisions] = useState<DivisionSummary[]>([])
  const [rol, setRol] = useState<RoleType | ''>('')
  const [division, setDivision] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')
  const [toast, setToast] = useState(pendingToast ?? '')

  const needsScope = rol !== '' && DIVISION_SCOPED_ROLES.has(rol)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    apiGet<UserDetail>(`/users/${userId}`)
      .then(data => {
        if (cancelled) return
        setUser(data)
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 404) setLoadErrorMsg('No se encontró el usuario solicitado.')
        else if (apiErr.status === 401) setLoadErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        else if (apiErr.status === 403) setLoadErrorMsg('No tienes permiso para consultar este usuario.')
        else setLoadErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
      })
    apiGet<DivisionsPageResponse>('/divisions', { size: 100 })
      .then(data => { if (!cancelled) setDivisions(data.items) })
      .catch(() => {/* non-critical — division select just won't populate */})
    return () => { cancelled = true }
  }, [userId])

  const divisionOptions: SelectOption[] = divisions.map(d => ({ value: d.id, label: `${d.code} — ${d.name}` }))

  function clearErr(field: keyof FormErrors) {
    if (submitted) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!rol) e.rol = 'Selecciona el rol a asignar.'
    if (needsScope && !division) e.division = 'Selecciona la división académica para este rol.'
    return e
  }

  async function handleSubmit() {
    const e = validate()
    setSubmitted(true)
    if (Object.keys(e).length > 0) { setErrors(e); return }
    if (!userId || !rol) return
    setSubmitStatus('submitting')
    setSubmitErrorMsg('')
    try {
      await apiPost(`/users/${userId}/roles`, {
        roleType: rol,
        divisionId: needsScope ? division : undefined,
      })
      navigate(`/usuarios/detalle?id=${userId}`, { state: { toast: 'Rol asignado correctamente.' } })
    } catch (err) {
      setSubmitStatus('error')
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 400) {
        // Backend: DivisionRuleViolationException — role/divisionId mismatch.
        setSubmitErrorMsg(apiErr.message ?? 'El rol y la división seleccionados no son compatibles.')
      } else if (apiErr.status === 401) {
        setSubmitErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
      } else if (apiErr.status === 403) {
        setSubmitErrorMsg('No tienes permiso para asignar roles.')
      } else if (apiErr.status === 404) {
        setSubmitErrorMsg('El usuario ya no existe.')
      } else {
        setSubmitErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
      }
    }
  }

  const isSubmitting = submitStatus === 'submitting'

  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4 flex-wrap">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Identidad</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/usuarios')} className="hover:text-[#009574] transition-colors">Usuarios</button>
        <ChevronRight size={13} />
        {userId && (
          <>
            <button onClick={() => navigate(`/usuarios/detalle?id=${userId}`)} className="hover:text-[#009574] transition-colors">
              {user?.fullName ?? 'Detalle'}
            </button>
            <ChevronRight size={13} />
          </>
        )}
        <span className="text-[#333333] font-medium">Asignar Rol</span>
      </nav>

      {/* Title */}
      <div className="mb-1">
        <h1 className="text-2xl font-semibold text-[#333333]">Asignar Rol</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">
          Agrega un nuevo rol de acceso para este usuario. Un usuario puede tener múltiples roles con distintos scopes.
        </p>
      </div>

      <hr className="border-[#E5E7EB] my-6" />

      {/* Load error banner */}
      {loadStatus === 'error' && loadErrorMsg && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mb-4">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {loadErrorMsg}
        </div>
      )}

      {loadStatus === 'loading' ? (
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-12 flex flex-col items-center gap-3 text-[#6B7280]">
          <Loader2 size={24} className="animate-spin text-[#009574]" />
          <p className="text-[13px] font-medium">Cargando usuario...</p>
        </div>
      ) : userId && user ? (
        <>
          {/* Context card */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg px-5 py-4 mb-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
              {initialsFor(user.fullName)}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#333333]">{user.fullName}</p>
              <p className="font-mono text-[12px] text-[#6B7280]">{user.username}</p>
            </div>
          </div>

          {/* Submit error banner */}
          {submitStatus === 'error' && submitErrorMsg && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mb-4">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              {submitErrorMsg}
            </div>
          )}

          {/* Form card */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 sm:p-8">
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-4">Rol a Asignar</p>

            <div className="grid grid-cols-12 gap-6 mb-6">
              <div className="col-span-12 md:col-span-8">
                <FieldLabel required>Rol</FieldLabel>
                <SearchSelectField
                  options={rolOptions}
                  value={rol}
                  onChange={v => { setRol(v as RoleType); setDivision(''); clearErr('rol') }}
                  placeholder="Selecciona el rol"
                  hasError={!!errors.rol}
                  searchPlaceholder="Buscar rol…"
                />
                {errors.rol && <FieldError>{errors.rol}</FieldError>}
              </div>
            </div>

            {rol && !needsScope && (
              <div className="flex items-start gap-2 bg-[#F8F9FA] border border-[#E5E7EB] rounded-md px-3 py-2.5 mb-4 text-[12px] text-[#6B7280]">
                <Info size={13} className="text-[#009574] flex-shrink-0 mt-0.5" />
                <span>
                  El rol <span className={`inline-flex text-[11px] font-semibold px-1.5 py-0.5 rounded-full mx-1 ${ROLE_BADGE_STYLE[rol]}`}>{ROLE_LABELS[rol]}</span>
                  tiene acceso global al sistema. No requiere scope de división.
                </span>
              </div>
            )}

            {needsScope && (
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 md:col-span-8">
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5 mb-4 text-[12px] text-amber-700">
                    <Info size={13} className="flex-shrink-0 mt-0.5" />
                    <span>
                      El rol <span className={`inline-flex text-[11px] font-semibold px-1.5 py-0.5 rounded-full mx-1 ${ROLE_BADGE_STYLE[rol as RoleType]}`}>{ROLE_LABELS[rol as RoleType]}</span>
                      requiere definir su alcance divisional. El usuario solo podrá operar dentro de la división seleccionada.
                    </span>
                  </div>

                  <FieldLabel required>División Académica (alcance)</FieldLabel>
                  <SearchSelectField
                    options={divisionOptions}
                    value={division}
                    onChange={v => { setDivision(v); clearErr('division') }}
                    placeholder="Selecciona la división"
                    hasError={!!errors.division}
                    searchPlaceholder="Buscar división…"
                  />
                  {errors.division
                    ? <FieldError>{errors.division}</FieldError>
                    : <FieldHelp>El rol solo tendrá acceso a los datos de esta división.</FieldHelp>
                  }
                </div>
              </div>
            )}

            {rol && (!needsScope || division) && (
              <div className="mt-6 flex items-center gap-3 bg-[#e6f5f1] border border-[#009574]/20 rounded-md px-4 py-3">
                <UserCircle2 size={16} className="text-[#009574] flex-shrink-0" />
                <div className="flex items-center gap-2 flex-wrap text-[12px]">
                  <span className="text-[#6B7280]">Se asignará el rol</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE_STYLE[rol]}`}>{ROLE_LABELS[rol]}</span>
                  {division && (
                    <>
                      <span className="text-[#6B7280]">con alcance en</span>
                      <span className="font-semibold text-[#333333]">
                        {divisionOptions.find(d => d.value === division)?.label}
                      </span>
                    </>
                  )}
                  <span className="text-[#6B7280]">a <strong className="text-[#333333]">{user.fullName}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Action zone */}
          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              onClick={() => navigate(`/usuarios/detalle?id=${userId}`)}
              disabled={isSubmitting}
              className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X size={14} className="inline mr-1.5 -mt-0.5" />Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Asignar Rol
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function initialsFor(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
