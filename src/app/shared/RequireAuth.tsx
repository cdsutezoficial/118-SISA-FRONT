import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { useRole } from './RoleContext'
import { getAccessToken, decodeJwtPayload } from './auth'

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
 * mount. Missing/expired token clears the session and redirects to `/login`.
 * A pending mandatory password change blocks every other authenticated route.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { authMode, mustChangePassword, logout } = useRole()
  const { pathname } = useLocation()

  const token = authMode === 'real' ? getAccessToken() : null
  const claims = token ? decodeJwtPayload(token) : null
  const isValid = authMode === 'mock' || (claims !== null && claims.exp * 1000 > Date.now())

  // Clearing storage/state is a side effect — deferred to an effect so it
  // never runs during another component's render. The redirect below fires
  // immediately regardless, computed straight from storage.
  useEffect(() => {
    if (authMode === 'real' && !isValid) {
      logout()
    }
  }, [authMode, isValid, logout])

  if (authMode === 'mock') {
    return <>{children}</>
  }

  if (!isValid) {
    return <Navigate to="/login" replace />
  }

  if (mustChangePassword && pathname !== CAMBIAR_PASSWORD_PATH) {
    return <Navigate to={CAMBIAR_PASSWORD_PATH} replace />
  }

  return <>{children}</>
}
