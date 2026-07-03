import { createBrowserRouter, Navigate } from 'react-router'
import AuthLayout from './layouts/AuthLayout'
import AppLayout from './layouts/AppLayout'
import { RequireRole } from './shared/RequireRole'

// Auth pages
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import ResetConfirm from './pages/ResetConfirm'

// Authenticated pages
import Dashboard from './pages/Dashboard'

// Admisión
import AdmisionDashboard from './pages/admision/AdmisionDashboard'
import CanalesDifusion from './pages/admision/CanalesDifusion'
import CandidatosList from './pages/admision/CandidatosList'
import CandidatoDetalle from './pages/admision/CandidatoDetalle'
import CandidatoRegistro from './pages/admision/CandidatoRegistro'
import FichaConfirmacion from './pages/admision/FichaConfirmacion'
import ConfirmarPagoFicha from './pages/admision/ConfirmarPagoFicha'
import ConfirmarPagoInduccion from './pages/admision/ConfirmarPagoInduccion'
import RegistroInduccion from './pages/admision/RegistroInduccion'
import RegistroExamen from './pages/admision/RegistroExamen'
import SeleccionCandidatos from './pages/admision/SeleccionCandidatos'
import GenerarMatriculas from './pages/admision/GenerarMatriculas'
import PublicarResultados from './pages/admision/PublicarResultados'
import AplicarDescuento from './pages/admision/AplicarDescuento'
import HabilitarInduccion from './pages/admision/HabilitarInduccion'

// Portal (público — Screens 16/17)
import PortalInduccion from './pages/portal/PortalInduccion'
import PortalInduccionPago from './pages/portal/PortalInduccionPago'

