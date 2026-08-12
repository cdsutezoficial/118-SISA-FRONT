# Project Context — 118-SISA-FRONT

## Purpose

Frontend functional prototype for SISAv2 (Sistema Integral de Servicios Académicos). React 18 + TypeScript + Vite, fully mocked — no real backend. All data lives in in-memory state / `sessionStorage`. Part of the larger SISAv2 workspace (`C:\workspace\SISAv2`), which also contains `118-SISA-CLAUDE` (requirements/domain design) and a future `118-SISA-BACK` repo.

## Tech Stack

- **Framework**: React 18.3.1 + React Router 7.13.0
- **Language**: TypeScript (`typescript ^6.0.3`)
- **Build tool**: Vite 6.3.5 (`@vitejs/plugin-react`)
- **Styling**: Tailwind CSS 4.1.12 (`@tailwindcss/vite`) + shadcn/ui-style components under `src/app/components/ui/`
- **UI primitives**: Radix UI (extensive set), `lucide-react`, `sonner` (toasts), `recharts`, `react-hook-form`
- **Package manager**: pnpm (`pnpm-workspace.yaml`, `pnpm.overrides`)
- **Scripts**: `dev` (vite), `build` (vite build), `typecheck` (`tsc --noEmit`)
- **No test runner configured** — no vitest/jest/playwright/cypress in `package.json`, no `*.test.ts(x)`/`*.spec.ts(x)` files found in `src/`.

## Project Conventions

### Code Structure

- `src/app/router.tsx` — central route table (React Router 7)
- `src/app/layouts/` — `AppLayout.tsx` (sidebar/navbar chrome), `AuthLayout.tsx` (bare `Outlet`, used for auth + public portal routes)
- `src/app/pages/` — screens; flat for the original módulo 01 (Programación) pages, per-module subfolder for newer modules (`pages/admision/`, `pages/inscripciones/`, `pages/portal/`)
- `src/app/shared/` — cross-cutting: `RoleContext.tsx` + `RequireRole.tsx` (mock-auth role guard), `Wizard.tsx`, `FileUpload.tsx`, `hooks.ts`, `types.ts`, `ui.tsx` (shared atomic UI), `utils.ts`
- `src/app/shared/<modulo>/types.ts` + `src/app/shared/<modulo>/mockData.ts` — per-module domain types and in-memory mock data (established pattern: `admision/`, `inscripciones/`)
- `src/app/components/ui/` — shadcn/ui-style atomic component library (generated, Radix-based)

### Shared UI Components (`src/app/shared/ui.tsx`)

Key exports relevant for building new pages:

| Export | Description |
|---|---|
| `SearchSelect` | Single-select dropdown with search; accepts `string[]` options |
| `SelectOption` | `{ value: string; label: string }` — option shape for object-based selects |
| `SearchSelectField` | Labeled dropdown with search; accepts `SelectOption[]`; use instead of `SearchSelect` when options are id/label pairs (e.g. division picker) |
| `FieldLabel`, `FieldHelp`, `FieldError` | Form field label/hint/error helpers |
| `inputCls(disabled, hasError)` | Tailwind class helper for `<input>` and `<select>` |
| `ModeSwitcher` | Register / Ver / Editar tab bar used in all form pages |
| `Switch` | Toggle switch for status (active/inactive) |
| `Toast`, `ActionBtn` | Feedback toast and icon action button |

### Responsive Design Conventions

Established pattern for all list and form pages (see `CHANGELOG.md` for rollout history):

**Lists:**
- Container: `px-4 sm:px-8 py-6 sm:py-8`
- Header: `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`
- Filters: `flex flex-col sm:flex-row sm:items-center gap-3`
- **Desktop table**: `hidden md:block` wrapper around the `<table>`
- **Mobile cards**: `md:hidden space-y-3` — one card per record; toggle + badge on top, action buttons (Ver/Editar) full-width at bottom
- **Mobile pagination**: Anterior | `{page} / {totalPages}` | Siguiente

**Forms:**
- Grid: `grid grid-cols-12` with `col-span-12 sm:col-span-8/4` (never bare `col-span-8/4`)
- Action buttons: `flex flex-col-reverse sm:flex-row sm:justify-end gap-3` + `w-full sm:w-auto` per button

### Role Guard Pattern

`RequireRole` (`src/app/shared/RequireRole.tsx`) wraps a route's `element`; enforces active mock role (from `RoleContext`) against an `allowedRoles` allow-list, redirecting (with a pending toast) otherwise. Each module's Dashboard/index route is intentionally left unguarded to avoid redirect loops, since it is the guard's own `redirectTo` target.

### Testing

No test runner is configured in this repo. Verification currently relies on `tsc --noEmit` (typecheck) and `vite build`. Strict TDD Mode is **disabled** — see Testing Capabilities below.

## SDD History

- Módulo Admisión: completed and archived at `openspec/archive/2026-07-01-admision-module/` (proposal, design, tasks, specs, archive-report).
- Existing specs (living): `openspec/specs/admision-screens.md`, `app-shell.md`, `mock-role-context.md`, `shared-file-upload.md`, `shared-wizard.md`.
- This `sdd-init` run is the first formal initialization for this repo; prior openspec usage predates it (specs/archive existed, but no `sdd-init/*` engram context or persisted testing-capabilities record).

## Persistence

- **Mode**: hybrid (openspec files + Engram).
- **Engram `project`**: `118-sisa-claude` — this is the SISAv2 workspace umbrella project (all repos under `C:\workspace\SISAv2` share this Engram project; Engram detects projects by git repo, and the umbrella folder itself is not a git repo).
- **Engram topic_key convention**: repo-scoped, `sdd-init/{repo-name}` — this repo uses `sdd-init/118-sisa-front` (NOT `sdd-init/118-sisa-claude`, which is already occupied by the `118-SISA-CLAUDE` repo's own requirements/design status memory, per established convention recorded at Engram observation #61).
