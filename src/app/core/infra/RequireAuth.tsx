import { Navigate, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { useRole } from './RoleContext'
import { SessionExpiredAlert } from './SessionExpiredAlert'
import { decodeJwtPayload, getStoredSignedOut } from './auth'
import { getAccessToken } from './apiClient'

const CAMBIAR_PASSWORD_PATH = '/usuarios/cambiar-password'

/**
 * Session gate wrapping the authenticated shell (`<AppLayout/>` in
 * `router.tsx`). A React component, NOT a router `loader` — `RoleProvider`
 * mounts ABOVE `RouterProvider` in `main.tsx`, and loaders run outside the
 * React tree so they cannot call `useRole()`.
 *
 * Mock mode (`authMode === 'mock'`): passthrough, unchanged legacy behavior.
 * `RequireRole` still enforces per-screen role checks below this gate.
 *
 * Real mode (`authMode === 'real'`): requires a present, non-expired access
 * token — re-decoded fresh on every render (not cached React state) so an
 * expiry crossed mid-session is caught on the next navigation, not just on
 * mount.
 *
 * Involuntary expiry (401 / token `exp` passes) keeps the CURRENT view mounted
 * and floats `SessionExpiredAlert` over it for 5 seconds; that alert performs
 * the `logout()` + redirect to `/login`. The view is not swapped in the
 * meantime — the underlying tree keeps its hydrated role, so no
 * redirect-loops fire. A session the user closed deliberately (`Cerrar
 * sesión`, or a Back that lands here after the alert redirected) is flagged
 * via `sisa.signedOut` and redirects instantly without re-showing the alert.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { authMode, mustChangePassword } = useRole()
  const { pathname } = useLocation()

  const signedOut = getStoredSignedOut()
  const token = authMode === 'real' ? getAccessToken() : null
  const claims = token ? decodeJwtPayload(token) : null
  const isValid = authMode === 'mock' || (claims !== null && claims.exp * 1000 > Date.now())

  if (authMode === 'mock') {
    return <>{children}</>
  }

  if (!isValid) {
    // Deliberate sign-out (or a Back after the alert already redirected):
    // instant, no alert. Involuntary expiry: keep the view and float the alert.
    if (signedOut) return <Navigate to="/login" replace />
    return (
      <>
        {children}
        <SessionExpiredAlert />
      </>
    )
  }

  if (mustChangePassword && pathname !== CAMBIAR_PASSWORD_PATH) {
    return <Navigate to={CAMBIAR_PASSWORD_PATH} replace />
  }

  return <>{children}</>
}