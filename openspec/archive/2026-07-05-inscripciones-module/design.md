# Design: Inscripciones Module — 6 Remaining Screens (Frontend)

## Technical Approach

Additive, hand-written React/TS. Fill the 6 Foundation-A stub routes (already nested under
`{ path: 'inscripciones', children: [...] }` in `router.tsx`, mounted directly under `AppLayout`)
with real components in `src/app/pages/inscripciones/`. **No route migration is pending** — the URLs
are already `/inscripciones/estudiantes`, `/inscripciones/nuevo-ingreso`, etc. (verified against
`router.tsx` lines 203–232; the proposal's "flat routes" note is incorrect and is superseded here).

Every screen reuses the existing primitives: `shared/Wizard.tsx`, `shared/FileUpload.tsx`, and
`shared/ui.tsx` (`SearchSelect`, `SimpleSelect`, `Switch`, `ConfirmModal`, `ActionBtn`, `Toast`,
`FieldLabel/FieldHelp/FieldError`, `inputCls`). Domain shapes come from the already-built
`shared/inscripciones/types.ts` + `mockData.ts`. Cards, Badges, Tables, Alerts, side-panels, radio
groups, progress bars and autocomplete lists are composed **inline with Tailwind per page**, exactly
as the archived Admisión screens do — they are layout compositions, not reusable widgets. Pages keep
local `useState` mock data; payments, PDF viewers, and downloads are simulated overlays/toasts.

## Architecture Decisions

### Decision: No new shared widgets — reuse ui.tsx + Wizard + FileUpload, compose the rest inline

**Choice**: Confirm the proposal's claim. Interactive primitives the 6 screens need already exist:
dependent Select (`SearchSelect`), toggle (`Switch`), confirmation (`ConfirmModal`), PDF upload
(`FileUpload`), stepper (`Wizard`). What has **no** shared primitive — radio group (Paso 5 payment
method), time picker (Paso 2 work hours), generic Alert, Badge, Card, Table, side-panel, progress bar
— is trivial inline Tailwind, and Admisión already builds all of these inline per page.
**Alternatives considered**: (a) extract Alert/Badge/Card/Table into `shared/ui.tsx` now; (b) add a
`RadioGroup`/`TimePicker` primitive.
**Rationale**: Extracting widgets mid-module is scope creep with no second consumer yet; it would also
touch the archived Admisión module for consistency. Native `<input type="time">` covers the two work-hour
fields; a 2-option radio is 6 lines of JSX. Follow the existing convention (compose inline) rather than
introduce a component library this module doesn't need. Only genuinely reused logic (`STUDENT_STATUS_META`)
already lives in `types.ts`.

### Decision: Paso 2 (Datos Complementarios) mirrors Admisión's `CandidatoRegistro` field logic

**Choice**: The Nuevo-Ingreso wizard's Paso 2 (domicilio + antecedentes bachillerato + salud + laboral)
is a subset of the branching already solved in `pages/admision/CandidatoRegistro.tsx`: the
Estado/Municipio selects, the `estudioEnMexico` Switch → INEGI-vs-foreign field swap, and the
`TIPOS_BACHILLERATO` catalog. Inscripciones **duplicates the small catalog consts inline** in its own
Screen-4 component (`ESTADOS_CATALOGO`, `TIPOS_BACHILLERATO`, blood-type, employment-type), rather than
importing from the archived Admisión screen or extracting a cross-module `shared/catalogos.ts`.
**Alternatives considered**: (a) extract Admisión's inline catalogs to a shared cross-module file and
import; (b) `import { ESTADOS_CATALOGO } from '../admision/CandidatoRegistro'`.
**Rationale**: Cross-module import couples Inscripciones to an archived screen's internals; extracting a
shared file mutates the archived module (risk, scope creep). Duplicating ~4 tiny mock consts is cheap,
zero-risk, and keeps each module self-contained — the same tradeoff Admisión itself accepted with its
flat `MUNICIPIOS_CATALOGO`.

### Decision: Municipio as a real dependent Select via `MUNICIPIOS_POR_ESTADO`

**Choice**: Honor the Figma spec literally ("Municipio dependiente de Estado"). Add a small
`MUNICIPIOS_POR_ESTADO: Record<string, string[]>` mock seeded for a few estados (Morelos with real
municipios; 2–3 others token). Municipio `SearchSelect` options = `MUNICIPIOS_POR_ESTADO[estado] ?? []`
and the field resets when Estado changes.
**Alternatives considered**: mirror Admisión's **flat** `MUNICIPIOS_CATALOGO` (independent of estado).
**Rationale**: Admisión flattened it as a shortcut, but the corrected Figma prompt explicitly asks for a
dependent select and the delegation calls it out. A `Record<estado, municipio[]>` is the minimal honest
mock of that dependency and demonstrates the cascade UX real backend will need. This is the **one data
extension** required (documented below, not implemented in this phase).

### Decision: Screen 4 wizard = ONE PR, sub-commits per step; Paso 2 extractable as the split seam

**Choice**: With `auto-chain` / `stacked-to-main` (each screen its own PR), Screen 4 exceeds the 400-line
budget. Deliver it as a **single PR** (one working wizard = one atomic, rollback-able deliverable),
structured as sub-commits per step: (1) wizard shell + route wiring + catalog/type extension, (2) Paso 1
Datos del Admitido, (3) Paso 2 Datos Complementarios, (4) Paso 3 Grupo, (5) Paso 4 Docs (accept-all gate),
(6) Paso 5 Pago + success modal. Accept `size:exception` for this PR.
**Alternatives considered**: (a) one big commit; (b) split into stacked child PRs across wizard steps.
**Rationale**: The `Wizard` is parent-driven (steps array + lifted form state), so steps share one
`useState` form object — splitting mid-wizard across PRs would ship a non-functional partial wizard.
Sub-commits keep review incremental while the PR stays a coherent deliverable. **Fallback** if a reviewer
demands hard ≤400-line PRs: extract Paso 2 into its own `Paso2Complementarios.tsx` child component (its
self-contained form slice is the natural seam) → PR-4a (shell + pasos 1/3/4/5 + success), PR-4b (Paso 2).

### Decision: Per-screen role guards preserved from Foundation A

**Choice**: Keep the existing `RequireRole` wrappers verbatim when replacing each stub element:
Screens 2–5 `GESTOR_ACADEMICO`, Screen 6 `ADMINISTRADOR`, Screen 7 `SERVICIOS_ESCOLARES`, all with
`redirectTo="/inscripciones"`. The index Dashboard stays unguarded (guard redirect target).
**Rationale**: Guards are already correct in `router.tsx`; only the placeholder `<div>` inside each
`RequireRole` changes to the real component. Zero routing/guard churn.

### Decision: Screen 3 tabs & Screen 7 side-panel need two deferred entities added incrementally

**Choice**: Screen 3 Tab 3 (Historial de Programas) needs `StudentProgramHistory`; the "Cambiar
Programa/Plan" action is a **mock modal only** (local state, no persistence). Screen 4 Paso 3 (Grupo)
and Screen 5 Paso 2 (Materias) render group + subject rows from `mockEnrollments` + a light `mockGroups`
seed rather than a full `Class` aggregate. Add `StudentProgramHistory` (and minimal group/subject mock
rows) to `types.ts`/`mockData.ts` when Screens 3/4/5 land — the files already flag these as deferred.
**Rationale**: Matches the Foundation-A doc comment; keeps types honest to `dominio/04-inscripciones.md`
without modeling `Class`/`CourseClass` fully in a mock frontend.

## Data Flow

    router.tsx  (inscripciones parent, under AppLayout)
      ├─ /estudiantes         → EstudiantesList     ─ mockStudents ─ STUDENT_STATUS_META → badges/filters
      ├─ /estudiantes/detalle → EstudianteDetalle   ─ mockStudents + mockEnrollments + mockStudentDocuments
      │                                               + StudentProgramHistory (new) → 4 tabs; Cambiar-Programa modal
      ├─ /nuevo-ingreso       → NuevoIngresoWizard   ─ <Wizard steps=[1..5]/> ; lifted useState(form)
      │        step2: SearchSelect(estado)→MUNICIPIOS_POR_ESTADO(new) + Switch(estudioEnMexico)→branch
      │        step4: mockInstitutionalDocuments → accept-all gate (Siguiente disabled until all ✓)
      │        step5: cargos → $0-beca branch hides método de pago ; Finalizar → success modal
      ├─ /reinscripcion       → ReinscripcionWizard  ─ <Wizard steps=[1..3]/> ; autocomplete over mockStudents
      │        step1: hasActiveDebt → Alert + Next disabled ; step2: RETAKE rows (mockEnrollments) → amber badge
      ├─ /documentos          → DocumentosInstitucionales ─ useState(mockInstitutionalDocuments) CRUD + register modal
      └─ /expediente          → ExpedienteRecibidos  ─ mockStudents + mockStudentDocuments → progress N/5
               "Registrar documentos" → inline right side-panel (checklist, Marcar entregado)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/pages/inscripciones/EstudiantesList.tsx` | Create | Screen 2 — list + filters (periodo/programa/nivel/estado) + search + pagination |
| `src/app/pages/inscripciones/EstudianteDetalle.tsx` | Create | Screen 3 — summary card + 4 tabs + Cambiar-Programa mock modal |
| `src/app/pages/inscripciones/NuevoIngresoWizard.tsx` | Create | Screen 4 — 5-step Wizard; success modal (sub-commits per step) |
| `src/app/pages/inscripciones/ReinscripcionWizard.tsx` | Create | Screen 5 — 3-step Wizard; debt gate + RETAKE flags |
| `src/app/pages/inscripciones/DocumentosInstitucionales.tsx` | Create | Screen 6 — CRUD list + register/edit modal (FileUpload PDF) |
| `src/app/pages/inscripciones/ExpedienteRecibidos.tsx` | Create | Screen 7 — list + progress + inline side-panel checklist |
| `src/app/router.tsx` | Modify | Replace 6 stub `<div>` elements with real components (guards unchanged) |
| `src/app/shared/inscripciones/types.ts` | Modify | Add `StudentProgramHistory` interface + `ProgramChangeType`; export types for new catalogs |
| `src/app/shared/inscripciones/mockData.ts` | Modify | Add `MUNICIPIOS_POR_ESTADO`, minimal `mockGroups`/subject rows, `mockStudentProgramHistory` seed |
| `src/app/pages/inscripciones/NuevoIngresoWizard.tsx` (inline consts) | Create | `ESTADOS_CATALOGO`, `TIPOS_BACHILLERATO`, blood-type, employment-type (duplicated from Admisión pattern) |

## Interfaces / Contracts (extensions — documented, NOT implemented this phase)

```ts
// shared/inscripciones/types.ts — additions
export type ProgramChangeType = 'INGRESO' | 'CAMBIO_CARRERA' | 'CAMBIO_PLAN' | 'TSU_CONTINUIDAD'
export interface StudentProgramHistory {
  id: string; studentId: string
  programa: string; plan: string
  desde: string; hasta: string | null   // null = current program
  tipoCambio: ProgramChangeType
}

// shared/inscripciones/mockData.ts — additions
export const MUNICIPIOS_POR_ESTADO: Record<string, string[]>  // dependent Municipio select source
export const mockStudentProgramHistory: StudentProgramHistory[]
export const mockGroups: { grupo: string; nivel: string; turno: string; capacidad: number
  materias: { materia: string; clave: string; creditos: number; horario: string }[] }[]
```

`InstitutionalDocument` catalog already exists (`mockInstitutionalDocuments`) — no extension needed for
Screen 6. `StudentDocument` + `STUDENT_DOCUMENT_TYPE_LABELS` already cover Screen 7 — no extension needed.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Status/label maps, accept-all gate boolean, debt-gate boolean, Municipio cascade reset | pure-function checks (no runner configured) |
| Integration | Wizard Next-gating per step; INEGI/foreign branch swap; $0-beca hides payment; side-panel open/close | in-app manual walkthrough |
| E2E | 6-screen navigation per role vs corrected `04-inscripciones.md` | manual click-through |

No automated runner is configured in `118-SISA-FRONT`; gate is `tsc` typecheck + `vite build` clean, plus
manual verification against the Figma prompt.

## Migration / Rollout

No migration. Pure additive UI. Rollback: delete `pages/inscripciones/*` (Screens 2–7), restore the 6 stub
`<div>` route elements in `router.tsx`, revert the `types.ts`/`mockData.ts` additions. Foundation A +
Screen 1 Dashboard baseline unaffected. Delivery: `auto-chain` / `stacked-to-main`, one PR per screen;
Screen 4 carries `size:exception` (see decision above).

## Open Questions

- [ ] Screen 4 Paso 2 work-hours: native `<input type="time">` vs `SearchSelect` of time slots — design
      picks native `<input type="time">` (no primitive needed); confirm acceptable in tasks.
- [ ] `MUNICIPIOS_POR_ESTADO` seed depth — full INEGI catalog is out of scope; seed Morelos real +
      token entries for 2–3 estados. Confirm that mock depth is enough for the prototype.
- [ ] Screen 4 PR: default to single PR + `size:exception`; escalate to the Paso-2-extraction split only
      if the reviewer rejects the exception. Orchestrator to confirm at the Review Workload Guard.
