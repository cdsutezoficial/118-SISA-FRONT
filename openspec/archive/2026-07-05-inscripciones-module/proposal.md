# Proposal: Inscripciones Module (Frontend)

## Intent

Build the Inscripciones (Enrollment) module UI as hand-written React/TS in `118-SISA-FRONT`, matching the corrected UX spec in `118-SISA-CLAUDE/docs/design/figma/prompts/04-inscripciones.md` and the domain model in `dominio/04-inscripciones.md`. This is the second module after Admisión; it consumes admitted candidates and manages the full student lifecycle entry: new-student enrollment, automatic-style reinscription, institutional-document acceptance, and the physical-document expediente checklist. It reuses the shared widgets (Wizard, FileUpload) and mock-role context already built for Admisión.

## Baseline — already implemented (NOT re-proposed, tracked for traceability)

Preliminary work landed ad-hoc before this SDD flow, on two unmerged local branches:

- **Foundation A** (`inscripciones/foundation-a`, `0128641`): `src/app/shared/inscripciones/types.ts` (Student, Enrollment, EnrollmentSlip, StudentDocument, InstitutionalDocument, DocumentAcceptance + status metas), `src/app/shared/inscripciones/mockData.ts`, 7 reserved routes in `router.tsx` (6 as role-guarded stubs), "Inscripciones" nav item in the sidebar, per-screen `RequireRole` guards.
- **Screen 1 — Dashboard** (`inscripciones/screen-01-dashboard`, `cd01ddf`/`6eb18d8`/`3caa031`): `src/app/pages/inscripciones/InscripcionesDashboard.tsx` mounted at `/inscripciones`. `typecheck` + `build` pass clean.

This proposal covers ONLY the 6 remaining screens; the baseline is context to build on, not scope.

## Scope

