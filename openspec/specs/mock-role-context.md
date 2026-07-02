# Mock Role Context Specification

## Purpose

A mock, non-authenticated role system that lets the prototype switch between the 4 roles touching Admisión (Servicios Escolares, Finanzas, Director de División, Candidato) and filters navigation/access accordingly. Isolated so a future real auth provider can replace only the context implementation.

## Requirements

### Requirement: `useRole` Hook and Provider

The system MUST provide a `RoleProvider` (React Context) exposing: the current active role, a setter/switcher function, and the static list of selectable roles. `useRole()` MUST be the only way pages/routes read the active role — no component MAY read role state by other means (e.g., reaching into the provider's internals).

#### Scenario: Hook returns current role
- GIVEN `RoleProvider` wraps the app with default role "Servicios Escolares"
- WHEN any page calls `useRole()`
- THEN it receives the current role and a function to change it

#### Scenario: Switching role updates every consumer
- GIVEN the Navbar dropdown switches role to "Director de División"
- WHEN any mounted component reads `useRole()`
- THEN it reflects "Director de División" without a page reload

### Requirement: Role-Filtered Navigation

`NAV_ITEMS` MUST be filterable by role: each item MUST declare which role(s) may see it, and the sidebar MUST render only items matching the active role.

#### Scenario: Sidebar items differ per role
- GIVEN the active role is "Personal de Finanzas"
- WHEN the sidebar renders
- THEN only Finanzas-applicable items (e.g., Confirmar Pago Ficha/Inducción) MUST appear — Servicios-Escolares-only items (e.g., Generar Matrículas) MUST NOT appear

### Requirement: Role-Gated Route Access

Routes restricted to a role MUST NOT render their target page when the active mock role does not match; the system MUST redirect (or show a "not accessible for this role" state) instead of rendering protected content. This MUST be enforced at the route boundary (not only via sidebar link visibility), so direct URL navigation to a mismatched-role route cannot render protected content.

Implemented via `src/app/shared/RequireRole.tsx`, a component that wraps a route's `element`, reads `useRole()`, and redirects (`<Navigate replace>`) to `/admision` with `state: { toast: 'No tienes permiso para acceder a esa pantalla.' }` when the active role (including the anonymous `null` tier) is not in the route's `allowedRoles`. `AdmisionDashboard.tsx` reads that state via `usePendingToast()` and renders it with the shared `Toast` component.

Every `/admision/*` screen is wrapped in `RequireRole` with the role(s) from its "Rol activo en sidebar" annotation in `03-admision.md`, EXCEPT the index route (`/admision`, the Dashboard) — see "Deliberate exception" below.

#### Scenario: Mismatched role blocked from route
- GIVEN the active role is "Servicios Escolares"
- WHEN the user navigates directly to `/admision/seleccion` (Director-only)
- THEN the page MUST NOT render the Director's candidate list; the user MUST be redirected to `/admision` with a "No tienes permiso para acceder a esa pantalla." toast

#### Deliberate exception: Dashboard route is never role-gated
- The Dashboard (`/admision` index route) is intentionally NOT wrapped in `RequireRole`, deviating from a stricter "Servicios Escolares only" reading of `03-admision.md`'s sidebar annotation for this screen.
- Reason: `/admision` is `RequireRole`'s own redirect target. Gating it to any role subset would cause an infinite redirect loop for every role/tier excluded from that subset (e.g. Finanzas or Director de División bouncing off a blocked screen back onto a Dashboard that also rejects them, or an anonymous/`CANDIDATO` session that reached an `/admision/*` URL directly).
- This is safe because `AdmisionDashboard.tsx` renders role-agnostic aggregate KPIs only — no per-role sensitive data. Its "Acciones Rápidas" links to sensitive screens (e.g. "Registrar Candidato") remain protected because the DESTINATION route is guarded, not the Dashboard link itself.

### Requirement: Navbar Role Switcher

The Navbar MUST expose a functional role-switch dropdown listing all 4 roles; selecting one MUST update the active role via `useRole` and immediately re-filter `NAV_ITEMS`.

#### Scenario: Selecting a role updates the sidebar instantly
- GIVEN the dropdown is open
- WHEN the user selects "Finanzas"
- THEN the sidebar items MUST update to the Finanzas-filtered set without navigation
