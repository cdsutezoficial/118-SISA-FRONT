import { useState } from 'react'
import { NavState } from './shared/types'
import { Shell } from './shared/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DivisionesList from './pages/DivisionesList'
import DivisionesForm from './pages/DivisionesForm'
import ProgramasList from './pages/ProgramasList'
import ProgramasForm from './pages/ProgramasForm'
import PeriodosList from './pages/PeriodosList'
import PeriodosForm from './pages/PeriodosForm'
import GruposList from './pages/GruposList'
import GruposForm from './pages/GruposForm'
import MateriasList from './pages/MateriasList'
import MateriasForm from './pages/MateriasForm'
import ConceptosList from './pages/ConceptosList'
import ConceptosForm from './pages/ConceptosForm'
import PlanesList from './pages/PlanesList'
import PlanForm from './pages/PlanForm'
import PlanDetalle from './pages/PlanDetalle'
import EscalasList from './pages/EscalasList'
import EscalaForm from './pages/EscalaForm'
import AsignarMateria from './pages/AsignarMateria'
import UsuariosList from './pages/UsuariosList'
import UsuariosForm from './pages/UsuariosForm'
import UsuarioDetalle from './pages/UsuarioDetalle'
import CambiarPassword from './pages/CambiarPassword'
import ResetPassword from './pages/ResetPassword'
import ResetConfirm from './pages/ResetConfirm'
import AsignarRol from './pages/AsignarRol'

export default function App() {
  const [nav, setNav] = useState<NavState>({ page: 'login' })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  function navigate(next: NavState) {
    setNav(next)
    window.scrollTo(0, 0)
  }

  // Unauthenticated pages render outside the Shell — no navbar/sidebar
  if (nav.page === 'login') return <Login navigate={navigate} />
  if (nav.page === 'reset-password') return <ResetPassword navigate={navigate} />
  if (nav.page === 'reset-confirm') return <ResetConfirm navigate={navigate} tokenExpired={mode === 'view'} />

  const mode = nav.mode ?? 'register'
  const pendingToast = nav.pendingToast

  function renderPage() {
    switch (nav.page) {
      case 'dashboard':
        return <Dashboard navigate={navigate} pendingToast={pendingToast} />
      case 'divisiones-list':
        return <DivisionesList navigate={navigate} pendingToast={pendingToast} />
      case 'division-form':
        return <DivisionesForm navigate={navigate} mode={mode} />
      case 'programas-list':
        return <ProgramasList navigate={navigate} pendingToast={pendingToast} />
      case 'programa-form':
        return <ProgramasForm navigate={navigate} mode={mode} />
      case 'periodos-list':
        return <PeriodosList navigate={navigate} pendingToast={pendingToast} />
      case 'periodo-form':
        return <PeriodosForm navigate={navigate} mode={mode} />
      case 'grupos-list':
        return <GruposList navigate={navigate} pendingToast={pendingToast} />
      case 'grupo-form':
        return <GruposForm navigate={navigate} mode={mode} />
      case 'materias-list':
        return <MateriasList navigate={navigate} pendingToast={pendingToast} />
      case 'materia-form':
        return <MateriasForm navigate={navigate} mode={mode} />
      case 'conceptos-list':
        return <ConceptosList navigate={navigate} pendingToast={pendingToast} />
      case 'concepto-form':
        return <ConceptosForm navigate={navigate} mode={mode} />
      case 'planes-list':
        return <PlanesList navigate={navigate} pendingToast={pendingToast} />
      case 'plan-form':
        return <PlanForm navigate={navigate} mode={mode} />
      case 'plan-detalle':
        return <PlanDetalle navigate={navigate} pendingToast={pendingToast} />
      case 'escalas-list':
        return <EscalasList navigate={navigate} pendingToast={pendingToast} />
      case 'escala-form':
        return <EscalaForm navigate={navigate} mode={mode} />
      case 'asignar-materia':
        return <AsignarMateria navigate={navigate} />
      case 'usuarios-list':
        return <UsuariosList navigate={navigate} pendingToast={pendingToast} />
      case 'usuario-form':
        return <UsuariosForm navigate={navigate} mode={mode} />
      case 'usuario-detalle':
        return <UsuarioDetalle navigate={navigate} pendingToast={pendingToast} />
      case 'asignar-rol':
        return <AsignarRol navigate={navigate} />
      case 'cambiar-password':
        return <CambiarPassword navigate={navigate} firstAccess={mode === 'view'} />
      default:
        return <Dashboard navigate={navigate} />
    }
  }

  return (
    <Shell
      currentPage={nav.page}
      navigate={navigate}
      collapsed={sidebarCollapsed}
      onToggleSidebar={() => setSidebarCollapsed(c => !c)}
    >
      <div className="max-w-none">
        {renderPage()}
      </div>
    </Shell>
  )
}
