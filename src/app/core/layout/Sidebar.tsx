import { useState, useEffect, type ReactElement, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router'
import {
  LayoutDashboard, Building2, GraduationCap, BookOpen,
  CalendarRange, Users, CreditCard, IdCard, UserPlus,
  ClipboardCheck, ChevronLeft, ChevronRight, ChevronDown,
  LogOut, UserCog, X, Settings, Layers, Tags, Users2, Ticket,
} from 'lucide-react'
import { useRole } from '../infra/RoleContext'
import type { Role } from '../infra/RoleContext'
import { STAFF_ROLES, ROLE_LABELS } from './layoutRoles'

// ─── Nav model ────────────────────────────────────────────────────────────────
// Two entry types: NavLeaf (navigable item) and NavGroup (collapsible section).
// Add children to any group to introduce a deeper level in the future.

export interface NavLeaf {
  icon: ReactElement
  label: string
  base: string
  path: string
  roles: Role[]
}

export interface NavGroup {
  id: string
  icon: ReactElement
  label: string
  children: NavLeaf[]
}

export type NavEntry = NavLeaf | NavGroup

function isGroup(e: NavEntry): e is NavGroup {
  return 'children' in e
}

/** System-wide navigation tree — any module/shell can render its own subset. */
export const SYSTEM_NAV: NavEntry[] = [
  { icon: <LayoutDashboard size={18} />, label: 'Dashboard', base: 'dashboard', path: '/dashboard', roles: STAFF_ROLES },
  {
    id: 'config', icon: <Settings size={18} />, label: 'Configuración Académica',
    children: [
      { icon: <Building2 size={18} />,     label: 'Divisiones Académicas',   base: 'divisiones', path: '/divisiones', roles: STAFF_ROLES },
      { icon: <GraduationCap size={18} />, label: 'Programas Educativos',    base: 'programas',  path: '/programas',  roles: STAFF_ROLES },
      { icon: <BookOpen size={18} />,      label: 'Planes de Estudio',       base: 'planes',     path: '/planes',     roles: STAFF_ROLES },
      { icon: <Tags size={18} />,          label: 'Clasificaciones de Materias', base: 'clasificaciones', path: '/clasificaciones', roles: STAFF_ROLES },
      { icon: <CalendarRange size={18} />, label: 'Periodos Académicos',     base: 'periodos',   path: '/periodos',   roles: STAFF_ROLES },
      { icon: <Users2 size={18} />,        label: 'Generaciones',            base: 'generaciones', path: '/generaciones', roles: STAFF_ROLES },
      { icon: <Users size={18} />,         label: 'Grupos',                  base: 'grupos',     path: '/grupos',     roles: STAFF_ROLES },
      { icon: <Ticket size={18} />,        label: 'Configuración de Admisión', base: 'configuracion-admision', path: '/configuracion-admision', roles: STAFF_ROLES },
      { icon: <CreditCard size={18} />,    label: 'Conceptos de Pago',       base: 'conceptos',  path: '/conceptos',  roles: STAFF_ROLES },
    ],
  },
  {
    id: 'admin', icon: <UserCog size={18} />, label: 'Administración',
    children: [
      { icon: <IdCard size={18} />, label: 'Usuarios', base: 'usuarios', path: '/usuarios', roles: STAFF_ROLES },
    ],
  },
  {
    id: 'modules', icon: <Layers size={18} />, label: 'Módulos',
    children: [
      { icon: <UserPlus size={18} />,      label: 'Admisión',     base: 'admision',      path: '/admision',      roles: ['SERVICIOS_ESCOLARES', 'FINANZAS', 'DIRECTOR_DIVISION'] as Role[] },
      { icon: <ClipboardCheck size={18} />, label: 'Inscripciones', base: 'inscripciones', path: '/inscripciones', roles: ['GESTOR_ACADEMICO', 'ADMINISTRADOR', 'SERVICIOS_ESCOLARES'] as Role[] },
    ],
  },
]

/** Id of the NavGroup whose children include `segment`, or null. */
function groupForSegment(nav: NavEntry[], segment: string): string | null {
  for (const e of nav) {
    if (isGroup(e) && e.children.some(c => c.base === segment)) return e.id
  }
  return null
}

/** Flat list of all NavLeaf items visible to `role` (for collapsed sidebar). */
function allLeafsForRole(nav: NavEntry[], role: Role | null): NavLeaf[] {
  if (!role) return []
  const out: NavLeaf[] = []
  for (const e of nav) {
    if (isGroup(e)) out.push(...e.children.filter(c => c.roles.includes(role)))
    else if (e.roles.includes(role)) out.push(e)
  }
  return out
}

export interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
  /** Navigation tree to render. Defaults to the system-wide `SYSTEM_NAV`. */
  navigation?: NavEntry[]
}

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
  navigation = SYSTEM_NAV,
}: SidebarProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { role, setRole, availableRoles, user, authMode, logout } = useRole()
  const isRealSession = authMode === 'real'
  const segment = pathname.split('/')[1] ?? ''

  // ─── Accordion state ───────────────────────────────────────────────────────
  // Default: 'config' group open + whatever group contains the active route.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const activeId = groupForSegment(navigation, segment)
    return new Set(['config', ...(activeId && activeId !== 'config' ? [activeId] : [])])
  })

  // ─── Tooltip state (collapsed sidebar) ─────────────────────────────────────
  // Rendered via a portal to <body> so the sidebar's overflow clipping doesn't
  // cut it off. Mirrors the ActionBtn tooltip design (bg #333333, 11px, rounded).
  const [tooltip, setTooltip] = useState<{ label: string; rect: DOMRect } | null>(null)
  const tooltipTimer = useRef<number | null>(null)

  function showTooltip(label: string, el: HTMLElement) {
    setTooltip({ label, rect: el.getBoundingClientRect() })
  }

  function hideTooltip() {
    if (tooltipTimer.current !== null) {
      window.clearTimeout(tooltipTimer.current)
      tooltipTimer.current = null
    }
    setTooltip(null)
  }

  // Clear the tooltip if the sidebar is expanded while one is showing.
  useEffect(() => {
    if (!collapsed) setTooltip(null)
  }, [collapsed])

  // Auto-expand the group containing the active route on navigation.
  useEffect(() => {
    const activeId = groupForSegment(navigation, segment)
    if (activeId) {
      setExpandedGroups(prev => prev.has(activeId) ? prev : new Set([...prev, activeId]))
    }
  }, [navigation, segment])

  function toggleGroup(id: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function goTo(path: string) {
    navigate(path)
    onMobileClose()
  }

  function handleMobileLogout() {
    if (isRealSession) logout()
    navigate('/login')
    onMobileClose()
  }

  // Role-filtered nav entries. Groups with no visible children are hidden.
  const visibleEntries: NavEntry[] = role === null ? [] : navigation
    .map((entry): NavEntry | null => {
      if (!isGroup(entry)) return (entry as NavLeaf).roles.includes(role) ? entry : null
      const kids = (entry as NavGroup).children.filter(c => c.roles.includes(role))
      return kids.length > 0 ? { ...(entry as NavGroup), children: kids } : null
    })
    .filter((e): e is NavEntry => e !== null)

  // ─── Desktop sidebar (md+) ─────────────────────────────────────────────────
  return (
    <>
      <aside className={`hidden md:flex fixed top-14 left-0 bottom-0 z-40 bg-white border-r border-[#E5E7EB] flex-col transition-all duration-200 overflow-hidden ${collapsed ? 'w-[60px]' : 'w-[240px]'}`}>
        {/* User info */}
        {collapsed ? (
          <div className="px-3 py-4 border-b border-[#E5E7EB] flex justify-center">
            <div className="w-9 h-9 rounded-full bg-[#009574] flex items-center justify-center text-white font-semibold text-xs">MG</div>
          </div>
        ) : (
          <div className="px-4 py-4 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#009574] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">MG</div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[#333333] truncate">{user?.name ?? 'Usuario'}</p>
                <p className="text-[11px] text-[#6B7280] truncate">{role ? ROLE_LABELS[role] : ''}</p>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className={`flex-1 py-2 px-2 space-y-0.5 ${collapsed ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {collapsed ? (
            // Collapsed: flat icon list (tree flattened to leaves)
            allLeafsForRole(navigation, role).map(item => {
              const isActive = item.base === segment
              return (
                <div key={item.base} className="relative group">
                  <button
                    onClick={() => goTo(item.path)}
                    onMouseEnter={e => { const el = e.currentTarget; hideTooltip(); tooltipTimer.current = window.setTimeout(() => showTooltip(item.label, el), 150) }}
                    onMouseLeave={hideTooltip}
                    className={`w-full flex justify-center p-2.5 rounded-md transition-colors ${
                      isActive ? 'bg-[#e6f5f1] text-[#009574]' : 'text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#333333]'
                    }`}
                  >
                    {item.icon}
                  </button>
                </div>
              )
            })
          ) : (
            // Expanded: accordion groups
            visibleEntries.map(entry => {
              if (!isGroup(entry)) {
                const isActive = (entry as NavLeaf).base === segment
                return (
                  <button
                    key={(entry as NavLeaf).base}
                    onClick={() => goTo((entry as NavLeaf).path)}
                    className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors ${
                      isActive ? 'bg-[#e6f5f1] text-[#009574]' : 'text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#333333]'
                    }`}
                  >
                    <span className={`flex-shrink-0 ${isActive ? 'text-[#009574]' : ''}`}>{entry.icon}</span>
                    <span className="truncate">{entry.label}</span>
                  </button>
                )
              }
              const grp = entry as NavGroup
              const expanded = expandedGroups.has(grp.id)
              const hasActive = grp.children.some(c => c.base === segment)
              return (
                <div key={grp.id} className="mb-0.5">
                  <button
                    onClick={() => toggleGroup(grp.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors hover:bg-[#F8F9FA] ${
                      hasActive ? 'text-[#009574]' : 'text-[#9CA3AF] hover:text-[#333333]'
                    }`}
                  >
                    <span className={`flex-shrink-0 ${hasActive ? 'text-[#009574]' : 'text-[#9CA3AF]'}`}>{grp.icon}</span>
                    <span className="flex-1 text-left truncate">{grp.label}</span>
                    <ChevronDown size={13} className={`flex-shrink-0 transition-transform duration-150 ${expanded ? '' : '-rotate-90'}`} />
                  </button>
                  {expanded && (
                    <div className="mt-0.5 space-y-0.5">
                      {grp.children.map(child => {
                        const isActive = child.base === segment
                        return (
                          <button
                            key={child.base}
                            onClick={() => goTo(child.path)}
                            className={`w-full flex items-center gap-3 pl-7 pr-2.5 py-2 rounded-md text-[13px] font-medium transition-colors ${
                              isActive ? 'bg-[#e6f5f1] text-[#009574]' : 'text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#333333]'
                            }`}
                          >
                            <span className={`flex-shrink-0 ${isActive ? 'text-[#009574]' : ''}`}>{child.icon}</span>
                            <span className="truncate">{child.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2 border-t border-[#E5E7EB]">
          <button
            onClick={onToggle}
            onMouseEnter={e => {
              if (!collapsed) return
              const el = e.currentTarget
              hideTooltip()
              tooltipTimer.current = window.setTimeout(() => showTooltip('Expandir', el), 150)
            }}
            onMouseLeave={hideTooltip}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#333333] transition-colors text-[13px] ${collapsed ? 'justify-center' : ''}`}
          >
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span className="font-medium">Contraer</span></>}
          </button>
        </div>
      </aside>

      {/* Tooltip overlay for the collapsed sidebar (portaled to <body>) */}
      {collapsed && tooltip && createPortal(
        <div
          className="fixed z-[60] px-2 py-1 bg-white text-[#333333] text-[11px] rounded border border-[#E5E7EB] whitespace-nowrap pointer-events-none shadow-lg"
          style={{ left: tooltip.rect.right + 8, top: tooltip.rect.top + tooltip.rect.height / 2, transform: 'translateY(-50%)' }}
        >
          {tooltip.label}
        </div>,
        document.body,
      )}

      {/* ── Mobile drawer (< md) ──────────────────────────────────────────────── */}
      {/* Semi-transparent backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onMobileClose}
      />
      {/* Full-screen panel */}
      <div
        className={`md:hidden fixed inset-0 z-50 bg-white flex flex-col transition-transform duration-200 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-[#E5E7EB] flex-shrink-0">
          <span className="font-semibold text-[15px] text-[#333333] tracking-tight">
            SISA <span className="text-xs font-normal text-[#6B7280] ml-1">v2</span>
          </span>
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-md text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#333333] transition-colors"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        {/* User info */}
        <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#F8F9FA] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#009574] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">MG</div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#333333] truncate">{user?.name ?? 'Usuario'}</p>
              <p className="text-[12px] text-[#6B7280]">{role ? ROLE_LABELS[role] : 'Sin rol'}</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {visibleEntries.map(entry => {
            if (!isGroup(entry)) {
              const leaf = entry as NavLeaf
              const isActive = leaf.base === segment
              return (
                <button
                  key={leaf.base}
                  onClick={() => goTo(leaf.path)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[14px] font-medium transition-colors mb-1 ${
                    isActive ? 'bg-[#e6f5f1] text-[#009574]' : 'text-[#333333] hover:bg-[#F8F9FA]'
                  }`}
                >
                  <span className={`flex-shrink-0 ${isActive ? 'text-[#009574]' : 'text-[#6B7280]'}`}>{leaf.icon}</span>
                  {leaf.label}
                </button>
              )
            }
            const grp = entry as NavGroup
            const expanded = expandedGroups.has(grp.id)
            const hasActive = grp.children.some(c => c.base === segment)
            return (
              <div key={grp.id} className="mb-2">
                <button
                  onClick={() => toggleGroup(grp.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
                    hasActive ? 'text-[#009574] bg-[#f0faf7]' : 'text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#333333]'
                  }`}
                >
                  <span className={`flex-shrink-0 ${hasActive ? 'text-[#009574]' : ''}`}>{grp.icon}</span>
                  <span className="flex-1 text-left">{grp.label}</span>
                  <ChevronDown size={16} className={`flex-shrink-0 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
                </button>
                {expanded && (
                  <div className="mt-1 ml-6 pl-3 border-l-2 border-[#E5E7EB] space-y-0.5">
                    {grp.children.map(child => {
                      const isActive = child.base === segment
                      return (
                        <button
                          key={child.base}
                          onClick={() => goTo(child.path)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors ${
                            isActive ? 'text-[#009574] bg-[#e6f5f1]' : 'text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#333333]'
                          }`}
                        >
                          <span className={`flex-shrink-0 ${isActive ? 'text-[#009574]' : ''}`}>{child.icon}</span>
                          {child.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Bottom: role switcher (mock) + actions */}
        <div className="border-t border-[#E5E7EB] px-3 py-3 space-y-1 flex-shrink-0">
          {!isRealSession && (
            <div className="mb-3">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider px-3 mb-1.5">Cambiar rol</p>
              <div className="space-y-0.5">
                {availableRoles.map(r => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-colors ${
                      role === r ? 'text-[#009574] font-semibold bg-[#e6f5f1]' : 'text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#333333]'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${role === r ? 'bg-[#009574]' : 'bg-[#E5E7EB]'}`} />
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
              <div className="h-px bg-[#E5E7EB] mt-3" />
            </div>
          )}
          <button
            onClick={() => { navigate('/usuarios/cambiar-password'); onMobileClose() }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[14px] font-medium text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#333333] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Cambiar contraseña
          </button>
          <button
            onClick={handleMobileLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[14px] font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={16} className="flex-shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </>
  )
}