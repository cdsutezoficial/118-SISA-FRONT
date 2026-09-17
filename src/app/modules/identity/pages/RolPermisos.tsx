import { ArrowLeft, FolderOpen } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  FormPage, FormHeader, FormCard, MiniTable, Button,
} from '@app/core/components/form'
import { SearchSelectField } from '@app/core/components/ui'
import {
  Breadcrumb, EmptyState,
} from '@app/core/components/list'
import { ROLE_LABELS, ROLE_OPTIONS } from '../data/roles'
import type { RoleType } from '../data/roles'
import {
  ROLE_DESCRIPTIONS, ROLE_PERMISSIONS, ACTION_LABELS, ACTION_BADGE_STYLE,
} from '../data/permissions'
import type { PermissionAction, PermissionItem } from '../data/permissions'

const ACTION_ORDER: PermissionAction[] = ['VER', 'CREAR', 'EDITAR', 'ELIMINAR']

function ActionChips({ actions }: { actions: PermissionAction[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {ACTION_ORDER.filter(a => actions.includes(a)).map(action => (
        <span key={action} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ACTION_BADGE_STYLE[action]}`}>
          {ACTION_LABELS[action]}
        </span>
      ))}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function RolPermisos() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const requested = params.get('rol')
  const role: RoleType = requested && requested in ROLE_LABELS ? (requested as RoleType) : 'ADMIN'
  const groups = ROLE_PERMISSIONS[role]

  return (
    <FormPage>
      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Identidad' },
          { label: 'Roles', to: '/roles' },
          { label: 'Permisos' },
        ]}
      />

      <FormHeader
        title={`Permisos: ${ROLE_LABELS[role]}`}
        subtitle={ROLE_DESCRIPTIONS[role]}
        right={
          <div className="w-full sm:w-64">
            <SearchSelectField
              options={ROLE_OPTIONS}
              value={role}
              onChange={v => navigate(`/roles/permisos?rol=${v}`, { replace: true })}
              placeholder="Seleccionar rol"
              searchPlaceholder="Buscar rol…"
            />
          </div>
        }
      />

      {groups.length === 0 ? (
        <EmptyState
          title="Sin permisos asignados"
          hint="Este rol no tiene permisos configurados."
        />
      ) : (
        groups.map(group => (
          <FormCard key={group.module}>
            <div className="flex items-center gap-2 mb-3">
              <FolderOpen size={15} className="text-[#009574]" />
              <h2 className="text-[13px] font-semibold text-[#333333] uppercase tracking-wider">{group.module}</h2>
            </div>
            <MiniTable<PermissionItem>
              columns={[
                { key: 'resource', header: 'Recurso', render: row => (
                  <span className="font-medium text-[#333333]">{row.resource}</span>
                ) },
                { key: 'actions', header: 'Acciones', render: row => <ActionChips actions={row.actions} /> },
              ]}
              items={group.items}
              keyFor={row => row.resource}
            />
          </FormCard>
        ))
      )}

      <div className="flex items-center justify-end mt-6">
        <Button variant="secondary" onClick={() => navigate('/roles')}>
          <ArrowLeft size={14} />Regresar
        </Button>
      </div>
    </FormPage>
  )
}
