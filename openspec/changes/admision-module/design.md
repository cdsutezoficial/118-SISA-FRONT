# Design: Admisión Module (Frontend)

## Technical Approach

Additive, hand-written React/TS. 17 screens reuse `src/app/shared/ui.tsx` primitives and the
existing layout shells. Three new cross-cutting pieces land in `src/app/shared/`: a mock
**RoleContext**, a generic **Wizard**, and a generic **FileUpload**. A shared **Candidate**
domain type centralizes status-driven UI. Routing extends the two existing layout route blocks
(`AppLayout` for `/admision/*`, `AuthLayout` for `/portal/*`) without touching modules 01/02.
Pages keep local `useState` mock data; all payment/LlaveMX flows are simulated overlays/toasts.

## Architecture Decisions

### Decision: Mock role system via React Context isolated behind `useRole` (with anonymous state)

**Choice**: `RoleContext.tsx` exports a `Role` union, `RoleProvider`, and `useRole()` returning
`{ role, setRole, availableRoles, user }` where **`role: Role | null`** — `null` is the anonymous /
no-role state. Provider wraps `<RouterProvider>` in `main.tsx` so both `/admision/*` and `/portal/*`
trees can read it. The mock provider defaults to a staff role (e.g. `SERVICIOS_ESCOLARES`) for the
authed shell; the public self-registration flow simply does not depend on `role` at all.
**Alternatives considered**: (a) prop-drilling role from layout; (b) Redux/Zustand store; (c) URL
param `?role=`; (d) a sentinel `'ANONYMOUS'` member inside the `Role` union.
**Rationale**: Context matches the "swap only the provider for real auth" constraint — page/route
code calls `useRole()` and never sees auth internals. A store is overkill for a single value; prop
drilling can't reach portal routes; URL param leaks into navigation semantics. `role: Role | null`
(not an `'ANONYMOUS'` union member) keeps the staff `Role` set clean and makes "no identity" a
distinct, type-checkable state — `availableRoles` (the dropdown source) never includes `null`, so
the authed shell can't accidentally render an anonymous option. When real auth arrives, only
`RoleProvider`'s body changes (read JWT instead of `useState`; unauthenticated → `null`).

**Three identity tiers** the design must keep distinct:
1. **Staff roles** (`SERVICIOS_ESCOLARES`, `FINANZAS`, `DIRECTOR_DIVISION`, plus existing
   `ADMINISTRADOR`/`GESTOR_ACADEMICO`) — authed shell, `/admision/*`.
2. **`CANDIDATO`** — post-registration portal access (screens 16/17) gated by a simulated folio+CURP
   "login"; a real role value, set after the candidate authenticates into `/portal/induccion*`.
3. **`null` (anonymous visitor)** — the pre-registration public flow (`/portal/registro*`, screens
   4 & 13). No login at all; the flow itself produces the folio that later enables tier 2.

### Decision: Role-aware navigation by per-item `roles` field + declarative filter

**Choice**: Extend each `NAV_ITEMS` entry with `roles: Role[]`. `Sidebar` filters
`NAV_ITEMS.filter(i => i.roles.includes(role))`. Add one `Admisión` entry (`base: 'admision'`)
scoped to admisión roles; tag existing config entries with `['ADMINISTRADOR','GESTOR_ACADEMICO']`.
**Alternatives considered**: separate hardcoded arrays per role (`ADMIN_NAV`, `SE_NAV`…).
**Rationale**: Single source of truth, no duplication, trivial to read. Separate arrays drift and
duplicate icons/paths. Tradeoff: a screen visible to many roles repeats them in one array — cheap
and explicit vs. N arrays to keep in sync.

### Decision: Functional Navbar role dropdown driven by `availableRoles`

**Choice**: Replace the two hardcoded `Administrador`/`Gestor Académico` buttons with a map over
`availableRoles`; each button calls `setRole(r)`; active role gets the `#e6f5f1`/`#009574`
highlight. Header label and sidebar avatar read `role`/`user` from context.
**Rationale**: Makes the existing-but-cosmetic dropdown real with no new chrome; lifts the dropdown
open-state where it already lives in `AppLayout`.

### Decision: Generic Wizard (render-config steps, validation-gated Next)

