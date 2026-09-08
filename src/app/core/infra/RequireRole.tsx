import { Navigate } from 'react-router'
import type { ReactNode } from 'react'
import { useRole } from './RoleContext'
import type { Role } from './RoleContext'

/**
 * Route-level role guard shared by every guarded module (mock auth).
 *
 * `AppLayout.tsx`'s `NAV_ITEMS` role filtering only controls what the
 * Sidebar SHOWS — it never stopped direct URL navigation. This component
 * closes that gap: wrap a route's `element` and it enforces the same rule
 * at the route boundary, regardless of how the user got there.
 *
 * If the active mock role is one of `allowedRoles`, renders `children`
 * normally. Otherwise (including the anonymous `role === null` tier),
 * redirects to `redirectTo` with a pending toast — mirrors the
 * `usePendingToast()` convention already used across many screens (see
 * `shared/hooks.ts`).
 *
 * `redirectTo` defaults to `/admision` to preserve every existing Admisión
 * call site unchanged. Other modules MUST pass their own Dashboard path
 * (e.g. `redirectTo="/inscripciones"`) — that path's index/Dashboard route is
 * intentionally NEVER wrapped in `RequireRole` itself, since it's the guard's
 * own redirect target; guarding it too would risk an infinite redirect loop
 * for any role/tier not on its allow-list. See each module's `router.tsx`
 * block for the specific rationale.
 */
export function RequireRole({ allowedRoles, redirectTo = '/admision', children }: { allowedRoles: Role[]; redirectTo?: string; children: ReactNode }) {
  const { role } = useRole()

  if (role === null || !allowedRoles.includes(role)) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ toast: 'No tienes permiso para acceder a esa pantalla.' }}
      />
    )
  }

  return <>{children}</>
}
