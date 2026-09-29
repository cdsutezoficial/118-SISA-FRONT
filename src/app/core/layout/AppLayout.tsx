import { useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { Menu, ChevronDown, HelpCircle, LogOut, UserCog } from 'lucide-react'
import { useRole } from '../infra/RoleContext'
import type { Role } from '../infra/RoleContext'
import { Sidebar } from './Sidebar'
import { ROLE_LABELS, ROLE_DEFAULT_PATHS } from './layoutRoles'
import { decodeJwtPayload } from '../infra/auth'
import { getAccessToken, getStoredAuthMode } from '../infra/apiClient'

function isRealSessionActive(): boolean {
  if (getStoredAuthMode() !== 'real') return false
  const token = getAccessToken()
  const claims = token ? decodeJwtPayload(token) : null
  return claims !== null && claims.exp * 1000 > Date.now()
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar({
  onRoleMenuToggle,
  roleMenuOpen,
  onMobileMenuToggle,
}: {
  onRoleMenuToggle: () => void
  roleMenuOpen: boolean
  onMobileMenuToggle: () => void
}) {
  const navigate = useNavigate()
  const { role, setRole, availableRoles, user, authMode, logout } = useRole()
  const isRealSession = authMode === 'real'

  function handleLogout() {
    if (isRealSession) logout()
    navigate('/login')
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-[#E5E7EB] flex items-center px-3 sm:px-6 justify-between gap-2">
      {/* Left: hamburger (mobile only) + brand */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-1.5 rounded-md text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#333333] transition-colors flex-shrink-0"
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
        <span className="font-semibold text-[15px] text-[#333333] tracking-tight truncate">
          SISA<span className="hidden sm:inline ml-1 text-xs font-normal text-[#6B7280]"> Sistema Integral de Servicios Académicos</span>
        </span>
      </div>

      {/* Right: role switcher + help + logout */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        <div className="relative">
          <button
            onClick={onRoleMenuToggle}
            aria-haspopup="menu"
            aria-expanded={roleMenuOpen}
            className={`flex items-center gap-1.5 text-sm text-[#333333] px-2 sm:px-3 py-1.5 rounded-md border border-[#E5E7EB] transition-colors hover:bg-[#F8F9FA]`}
          >
            <UserCog size={15} className="text-[#6B7280] flex-shrink-0" />
            <span className="font-medium hidden sm:inline">{role ? ROLE_LABELS[role] : 'Seleccionar rol'}</span>
            <ChevronDown size={14} className="text-[#6B7280] hidden sm:block" />
          </button>
          {roleMenuOpen && (
            <div className="absolute right-0 top-9 w-52 bg-white border border-[#E5E7EB] rounded-lg shadow-lg py-1 z-50">
              <div className="px-4 py-2.5 border-b border-[#E5E7EB]">
                <p className="text-[12px] font-semibold text-[#333333]">{user?.name}</p>
                <p className="text-[11px] text-[#6B7280]">{user?.email}</p>
              </div>
              {availableRoles.map(r => (
                <button
                  key={r}
                  onClick={() => { setRole(r); onRoleMenuToggle() }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    role === r ? 'text-[#009574] font-medium bg-[#e6f5f1]' : 'text-[#333333] hover:bg-[#F8F9FA]'
                  }`}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
              <div className="h-px bg-[#E5E7EB] my-1" />
              <button
                onClick={() => navigate('/usuarios/cambiar-password')}
                className="w-full text-left px-4 py-2 text-sm text-[#333333] hover:bg-[#F8F9FA] flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#6B7280]">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Cambiar contraseña
              </button>
            </div>
          )}
        </div>
        <button className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#333333] px-2 py-1.5 rounded-md hover:bg-[#F8F9FA] transition-colors">
          <HelpCircle size={16} /><span className="hidden sm:inline">Manual</span>
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-red-600 px-2 py-1.5 rounded-md hover:bg-red-50 transition-colors"
        >
          <LogOut size={16} /><span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      </div>
    </header>
  )
}

// ─── AppLayout ────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [roleMenuOpen, setRoleMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { role } = useRole()
  const navigate = useNavigate()
  // Skips the redirect on the initial mount (a reload/refresh/re-login must
  // NOT yank the user away from the route they opened).
  const prevRoleRef = useRef<Role | null>(null)

  // Browser Back/Forward can restore a protected page from the bfcache with
  // its DOM intact even after the session was cleared — the user would briefly
  // SEE the stale screen. On any such restore in real mode without a live
  // token, hard-leave to /login instead of showing that snapshot.
  useEffect(() => {
    const onPageshow = (e: PageTransitionEvent) => {
      if (e.persisted && !isRealSessionActive()) {
        window.location.replace('/login')
      }
    }
    window.addEventListener('pageshow', onPageshow)
    return () => window.removeEventListener('pageshow', onPageshow)
  }, [])

  // On a role switch, always land on that role's main view — never stay on a
  // route the new role may not even see in its sidebar. Runs once centrally,
  // covering every switch path (Navbar dropdown, Sidebar desktop/mobile,
  // post-login role selection). `replace` keeps history clean so Back doesn't
  // return into the previous role's stale view.
  useEffect(() => {
    if (prevRoleRef.current === null) {
      prevRoleRef.current = role
      return
    }
    prevRoleRef.current = role
    if (role) {
      navigate(ROLE_DEFAULT_PATHS[role], { replace: true })
    }
  }, [role, navigate])

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-['Inter',sans-serif] flex flex-col">
      <Navbar
        onRoleMenuToggle={() => setRoleMenuOpen(o => !o)}
        roleMenuOpen={roleMenuOpen}
        onMobileMenuToggle={() => setMobileMenuOpen(o => !o)}
      />
      <div className="flex flex-1 pt-14">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(c => !c)}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
        {/* On mobile: no sidebar offset. On desktop: offset by sidebar width. */}
        <main className={`flex-1 min-w-0 transition-all duration-200 ${sidebarCollapsed ? 'md:ml-[60px]' : 'md:ml-[240px]'}`}>
          <div className="max-w-none">
            <Outlet />
          </div>
        </main>
      </div>
      {roleMenuOpen && <div className="fixed inset-0 z-30" onClick={() => setRoleMenuOpen(false)} />}
    </div>
  )
}