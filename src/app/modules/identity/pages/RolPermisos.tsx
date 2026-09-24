import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, FolderOpen, Loader2, Save } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  FormPage, FormHeader, FormCard, Button,
} from '@app/core/components/form'
import { FieldHelp, SearchSelectField } from '@app/core/components/ui'
import {
  Breadcrumb, EmptyState,
} from '@app/core/components/list'
import { Checkbox } from '@app/core/ui/checkbox'
import { apiGet, apiPut } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'
import { useRole } from '@app/core/infra/RoleContext'
import {
  describeRole,
  groupPermissionCatalog,
  mergePlannedPermissions,
  type PermissionCatalogItem,
  type PermissionDisplayItem,
  type PermissionDisplayGroup,
} from '../data/permissions'

interface RoleListItem {
  id: string
  key: string
  name: string
  description: string
}

interface RoleListResponse {
  items: RoleListItem[]
}

interface RolePermissionItem extends PermissionCatalogItem {}

interface RoleDetailResponse {
  id: string
  key: string
  name: string
  description: string
  permissions: RolePermissionItem[]
}

function InlineBanner({ message, tone = 'error' }: { message: string; tone?: 'error' | 'success' }) {
  const palette = tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-red-200 bg-red-50 text-red-700'

  return (
    <div className={`mb-6 rounded-lg border px-4 py-3 text-[13px] ${palette}`}>
      {message}
    </div>
  )
}

function groupCheckedState(group: PermissionDisplayGroup, selectedIds: Set<string>): boolean | 'indeterminate' {
  const activeIds = group.items.filter(permission => permission.status === 'ACTIVE').map(permission => permission.id)
  if (activeIds.length === 0) return false
  const selectedCount = activeIds.filter(permissionId => selectedIds.has(permissionId)).length
  if (selectedCount === 0) return false
  if (selectedCount === activeIds.length) return true
  return 'indeterminate'
}

const TABLE_ACTION_COLUMNS = [
  { suffix: 'READ', label: 'Ver' },
  { suffix: 'CREATE', label: 'Crear' },
  { suffix: 'UPDATE', label: 'Actualizar' },
  { suffix: 'DELETE', label: 'Eliminar' },
] as const

function findActionItem(items: PermissionDisplayItem[], suffix: string): PermissionDisplayItem | undefined {
  return items.find(item => item.actionSuffix === suffix)
}

