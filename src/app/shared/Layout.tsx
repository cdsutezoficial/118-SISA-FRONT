import { useState } from 'react'
import {
  LayoutDashboard, Building2, GraduationCap, BookOpen, BookMarked,
  CalendarRange, Users, CreditCard, ClipboardList,
  ChevronLeft, ChevronRight, HelpCircle, LogOut, UserCog, ChevronDown,
} from 'lucide-react'
import type { PageId, NavigateFn } from './types'

// ─── Sidebar active item mapping ──────────────────────────────────────────────
function activeLabel(page: PageId): string {
  if (page === 'dashboard') return 'Dashboard'
  if (page.startsWith('divisiones') || page === 'division-form') return 'Divisiones Académicas'
  if (page.startsWith('programas') || page === 'programa-form') return 'Programas Educativos'
  if (page === 'planes-list' || page === 'plan-form' || page === 'plan-detalle' || page === 'escalas-list' || page === 'escala-form' || page === 'asignar-materia') return 'Planes de Estudio'
  if (page.startsWith('materias') || page === 'materia-form') return 'Materias'
  if (page.startsWith('periodos') || page === 'periodo-form') return 'Periodos Académicos'
  if (page.startsWith('grupos') || page === 'grupo-form') return 'Grupos'
  if (page.startsWith('conceptos') || page === 'concepto-form') return 'Conceptos de Pago'
  return ''   // no active item for pages outside Configuración Académica
}

const NAV_ITEMS = [
  { icon: <LayoutDashboard size={18} />, label: 'Dashboard', page: 'dashboard' as PageId },
  { icon: <Building2 size={18} />, label: 'Divisiones Académicas', page: 'divisiones-list' as PageId },
  { icon: <GraduationCap size={18} />, label: 'Programas Educativos', page: 'programas-list' as PageId },
  { icon: <BookOpen size={18} />, label: 'Planes de Estudio', page: 'planes-list' as PageId },
  { icon: <BookMarked size={18} />, label: 'Materias', page: 'materias-list' as PageId },
  { icon: <CalendarRange size={18} />, label: 'Periodos Académicos', page: 'periodos-list' as PageId },
  { icon: <Users size={18} />, label: 'Grupos', page: 'grupos-list' as PageId },
  { icon: <CreditCard size={18} />, label: 'Conceptos de Pago', page: 'conceptos-list' as PageId },
  { icon: <ClipboardList size={18} />, label: 'Escalas de Calificación', page: 'escalas-list' as PageId },
]

function Navbar({ onRoleMenuToggle, roleMenuOpen, navigate }: {
  onRoleMenuToggle: () => void; roleMenuOpen: boolean; navigate: NavigateFn
}) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-[#E5E7EB] flex items-center px-6 justify-between">
      <span className="font-semibold text-[15px] text-[#333333] tracking-tight">
        SISA <span className="ml-1 text-xs font-normal text-[#6B7280]">Sistema Integral de Servicios Académicos</span>
      </span>
      <div className="flex items-center gap-2">
        <div className="relative">
          <button onClick={onRoleMenuToggle} className="flex items-center gap-2 text-sm text-[#333333] px-3 py-1.5 rounded-md hover:bg-[#F8F9FA] border border-[#E5E7EB] transition-colors">
            <UserCog size={15} className="text-[#6B7280]" /><span className="font-medium">Administrador</span><ChevronDown size={14} className="text-[#6B7280]" />
          </button>
          {roleMenuOpen && (
            <div className="absolute right-0 top-9 w-52 bg-white border border-[#E5E7EB] rounded-lg shadow-lg py-1 z-50">
              <div className="px-4 py-2.5 border-b border-[#E5E7EB]">
                <p className="text-[12px] font-semibold text-[#333333]">María González</p>
                <p className="text-[11px] text-[#6B7280]">admin@utez.edu.mx</p>
              </div>
              <button className="w-full text-left px-4 py-2 text-sm text-[#009574] font-medium bg-[#e6f5f1]">Administrador</button>
              <button className="w-full text-left px-4 py-2 text-sm text-[#333333] hover:bg-[#F8F9FA]">Gestor Académico</button>
              <div className="h-px bg-[#E5E7EB] my-1" />
              <button
                onClick={() => navigate({ page: 'cambiar-password' })}
                className="w-full text-left px-4 py-2 text-sm text-[#333333] hover:bg-[#F8F9FA] flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#6B7280]"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Cambiar contraseña
              </button>
            </div>
          )}
        </div>
        <button className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#333333] px-2 py-1.5 rounded-md hover:bg-[#F8F9FA] transition-colors">
          <HelpCircle size={16} /><span className="hidden sm:inline">Manual</span>
        </button>
        <button
          onClick={() => navigate({ page: 'login' })}
          className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-red-600 px-2 py-1.5 rounded-md hover:bg-red-50 transition-colors">
          <LogOut size={16} /><span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      </div>
    </header>
  )
}

function Sidebar({ collapsed, onToggle, currentPage, navigate }: {
  collapsed: boolean
  onToggle: () => void
  currentPage: PageId
  navigate: NavigateFn
}) {
  const active = activeLabel(currentPage)
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
        {NAV_ITEMS.map(item => {
          const isActive = item.label === active
          return (
            <div key={item.label} className="relative group">
              <button
                onClick={() => navigate({ page: item.page })}
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
          {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span className="font-medium">Contraer</span></>}
        </button>
      </div>
    </aside>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────
/**
 * @deprecated Shell and its sub-components (Navbar, Sidebar) are superseded by
 * `src/app/layouts/AppLayout.tsx`. No page currently imports from this file.
 * Will be removed in the cleanup slice (T23) once all module pages are migrated.
 */
export function Shell({ children, currentPage, navigate, collapsed, onToggleSidebar }: {
  children: React.ReactNode
  currentPage: PageId
  navigate: NavigateFn
  collapsed: boolean
  onToggleSidebar: () => void
}) {
  const [roleMenuOpen, setRoleMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-['Inter',sans-serif] flex flex-col">
      <Navbar onRoleMenuToggle={() => setRoleMenuOpen(o => !o)} roleMenuOpen={roleMenuOpen} navigate={navigate} />
      <div className="flex flex-1 pt-14">
        <Sidebar collapsed={collapsed} onToggle={onToggleSidebar} currentPage={currentPage} navigate={navigate} />
        <main className={`flex-1 transition-all duration-200 ${collapsed ? 'ml-[60px]' : 'ml-[240px]'}`}>
          {children}
        </main>
      </div>
      {roleMenuOpen && <div className="fixed inset-0 z-30" onClick={() => setRoleMenuOpen(false)} />}
    </div>
  )
}
