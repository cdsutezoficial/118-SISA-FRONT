import { Navigate } from 'react-router'
import type { ReactNode } from 'react'
import { useRole } from './RoleContext'
import { ROLE_DEFAULT_PATHS } from '../layout/layoutRoles'

export function RequirePermission({
  permissionKeys,
  redirectTo = '/dashboard',
  redirectToRoleMain = false,
  children,
}: {
  permissionKeys: string[]
  redirectTo?: string
  redirectToRoleMain?: boolean
  children: ReactNode
}) {
  const { role, authMode, availableRoles, permissionsStatus, hasAnyPermission } = useRole()

  if (authMode === 'real' && role === null && availableRoles.length > 0) {
    return null
  }

  /**
   * Permission resolution is `'pending'` (never resolved on this mount yet) or
   * `'loading'` — hold rendering instead of reading the still-empty key set.
   * This is what prevents the reload false-positive: permissions arrive async,
   * so "not resolved yet" must NOT be treated as "no permission".
   */
  if (authMode === 'real' && (permissionsStatus === 'pending' || permissionsStatus === 'loading')) {
    return null
  }

  if (role === null || !hasAnyPermission(permissionKeys)) {
    const to = redirectToRoleMain && role ? ROLE_DEFAULT_PATHS[role] : redirectTo
    return (
      <Navigate
        to={to}
        replace
        state={{ toast: 'No tienes permiso para acceder a esa pantalla.' }}
      />
    )
  }

  return <>{children}</>
}