**Scoping interpretation:** ONE proposal/spec/design for the whole Inscripciones slice; `sdd-tasks` slices delivery **screen by screen** (each screen = its own PR, `auto-chain` / `stacked-to-main`, merging directly to main in order — same as Admisión's 17 screens).

### In Scope — 6 remaining screens (route under `/inscripciones`)

| # | Screen | Route | Role |
|---|--------|-------|------|
| 2 | Estudiantes: Listado | `/inscripciones/estudiantes` | Gestor Académico |
| 3 | Estudiante: Detalle (4 tabs) | `/inscripciones/estudiantes/detalle` | Gestor Académico |
| 4 | Inscripción Nuevo Ingreso: Wizard (5 pasos) | `/inscripciones/nuevo-ingreso` | Gestor Académico |
| 5 | Reinscripción: Wizard (3 pasos) | `/inscripciones/reinscripcion` | Gestor Académico |
| 6 | Documentos Institucionales: Gestión | `/inscripciones/documentos` | Administrador |
| 7 | Expediente: Documentos Recibidos | `/inscripciones/expediente` | Servicios Escolares |

Key behaviors from the domain model: `StudentStatus` (`PENDING→ACTIVE→...`) drives badges; Screen 4 wizard steps = Datos del Admitido / Datos Complementarios (INEGI-dependent selects, high-school + health + employment subsections) / Grupo Asignado / Documentos Institucionales (accept-all gate) / Pago; Screen 5 blocks on active debt (`hasActiveDebt`) and flags `RETAKE` materias; Screen 6 CRUD of `InstitutionalDocument` (scope GLOBAL/DIVISION/PROGRAM + optional periodo) with PDF upload; Screen 7 side-panel checklist of `StudentDocument` (mark-as-delivered, delivery-only tracking).

### Out of Scope

- Real backend / API calls — pages keep local `useState` mock data (existing-module convention).
- Real auth / payments / LlaveMX / Evo Payments — mocked (overlays/toasts). Role is mock-switched.
- **Physical delivery confirmation of `EnrollmentSlip`** (`ConfirmEnrollmentSlipDeliveryUseCase`, `READY→DELIVERED`) — deferred; Screen 7 tracks `StudentDocument` receipt only, not slip delivery.
- **Extraordinarios (RF-INS-003), reincorporaciones int/ext (RF-INS-004/005), recursamientos por materia (RF-INS-006), equivalencias (RF-INS-007)** — capture/approval UI lives in Calificaciones and Control Escolar modules; Enrollment only reacts to their events. Not built here.
- StudentProgramHistory tab modal wiring beyond a read-only historial + mock "Cambiar Programa/Plan" modal (no cross-module flow).

## Capabilities

### New Capabilities
- `inscripciones-screens`: the 7 Inscripciones screens (Dashboard baseline + 6 in scope) with local mock state and prototype navigation.

### Modified Capabilities
- None at the spec level. Reuses `shared-wizard` (Screens 4/5), `shared-file-upload` (Screen 6 PDF), `mock-role-context`, and `app-shell` (nav item already added in Foundation A) as-is.

## Approach

- **Reuse** existing patterns and primitives: List/CRUD (`UsuariosList`/Admisión listados), Detail+Tabs (`UsuarioDetalle`/Candidato Detalle), `shared/Wizard.tsx` for both wizards, `shared/FileUpload.tsx` for Screen 6, and `shared/ui.tsx` primitives (`SearchSelect`, `DatePicker`, `Switch`, `ConfirmModal`, `Toast`, `FieldLabel/Help/Error`). No new shared widgets required.
- **One source of truth** for types/mock data: extend `shared/inscripciones/types.ts` + `mockData.ts` as later screens need `StudentProgramHistory` and `Class` (intentionally deferred in Foundation A).
- Domain-accurate UI states: debt gate on Screen 5, accept-all gate on Screen 4 step 4, `$0.00`-by-beca branch on Screen 4 step 5, INEGI-vs-foreign address/high-school branches on step 2.
- Fill in the 6 stub routes in `router.tsx` with real page components under `src/app/pages/inscripciones/`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/router.tsx` | Modified | Replace 6 stubs with real page elements (routes already reserved) |
| `src/app/pages/inscripciones/` | New | 6 page components (Screens 2–7) |
| `src/app/shared/inscripciones/types.ts` | Modified | Add `StudentProgramHistory`, `Class`, group/materia shapes as needed |
| `src/app/shared/inscripciones/mockData.ts` | Modified | Extend example data for the 6 screens |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Screen 4 wizard complexity (5 steps, conditional subsections) overflows one PR budget | High | Per-screen task slicing; Screen 4 may split into sub-work-units in `sdd-tasks` |
| Domain drift vs. corrected docs (debt gate, activation-by-payment) | Med | Docs are the audited source of truth; mirror invariants (RN-INS-001) in UI states |
| Deferred entities (`Class`, `StudentProgramHistory`) needed mid-build | Med | Add to `types.ts` incrementally when the consuming screen lands |
| Scope creep into extraordinarios/reincorporaciones/equivalencias | Med | Explicit out-of-scope; those live in other modules |

## Rollback Plan

Pure additive UI. Revert by removing `src/app/pages/inscripciones/` page components, restoring the 6 stub route elements in `router.tsx`, and reverting the `types.ts`/`mockData.ts` additions. No data migrations, no backend, no shared-widget deletions. Baseline (Foundation A + Dashboard) is unaffected.

## Dependencies

- None external. Reuses `shared/Wizard.tsx`, `shared/FileUpload.tsx`, `shared/RoleContext.tsx`, `shared/RequireRole.tsx`, `shared/ui.tsx`, and the Inscripciones baseline (types/mockData/routes) already present.

## Success Criteria

- [ ] Screens 2–7 render with example mock data and prototype navigation per the corrected `04-inscripciones.md`.
- [ ] Role guards hold: Screens 2–5 (Gestor Académico), Screen 6 (Administrador), Screen 7 (Servicios Escolares).
- [ ] Screen 4 enforces accept-all gate (step 4) and handles `$0.00`-by-beca and INEGI-vs-foreign branches.
- [ ] Screen 5 blocks "Siguiente" when the student has active debt and flags `RETAKE` materias.
- [ ] Screen 6 CRUD-mocks `InstitutionalDocument` (scope + optional periodo + PDF upload); Screen 7 side-panel marks `StudentDocument` as delivered.
- [ ] `EnrollmentSlip` physical-delivery confirmation is NOT built (deferred).
- [ ] `typecheck` (`tsc --noEmit`) and `vite build` pass clean; no new backend/API calls.

## Proposal question round (assumptions needing PO review)

Asked here because this executor cannot prompt interactively. Confirm or correct:
1. Whole-slice plan + per-screen PR delivery (`auto-chain` / `stacked-to-main`, direct to main)? (assumed yes)
2. `EnrollmentSlip` physical-delivery confirmation stays out of Screen 7 for now? (assumed yes — per task brief)
3. Screen 3 "Cambiar Programa/Plan" is a mock modal only, no cross-module equivalence flow? (assumed yes)
4. Extraordinarios/reincorporaciones/recursamientos/equivalencias fully out of this module? (assumed yes — they live in Calificaciones / Control Escolar)
5. No new shared widgets — Wizard + FileUpload reused as-is? (assumed yes)
