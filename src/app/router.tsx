import { createBrowserRouter, Navigate } from 'react-router'
import AuthLayout from './layouts/AuthLayout'
import AppLayout from './layouts/AppLayout'

// Auth pages
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import ResetConfirm from './pages/ResetConfirm'

// Authenticated pages
import Dashboard from './pages/Dashboard'

// Divisiones
import DivisionesList from './pages/DivisionesList'
import DivisionesForm from './pages/DivisionesForm'

// Programas
import ProgramasList from './pages/ProgramasList'
import ProgramasForm from './pages/ProgramasForm'

// Materias
import MateriasList from './pages/MateriasList'
import MateriasForm from './pages/MateriasForm'

// Periodos
import PeriodosList from './pages/PeriodosList'
import PeriodosForm from './pages/PeriodosForm'

// Grupos
import GruposList from './pages/GruposList'
import GruposForm from './pages/GruposForm'

// Conceptos
import ConceptosList from './pages/ConceptosList'
import ConceptosForm from './pages/ConceptosForm'

// Planes
import PlanesList from './pages/PlanesList'
import PlanForm from './pages/PlanForm'
import PlanDetalle from './pages/PlanDetalle'
import AsignarMateria from './pages/AsignarMateria'

// Escalas
import EscalasList from './pages/EscalasList'
import EscalaForm from './pages/EscalaForm'

// Usuarios
import UsuariosList from './pages/UsuariosList'
import UsuariosForm from './pages/UsuariosForm'
import UsuarioDetalle from './pages/UsuarioDetalle'
import AsignarRol from './pages/AsignarRol'
import CambiarPassword from './pages/CambiarPassword'

const router = createBrowserRouter([
  // Root redirect — goes to /login (no auth guard yet)
  { path: '/', element: <Navigate to="/login" replace /> },

  // ─── Bare layout (no Sidebar / Navbar) ──────────────────────────────────────
  {
    element: <AuthLayout />,
    children: [
      { path: 'login', element: <Login /> },
      { path: 'reset-password', element: <ResetPassword /> },
      // ?expired=true is an optional query param, not a separate route
      { path: 'reset-confirm', element: <ResetConfirm /> },

      // Portal — public candidate-facing routes (anonymous + CANDIDATO tiers).
      // Stubs only: screens 4/13/16/17 land in later Admisión work units and
      // will dual-mount screens 4 & 13 here from `pages/admision/*`.
      {
        path: 'portal',
        children: [
          // TODO(admision-module 2.5): <CandidatoRegistro origin="public" />
          { path: 'registro', element: <div className="p-6 text-sm text-[#6B7280]">Portal — Registro (próximamente)</div> },
          // TODO(admision-module 2.6): <FichaConfirmacion origin="public" />
          { path: 'registro/ficha', element: <div className="p-6 text-sm text-[#6B7280]">Portal — Ficha de Confirmación (próximamente)</div> },
          // TODO(admision-module 2.16): <PortalInduccion />
          { path: 'induccion', element: <div className="p-6 text-sm text-[#6B7280]">Portal — Acceso a Inducción (próximamente)</div> },
          // TODO(admision-module 2.17): <PortalInduccionPago />
          { path: 'induccion/pago', element: <div className="p-6 text-sm text-[#6B7280]">Portal — Pago de Inducción (próximamente)</div> },
        ],
      },
    ],
  },

  // ─── Shell layout (Navbar + Sidebar) ────────────────────────────────────────
  {
    element: <AppLayout />,
    children: [
      { path: 'dashboard', element: <Dashboard /> },

      // Admisión — stub only: Screen 1 Dashboard lands in a later work unit.
      {
        path: 'admision',
        children: [
          // TODO(admision-module 2.1): replace with <AdmisionDashboard />
          { index: true, element: <div className="p-6 text-sm text-[#6B7280]">Admisión — Dashboard (próximamente)</div> },
        ],
      },

      // Divisiones
      { path: 'divisiones',      element: <DivisionesList /> },
      { path: 'divisiones/new',  element: <DivisionesForm /> },
      { path: 'divisiones/form', element: <DivisionesForm /> },

      // Programas
      { path: 'programas',      element: <ProgramasList /> },
      { path: 'programas/new',  element: <ProgramasForm /> },
      { path: 'programas/form', element: <ProgramasForm /> },

      // Materias
      { path: 'materias',      element: <MateriasList /> },
      { path: 'materias/new',  element: <MateriasForm /> },
      { path: 'materias/form', element: <MateriasForm /> },

      // Periodos
      { path: 'periodos',      element: <PeriodosList /> },
      { path: 'periodos/new',  element: <PeriodosForm /> },
      { path: 'periodos/form', element: <PeriodosForm /> },

      // Grupos
      { path: 'grupos',      element: <GruposList /> },
      { path: 'grupos/new',  element: <GruposForm /> },
      { path: 'grupos/form', element: <GruposForm /> },

      // Conceptos
      { path: 'conceptos',      element: <ConceptosList /> },
      { path: 'conceptos/new',  element: <ConceptosForm /> },
      { path: 'conceptos/form', element: <ConceptosForm /> },

      // Planes (includes extras: detalle + asignar-materia)
      { path: 'planes',                element: <PlanesList /> },
      { path: 'planes/new',            element: <PlanForm /> },
      { path: 'planes/form',           element: <PlanForm /> },
      { path: 'planes/detalle',        element: <PlanDetalle /> },
      { path: 'planes/asignar-materia', element: <AsignarMateria /> },

      // Escalas
      { path: 'escalas',      element: <EscalasList /> },
      { path: 'escalas/new',  element: <EscalaForm /> },
      { path: 'escalas/form', element: <EscalaForm /> },

      // Usuarios (includes extras: detalle + asignar-rol + cambiar-password)
      { path: 'usuarios',                    element: <UsuariosList /> },
      { path: 'usuarios/new',                element: <UsuariosForm /> },
      { path: 'usuarios/form',               element: <UsuariosForm /> },
      { path: 'usuarios/detalle',            element: <UsuarioDetalle /> },
      { path: 'usuarios/asignar-rol',        element: <AsignarRol /> },
      { path: 'usuarios/cambiar-password',   element: <CambiarPassword /> },
    ],
  },
])

export default router