// Inscripciones — Screens 1-4 are real; Screens 5-7 remain Foundation A
// stubs until their own `inscripciones/screen-0N-*` work units land.
import InscripcionesDashboard from './pages/inscripciones/InscripcionesDashboard'
import EstudiantesList from './pages/inscripciones/EstudiantesList'
import EstudianteDetalle from './pages/inscripciones/EstudianteDetalle'
import NuevoIngresoWizard from './pages/inscripciones/NuevoIngresoWizard'
import ReinscripcionWizard from './pages/inscripciones/ReinscripcionWizard'

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
      // Screens 4 & 13 are dual-mounted here from `pages/admision/*`; screens
      // 16/17 live in `pages/portal/*` (candidate-only, not dual-mounted).
      {
        path: 'portal',
        children: [
          { path: 'registro', element: <CandidatoRegistro origin="public" /> },
          { path: 'registro/ficha', element: <FichaConfirmacion origin="public" /> },
          { path: 'induccion', element: <PortalInduccion /> },
          { path: 'induccion/pago', element: <PortalInduccionPago /> },
        ],
      },
    ],
  },

  // ─── Shell layout (Navbar + Sidebar) ────────────────────────────────────────
  {
    element: <AppLayout />,
    children: [
      { path: 'dashboard', element: <Dashboard /> },

      // Admisión
      //
      // Role guard: every screen below is wrapped in `RequireRole` per the
      // "Rol activo en sidebar" annotations in `03-admision.md`. The index
      // route (`/admision`, the Dashboard) is the ONE deliberate exception —
      // it is NEVER wrapped. It's the guard's own redirect target, so
      // guarding it too (e.g. to SERVICIOS_ESCOLARES only) would send any
      // other role/tier (FINANZAS, DIRECTOR_DIVISION, ADMINISTRADOR,
      // GESTOR_ACADEMICO, or an anonymous/CANDIDATO session hitting a
      // mismatched URL) into an infinite redirect loop back onto itself.
      // The Dashboard's content is role-agnostic aggregate KPIs with no
      // sensitive per-role data, so leaving it unguarded is safe.
      {
        path: 'admision',
        children: [
          { index: true, element: <AdmisionDashboard /> },
          {
            path: 'canales',
            element: <RequireRole allowedRoles={['SERVICIOS_ESCOLARES']}><CanalesDifusion /></RequireRole>,
          },
          {
            path: 'candidatos',
            element: <RequireRole allowedRoles={['SERVICIOS_ESCOLARES']}><CandidatosList /></RequireRole>,
          },
          {
            path: 'candidatos/detalle',
            element: <RequireRole allowedRoles={['SERVICIOS_ESCOLARES']}><CandidatoDetalle /></RequireRole>,
          },
          {
            path: 'candidatos/registrar',
            element: <RequireRole allowedRoles={['SERVICIOS_ESCOLARES']}><CandidatoRegistro origin="staff" /></RequireRole>,
          },
          {
            path: 'candidatos/ficha',
            element: <RequireRole allowedRoles={['SERVICIOS_ESCOLARES']}><FichaConfirmacion origin="staff" /></RequireRole>,
          },
          {
            path: 'candidatos/pago-ficha',
            element: <RequireRole allowedRoles={['FINANZAS']}><ConfirmarPagoFicha /></RequireRole>,
          },
          {
            path: 'candidatos/pago-induccion',
            element: <RequireRole allowedRoles={['FINANZAS']}><ConfirmarPagoInduccion /></RequireRole>,
          },
          {
            path: 'candidatos/induccion',
            element: <RequireRole allowedRoles={['SERVICIOS_ESCOLARES']}><RegistroInduccion /></RequireRole>,
          },
          {
            path: 'candidatos/examen',
            element: <RequireRole allowedRoles={['SERVICIOS_ESCOLARES']}><RegistroExamen /></RequireRole>,
          },
          {
            path: 'seleccion',
            element: <RequireRole allowedRoles={['DIRECTOR_DIVISION']}><SeleccionCandidatos /></RequireRole>,
          },
          {
            path: 'matriculas',
            element: <RequireRole allowedRoles={['SERVICIOS_ESCOLARES']}><GenerarMatriculas /></RequireRole>,
          },
          {
            path: 'publicar',
            element: <RequireRole allowedRoles={['SERVICIOS_ESCOLARES']}><PublicarResultados /></RequireRole>,
          },
          {
            path: 'descuentos',
            element: <RequireRole allowedRoles={['SERVICIOS_ESCOLARES']}><AplicarDescuento /></RequireRole>,
          },
          {
            path: 'habilitacion',
            element: <RequireRole allowedRoles={['SERVICIOS_ESCOLARES']}><HabilitarInduccion /></RequireRole>,
          },
        ],
      },

      // Inscripciones
      //
      // Screens 1-5 (Dashboard, Estudiantes — Listado, Estudiante — Detalle,
      // Inscripción Nuevo Ingreso, Reinscripción) are real; Screens 6-7 remain
      // Foundation A stubs until their own `inscripciones/screen-0N-*` work
      // units land.
      //
      // Role guard: mirrors Admisión's rule — the index route (`/inscripciones`,
      // the Dashboard) is the ONE deliberate exception, NEVER wrapped in
      // `RequireRole`, because it's the guard's own redirect target (see
      // `RequireRole.tsx`). Its content is role-agnostic aggregate KPIs with no
      // sensitive per-role data, so leaving it unguarded is safe. Per-screen
      // roles below come from `figma/prompts/04-inscripciones.md`'s "Rol activo
      // en sidebar" annotations (Gestor Académico for Screens 2-5, Administrador
      // for Screen 6, Servicios Escolares for Screen 7) — NOT Servicios
      // Escolares for every screen.
      {
        path: 'inscripciones',
        children: [
          { index: true, element: <InscripcionesDashboard /> },
          {
            path: 'estudiantes',
            element: <RequireRole allowedRoles={['GESTOR_ACADEMICO']} redirectTo="/inscripciones"><EstudiantesList /></RequireRole>,
          },
          {
            path: 'estudiantes/detalle',
            element: <RequireRole allowedRoles={['GESTOR_ACADEMICO']} redirectTo="/inscripciones"><EstudianteDetalle /></RequireRole>,
          },
          {
            path: 'nuevo-ingreso',
            element: <RequireRole allowedRoles={['GESTOR_ACADEMICO']} redirectTo="/inscripciones"><NuevoIngresoWizard /></RequireRole>,
          },
          {
            path: 'reinscripcion',
            element: <RequireRole allowedRoles={['GESTOR_ACADEMICO']} redirectTo="/inscripciones"><ReinscripcionWizard /></RequireRole>,
          },
          {
            path: 'documentos',
            element: <RequireRole allowedRoles={['ADMINISTRADOR']} redirectTo="/inscripciones"><div className="p-6 text-sm text-[#6B7280]">Documentos Institucionales (próximamente)</div></RequireRole>,
          },
          {
            path: 'expediente',
            element: <RequireRole allowedRoles={['SERVICIOS_ESCOLARES']} redirectTo="/inscripciones"><div className="p-6 text-sm text-[#6B7280]">Expediente — Documentos Recibidos (próximamente)</div></RequireRole>,
          },
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
