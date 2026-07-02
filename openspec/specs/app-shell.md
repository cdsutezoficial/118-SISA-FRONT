# Delta for App Shell

> No prior `openspec/specs/app-shell/spec.md` exists yet (first SDD change in this repo). The MODIFIED blocks below describe the full intended behavior; "Previously" notes summarize current code behavior observed in `AppLayout.tsx`/`router.tsx` as the implicit baseline this delta replaces.

## MODIFIED Requirements

### Requirement: Navbar Role Dropdown

The Navbar's role dropdown MUST be functional: it MUST list the 4 roles relevant to Admisión, MUST update the active role via `useRole` on selection, and MUST close after selection.
(Previously: dropdown UI exists but is not wired to any role state — purely decorative.)

#### Scenario: Selecting a role persists for the session
- GIVEN the dropdown is open
- WHEN the user selects "Director de División"
- THEN the active role becomes "Director de División" for the remainder of the session (until changed again)

### Requirement: Role-Filtered `NAV_ITEMS`

`NAV_ITEMS` MUST support per-item role restriction; the sidebar MUST render only items whose allowed roles include the active role. Existing items without an explicit Admisión-related role restriction MUST remain visible to all roles (no regression to modules 01/02 navigation).
(Previously: `NAV_ITEMS` is a flat, unrestricted array — every item shows regardless of any role concept, because no role concept existed.)

#### Scenario: Existing modules unaffected for default role
- GIVEN the active role is "Servicios Escolares"
- WHEN the sidebar renders
- THEN all pre-existing items (Dashboard, Divisiones, Programas, etc.) MUST still display exactly as before

## ADDED Requirements

### Requirement: AuthLayout Reused for Public Portal

`AuthLayout` (existing chrome-less layout) MUST be reused, unmodified in its bare-`Outlet` behavior, to host all public portal routes: induction access/payment (`/portal/induccion`, `/portal/induccion/pago`) and public self-registration (`/portal/registro`, `/portal/registro/ficha`). No sidebar, navbar, or `NAV_ITEMS` filtering logic MUST apply to routes mounted under `AuthLayout`.

#### Scenario: Portal route renders without app chrome
- GIVEN a user (no role/session) navigates to `/portal/induccion`
- WHEN the route resolves
- THEN no sidebar or Navbar MUST render — only the portal screen content inside `AuthLayout`'s bare outlet

#### Scenario: Public self-registration route renders without app chrome
- GIVEN an aspirant (no role/session) navigates to `/portal/registro`
- WHEN the route resolves
- THEN no sidebar or Navbar MUST render — only the Registro Wizard content inside `AuthLayout`'s bare outlet
