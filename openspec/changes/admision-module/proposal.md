# Proposal: Admisión Module (Frontend)

## Intent

Build the 17-screen Admisión module UI directly as hand-written React/TS in `118-SISA-FRONT`, matching the mature UX spec in `118-SISA-CLAUDE/docs/design/figma/prompts/03-admision.md` (corrections to screens 3/4/5/8/9 are authoritative). No Figma Make this time. This is the first module to require role-scoped navigation and two new shared widgets (wizard, file upload) the codebase lacks today.

## Scope

**Scoping interpretation (confirm):** ONE proposal/spec/design for the whole Admisión slice (the mock-role context and wizard are cross-cutting, decided once). The later `sdd-tasks` phase slices delivery **screen by screen** for incremental apply/review.

### In Scope — 17 screens (route under `/admision`, public portal under `/portal`)

| # | Screen | Route | Role |
|---|--------|-------|------|
| 1 | Dashboard | `/admision` | Serv. Escolares |
| 2 | Canales Difusión | `/admision/canales` | Serv. Escolares |
| 3 | Candidatos Listado | `/admision/candidatos` | Serv. Escolares |
| 4 | Registro Wizard (3 pasos) | `/admision/candidatos/registrar` (staff) + `/portal/registro` (público, anónimo) | Serv. Escolares + público |
| 5 | Candidato Detalle (Tabs) | `/admision/candidatos/detalle` | Serv. Escolares |
| 6 | Confirmar Pago Ficha | `/admision/candidatos/pago-ficha` | Finanzas |
| 7 | Registro Examen | `/admision/candidatos/examen` | Serv. Escolares |
| 8 | Registro Inducción | `/admision/candidatos/induccion` | Serv. Escolares |
| 9 | Publicar Resultados | `/admision/publicar` | Serv. Escolares |
| 10 | Confirmar Pago Inducción | `/admision/candidatos/pago-induccion` | Finanzas |
| 11 | Selección Candidatos | `/admision/seleccion` | Director División |
| 12 | Generar Matrículas | `/admision/matriculas` | Serv. Escolares |
| 13 | Ficha Confirmación | `/admision/candidatos/ficha` (staff) + `/portal/registro/ficha` (público, anónimo) | Serv. Escolares + público |
| 14 | Aplicar Descuento | `/admision/descuentos` | Serv. Escolares |
| 15 | Habilitar Inducción | `/admision/habilitacion` | Serv. Escolares |
| 16 | Portal Acceso (público) | `/portal/induccion` | Candidato (no chrome) |
| 17 | Portal Pago (público) | `/portal/induccion/pago` | Candidato (no chrome) |

Plus: mock role-switching context, functional Navbar role dropdown, role-aware `NAV_ITEMS`, and two reusable shared widgets (Wizard/Stepper, FileUpload).

### Out of Scope
- Real backend / API calls — pages keep local `useState` mock data like existing modules.
- Real auth/JWT/LlaveMX/Evo Payments — mocked (overlay/simulated). Role is mock-switched, not authenticated.
- Refactoring existing modules 01/02 or migrating their ad-hoc List/Modal patterns into shared components (flagged as a decision below, not assumed).

## Capabilities

### New Capabilities
- `admision-screens`: 17 admission-flow screens with local mock state and prototype navigation.
- `mock-role-context`: React Context providing active mock role + switcher; pages/routes read role, never auth internals.
- `shared-wizard`: reusable Stepper/Wizard primitive (screen 4 today, reusable elsewhere).
- `shared-file-upload`: reusable file-upload primitive (screens 6, 10).

### Modified Capabilities
- `app-shell`: `AppLayout` Navbar dropdown becomes functional; `NAV_ITEMS` becomes role-filtered. `AuthLayout` reused for the chrome-less public portal.

## Approach

- **Reuse** existing patterns: List/CRUD (`UsuariosList`), Detail+Tabs (`UsuarioDetalle`), inline editable table (`EscalaForm`), and `shared/ui.tsx` primitives (`SearchSelect`, `DatePicker`, `Switch`, `ConfirmModal`, `Toast`, `FieldLabel/Help/Error`). Adopt these consistently instead of re-implementing local copies (the observed inconsistency).
- **Build once, reuse**: `Wizard/Stepper` and `FileUpload` as shared components in `src/app/shared/`.
- **Mock role context** in `src/app/shared/` (Provider + `useRole` hook). Navbar dropdown switches the active role; `NAV_ITEMS` filters by role; public portal routes (16/17) mount under `AuthLayout` (bare `<Outlet/>`). Designed so a future real auth provider swaps only the context implementation — pages/routes unchanged.
- Register all routes in `router.tsx` following the existing flat-segment convention.
- Domain status model `REGISTERED→PAID→EXAM_TAKEN→ACCEPTED/REJECTED→ENROLLED` drives badges and conditional actions per the corrections.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/router.tsx` | Modified | Add ~17 routes (`/admision/*`, `/portal/*`) |
| `src/app/layouts/AppLayout.tsx` | Modified | Functional role dropdown + role-aware `NAV_ITEMS` |
| `src/app/shared/` | New | role-context, Wizard, FileUpload |
| `src/app/pages/admision/` | New | 17 page components |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Mock role system reworked when real backend auth arrives | Med | Isolate behind `useRole`/Provider; only provider swaps |
| Pattern inconsistency grows (ad-hoc List/Modal vs. shared) | Med | Reuse `ui.tsx`; defer big refactor to explicit decision below |
| 17 screens overflow review budget | High | Per-screen task slicing in `sdd-tasks`; chained PRs |
| Public portal leaks into authed shell | Low | Mount 16/17 under `AuthLayout`, no `NAV_ITEMS` |

## Decision Points (need PO confirmation)
1. **Whole-slice vs. per-screen SDD** — proposal assumes whole-slice plan, per-screen task delivery. Confirm.
2. **Shared List/Modal/Tabs extraction** — recommend a *thin* opt-in: build Admisión on `ui.tsx` primitives now, do NOT refactor modules 01/02. A full shared `DataTable` is deferred unless you approve it as separate scope.
3. **Mock-now vs. wait-for-backend role system** — recommend mock-now (unblocks 4 role views) given the `useRole` isolation.

## Rollback Plan
Pure additive UI. Revert by removing `src/app/pages/admision/`, the new `src/app/shared/` files, and the added `router.tsx`/`AppLayout.tsx` blocks. No data migrations, no backend, no shared-module deletions.

## Dependencies
- None external. Existing `shared/ui.tsx`, `AppLayout`, `AuthLayout`, react-router already present.

## Success Criteria
- [ ] All 17 screens render with example mock data and prototype navigation per the spec (corrected versions of 3/4/5/8/9).
- [ ] Switching mock role changes sidebar/routes; each of the 4 roles sees only its screens.
- [ ] Wizard and FileUpload exist as reusable shared components.
- [ ] Public portal (16/17) renders chrome-less via `AuthLayout`.
- [ ] No new backend/API calls introduced; state stays local.

## Proposal question round (assumptions needing PO review)
Asked here because this executor cannot prompt interactively. Confirm or correct:
1. Whole-slice plan + per-screen task delivery? (assumed yes)
2. Build on `ui.tsx` primitives but do NOT refactor modules 01/02? (assumed yes — Decision 2)
3. Mock role system now, isolated behind `useRole`? (assumed yes — Decision 3)
4. Public portal routes live under `/portal/*` via `AuthLayout`? (assumed yes)
5. All payment/LlaveMX flows simulated with overlays/toasts, zero real integration? (assumed yes)
