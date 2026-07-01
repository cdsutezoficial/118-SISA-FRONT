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

Routes restricted to a role MUST NOT render their target page when the active mock role does not match; the system MUST redirect (or show a "not accessible for this role" state) instead of rendering protected content.

#### Scenario: Mismatched role blocked from route
- GIVEN the active role is "Servicios Escolares"
- WHEN the user navigates directly to `/admision/seleccion` (Director-only)
- THEN the page MUST NOT render the Director's candidate list; the user MUST be redirected or shown a restricted-access state

### Requirement: Navbar Role Switcher

The Navbar MUST expose a functional role-switch dropdown listing all 4 roles; selecting one MUST update the active role via `useRole` and immediately re-filter `NAV_ITEMS`.

#### Scenario: Selecting a role updates the sidebar instantly
- GIVEN the dropdown is open
- WHEN the user selects "Finanzas"
- THEN the sidebar items MUST update to the Finanzas-filtered set without navigation
