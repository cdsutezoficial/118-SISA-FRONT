import { createBrowserRouter, Navigate } from 'react-router'
import AuthLayout from '@app/core/layout/AuthLayout'
import AppLayout from '@app/core/layout/AppLayout'
import { RequireRole } from '@app/core/infra/RequireRole'
import { RequireAuth } from '@app/core/infra/RequireAuth'

// Auth pages
import Login from '@app/core/pages/Login'
import ResetPassword from '@app/core/pages/ResetPassword'
import ResetConfirm from '@app/core/pages/ResetConfirm'

// Authenticated pages
import Dashboard from '@app/core/pages/Dashboard'

// Admisión
import AdmisionDashboard from '@app/modules/admision/pages/AdmisionDashboard'
import CanalesDifusion from '@app/modules/admision/pages/CanalesDifusion'
import CandidatosList from '@app/modules/admision/pages/CandidatosList'
import CandidatoDetalle from '@app/modules/admision/pages/CandidatoDetalle'
import CandidatoRegistro from '@app/modules/admision/pages/CandidatoRegistro'
import FichaConfirmacion from '@app/modules/admision/pages/FichaConfirmacion'
import ConfirmarPagoFicha from '@app/modules/admision/pages/ConfirmarPagoFicha'
import ConfirmarPagoInduccion from '@app/modules/admision/pages/ConfirmarPagoInduccion'
import RegistroInduccion from '@app/modules/admision/pages/RegistroInduccion'
import RegistroExamen from '@app/modules/admision/pages/RegistroExamen'
import SeleccionCandidatos from '@app/modules/admision/pages/SeleccionCandidatos'
import GenerarMatriculas from '@app/modules/admision/pages/GenerarMatriculas'
import PublicarResultados from '@app/modules/admision/pages/PublicarResultados'
import AplicarDescuento from '@app/modules/admision/pages/AplicarDescuento'
import HabilitarInduccion from '@app/modules/admision/pages/HabilitarInduccion'

// Portal (público — Screens 16/17)
import PortalInduccion from '@app/portal/PortalInduccion'
import PortalInduccionPago from '@app/portal/PortalInduccionPago'

// Inscripciones — all 7 screens are real.
import InscripcionesDashboard from '@app/modules/inscripciones/pages/InscripcionesDashboard'
import EstudiantesList from '@app/modules/inscripciones/pages/EstudiantesList'
import EstudianteDetalle from '@app/modules/inscripciones/pages/EstudianteDetalle'
import NuevoIngresoWizard from '@app/modules/inscripciones/pages/NuevoIngresoWizard'
import ReinscripcionWizard from '@app/modules/inscripciones/pages/ReinscripcionWizard'
import DocumentosInstitucionales from '@app/modules/inscripciones/pages/DocumentosInstitucionales'
import ExpedienteRecibidos from '@app/modules/inscripciones/pages/ExpedienteRecibidos'

// Divisiones
import DivisionesList from '@app/modules/config-academica/pages/DivisionesList'
import DivisionesForm from '@app/modules/config-academica/pages/DivisionesForm'

// Clasificaciones de Materias
import ClasificacionesList from '@app/modules/config-academica/pages/ClasificacionesList'
import ClasificacionesForm from '@app/modules/config-academica/pages/ClasificacionesForm'

// Programas
import ProgramasList from '@app/modules/config-academica/pages/ProgramasList'
import ProgramasForm from '@app/modules/config-academica/pages/ProgramasForm'

// Periodos
import PeriodosList from '@app/modules/config-academica/pages/PeriodosList'
import PeriodosForm from '@app/modules/config-academica/pages/PeriodosForm'

// Generaciones
import GeneracionesList from '@app/modules/config-academica/pages/GeneracionesList'
import GeneracionesForm from '@app/modules/config-academica/pages/GeneracionesForm'

// Grupos
import GruposList from '@app/modules/config-academica/pages/GruposList'
import GruposForm from '@app/modules/config-academica/pages/GruposForm'

// Configuración de Admisión
import ConfiguracionAdmisionList from '@app/modules/config-academica/pages/ConfiguracionAdmisionList'
import ConfiguracionAdmisionForm from '@app/modules/config-academica/pages/ConfiguracionAdmisionForm'

// Conceptos
import ConceptosList from '@app/modules/config-academica/pages/ConceptosList'
import ConceptosForm from '@app/modules/config-academica/pages/ConceptosForm'
import ConceptosTarifaForm from '@app/modules/config-academica/pages/ConceptosTarifaForm'

