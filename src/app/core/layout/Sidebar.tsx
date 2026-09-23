import { useState, useEffect, type ReactElement, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router'
import {
  LayoutDashboard, Building2, GraduationCap, BookOpen,
  CalendarRange, Users, CreditCard, IdCard, UserPlus,
  ClipboardCheck, ChevronLeft, ChevronRight, ChevronDown,
  LogOut, UserCog, X, Settings, Tags, Users2, Ticket,
  Megaphone, BadgePercent, Unlock, RotateCcw, FileText, Archive, ShieldCheck,
} from 'lucide-react'
import { useRole } from '../infra/RoleContext'
import type { Role } from '../infra/RoleContext'
import {
  ACADEMIC_CONFIG_ROLES,
  ADMINISTRATION_ROLES,
  ADMISSION_ROLES,
  ENROLLMENT_ROLES,
  ROLE_LABELS,
} from './layoutRoles'

// ─── Nav model ────────────────────────────────────────────────────────────────
// NavLeaf (navigable item) and NavGroup (collapsible section). Groups nest
// recursively — Módulos holds Admisión/Inscripciones sub-groups — so consume
// trees recursively. Activation is path-based: the deepest visible leaf whose
// path prefixes `pathname` wins.

export interface NavLeaf {
  icon: ReactElement
  label: string
  base: string
  path: string
  roles: Role[]
  permissionKeys?: string[]
}

export interface NavGroup {
  id: string
  icon: ReactElement
  label: string
  children: NavEntry[]
}

export type NavEntry = NavLeaf | NavGroup

function isGroup(e: NavEntry): e is NavGroup {
  return 'children' in e
}

/** System-wide navigation tree — any module/shell can render its own subset. */
export const SYSTEM_NAV: NavEntry[] = [
  {
    id: 'config', icon: <Settings size={18} />, label: 'Configuración Académica',
    children: [
      { icon: <LayoutDashboard size={18} />, label: 'Dashboard', base: 'dashboard', path: '/dashboard', roles: ACADEMIC_CONFIG_ROLES },
      { icon: <Building2 size={18} />,     label: 'Divisiones Académicas',   base: 'divisiones', path: '/divisiones', roles: ACADEMIC_CONFIG_ROLES, permissionKeys: ['DIVISIONS_READ'] },
      { icon: <GraduationCap size={18} />, label: 'Programas Educativos',    base: 'programas',  path: '/programas',  roles: ACADEMIC_CONFIG_ROLES, permissionKeys: ['PROGRAMS_READ'] },
      { icon: <BookOpen size={18} />,      label: 'Planes de Estudio',       base: 'planes',     path: '/planes',     roles: ACADEMIC_CONFIG_ROLES, permissionKeys: ['PLANS_READ'] },
      { icon: <Tags size={18} />,          label: 'Clasificaciones de Materias', base: 'clasificaciones', path: '/clasificaciones', roles: ACADEMIC_CONFIG_ROLES, permissionKeys: ['SUBJECT_CLASSIFICATIONS_READ'] },
      { icon: <CalendarRange size={18} />, label: 'Periodos Académicos',     base: 'periodos',   path: '/periodos',   roles: ACADEMIC_CONFIG_ROLES, permissionKeys: ['PERIODS_READ'] },
      { icon: <Users2 size={18} />,        label: 'Generaciones',            base: 'generaciones', path: '/generaciones', roles: ACADEMIC_CONFIG_ROLES, permissionKeys: ['GENERATIONS_READ'] },
      { icon: <Users size={18} />,         label: 'Grupos',                  base: 'grupos',     path: '/grupos',     roles: ACADEMIC_CONFIG_ROLES, permissionKeys: ['GROUPS_READ'] },
      { icon: <Ticket size={18} />,        label: 'Configuración de Admisión', base: 'configuracion-admision', path: '/configuracion-admision', roles: ACADEMIC_CONFIG_ROLES, permissionKeys: ['PROGRAM_ADMISSION_CONFIGS_READ'] },
      { icon: <Building2 size={18} />,     label: 'Áreas de Facturación',     base: 'areas',      path: '/areas',      roles: ACADEMIC_CONFIG_ROLES, permissionKeys: ['PAYMENT_AREAS_READ'] },
      { icon: <CreditCard size={18} />,    label: 'Conceptos de Pago',       base: 'conceptos',  path: '/conceptos',  roles: ACADEMIC_CONFIG_ROLES, permissionKeys: ['PAYMENT_CONCEPTS_READ'] },
    ],
  },
  {
    id: 'admin', icon: <UserCog size={18} />, label: 'Administración',
    children: [
      { icon: <IdCard size={18} />, label: 'Usuarios', base: 'usuarios', path: '/usuarios', roles: ADMINISTRATION_ROLES, permissionKeys: ['USERS_READ'] },
      { icon: <ShieldCheck size={18} />, label: 'Roles y Permisos', base: 'roles', path: '/roles', roles: ADMINISTRATION_ROLES, permissionKeys: ['ROLES_READ'] },
    ],
  },
  {
    id: 'admision', icon: <UserPlus size={18} />, label: 'Admisión',
    children: [
      { icon: <LayoutDashboard size={16} />, label: 'Dashboard',              base: 'admision-dash',   path: '/admision',                  roles: ADMISSION_ROLES },
      { icon: <Megaphone size={16} />,        label: 'Canales de Difusión',   base: 'canales',          path: '/admision/canales',          roles: ['SERVICIOS_ESCOLARES'] },
      { icon: <GraduationCap size={16} />,    label: 'Tipos de Bachillerato', base: 'tipos-bachillerato', path: '/admision/tipos-bachillerato', roles: ['SERVICIOS_ESCOLARES'] },
      { icon: <Users size={16} />,            label: 'Candidatos',            base: 'candidatos',       path: '/admision/candidatos',       roles: ['SERVICIOS_ESCOLARES'] },
      { icon: <UserPlus size={16} />,         label: 'Registrar Candidato',   base: 'candidato-registrar', path: '/admision/candidatos/registrar', roles: ['SERVICIOS_ESCOLARES'] },
      { icon: <ClipboardCheck size={16} />,   label: 'Selección de Candidatos', base: 'seleccion',     path: '/admision/seleccion',        roles: ['SERVICIOS_ESCOLARES', 'DIRECTOR_DIVISION'] },
      { icon: <IdCard size={16} />,           label: 'Generar Matrículas',    base: 'matriculas',       path: '/admision/matriculas',       roles: ['SERVICIOS_ESCOLARES'] },
      { icon: <Megaphone size={16} />,        label: 'Publicar Resultados',   base: 'publicar',         path: '/admision/publicar',         roles: ['SERVICIOS_ESCOLARES'] },
      { icon: <BadgePercent size={16} />,     label: 'Aplicar Descuentos',    base: 'descuentos',       path: '/admision/descuentos',       roles: ['SERVICIOS_ESCOLARES'] },
      { icon: <Unlock size={16} />,           label: 'Habilitar Inducción',   base: 'habilitacion',     path: '/admision/habilitacion',     roles: ['SERVICIOS_ESCOLARES'] },
    ],
  },
  {
    id: 'inscripciones', icon: <ClipboardCheck size={18} />, label: 'Inscripciones',
    children: [
      { icon: <LayoutDashboard size={16} />, label: 'Dashboard',                   base: 'inscripciones-dash', path: '/inscripciones',               roles: ENROLLMENT_ROLES },
      { icon: <Users size={16} />,            label: 'Estudiantes',                 base: 'estudiantes',        path: '/inscripciones/estudiantes',  roles: ENROLLMENT_ROLES },
      { icon: <UserPlus size={16} />,         label: 'Nuevo Ingreso',               base: 'nuevo-ingreso',      path: '/inscripciones/nuevo-ingreso', roles: ENROLLMENT_ROLES },
      { icon: <RotateCcw size={16} />,        label: 'Reinscripción',               base: 'reinscripcion',      path: '/inscripciones/reinscripcion', roles: ENROLLMENT_ROLES },
      { icon: <FileText size={16} />,         label: 'Documentos Institucionales',  base: 'documentos',         path: '/inscripciones/documentos',   roles: ENROLLMENT_ROLES },
      { icon: <Archive size={16} />,          label: 'Expediente',                  base: 'expediente',         path: '/inscripciones/expediente',   roles: ENROLLMENT_ROLES },
    ],
  },
]

/**
 * `ADMINISTRADOR` is a superuser for the per-entry ROLE allow-lists: it can
 * open any entry regardless of its `roles` array (backend grants ADMIN on all
 * endpoints, and `RequireRole` mirrors that). Permission gating, however,
 * applies to every role — including ADMIN (`RequirePermission` has no
 * superuser bypass). An entry whose `permissionKeys` the active role lacks is
 * hidden for everyone, so removing e.g. `DIVISIONS_READ` from ADMIN also
 * removes the item from its sidebar. See `RequireRole.tsx` / `RequirePermission.tsx`
 * for the parallel rules.
 */
function isSuperAdmin(role: Role | null): boolean {
  return role === 'ADMINISTRADOR'
}

/** True si `pathname` cae dentro del subárbol de `leaf` (ruta exacta o prefijo). */
function leafActive(leaf: NavLeaf, pathname: string): boolean {
  return pathname === leaf.path || pathname.startsWith(leaf.path + '/')
}

/** Ruta de la hoja visible más profunda que matchea `pathname`, o null. */
function deepestActiveLeaf(nav: NavEntry[], pathname: string): string | null {
  let best: string | null = null
  const walk = (entries: NavEntry[]) => {
    for (const e of entries) {
      if (isGroup(e)) walk(e.children)
      else if (leafActive(e, pathname) && (best === null || e.path.length > best.length)) best = e.path
    }
  }
  walk(nav)
  return best
}

/** True si algún leaf del subárbol es la hoja activa. */
function treeHasActive(nav: NavEntry[], active: string | null): boolean {
  for (const e of nav) {
    if (isGroup(e)) { if (treeHasActive(e.children, active)) return true }
    else if (e.path === active) return true
  }
  return false
}

/** True si `pathname` cae dentro de algún leaf del subárbol. */
function treeMatches(nav: NavEntry[], pathname: string): boolean {
  for (const e of nav) {
    if (isGroup(e)) { if (treeMatches(e.children, pathname)) return true }
    else if (leafActive(e, pathname)) return true
  }
  return false
}

/** Ids de los subgrupos (cadena de ancestros) que contienen la ruta activa. */
function ancestorGroups(nav: NavEntry[], pathname: string, out: Set<string>) {
  for (const e of nav) {
    if (!isGroup(e)) continue
    if (treeMatches(e.children, pathname)) {
      out.add(e.id)
      ancestorGroups(e.children, pathname, out)
    }
  }
}

/** Entries filtradas por rol/permisos (recursivo); los grupos sin hijos visibles se ocultan. */
function filterNavByRole(
  nav: NavEntry[],
  superAdmin: boolean,
  role: Role | null,
  hasAnyPermission: (permissionKeys: string[]) => boolean,
): NavEntry[] {
  const out: NavEntry[] = []
  for (const e of nav) {
    if (isGroup(e)) {
      const children = filterNavByRole(e.children, superAdmin, role, hasAnyPermission)
      if (children.length > 0) out.push({ ...e, children })
    } else if (
      role !== null &&
      (superAdmin || e.roles.includes(role)) &&
      (!e.permissionKeys || hasAnyPermission(e.permissionKeys))
    ) out.push(e)
  }
  return out
}

/** Hojas visibles aplanadas (sidebar colapsada — el árbol completo). */
function flattenedLeaves(nav: NavEntry[]): NavLeaf[] {
  const out: NavLeaf[] = []
  const walk = (entries: NavEntry[]) => {
    for (const e of entries) {
      if (isGroup(e)) walk(e.children)
      else out.push(e)
    }
  }
  walk(nav)
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
  const { role, setRole, availableRoles, user, authMode, logout, hasAnyPermission } = useRole()
  const isRealSession = authMode === 'real'

  // ─── Accordion state ───────────────────────────────────────────────────────
  // Default: 'config' group open + every group that contains the active route
  // (ancestor chain, so Módulos → Admisión auto-expands when inside /admision/…).
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const chain = new Set<string>(['config'])
    ancestorGroups(navigation, pathname, chain)
    return chain
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

  // Auto-expand the ancestor chain containing the active route on navigation.
  useEffect(() => {
    setExpandedGroups(prev => {
      const chain = new Set<string>()
      ancestorGroups(navigation, pathname, chain)
      let changed = false
      for (const id of chain) {
        if (!prev.has(id)) { changed = true; break }
      }
      return changed ? new Set([...prev, ...chain]) : prev
    })
  }, [navigation, pathname])

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

  // Role-filtered nav entries. Groups with no visible children (recursively)
  // are hidden. ADMINISTRADOR bypasses the per-entry ROLE allow-lists
  // (superuser) but still respects `permissionKeys` — an entry whose READ
  // permission was removed is hidden even for ADMIN. `activeLeaf` is the
  // deepest visible leaf matching `pathname`.
  const visibleEntries: NavEntry[] = role === null ? [] : filterNavByRole(navigation, isSuperAdmin(role), role, hasAnyPermission)
  const activeLeaf: string | null = deepestActiveLeaf(visibleEntries, pathname)

  // Recursive renderers. Depth drives indentation on the desktop sidebar; the
  // mobile drawer indents via the bordered child containers instead.
  const renderDesktop = (entries: NavEntry[], depth: number): ReactElement[] => entries.map(entry => {
    if (!isGroup(entry)) {
      const isActive = entry.path === activeLeaf
      const pad = depth === 0 ? 'px-2.5 py-2' : depth === 1 ? 'pl-7 pr-2.5 py-2' : 'pl-10 pr-2.5 py-2'
      return (
        <button
          key={entry.path}
          onClick={() => goTo(entry.path)}
          className={`w-full flex items-center gap-3 ${pad} rounded-md text-[13px] font-medium transition-colors ${
            isActive ? 'bg-[#e6f5f1] text-[#009574]' : 'text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#333333]'
          }`}
        >
          <span className={`flex-shrink-0 ${isActive ? 'text-[#009574]' : ''}`}>{entry.icon}</span>
          <span className="truncate">{entry.label}</span>
        </button>
      )
    }
    const expanded = expandedGroups.has(entry.id)
    const hasActive = treeHasActive(entry.children, activeLeaf)
    return (
      <div key={entry.id} className="mb-0.5">
        <button
          onClick={() => toggleGroup(entry.id)}
          className={`w-full flex items-center gap-2 ${depth === 0 ? 'px-2.5' : 'pl-7 pr-2.5'} py-2 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors hover:bg-[#F8F9FA] ${
            hasActive ? 'text-[#009574]' : 'text-[#9CA3AF] hover:text-[#333333]'
          }`}
        >
          <span className={`flex-shrink-0 ${hasActive ? 'text-[#009574]' : 'text-[#9CA3AF]'}`}>{entry.icon}</span>
          <span className="flex-1 text-left truncate">{entry.label}</span>
          <ChevronDown size={13} className={`flex-shrink-0 transition-transform duration-150 ${expanded ? '' : '-rotate-90'}`} />
        </button>
        {expanded && (
          <div className="mt-0.5 space-y-0.5">
            {renderDesktop(entry.children, depth + 1)}
          </div>
        )}
      </div>
    )
  })

  const renderMobile = (entries: NavEntry[], depth: number): ReactElement[] => entries.map(entry => {
    if (!isGroup(entry)) {
      const isActive = entry.path === activeLeaf
      return (
        <button
          key={entry.path}
          onClick={() => goTo(entry.path)}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[14px] font-medium transition-colors mb-1 ${
            isActive ? 'bg-[#e6f5f1] text-[#009574]' : 'text-[#333333] hover:bg-[#F8F9FA]'
          }`}
        >
          <span className={`flex-shrink-0 ${isActive ? 'text-[#009574]' : 'text-[#6B7280]'}`}>{entry.icon}</span>
          {entry.label}
        </button>
      )
    }
    const expanded = expandedGroups.has(entry.id)
    const hasActive = treeHasActive(entry.children, activeLeaf)
    return (
      <div key={entry.id} className="mb-2">
        <button
          onClick={() => toggleGroup(entry.id)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
            hasActive ? 'text-[#009574] bg-[#f0faf7]' : 'text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#333333]'
          }`}
        >
          <span className={`flex-shrink-0 ${hasActive ? 'text-[#009574]' : ''}`}>{entry.icon}</span>
          <span className="flex-1 text-left">{entry.label}</span>
          <ChevronDown size={16} className={`flex-shrink-0 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
        </button>
        {expanded && (
          <div className="mt-1 ml-6 pl-3 border-l-2 border-[#E5E7EB] space-y-0.5">
            {renderMobile(entry.children, depth + 1)}
          </div>
        )}
      </div>
    )
  })

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
        <nav className={`flex-1 py-2 px-2 space-y-0.5 overflow-y-auto ${collapsed ? 'overflow-x-hidden' : ''}`}>
          {collapsed ? (
            // Collapsed: flat icon list (whole tree flattened to leaves)
            flattenedLeaves(visibleEntries).map(item => {
              const isActive = item.path === activeLeaf
              return (
                <div key={item.path} className="relative group">
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
            // Expanded: accordion groups, rendered recursively
            renderDesktop(visibleEntries, 0)
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
          {renderMobile(visibleEntries, 0)}
        </nav>

        {/* Bottom: role switcher (when more than one selectable role — mock
            staff catalog or a real multi-role account) + actions */}
        <div className="border-t border-[#E5E7EB] px-3 py-3 space-y-1 flex-shrink-0">
          {availableRoles.length > 1 && (
            <div className="mb-3">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider px-3 mb-1.5">Cambiar rol</p>
              <div className="space-y-0.5">
                {availableRoles.map(r => (
                  <button
                    key={r}
                    onClick={() => { setRole(r); onMobileClose() }}
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