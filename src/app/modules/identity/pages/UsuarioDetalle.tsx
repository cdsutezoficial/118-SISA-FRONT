import { useEffect, useState } from 'react'
import {
  ShieldCheck, X, Plus, LockKeyholeOpen, Clock, CalendarPlus, ArrowLeft, Loader2,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { usePendingToast } from '@app/core/infra/hooks'
import { apiGet, apiDelete, apiPatch } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'
import { ConfirmModal, Toast, ActionBtn } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, Button, MiniTable } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { ROLE_LABELS, ROLE_BADGE_STYLE } from '../data/roles'
import type { RoleType } from '../data/roles'

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

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <FormPage>
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

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Identidad' },
          { label: 'Usuarios', to: '/usuarios' },
          { label: 'Detalle' },
        ]}
      />

      <FormHeader
        title={user?.fullName ?? 'Detalle del Usuario'}
        subtitle="Información completa de la cuenta de usuario."
      />

      {/* Load error banner */}
      {loadStatus === 'error' && loadErrorMsg && <ErrorBanner message={loadErrorMsg} />}

      {/* Action error banner (revoke/unlock) */}
      {actionErrorMsg && <ErrorBanner message={actionErrorMsg} />}

      {loadStatus === 'loading' ? (
        <FormCard loading loadingLabel="Cargando usuario..." />
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

            {user.roles.length === 0 ? (
              <p className="text-[12px] text-[#6B7280] text-center py-12">
                Sin roles asignados todavía. Asigna un rol para que el usuario pueda acceder al sistema.
              </p>
            ) : (
              <MiniTable
                columns={[
                  {
                    key: 'rol',
                    header: 'Rol',
                    render: row => (
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${ROLE_BADGE_STYLE[row.roleType]}`}>
                        {ROLE_LABELS[row.roleType]}
                      </span>
                    ),
                  },
                  {
                    key: 'scope',
                    header: 'Scope (División)',
                    className: 'w-56',
                    render: row => <span className="text-[#333333]">{divisionLabel(row.divisionId)}</span>,
                  },
                  {
                    key: 'acciones',
                    header: '',
                    className: 'w-16',
                    render: row => (
                      <div className="flex items-center justify-end gap-1">
                        <ActionBtn icon={<X size={15} />} tooltip="Revocar rol" danger onClick={() => setRevokeTarget(row)} />
                      </div>
                    ),
                  },
                ]}
                items={user.roles}
                keyFor={row => row.userRoleId}
              />
            )}

            <div className="border-t border-[#E5E7EB] px-4 py-3">
              <Button variant="ghost" size="sm" onClick={() => navigate(`/usuarios/asignar-rol?userId=${user.userId}`)}>
                <Plus size={14} />Asignar Rol
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end mt-6">
            <Button variant="secondary" onClick={() => navigate('/usuarios')}>
              <ArrowLeft size={14} />Regresar
            </Button>
          </div>
        </>
      ) : null}
    </FormPage>
  )
}