// Planes
import PlanesList from '@app/modules/config-academica/pages/PlanesList'
import PlanForm from '@app/modules/config-academica/pages/PlanForm'
import PlanDetalle from '@app/modules/config-academica/pages/PlanDetalle'
import PlanMateriaForm from '@app/modules/config-academica/pages/PlanMateriaForm'
import PlanEscalaForm from '@app/modules/config-academica/pages/PlanEscalaForm'

// Usuarios
import UsuariosList from '@app/modules/identity/pages/UsuariosList'
import UsuariosForm from '@app/modules/identity/pages/UsuariosForm'
import UsuarioDetalle from '@app/modules/identity/pages/UsuarioDetalle'
import AsignarRol from '@app/modules/identity/pages/AsignarRol'
import CambiarPassword from '@app/modules/identity/pages/CambiarPassword'

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
  // Gated by `RequireAuth`: mock mode passes through unchanged; a real
  // session must be present/non-expired, and a pending mandatory password
  // change is force-routed to `/usuarios/cambiar-password`. See
  // `shared/RequireAuth.tsx`.
  {
    element: <RequireAuth><AppLayout /></RequireAuth>,
    children: [
      {
        path: 'dashboard',
        element: (
          // Panel de Control — su contenido (KPIs + accesos rápidos de la
          // configuración académica) sólo aplica a los roles que operan esos
          // módulos, igual que el ítem del sidebar. Los roles sin acceso se
          // redirigen a SU vista principal (ROLE_DEFAULT_PATHS), nunca a un
          // destino cross-module que pueda ciclar. Ver `RequireRole.tsx`.
          <RequireRole allowedRoles={['ADMINISTRADOR', 'SERVICIOS_ESCOLARES']} redirectToRoleMain>
            <Dashboard />
          </RequireRole>
        ),
      },

      // Admisión
      //
      // Role guard: every screen below is wrapped in `RequireRole` per the
      // "Rol activo en sidebar" annotations in `03-admision.md`. The index
      // route (`/admision`, the Dashboard) is now guarded TOO, mirroring the
      // module's sidebar roles — sidebar and URL stay in sync, so a role that
      // can't see "Admisión" in the sidebar can't reach it by URL either.
      // Its own redirect target is `/dashboard` (the role-agnostic shell
      // home), and because the index is guarded, denied sub-screens cascade
      // `/admision/… → /admision → /dashboard` instead of ever looping.
      {
        path: 'admision',
        children: [
          {
            index: true,
            element: (
              <RequireRole
                allowedRoles={['SERVICIOS_ESCOLARES', 'FINANZAS', 'DIRECTOR_DIVISION']}
                redirectTo="/dashboard"
              >
                <AdmisionDashboard />
              </RequireRole>
            ),
          },
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
      // All 7 screens (Dashboard, Estudiantes — Listado, Estudiante — Detalle,
      // Inscripción Nuevo Ingreso, Reinscripción, Documentos Institucionales,
      // Expediente — Documentos Recibidos) are real as of Screen 7 landing.
      //
      // Role guard: mirrors Admisión's rule — the index route
      // (`/inscripciones`, the Dashboard) is now guarded too, mirroring the
      // module's sidebar roles (sidebar and URL stay in sync; its own
      // redirect target is `/dashboard`, never itself). Per-screen roles
      // below come from `figma/prompts/04-inscripciones.md`'s "Rol activo en
      // sidebar" annotations (Gestor Académico for Screens 2-5, Administrador
      // for Screen 6, Servicios Escolares for Screen 7) — NOT Servicios
      // Escolares for every screen.
      {
        path: 'inscripciones',
        children: [
          {
            index: true,
            element: (
              <RequireRole
                allowedRoles={['GESTOR_ACADEMICO', 'ADMINISTRADOR', 'SERVICIOS_ESCOLARES']}
                redirectTo="/dashboard"
              >
                <InscripcionesDashboard />
              </RequireRole>
            ),
          },
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
            element: <RequireRole allowedRoles={['ADMINISTRADOR']} redirectTo="/inscripciones"><DocumentosInstitucionales /></RequireRole>,
          },
          {
            path: 'expediente',
            element: <RequireRole allowedRoles={['SERVICIOS_ESCOLARES']} redirectTo="/inscripciones"><ExpedienteRecibidos /></RequireRole>,
          },
        ],
      },

      // Divisiones
      //
      // Role guard: only the list route is wrapped here, mirroring the
      // `usuarios` precedent — `GET /divisions` (and every other `/divisions`
      // verb) is enforced server-side to ADMIN/SERVICIOS_ESCOLARES, so
      // wrapping the list gives a clean redirect instead of a raw 403/blank
      // state for any other role. `divisiones/new`/`divisiones/form` are
      // untouched — out of scope for this change.
      {
        path: 'divisiones',
        element: <RequireRole allowedRoles={['ADMINISTRADOR', 'SERVICIOS_ESCOLARES']} redirectTo="/dashboard"><DivisionesList /></RequireRole>,
      },
      { path: 'divisiones/new',  element: <DivisionesForm /> },
      { path: 'divisiones/form', element: <DivisionesForm /> },

      // Clasificaciones de Materias
      //
      // Role guard: only the list route is wrapped here, mirroring the
      // `divisiones` precedent — every `/subject-classifications` verb is
      // enforced server-side to ADMIN/SERVICIOS_ESCOLARES, so wrapping the
      // list gives a clean redirect instead of a raw 403/blank state for any
      // other role. `clasificaciones/new`/`clasificaciones/form` are
      // untouched — out of scope for this change.
      {
        path: 'clasificaciones',
        element: <RequireRole allowedRoles={['ADMINISTRADOR', 'SERVICIOS_ESCOLARES']} redirectTo="/dashboard"><ClasificacionesList /></RequireRole>,
      },
      { path: 'clasificaciones/new',  element: <ClasificacionesForm /> },
      { path: 'clasificaciones/form', element: <ClasificacionesForm /> },

      // Programas
      //
      // Role guard: the list route is wrapped here, mirroring the
      // `divisiones`/`clasificaciones`/`periodos`/`generaciones`/`grupos`
      // precedent — every `/programs` verb is enforced server-side to
      // ADMIN/SERVICIOS_ESCOLARES, so wrapping the list gives a clean
      // redirect to `/dashboard` instead of a raw 403/blank state for any
      // other role. `programas/new`/`programas/form` are untouched — out of
      // scope for this change.
      { path: 'programas', element: <RequireRole allowedRoles={['ADMINISTRADOR', 'SERVICIOS_ESCOLARES']} redirectTo="/dashboard"><ProgramasList /></RequireRole> },
      { path: 'programas/new',  element: <ProgramasForm /> },
      { path: 'programas/form', element: <ProgramasForm /> },

      // Periodos Académicos
      //
      // Role guard: only the list route is wrapped here, mirroring the
      // `divisiones`/`clasificaciones` precedent — every `/periods` verb is
      // enforced server-side to ADMIN/SERVICIOS_ESCOLARES, so wrapping the
      // list gives a clean redirect instead of a raw 403/blank state for any
      // other role. `periodos/new`/`periodos/form` are untouched — out of
      // scope for this change.
      {
        path: 'periodos',
        element: <RequireRole allowedRoles={['ADMINISTRADOR', 'SERVICIOS_ESCOLARES']} redirectTo="/dashboard"><PeriodosList /></RequireRole>,
      },
      { path: 'periodos/new',  element: <PeriodosForm /> },
      { path: 'periodos/form', element: <PeriodosForm /> },

      // Generaciones
      //
      // Role guard: only the list route is wrapped here, mirroring the
      // `divisiones`/`clasificaciones`/`periodos` precedent — every
      // `/generations` verb is enforced server-side to ADMIN/SERVICIOS_
      // ESCOLARES, so wrapping the list gives a clean redirect instead of a
      // raw 403/blank state for any other role. `generaciones/new`/
      // `generaciones/form` are untouched — out of scope for this change.
      {
        path: 'generaciones',
        element: <RequireRole allowedRoles={['ADMINISTRADOR', 'SERVICIOS_ESCOLARES']} redirectTo="/dashboard"><GeneracionesList /></RequireRole>,
      },
      { path: 'generaciones/new',  element: <GeneracionesForm /> },
      { path: 'generaciones/form', element: <GeneracionesForm /> },

      // Grupos
      //
      // Role guard: the list route is wrapped here, mirroring the
      // `divisiones`/`clasificaciones`/`periodos`/`generaciones`/`planes`
      // precedent — every `/groups` verb is enforced server-side to
      // ADMIN/SERVICIOS_ESCOLARES, so wrapping the list gives a clean
      // redirect to `/dashboard` instead of a raw 403/blank state for any
      // other role. `grupos/new`/`grupos/form` are untouched — out of scope
      // for this change.
      { path: 'grupos', element: <RequireRole allowedRoles={['ADMINISTRADOR', 'SERVICIOS_ESCOLARES']} redirectTo="/dashboard"><GruposList /></RequireRole> },
      { path: 'grupos/new',  element: <GruposForm /> },
      { path: 'grupos/form', element: <GruposForm /> },

      // Configuración de Admisión
      //
      // Role guard: only the list route is wrapped here, mirroring the
      // `divisiones`/`clasificaciones`/`periodos`/`generaciones` precedent —
      // every `/program-admission-configs` verb is enforced server-side to
      // ADMIN/SERVICIOS_ESCOLARES, so wrapping the list gives a clean
      // redirect instead of a raw 403/blank state for any other role.
      // `configuracion-admision/new`/`configuracion-admision/form` are
      // untouched — out of scope for this change.
      {
        path: 'configuracion-admision',
        element: <RequireRole allowedRoles={['ADMINISTRADOR', 'SERVICIOS_ESCOLARES']} redirectTo="/dashboard"><ConfiguracionAdmisionList /></RequireRole>,
      },
      { path: 'configuracion-admision/new',  element: <ConfiguracionAdmisionForm /> },
      { path: 'configuracion-admision/form', element: <ConfiguracionAdmisionForm /> },

      // Conceptos (includes extra: tarifa/form)
      //
      // Role guard: the list route is wrapped here, mirroring the
      // `divisiones`/`clasificaciones`/`periodos`/`generaciones`/`grupos`
      // precedent — every `/concepts` verb is enforced server-side to
      // ADMIN/SERVICIOS_ESCOLARES.
      //
      // `conceptos/tarifa/form` follows the exact route pattern established by
      // `planes/materia/form`/`planes/escala/form` — a SEPARATE screen (not a
      // modal) to add a new child record, taking the parent id via
      // `?conceptId=`. Unlike those two, there is no `?mode=` here: `PaymentRate`
      // is an append-only history with no edit, so this route is ALWAYS
      // registration (2026-07-28 wiring plan, Fase 4 of 4).
      { path: 'conceptos',            element: <RequireRole allowedRoles={['ADMINISTRADOR', 'SERVICIOS_ESCOLARES']} redirectTo="/dashboard"><ConceptosList /></RequireRole> },
      { path: 'conceptos/new',        element: <ConceptosForm /> },
      { path: 'conceptos/form',       element: <ConceptosForm /> },
      { path: 'conceptos/tarifa/form', element: <ConceptosTarifaForm /> },

      // Planes (includes extras: detalle + materia + escala)
      //
      // `planes/materia/form` (register + edit, via ?mode=) replaces the old
      // `planes/asignar-materia` mock screen — that one assumed a global
      // subject catalog, which the PO confirmed (2026-07-20) doesn't exist in
      // the domain; subjects are registered directly into a plan level.
      // `planes/escala/form` (register + edit, same ?mode= convention) follows
      // the exact same route pattern for GradeScale — full-screen route via
      // useSearchParams, no standalone GET-by-id, edit mode locates the record
      // inside the parent plan's response. Role guard: the list route is
      // wrapped here, mirroring the `divisiones`/`clasificaciones`/`usuarios`
      // precedent — every `/plans` verb is enforced server-side to
      // ADMIN/SERVICIOS_ESCOLARES.
      { path: 'planes', element: <RequireRole allowedRoles={['ADMINISTRADOR', 'SERVICIOS_ESCOLARES']} redirectTo="/dashboard"><PlanesList /></RequireRole> },
      { path: 'planes/new',          element: <PlanForm /> },
      { path: 'planes/form',         element: <PlanForm /> },
      { path: 'planes/detalle',      element: <PlanDetalle /> },
      { path: 'planes/materia/form', element: <PlanMateriaForm /> },
      { path: 'planes/escala/form',  element: <PlanEscalaForm /> },

      // Usuarios (includes extras: detalle + asignar-rol + cambiar-password)
      //
      // Role guard: only the list route is wrapped here — `GET /users` is now
      // enforced server-side to ADMIN/SERVICIOS_ESCOLARES, so wrapping the
      // list gives a clean redirect instead of a raw 403/blank state for any
      // other role. `usuarios/new`, `usuarios/detalle`, etc. are untouched —
      // out of scope for this change.
      {
        path: 'usuarios',
        element: <RequireRole allowedRoles={['ADMINISTRADOR', 'SERVICIOS_ESCOLARES']} redirectTo="/dashboard"><UsuariosList /></RequireRole>,
      },
      // `usuarios/form` (register+edit+view via ?mode=) is REMOVED — the
      // 2026-07-28 wiring plan drops "edit" entirely (no `PUT /users/{id}`
      // exists on purpose, nothing about a `User` is editable that way).
      // `usuarios/new` is now the sole registration route, a 2-step Wizard.
      { path: 'usuarios/new',                element: <UsuariosForm /> },
      { path: 'usuarios/detalle',            element: <UsuarioDetalle /> },
      { path: 'usuarios/asignar-rol',        element: <AsignarRol /> },
      { path: 'usuarios/cambiar-password',   element: <CambiarPassword /> },
    ],
  },
])

export default router
