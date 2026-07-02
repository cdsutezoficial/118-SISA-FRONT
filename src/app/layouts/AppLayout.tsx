import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router'
import {
  LayoutDashboard, Building2, GraduationCap, BookOpen, BookMarked,
  CalendarRange, Users, CreditCard, ClipboardList, IdCard, UserPlus,
  ChevronLeft, ChevronRight, HelpCircle, LogOut, UserCog, ChevronDown,
} from 'lucide-react'
import { useRole } from '../shared/RoleContext'
import type { Role } from '../shared/RoleContext'

// Existing modules 01/02 stay visible to every staff role — no regression to
// current navigation when the new Admisión roles are the active role.
const STAFF_ROLES: Role[] = [
  'ADMINISTRADOR', 'GESTOR_ACADEMICO', 'SERVICIOS_ESCOLARES', 'FINANZAS', 'DIRECTOR_DIVISION',
]

const ROLE_LABELS: Record<Role, string> = {
  ADMINISTRADOR: 'Administrador',
  GESTOR_ACADEMICO: 'Gestor Académico',
  SERVICIOS_ESCOLARES: 'Servicios Escolares',
  FINANZAS: 'Finanzas',
  DIRECTOR_DIVISION: 'Director de División',
  CANDIDATO: 'Candidato',
}

// ─── Nav items — same modules as current Layout.tsx, plus Admisión ────────────
// Each item carries its URL segment (`base`), full path (`path`), and the
// roles allowed to see it. The active sidebar item is determined by matching
// `pathname.split('/')[1]` against `base` — no PageId lookup needed.
const NAV_ITEMS = [
  { icon: <LayoutDashboard size={18} />, label: 'Dashboard',                base: 'dashboard', path: '/dashboard', roles: STAFF_ROLES },
  { icon: <Building2 size={18} />,       label: 'Divisiones Académicas',    base: 'divisiones', path: '/divisiones', roles: STAFF_ROLES },
  { icon: <GraduationCap size={18} />,   label: 'Programas Educativos',     base: 'programas', path: '/programas', roles: STAFF_ROLES },
  { icon: <BookOpen size={18} />,        label: 'Planes de Estudio',        base: 'planes', path: '/planes', roles: STAFF_ROLES },
  { icon: <BookMarked size={18} />,      label: 'Materias',                 base: 'materias', path: '/materias', roles: STAFF_ROLES },
  { icon: <CalendarRange size={18} />,   label: 'Periodos Académicos',      base: 'periodos', path: '/periodos', roles: STAFF_ROLES },
  { icon: <Users size={18} />,           label: 'Grupos',                   base: 'grupos', path: '/grupos', roles: STAFF_ROLES },
  { icon: <CreditCard size={18} />,      label: 'Conceptos de Pago',        base: 'conceptos', path: '/conceptos', roles: STAFF_ROLES },
  { icon: <ClipboardList size={18} />,   label: 'Escalas de Calificación',  base: 'escalas', path: '/escalas', roles: STAFF_ROLES },
  { icon: <IdCard size={18} />,          label: 'Usuarios',                 base: 'usuarios', path: '/usuarios', roles: STAFF_ROLES },
  {
    icon: <UserPlus size={18} />, label: 'Admisión', base: 'admision', path: '/admision',
    roles: ['SERVICIOS_ESCOLARES', 'FINANZAS', 'DIRECTOR_DIVISION'] as Role[],
  },
]

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar({ onRoleMenuToggle, roleMenuOpen }: {
  onRoleMenuToggle: () => void
  roleMenuOpen: boolean
}) {
  const navigate = useNavigate()
  const { role, setRole, availableRoles, user } = useRole()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-[#E5E7EB] flex items-center px-6 justify-between">
      <span className="font-semibold text-[15px] text-[#333333] tracking-tight">
        SISA <span className="ml-1 text-xs font-normal text-[#6B7280]">Sistema Integral de Servicios Académicos</span>
      </span>
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={onRoleMenuToggle}
            className="flex items-center gap-2 text-sm text-[#333333] px-3 py-1.5 rounded-md hover:bg-[#F8F9FA] border border-[#E5E7EB] transition-colors"
          >
            <UserCog size={15} className="text-[#6B7280]" />
            <span className="font-medium">{role ? ROLE_LABELS[role] : 'Seleccionar rol'}</span>
            <ChevronDown size={14} className="text-[#6B7280]" />
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
          onClick={() => navigate('/login')}
          className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-red-600 px-2 py-1.5 rounded-md hover:bg-red-50 transition-colors"
        >
          <LogOut size={16} /><span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      </div>
    </header>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { role } = useRole()
  // Match the first path segment (e.g. 'divisiones' for '/divisiones/form')
  const segment = pathname.split('/')[1] ?? ''
  // Sidebar only mounts inside the authed shell, so `role` is a staff role in
  // practice — the `null` guard is defensive (matches the anonymous tier).
  const visibleItems = NAV_ITEMS.filter(item => role !== null && item.roles.includes(role))

  return (
    <aside className={`fixed top-14 left-0 bottom-0 z-40 bg-white border-r border-[#E5E7EB] flex flex-col transition-all duration-200 ${collapsed ? 'w-[60px]' : 'w-[240px]'}`}>
      {!collapsed ? (
        <div className="px-4 py-4 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#009574] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">MG</div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#333333] truncate">María González</p>
              <p className="text-[11px] text-[#6B7280] truncate">Administrador</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-3 py-4 border-b border-[#E5E7EB] flex justify-center">
          <div className="w-9 h-9 rounded-full bg-[#009574] flex items-center justify-center text-white font-semibold text-xs">MG</div>
        </div>
      )}
      {!collapsed && (
        <div className="px-4 pt-4 pb-1">
          <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest">Configuración Académica</p>
        </div>
      )}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {visibleItems.map(item => {
          const isActive = item.base === segment
          return (
            <div key={item.label} className="relative group">
              <button
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors
                  ${isActive ? 'bg-[#e6f5f1] text-[#009574]' : 'text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#333333]'}
                  ${collapsed ? 'justify-center' : ''}`}
              >
                <span className={isActive ? 'text-[#009574]' : ''}>{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
              {collapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-[#333333] text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                  {item.label}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      <div className="p-2 border-t border-[#E5E7EB]">
        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#333333] transition-colors text-[13px] ${collapsed ? 'justify-center' : ''}`}
        >
          {collapsed
            ? <ChevronRight size={16} />
            : <><ChevronLeft size={16} /><span className="font-medium">Contraer</span></>}
        </button>
      </div>
    </aside>
  )
}

// ─── AppLayout ────────────────────────────────────────────────────────────────
export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [roleMenuOpen, setRoleMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-['Inter',sans-serif] flex flex-col">
      <Navbar
        onRoleMenuToggle={() => setRoleMenuOpen(o => !o)}
        roleMenuOpen={roleMenuOpen}
      />
      <div className="flex flex-1 pt-14">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(c => !c)}
        />
        <main className={`flex-1 transition-all duration-200 ${sidebarCollapsed ? 'ml-[60px]' : 'ml-[240px]'}`}>
          <div className="max-w-none">
            <Outlet />
          </div>
        </main>
      </div>
      {roleMenuOpen && <div className="fixed inset-0 z-30" onClick={() => setRoleMenuOpen(false)} />}
    </div>
  )
}
