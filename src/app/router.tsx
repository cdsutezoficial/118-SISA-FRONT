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

// NOTE: Page components still carry their old prop signatures in this PR.
// TypeScript will report "missing required props" errors on each element below.
// That is EXPECTED — props are removed module-by-module in PR 2+.
// Vite/esbuild does not type-check at build time, so the dev server and build
// will succeed. IDE type errors here are transient and will go away in PR 2+.

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
    ],
  },

  // ─── Shell layout (Navbar + Sidebar) ────────────────────────────────────────
  {
    element: <AppLayout />,
    children: [
      { path: 'dashboard', element: <Dashboard /> },

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