function isStandardAction(suffix: string): boolean {
  return TABLE_ACTION_COLUMNS.some(column => column.suffix === suffix)
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function RolPermisos() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { activeRoleKey, refreshCapabilities } = useRole()
  const requestedRoleKey = params.get('rol')
  const [roles, setRoles] = useState<RoleListItem[]>([])
  const [permissions, setPermissions] = useState<PermissionCatalogItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loadStatus, setLoadStatus] = useState<'loading' | 'idle' | 'error'>('loading')
  const [loadErrorMsg, setLoadErrorMsg] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting'>('idle')
  const [submitMsg, setSubmitMsg] = useState('')
  const [submitTone, setSubmitTone] = useState<'error' | 'success'>('error')

  const selectedRole = useMemo(() => {
    if (roles.length === 0) return null
    return roles.find(role => role.key === requestedRoleKey) ?? roles[0]
  }, [requestedRoleKey, roles])

  const groupedPermissions = useMemo(() => groupPermissionCatalog(permissions), [permissions])

  useEffect(() => {
    let cancelled = false

    async function loadCatalogs() {
      setLoadStatus('loading')
      setLoadErrorMsg('')

      try {
        const [rolesResponse, permissionsResponse] = await Promise.all([
          apiGet<RoleListResponse>('/roles', { size: 100 }),
          apiGet<{ items: PermissionCatalogItem[] }>('/permissions', { size: 100 }),
        ])

        if (cancelled) return
        setRoles(rolesResponse.items)
        setPermissions(mergePlannedPermissions(permissionsResponse.items))
        setLoadStatus('idle')
      } catch (err) {
        if (cancelled) return
        const apiErr = err as Partial<ApiError>
        setLoadErrorMsg(apiErr.status === 403
          ? 'No tienes permiso para consultar roles y permisos.'
          : 'No se pudo cargar el catálogo de roles y permisos.')
        setLoadStatus('error')
      }
    }

    void loadCatalogs()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selectedRole) return
    const roleId = selectedRole.id
    let cancelled = false

    async function loadRoleDetail() {
      setLoadStatus('loading')
      setLoadErrorMsg('')

      try {
        const detail = await apiGet<RoleDetailResponse>(`/roles/${roleId}`)
        if (cancelled) return
        setSelectedIds(new Set(detail.permissions.map(permission => permission.id)))
        setLoadStatus('idle')
      } catch (err) {
        if (cancelled) return
        const apiErr = err as Partial<ApiError>
        setLoadErrorMsg(apiErr.status === 403
          ? 'No tienes permiso para consultar el detalle del rol.'
          : 'No se pudo cargar el detalle del rol seleccionado.')
        setLoadStatus('error')
      }
    }

    void loadRoleDetail()
    return () => { cancelled = true }
  }, [selectedRole])

  function handleRoleChange(roleKey: string) {
    setSubmitMsg('')
    setSubmitTone('error')
    navigate(`/roles/permisos?rol=${roleKey}`, { replace: true })
  }

  function togglePermission(permissionId: string, checked: boolean) {
    setSubmitMsg('')
    setSubmitTone('error')
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(permissionId)
      else next.delete(permissionId)
      return next
    })
  }

  function toggleModulePermissions(group: PermissionDisplayGroup, checked: boolean) {
    setSubmitMsg('')
    setSubmitTone('error')
    const activeIds = group.items.filter(permission => permission.status === 'ACTIVE').map(permission => permission.id)
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (const permissionId of activeIds) {
        if (checked) next.add(permissionId)
        else next.delete(permissionId)
      }
      return next
    })
  }

  async function handleSave() {
    if (!selectedRole) return
    setSubmitStatus('submitting')
    setSubmitMsg('')
    setSubmitTone('error')

    try {
      const result = await apiPut<RoleDetailResponse>(`/roles/${selectedRole.id}/permissions`, {
        permissionIds: Array.from(selectedIds),
      })
      setSelectedIds(new Set(result.permissions.map(permission => permission.id)))
      setSubmitMsg('Permisos actualizados correctamente.')
      setSubmitTone('success')
      if (selectedRole.key === activeRoleKey) await refreshCapabilities()
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 409 || apiErr.status === 400) {
        setSubmitMsg(apiErr.message ?? 'No se pudieron guardar los permisos del rol.')
      } else if (apiErr.status === 403) {
        setSubmitMsg('No tienes permiso para actualizar este rol.')
      } else {
        setSubmitMsg('No se pudieron guardar los permisos del rol.')
      }
    } finally {
      setSubmitStatus('idle')
    }
  }

  return (
    <FormPage>
      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Identidad' },
          { label: 'Roles', to: '/roles' },
          { label: 'Roles y permisos' },
        ]}
      />

      <FormHeader
        title={selectedRole ? `Permisos: ${selectedRole.name}` : 'Permisos del rol'}
        subtitle={selectedRole ? describeRole(selectedRole.key, selectedRole.description) : 'Selecciona un rol para administrar sus permisos.'}
        right={
          <div className="w-full sm:w-64">
            <SearchSelectField
              options={roles.map(role => ({ value: role.key, label: role.name }))}
              value={selectedRole?.key ?? ''}
              onChange={handleRoleChange}
              placeholder="Seleccionar rol"
              searchPlaceholder="Buscar rol…"
              disabled={roles.length === 0 || loadStatus === 'loading'}
            />
          </div>
        }
      />

      {loadErrorMsg && <InlineBanner message={loadErrorMsg} />}
      {submitMsg && <InlineBanner message={submitMsg} tone={submitTone} />}

      {loadStatus === 'loading' ? (
        <FormCard>
          <div className="flex items-center justify-center gap-3 py-12 text-[#6B7280]">
            <Loader2 size={20} className="animate-spin text-[#009574]" />
            <span className="text-[13px] font-medium">Cargando permisos del rol...</span>
          </div>
        </FormCard>
      ) : !selectedRole ? (
        <EmptyState
          title="Sin roles disponibles"
          hint="No se encontraron roles para administrar permisos."
        />
      ) : groupedPermissions.length === 0 ? (
        <EmptyState
          title="Sin permisos disponibles"
          hint="El catálogo de permisos está vacío."
        />
      ) : (
        groupedPermissions.map(group => (
          <FormCard key={group.module}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen size={15} className="text-[#009574]" />
                <h2 className="text-[13px] font-semibold text-[#333333] uppercase tracking-wider">{group.module}</h2>
              </div>
              <label className="inline-flex items-center gap-2 text-[12px] font-medium text-[#333333]">
                <Checkbox
                  checked={groupCheckedState(group, selectedIds)}
                  disabled={submitStatus === 'submitting' || group.items.every(permission => permission.status !== 'ACTIVE')}
                  onCheckedChange={value => toggleModulePermissions(group, value === true)}
                />
                Seleccionar toda la sección
              </label>
            </div>
            <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
              <table className="min-w-full border-collapse bg-white">
                <thead>
                  <tr className="bg-[#F8F9FA] text-left">
                    <th className="px-4 py-3 text-[12px] font-semibold text-[#333333]">Módulo / descripción</th>
                    {TABLE_ACTION_COLUMNS.map(column => (
                      <th key={column.suffix} className="px-4 py-3 text-[12px] font-semibold text-[#333333] min-w-[150px]">
                        <span>{column.label}</span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-[12px] font-semibold text-[#333333] min-w-[260px]">Otros</th>
                  </tr>
                </thead>
                <tbody>
                  {group.resources.map(resource => {
                    const otherItems = resource.items.filter(permission => !isStandardAction(permission.actionSuffix))
                    return (
                      <tr key={`${group.module}-${resource.resource}`} className="border-t border-[#E5E7EB] align-top">
                        <td className="px-4 py-4">
                          <p className="text-[13px] font-semibold text-[#333333]">{resource.resource}</p>
                        </td>
                        {TABLE_ACTION_COLUMNS.map(column => {
                          const permission = findActionItem(resource.items, column.suffix)
                          if (!permission) {
                            return <td key={`${resource.resource}-${column.suffix}`} className="px-4 py-4 text-[12px] text-[#9CA3AF]">—</td>
                          }

                          const checked = selectedIds.has(permission.id)
                          const disabled = permission.status !== 'ACTIVE' || submitStatus === 'submitting'
                          return (
                            <td key={permission.id} className="px-4 py-4">
                              <label className={`flex transition-colors ${disabled ? 'opacity-70' : 'cursor-pointer hover:border-[#009574]/30'}`}>
                                <Checkbox
                                  checked={checked}
                                  disabled={disabled}
                                  onCheckedChange={value => togglePermission(permission.id, value === true)}
                                />
                              </label>
                            </td>
                          )
                        })}
                        <td className="px-4 py-4">
                          {otherItems.length === 0 ? (
                            <span className="text-[12px] text-[#9CA3AF]">—</span>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {otherItems.map(permission => {
                                const checked = selectedIds.has(permission.id)
                                const disabled = permission.status !== 'ACTIVE' || submitStatus === 'submitting'
                                return (
                                  <label key={permission.id} className={`flex items-center gap-2 text-[12px] text-[#000] ${disabled ? 'opacity-70' : 'cursor-pointer hover:border-[#009574]/30'}`}>
                                    <Checkbox
                                      checked={checked}
                                      disabled={disabled}
                                      onCheckedChange={value => togglePermission(permission.id, value === true)}
                                    />
                                    <span className="min-w-0">
                                      <span className="block text-[#6B7280]">{permission.actionLabel}</span>
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          )}
                          {resource.items.some(permission => permission.status !== 'ACTIVE') && (
                            <FieldHelp>Los permisos inactivos de este recurso no pueden asignarse.</FieldHelp>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </FormCard>
        ))
      )}


      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end mt-6">
        <Button variant="secondary" onClick={() => navigate('/roles')}>
          <ArrowLeft size={14} />Regresar
        </Button>
        <Button onClick={handleSave} loading={submitStatus === 'submitting'} disabled={!selectedRole || loadStatus !== 'idle'}>
          {submitStatus !== 'submitting' && <Save size={14} />}
          Guardar permisos
        </Button>
      </div>
    </FormPage>
  )
}
