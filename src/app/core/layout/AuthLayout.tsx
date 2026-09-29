import { Outlet } from 'react-router'

/**
 * Bare layout for unauthenticated routes (/login, /reset-password, /reset-confirm).
 * Renders no Shell chrome — no Sidebar, no Navbar.
 */
export default function AuthLayout() {
  return <Outlet />
}
