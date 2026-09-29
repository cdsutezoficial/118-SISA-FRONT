import { apiGet } from '@app/core/infra/apiClient'
import type { RoleType } from './roles'

interface RoleCatalogItem {
  id: string
  key: string
}

interface RolesPageResponse {
  items: RoleCatalogItem[]
}

/**
 * Resolves each seeded `RoleType` to its persisted role UUID via `GET /roles`.
 * `POST /users/{userId}/roles` expects `{roleId, divisionId}` (backend
 * persisted-roles contract), not the `roleType` string.
 */
export async function fetchRoleIdByType(): Promise<Partial<Record<RoleType, string>>> {
  const data = await apiGet<RolesPageResponse>('/roles', { size: 100 })
  const map: Partial<Record<RoleType, string>> = {}
  for (const item of data.items) {
    map[item.key as RoleType] = item.id
  }
  return map
}