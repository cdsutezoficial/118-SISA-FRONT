import { useEffect, useState } from 'react'
import {
  ChevronRight, ShieldCheck, X, Plus, LockKeyholeOpen, Loader2, AlertCircle,
  Clock, CalendarPlus,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { usePendingToast } from '../shared/hooks'
import { apiGet, apiDelete, apiPatch } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'
import { ConfirmModal, Toast, ActionBtn } from '../shared/ui'
import { ROLE_LABELS, ROLE_BADGE_STYLE } from '../shared/identity/roles'
import type { RoleType } from '../shared/identity/roles'

// ─── Types ─────────────────────────────────────────────────────────────────────

type BackendUserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED'

interface UserRoleDetailItem {
  userRoleId: string
  roleType: RoleType
  divisionId: string | null
}

interface UserDetail {
  userId: string
  personId: string
  fullName: string
  username: string
  status: BackendUserStatus
  mustChangePassword: boolean
  lastLoginAt: string | null
  createdAt: string
  roles: UserRoleDetailItem[]
}

interface DivisionSummary {
  id: string
  name: string
  code: string
}

interface DivisionsPageResponse {
  items: DivisionSummary[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function initialsFor(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Nunca'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Nunca'
  return date.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function UsuarioDetalle() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [params] = useSearchParams()
  const id = params.get('id')

  const [user, setUser] = useState<UserDetail | null>(null)
  const [divisions, setDivisions] = useState<DivisionSummary[]>([])
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>(id ? 'loading' : 'error')
  const [loadErrorMsg, setLoadErrorMsg] = useState(id ? '' : 'Falta el identificador del usuario.')
  const [revokeTarget, setRevokeTarget] = useState<UserRoleDetailItem | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [actionErrorMsg, setActionErrorMsg] = useState('')
  const [toast, setToast] = useState(pendingToast ?? '')

  function loadUser() {
    if (!id) return Promise.resolve()
    setLoadStatus('loading')
    setLoadErrorMsg('')
    return apiGet<UserDetail>(`/users/${id}`)
      .then(data => { setUser(data); setLoadStatus('idle') })
      .catch((err: unknown) => {
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 404) setLoadErrorMsg('No se encontró el usuario solicitado.')
        else if (apiErr.status === 401) setLoadErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        else if (apiErr.status === 403) setLoadErrorMsg('No tienes permiso para consultar este usuario.')
        else setLoadErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
      })
  }

  useEffect(() => {
    if (!id) return
    loadUser()
    apiGet<DivisionsPageResponse>('/divisions', { size: 100 })
      .then(data => setDivisions(data.items))
      .catch(() => {/* non-critical — division names just won't resolve */})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function divisionLabel(divisionId: string | null): string {
    if (!divisionId) return 'Global'
    const division = divisions.find(d => d.id === divisionId)
    return division ? `${division.code} — ${division.name}` : divisionId
  }

  async function handleRevokeConfirm() {
    if (!revokeTarget || !user) return
    setRevoking(true)
    setActionErrorMsg('')
    try {
      await apiDelete(`/users/${user.userId}/roles/${revokeTarget.userRoleId}`)
      const label = ROLE_LABELS[revokeTarget.roleType]
      setRevokeTarget(null)
      await loadUser()
      setToast(`Rol "${label}" revocado exitosamente.`)
      setTimeout(() => setToast(''), 3500)
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 404) setActionErrorMsg('El rol ya no existe o no pertenece a este usuario.')
      else if (apiErr.status === 401) setActionErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
      else if (apiErr.status === 403) setActionErrorMsg('No tienes permiso para revocar roles.')
      else setActionErrorMsg('No se pudo revocar el rol. Intenta de nuevo.')
    } finally {
      setRevoking(false)
    }
  }

  async function handleUnlock() {
    if (!user) return
    setUnlocking(true)
    setActionErrorMsg('')
    try {
      await apiPatch(`/users/${user.userId}/unlock`)
      await loadUser()
      setToast('Cuenta desbloqueada. El usuario puede iniciar sesión nuevamente.')
      setTimeout(() => setToast(''), 4000)
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 401) setActionErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
      else if (apiErr.status === 403) setActionErrorMsg('No tienes permiso para desbloquear cuentas.')
      else setActionErrorMsg('No se pudo desbloquear la cuenta. Intenta de nuevo.')
    } finally {
      setUnlocking(false)
    }
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {revokeTarget && (
        <ConfirmModal
          title="Revocar rol"
          message={`Estás a punto de revocar el rol "${ROLE_LABELS[revokeTarget.roleType]}" a ${user?.fullName ?? 'este usuario'}. Esta acción no se puede deshacer.`}
          confirmLabel={revoking ? 'Revocando...' : 'Sí, revocar'}
          onConfirm={handleRevokeConfirm}
          onCancel={() => setRevokeTarget(null)}
        />
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4 flex-wrap">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Identidad</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/usuarios')} className="hover:text-[#009574] transition-colors">Usuarios</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Detalle</span>
      </nav>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">{user?.fullName ?? 'Detalle del Usuario'}</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">Información completa de la cuenta de usuario.</p>
      </div>

      {/* Load error banner */}
      {loadStatus === 'error' && loadErrorMsg && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mb-4">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {loadErrorMsg}
        </div>
      )}

      {/* Action error banner (revoke/unlock) */}
      {actionErrorMsg && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mb-4">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {actionErrorMsg}
        </div>
      )}

      {loadStatus === 'loading' ? (
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-16 flex flex-col items-center gap-3 text-[#6B7280]">
          <Loader2 size={24} className="animate-spin text-[#009574]" />
          <p className="text-[13px] font-medium">Cargando usuario...</p>
        </div>
      ) : user ? (
        <>
          {/* Summary card */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg px-6 py-5 mb-6">
            <div className="flex items-center gap-5 flex-wrap">
              <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[18px] font-bold flex-shrink-0">
                {initialsFor(user.fullName)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <p className="text-[16px] font-bold text-[#333333]">{user.fullName}</p>
                  {user.status === 'ACTIVE' ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Activo
                    </span>
                  ) : user.status === 'LOCKED' ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />Bloqueada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Inactivo
                    </span>
                  )}
                  {user.mustChangePassword && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      Debe cambiar su contraseña
                    </span>
                  )}
                </div>
                <p className="font-mono text-[13px] text-[#6B7280]">{user.username}</p>
                <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                  <p className="text-[12px] text-[#6B7280] flex items-center gap-1">
                    <Clock size={12} />
                    Último acceso: <strong className="text-[#333333]">{formatDateTime(user.lastLoginAt)}</strong>
                  </p>
                  <p className="text-[12px] text-[#6B7280] flex items-center gap-1">
                    <CalendarPlus size={12} />
                    Creado el: <strong className="text-[#333333]">{formatDate(user.createdAt)}</strong>
                  </p>
                </div>
              </div>

              {user.status === 'LOCKED' && (
                <button
                  onClick={handleUnlock}
                  disabled={unlocking}
                  className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-[#009574] border border-[#009574]/30 bg-[#e6f5f1] hover:bg-[#d0ede6] rounded-md transition-colors flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {unlocking ? <Loader2 size={13} className="animate-spin" /> : <LockKeyholeOpen size={13} />}
                  Desbloquear cuenta
                </button>
              )}
            </div>
          </div>

          {/* Roles section */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#F8F9FA] flex items-center justify-between">
              <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest flex items-center gap-1.5">
                <ShieldCheck size={13} />Roles Asignados
              </p>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Rol</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-56">Scope (División)</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {user.roles.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-[#6B7280]">
                        <ShieldCheck size={28} className="text-[#E5E7EB]" />
                        <p className="text-[13px] font-medium">Sin roles asignados</p>
                        <p className="text-[12px]">Asigna un rol para que el usuario pueda acceder al sistema.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  user.roles.map(row => (
                    <tr key={row.userRoleId} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${ROLE_BADGE_STYLE[row.roleType]}`}>
                          {ROLE_LABELS[row.roleType]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#333333]">{divisionLabel(row.divisionId)}</td>
                      <td className="px-4 py-3">
                        <ActionBtn icon={<X size={15} />} tooltip="Revocar rol" danger onClick={() => setRevokeTarget(row)} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="border-t border-[#E5E7EB] px-4 py-3">
              <button
                type="button"
                onClick={() => navigate(`/usuarios/asignar-rol?userId=${user.userId}`)}
                className="flex items-center gap-1.5 text-[12px] font-medium text-[#009574] hover:text-[#007a5e] transition-colors"
              >
                <Plus size={14} />Asignar Rol
              </button>
            </div>
          </div>

          {/* Action zone */}
          <div className="flex items-center justify-end gap-3 mt-8">
            <button
              onClick={() => navigate('/usuarios')}
              className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
            >
              Regresar
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
