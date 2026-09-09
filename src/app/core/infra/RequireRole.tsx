import { Navigate } from 'react-router'
import type { ReactNode } from 'react'
import { useRole } from './RoleContext'
import type { Role } from './RoleContext'
import { ROLE_DEFAULT_PATHS } from '../layout/layoutRoles'

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
 * `ADMINISTRADOR` is a superuser: it bypasses the allow-list entirely and
 * always renders `children`. The backend grants ADMIN on every endpoint of
 * every module (auditoría included — `transversales/auditoria.md`), so route
 * gating matches: ADMIN can reach any screen by URL and the sidebar shows it
 * every entry.
 *
 * `redirectTo` defaults to `/admision` to preserve every existing Admisión
 * call site unchanged. Other modules MUST pass their own Dashboard path
 * (e.g. `redirectTo="/inscripciones"`) — that path's index/Dashboard route is
 * intentionally NEVER wrapped in `RequireRole` itself, since it's the guard's
 * own redirect target; guarding it too would risk an infinite redirect loop
 * for any role/tier not on its allow-list. See each module's `router.tsx`
 * block for the specific rationale.
 *
 * `redirectToRoleMain` is the exception to that rule, used specifically for
 * the cross-module `/dashboard` (Panel de Control). It ignores `redirectTo`
 * and sends the denied role to its own main view via `ROLE_DEFAULT_PATHS`
 * (Gestor → `/inscripciones`, Finanzas/Director → `/admision`, …), which by
 * construction is a route every staff role CAN open. That destination is
 * never a guarded cross-target, so no redirect loop is possible even though
 * `/dashboard` itself is guarded now (its allow-list is Administrador +
 * Servicios Escolares, mirroring the sidebar).
 */
export function RequireRole({ allowedRoles, redirectTo = '/admision', redirectToRoleMain = false, children }: {
  allowedRoles: Role[]
  redirectTo?: string
  /** true → redirige al rol a su vista principal (`ROLE_DEFAULT_PATHS`), no a `redirectTo`. */
  redirectToRoleMain?: boolean
  children: ReactNode
}) {
  const { role } = useRole()

  if (role === null || (role !== 'ADMINISTRADOR' && !allowedRoles.includes(role))) {
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
