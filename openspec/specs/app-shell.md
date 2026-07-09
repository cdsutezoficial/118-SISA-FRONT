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

---

## ADDED Requirements — Multilevel Navigation + Mobile Drawer (2026-07-09)

### Requirement: Multilevel Navigation Model

The nav structure MUST support two entry types: `NavLeaf` (leaf navigable item)
and `NavGroup` (collapsible section with `children: NavLeaf[]`). Adding a
deeper level only requires assigning `children` to an existing `NavLeaf` —
no structural changes to the rendering logic are needed. Groups MUST be hidden
if none of their children are visible to the active role.

The production nav tree is:

| Entry | Type | id |
|---|---|---|
| Dashboard | `NavLeaf` | — |
| Configuración Académica | `NavGroup` | `'config'` |
| Administración | `NavGroup` | `'admin'` |
| Módulos | `NavGroup` | `'modules'` |

#### Scenario: Group with no accessible children is hidden
- GIVEN the active role is "Finanzas" (cannot access Usuarios)
- WHEN the sidebar renders
- THEN the "Administración" group MUST NOT appear

#### Scenario: Group with at least one accessible child is visible
- GIVEN the active role is "Finanzas" (can access Admisión inside Módulos)
- WHEN the sidebar renders
- THEN the "Módulos" group MUST appear, showing only the children the role can access

### Requirement: Desktop Sidebar Accordion

In expanded mode (240 px), groups MUST render as collapsible accordion sections.
The group containing the active route MUST be auto-expanded on initial render and on
any navigation that changes the active route segment. `config` MUST default to expanded
on first load. In collapsed mode (60 px), the sidebar MUST flatten all accessible leaf
items into a single icon list with hover tooltips.

#### Scenario: Active group auto-expands on navigation
- GIVEN the user navigates to `/materias`
- WHEN the sidebar renders
- THEN the "Configuración Académica" group MUST be expanded, showing "Materias" highlighted as active

#### Scenario: Collapsed sidebar shows flat icon list
- GIVEN the sidebar is in collapsed mode
- WHEN any page is active
- THEN only icons are shown — one per accessible leaf — with a tooltip on hover revealing the item's label

### Requirement: Mobile Hamburger Menu

On viewports narrower than `md` (768 px), the sidebar MUST NOT be present in
the document flow. Instead, the Navbar MUST display a hamburger icon (`Menu`)
on its left side. Tapping the hamburger MUST open a full-screen drawer
(`fixed inset-0`) that covers 100 % of the viewport width. The drawer MUST
animate in from the left (`-translate-x-full` → `translate-x-0`). A
semi-transparent backdrop MUST render behind the drawer; tapping it MUST close
the drawer. The main content area MUST have no left margin on mobile
(`md:ml-[240px]` / `md:ml-[60px]` apply only on desktop).

#### Scenario: Hamburger opens full-width drawer
- GIVEN the viewport width is less than 768 px
- WHEN the user taps the hamburger icon
- THEN a full-screen drawer slides in from the left, showing the navigation groups, user info, role switcher, and logout

#### Scenario: Tapping a nav item closes the drawer
- GIVEN the mobile drawer is open
- WHEN the user taps any navigation item
- THEN the app navigates to that route AND the drawer closes

#### Scenario: Backdrop tap closes the drawer
- GIVEN the mobile drawer is open
- WHEN the user taps the semi-transparent backdrop area
- THEN the drawer closes without navigating

#### Scenario: Main content takes full width on mobile
- GIVEN the viewport width is less than 768 px
- WHEN any page renders
- THEN the main content area has no left margin offset (the sidebar is not in the layout flow)

### Requirement: Mobile Drawer Contents

The mobile drawer MUST contain, in order:
1. Header row: SISA v2 brand + close button (`X`)
2. User info: avatar initials + full name + active role label
3. Nav groups (collapsible accordion, same logic as desktop) — role-filtered
4. Bottom section: role switcher (mock mode only), cambiar contraseña, cerrar sesión

#### Scenario: Role switcher appears only in mock mode
- GIVEN `authMode === 'real'`
- WHEN the mobile drawer is open
- THEN the role switcher section MUST NOT be visible in the drawer

#### Scenario: Changing role in drawer updates sidebar immediately
- GIVEN the mobile drawer is open and `authMode === 'mock'`
- WHEN the user selects a different role
- THEN the active role updates immediately; nav groups re-filter; the drawer does NOT close automatically
