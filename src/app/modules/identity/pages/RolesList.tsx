import {
  useEffect,
  useState,
} from 'react'
import {
  Eye, ShieldCheck, Landmark, Globe,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@app/core/components/form'
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
  DataTable,
  MobileCards,
  type ColumnDef,
} from '@app/core/components/list'
import { apiGet } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'
import { ROLE_LABELS, ROLE_BADGE_STYLE, DIVISION_SCOPED_ROLES } from '../data/roles'
import type { RoleType } from '../data/roles'
import { describeRole, isRoleType } from '../data/permissions'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Rol {
  id: string
  roleType: RoleType
  label: string
  description: string
  scope: 'Global' | 'División'
  permisos: number
}

interface RoleListItem {
  id: string
  name: string
  key: string
  status: 'ACTIVE' | 'INACTIVE'
  description: string
}

interface RoleListResponse {
  items: RoleListItem[]
}

interface RolePermissionItem {
  id: string
  status: 'ACTIVE' | 'INACTIVE'
}

interface RoleDetailResponse {
  permissions: RolePermissionItem[]
}

function RoleBadge({ roleType }: { roleType: RoleType }) {
  return (
    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE_STYLE[roleType]}`}>
      {ROLE_LABELS[roleType]}
    </span>
  )
}

function ScopeBadge({ scope }: { scope: Rol['scope'] }) {
  const isDivision = scope === 'División'
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
      isDivision ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-100 text-gray-600 border-gray-200'
    }`}>
      {isDivision ? <Landmark size={11} /> : <Globe size={11} />}
      {scope}
    </span>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function RolesList() {
  const navigate = useNavigate()
  const [roles, setRoles] = useState<Rol[]>([])
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadRoles() {
      setLoadStatus('loading')
      setErrorMsg('')

      try {
        const data = await apiGet<RoleListResponse>('/roles', { size: 100 })
        const permissionCounts = await Promise.all(data.items.map(async role => {
          try {
            const detail = await apiGet<RoleDetailResponse>(`/roles/${role.id}`)
            return [role.id, detail.permissions.filter(permission => permission.status === 'ACTIVE').length] as const
          } catch {
            return [role.id, 0] as const
          }
        }))

        if (cancelled) return

        const counts = new Map(permissionCounts)
        setRoles(data.items
          .filter((role): role is RoleListItem & { key: RoleType } => isRoleType(role.key))
          .map(role => ({
            id: role.id,
            roleType: role.key,
            label: ROLE_LABELS[role.key],
            description: describeRole(role.key, role.description),
            scope: DIVISION_SCOPED_ROLES.has(role.key) ? 'División' : 'Global',
            permisos: counts.get(role.id) ?? 0,
          })))
        setLoadStatus('idle')
      } catch (err) {
        if (cancelled) return
        const apiErr = err as Partial<ApiError>
        setErrorMsg(apiErr.status === 403
          ? 'No tienes permiso para consultar roles.'
          : 'No se pudo cargar el catálogo de roles.')
        setLoadStatus('error')
      }
    }

    void loadRoles()
    return () => { cancelled = true }
  }, [])

  const columns: ColumnDef<Rol>[] = [
    { key: 'label', header: 'Rol', render: row => <RoleBadge roleType={row.roleType} />, className: 'w-56' },
    { key: 'description', header: 'Descripción', render: row => (
      <span className="text-[13px] text-[#6B7280]">{row.description}</span>
    ) },
    { key: 'scope', header: 'Alcance', render: row => <ScopeBadge scope={row.scope} />, className: 'w-28' },
    { key: 'permisos', header: 'Permisos', type: 'count', className: 'w-24' },
  ]

  return (
    <PageContainer>
      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Identidad' },
          { label: 'Roles' },
        ]}
      />

      <PageHeader
        title="Roles"
        subtitle="Catálogo de roles del sistema. Consulta los permisos de cada rol con la acción Ver."
      />

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <DataTable
        numbered
        columns={columns}
        status={loadStatus}
        items={roles}
        keyFor={row => row.id}
        loadingLabel="Cargando roles..."
        emptyTitle="No hay roles registrados"
        emptyHint={loadStatus === 'error' ? errorMsg : 'El catálogo de roles está vacío.'}
        actions={{
          view: row => navigate(`/roles/permisos?rol=${row.roleType}`),
          viewTooltip: 'Ver permisos',
        }}
      />

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <MobileCards
        status={loadStatus}
        items={roles}
        keyFor={row => row.id}
        renderItem={row => (
          <>
            <div className="flex items-center justify-between gap-2 mb-2">
              <RoleBadge roleType={row.roleType} />
              <ScopeBadge scope={row.scope} />
            </div>
            <p className="text-[12px] text-[#6B7280] mb-2">{row.description}</p>
            <p className="flex items-center gap-1.5 text-[12px] text-[#6B7280] mb-3">
              <ShieldCheck size={12} />
              {row.permisos} permisos
            </p>
            <div className="pt-2 border-t border-[#E5E7EB]">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => navigate(`/roles/permisos?rol=${row.roleType}`)}
              >
                <Eye size={14} />Ver permisos
              </Button>
            </div>
          </>
        )}
        loadingLabel="Cargando roles..."
        emptyTitle="No hay roles registrados"
        emptyHint={loadStatus === 'error' ? errorMsg : 'El catálogo de roles está vacío.'}
      />
    </PageContainer>
  )
}
