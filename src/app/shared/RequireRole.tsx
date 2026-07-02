import { Navigate } from 'react-router'
import type { ReactNode } from 'react'
import { useRole } from './RoleContext'
import type { Role } from './RoleContext'

/**
 * Route-level role guard for the Admisión module (mock auth).
 *
 * `AppLayout.tsx`'s `NAV_ITEMS` role filtering only controls what the
 * Sidebar SHOWS — it never stopped direct URL navigation. This component
 * closes that gap: wrap a route's `element` and it enforces the same rule
 * at the route boundary, regardless of how the user got there.
 *
 * If the active mock role is one of `allowedRoles`, renders `children`
 * normally. Otherwise (including the anonymous `role === null` tier),
 * redirects to the Admisión Dashboard (`/admision`) with a pending toast —
 * mirrors the `usePendingToast()` convention already used across ~15
 * screens (see `shared/hooks.ts`).
 *
 * `/admision` (the Dashboard/index route) is intentionally NEVER wrapped in
 * `RequireRole` — see `router.tsx` for the rationale (it's the guard's own
 * redirect target; guarding it too would risk an infinite redirect loop for
 * any role/tier not on its allow-list).
 */
export function RequireRole({ allowedRoles, children }: { allowedRoles: Role[]; children: ReactNode }) {
  const { role } = useRole()

  if (role === null || !allowedRoles.includes(role)) {
    return (
      <Navigate
        to="/admision"
        replace
        state={{ toast: 'No tienes permiso para acceder a esa pantalla.' }}
      />
    )
  }

  return <>{children}</>
}