**Choice**: `Wizard` takes `steps: WizardStep[]` and `onComplete`; owns `currentStep` internally.
Each step `{ id, label, render, isValid }`. Next is disabled when `steps[current].isValid === false`.
Parent owns form data (lifted `useState`), passed into each `render`.
**Alternatives considered**: hardcode the step flow inside screen 4 (originally drafted as 3 steps, reworked to 4 per the PO's 2026-07-01 complete field-list correction — irrelevant to this decision either way since the Wizard itself is step-count-agnostic); headless lib (react-step-wizard).
**Rationale**: Reusable for future flows per proposal; parent-owned data keeps the wizard stateless
about domain shape. No new dependency.

### Decision: Generic FileUpload with simulated progress

**Choice**: `FileUpload` props `{ accept, label, value, onChange }`; internal `setTimeout` drives
`status: 'idle'|'uploading'|'done'|'error'`. No network — emits an `UploadedFile` descriptor.
**Rationale**: Screens 6 and 10 need identical behavior; consistent with the module-wide
"simulate everything" rule.

### Decision: Nested route parents inside existing layout blocks (with public dual-mounts)

**Choice**: Add one `{ path: 'admision', children: [...] }` object to `AppLayout.children` (with an
`index` route = Dashboard) and one `{ path: 'portal', children: [...] }` to `AuthLayout.children`.
The `portal` parent holds FOUR public routes — the post-registration candidate portal AND the
pre-registration self-service flow:

| Public route | Screen | Component | Mode |
|--------------|--------|-----------|------|
| `/portal/registro` | 4 (Wizard) | `CandidatoRegistro` | `public` (anonymous) |
| `/portal/registro/ficha` | 13 (Ficha confirmación) | `FichaConfirmacion` | `public` (anonymous) |
| `/portal/induccion` | 16 (Acceso) | `PortalInduccion` | folio+CURP gated → `CANDIDATO` |
| `/portal/induccion/pago` | 17 (Pago) | `PortalInduccionPago` | `CANDIDATO` |

Screens 4 and 13 are **dual-mounted**: the SAME components also appear under
`/admision/candidatos/registrar` and `/admision/candidatos/ficha` in the `admision` (staff) parent.
**Alternatives considered**: 17 flat sibling entries; separate copy-paste portal components for 4/13.
**Rationale**: Nesting gives a clean `/admision` index, groups the module, and is purely additive.
Dual-mounting reuses one component per screen (single source of truth for the wizard/ficha UI),
exactly mirroring how `Login`/`ResetPassword`/`ResetConfirm` already coexist as siblings under bare
`AuthLayout`. The public `/portal/registro*` routes need no role — they render for anonymous
visitors (`role === null`).

### Decision: Dual-mounted screens 4 & 13 differ only by an `origin` prop

**Choice**: `CandidatoRegistro` and `FichaConfirmacion` each take `origin: 'staff' | 'public'`,
supplied at the route element (`<CandidatoRegistro origin="public" />`). `origin` drives only the
post-completion navigation target and chrome assumptions — NOT the form logic, which is identical:
- Screen 4 `staff`: on complete → navigate `/admision/candidatos` (Candidatos Listado).
  `public`: on complete → navigate `/portal/registro/ficha` (public confirmation).
- Screen 13 `staff`: rendered inside the authed shell; back-link → `/admision/candidatos`.
  `public`: terminal public confirmation (shows generated folio for later portal login), no shell.
**Alternatives considered**: read `useLocation().pathname.startsWith('/portal')` instead of a prop;
two separate components.
**Rationale**: An explicit `origin` prop is self-documenting and testable, avoids brittle pathname
sniffing, and keeps a single component. The component reads `useRole()` only defensively — under
`origin: 'public'` it must NOT assume a role exists (`role` may be `null`).

### Decision: Shared `Candidate` domain type + status-meta map

**Choice**: `shared/admision/types.ts` exports `CandidateStatus` union and a `Candidate` interface.
`STATUS_META: Record<CandidateStatus, { label; badgeClass }>` and
`STATUS_ACTIONS: Record<CandidateStatus, AdmisionAction[]>` drive badges and which buttons are
enabled. Shared `mockCandidates` seed in `shared/admision/mockData.ts`.
**Rationale**: Prevents 17 pages from each inventing a candidate shape; status→UI logic lives once.

## Data Flow

    main.tsx
      └─ RoleProvider (useState role)  ──useRole()──┐
         └─ RouterProvider                          │
            ├─ AppLayout  ── Sidebar/Navbar ─────────┘ (filter NAV_ITEMS, switch role)
            │   └─ /admision/* pages ── useState(mockCandidates) ── STATUS_META/ACTIONS → badges+buttons
            │        └─ screen 4 → <Wizard steps=[...] /> ; screens 6,10 → <FileUpload/>
            └─ AuthLayout (bare <Outlet/>)
                ├─ /portal/registro, /portal/registro/ficha (ANONYMOUS, role===null)
                │     └─ <CandidatoRegistro origin="public"/>, <FichaConfirmacion origin="public"/>  (dual-mount of 4 & 13)
                └─ /portal/induccion, /portal/induccion/pago (CANDIDATO, folio+CURP gated)
                      └─ useRole() for identity, simulated payment overlay

Staff dual-mount: /admision/candidatos/registrar → <CandidatoRegistro origin="staff"/>;
                  /admision/candidatos/ficha     → <FichaConfirmacion origin="staff"/>

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/shared/RoleContext.tsx` | Create | `Role` union, `RoleProvider`, `useRole()` |
| `src/app/shared/Wizard.tsx` | Create | Generic stepper, validation-gated Next |
| `src/app/shared/FileUpload.tsx` | Create | Generic simulated upload |
| `src/app/shared/admision/types.ts` | Create | `Candidate`, `CandidateStatus`, `STATUS_META`, `STATUS_ACTIONS` |
| `src/app/shared/admision/mockData.ts` | Create | `mockCandidates` seed |
| `src/app/pages/admision/*.tsx` | Create | 15 staff screens (1–15); incl. `CandidatoRegistro` (4) & `FichaConfirmacion` (13), each with an `origin` prop |
| `src/app/pages/portal/*.tsx` | Create | 2 candidate-portal screens (16,17). Screens 4 & 13 are NOT re-created here — their `admision` components are dual-mounted into the portal routes |
| `src/main.tsx` | Modify | Wrap `RouterProvider` in `RoleProvider` |
| `src/app/router.tsx` | Modify | Add `admision` parent to AppLayout; add `portal` parent (4 routes: registro, registro/ficha, induccion, induccion/pago) to AuthLayout, reusing screens 4 & 13 components |
| `src/app/layouts/AppLayout.tsx` | Modify | Role-aware `NAV_ITEMS` + functional dropdown via `useRole` |

## Interfaces / Contracts

```ts
// RoleContext.tsx
export type Role =
  | 'ADMINISTRADOR' | 'GESTOR_ACADEMICO'
  | 'SERVICIOS_ESCOLARES' | 'FINANZAS' | 'DIRECTOR_DIVISION' | 'CANDIDATO'
export interface RoleContextValue {
  role: Role | null               // null = anonymous visitor (pre-registration public flow)
  setRole: (r: Role | null) => void
  availableRoles: Role[]          // staff dropdown source — never contains null
  user: { name: string; email: string } | null  // null when anonymous
}
export function useRole(): RoleContextValue

// Dual-mounted screens 4 & 13 — same component, two route entries
type ScreenOrigin = 'staff' | 'public'
export function CandidatoRegistro(props: { origin: ScreenOrigin }): JSX.Element  // screen 4
export function FichaConfirmacion(props: { origin: ScreenOrigin }): JSX.Element  // screen 13

// Wizard.tsx
export interface WizardStep { id: string; label: string; render: React.ReactNode; isValid: boolean }
export function Wizard(props: { steps: WizardStep[]; onComplete: () => void }): JSX.Element

// FileUpload.tsx
export interface UploadedFile { name: string; size: number; status: 'uploading' | 'done' | 'error' }
export function FileUpload(props: {
  accept?: string; label: string
  value: UploadedFile | null; onChange: (f: UploadedFile | null) => void
}): JSX.Element

// admision/types.ts
export type CandidateStatus =
  | 'REGISTERED' | 'PAID' | 'EXAM_TAKEN' | 'ACCEPTED' | 'REJECTED' | 'ENROLLED'
export interface Candidate {
  id: string; nombre: string; email: string; programa: string
  canal: string; status: CandidateStatus; matricula?: string
}
```

`NAV_ITEMS` gains `roles: Role[]`; `Sidebar` renders
`NAV_ITEMS.filter(i => role !== null && i.roles.includes(role))` (Sidebar lives only in the authed
shell, so `role` is a staff role in practice; the `null` guard is defensive).

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `STATUS_ACTIONS`/`STATUS_META` mapping, `NAV_ITEMS` filter | pure-function checks (manual, no runner configured) |
| Integration | Role switch updates sidebar+routes; Wizard Next gating; FileUpload status transitions | in-app manual prototype walkthrough |
| E2E | 17-screen prototype navigation per role | manual click-through vs corrected UX spec |

No automated runner is configured in `118-SISA-FRONT`; verification is manual against the UX spec.

## Migration / Rollout

No migration. Pure additive UI; rollback removes new files and the added router/AppLayout/main blocks.

## Open Questions

- [ ] `pages/portal/` vs `pages/admision/portal/` for screens 16–17 — design picks `pages/portal/` to mirror route separation; confirm in tasks. Screens 4 & 13 live in `pages/admision/` (dual-mounted), not portal.
- [ ] `CANDIDATO` is set only after the simulated folio+CURP login on `/portal/induccion` (tier 2); it is NOT in `availableRoles` (staff dropdown) and is NOT used for `/portal/registro*` (tier 3, `role === null`). Confirm the folio+CURP "login" UX in spec.
- [ ] Anonymous public flow (`role === null`) shares the bare `AuthLayout` with staff auth pages (`/login`); ensure no `useRole()` consumer in that tree throws on `null` (the provider must render the tree even with no role).
