# Tasks: Admisión Module (Frontend)

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~3000-4000 total; ~100-250 per work unit |
| 400-line budget risk | High (aggregate) / Low (per unit) |
| Chained PRs recommended | Yes |
| Suggested split | 19 units: Foundation A, Foundation B, 17 screen units |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Resolved
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain — tracker branch `admision-module` (from `main`, post PR#3 merge); each unit branches from and PRs into the previous unit's branch, only the tracker merges to `main` at the end.
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Notes |
|---|---|---|---|
| 1 | Foundation A: RoleContext + role-aware nav/Navbar + router skeleton (1.1-1.4, 1.9) | PR 1 | branch `admision/foundation-a` from tracker `admision-module`; ~200-300 lines |
| 2 | Foundation B: Wizard, FileUpload, Candidate types/mockData (1.5-1.8) | PR 2 | branch `admision/foundation-b` from PR1's branch; ~200-300 lines |
| 3-19 | One screen each, in Phase 2 order below | PR 3-19 | each ~100-250 lines; branch from the immediately preceding unit's branch |

Chain strategy resolved: **feature-branch-chain**. Tracker branch `admision-module` pushed from `main` (post PR#3 merge). Only the tracker merges to `main` when the whole module is done; each work-unit PR targets the previous unit's branch.

**Branch naming gotcha**: git refs are paths, so a branch named `admision-module/x` cannot coexist with the tracker branch `admision-module` (ref lock conflict — a ref can't be both a file and a directory). All work-unit branches use the `admision/` prefix instead (a distinct top segment from `admision-module`), e.g. `admision/foundation-a`, `admision/screen-03-candidatos-list`.

## Phase 1: Foundation (prereqs for all screens)

- [x] 1.1 Create `src/app/shared/RoleContext.tsx`: `Role` union, `RoleProvider`, `useRole()` → `{role, setRole, availableRoles, user}`, `role: Role|null`
- [x] 1.2 Modify `src/main.tsx`: wrap `RouterProvider` in `RoleProvider`
- [x] 1.3 Modify `src/app/layouts/AppLayout.tsx`: add `roles: Role[]` per `NAV_ITEMS` entry, filter sidebar by `useRole().role`, add Admisión entry
- [x] 1.4 Modify `src/app/layouts/AppLayout.tsx`: Navbar dropdown maps `availableRoles`, calls `setRole`, replaces hardcoded buttons
- [x] 1.5 Create `src/app/shared/Wizard.tsx`: `WizardStep[]`, validation-gated Next, back preserves state
- [x] 1.6 Create `src/app/shared/FileUpload.tsx`: accept/required props, simulated progress, preview/remove, no network
- [x] 1.7 Create `src/app/shared/admision/types.ts`: `CandidateStatus`, `Candidate`, `STATUS_META`, `STATUS_ACTIONS`
- [x] 1.8 Create `src/app/shared/admision/mockData.ts`: `mockCandidates` seed across all statuses
- [x] 1.9 Modify `src/app/router.tsx`: add `admision` parent (under `AppLayout`, index = Dashboard) and `portal` parent (under `AuthLayout`, 4 route slots) skeletons

## Phase 2: Screens — one self-contained unit per screen, dependency order

- [x] 2.1 Screen 1 Dashboard — `pages/admision/AdmisionDashboard.tsx`, route `/admision` (index)
- [x] 2.2 Screen 2 Canales Difusión — `pages/admision/CanalesDifusion.tsx`, route `/admision/canales`
- [x] 2.3 Screen 3 Candidatos Listado — `pages/admision/CandidatosList.tsx`, route `/admision/candidatos`; 6 status badges, conditional row actions
- [x] 2.4 Screen 5 Candidato Detalle — `pages/admision/CandidatoDetalle.tsx`, route `/admision/candidatos/detalle`; Pagos tab (Ficha + Inducción), no Admitir/Rechazar (depends on 2.3)
- [x] 2.5 Screen 4 Registro Wizard (dual-mount) — `pages/admision/CandidatoRegistro.tsx` w/ `origin` prop; routes `/admision/candidatos/registrar` (staff) + `/portal/registro` (public); LlaveMX gate, isFirstChoice, payment-method gate (uses Wizard, 1.5) — **reworked 2026-07-01**: PO supplied the complete, authoritative 56-field-slot ficha list; wizard expanded from 3 to 4 steps (Datos Generales+Domicilio+Contacto / Información Complementaria+Ingresos / Selección de Carrera+Antecedentes Escolares / Confirmación unchanged), `Candidate.fichaCompleta?: FichaAdmisionCompleta` added to `shared/admision/types.ts`. See `specs/admision-screens/spec.md` for the updated requirement.
- [x] 2.6 Screen 13 Ficha Confirmación (dual-mount) — `pages/admision/FichaConfirmacion.tsx` w/ `origin` prop; routes `/admision/candidatos/ficha` + `/portal/registro/ficha`; simulated overlay, staff-only back-link (depends on 2.5)
- [x] 2.7 Screen 6 Confirmar Pago Ficha — `pages/admision/ConfirmarPagoFicha.tsx`, route `/admision/candidatos/pago-ficha`; FileUpload, sets PAID
- [x] 2.8 Screen 10 Confirmar Pago Inducción — `pages/admision/ConfirmarPagoInduccion.tsx`, route `/admision/candidatos/pago-induccion`; FileUpload, unlocks Screen 8
- [x] 2.9 Screen 8 Registro Inducción — `pages/admision/RegistroInduccion.tsx`, route `/admision/candidatos/induccion`; locked until induction paid, banner links to 2.8 (depends on 2.8)
- [x] 2.10 Screen 7 Registro Examen — `pages/admision/RegistroExamen.tsx`, route `/admision/candidatos/examen`; live Aprobado/Reprobado vs 60
- [ ] 2.11 Screen 11 Selección Candidatos — `pages/admision/SeleccionCandidatos.tsx`, route `/admision/seleccion`; Director-only, Admitir/Rechazar locks row
- [ ] 2.12 Screen 12 Generar Matrículas — `pages/admision/GenerarMatriculas.tsx`, route `/admision/matriculas`; per-program generate, sets ENROLLED + matrícula (depends on 2.11)
- [ ] 2.13 Screen 9 Publicar Resultados — `pages/admision/PublicarResultados.tsx`, route `/admision/publicar`; blocked until all ACCEPTED are ENROLLED (depends on 2.12, corrected ordering)
- [ ] 2.14 Screen 14 Aplicar Descuento — `pages/admision/AplicarDescuento.tsx`, route `/admision/descuentos`; 100% auto-confirms payment/enables induction (depends on 2.7, 2.8)
- [ ] 2.15 Screen 15 Habilitar Inducción — `pages/admision/HabilitarInduccion.tsx`, route `/admision/habilitacion`; batch-enable, excludes Exento (depends on 2.7, 2.14)
- [ ] 2.16 Screen 16 Portal Acceso — `pages/portal/PortalInduccion.tsx`, route `/portal/induccion`; simulated LlaveMX + folio/CURP, sets role `CANDIDATO`
- [ ] 2.17 Screen 17 Portal Pago Inducción — `pages/portal/PortalInduccionPago.tsx`, route `/portal/induccion/pago`; already-paid alt state, simulated overlay (depends on 2.16)

## Phase 3: Verification (manual — no test runner configured in 118-SISA-FRONT)

- [ ] 3.1 Manual walkthrough per role (Serv. Escolares, Finanzas, Director, Administrador) confirms `NAV_ITEMS` filtering
- [ ] 3.2 Verify dual-mount parity: screens 4 & 13 identical fields/validation staff vs public, correct post-submit target per mount
- [ ] 3.3 Verify status state machine: PAID/ACCEPTED/REJECTED/ENROLLED only via screens 6/11/12; exam/induction never alter status
- [ ] 3.4 Verify `/portal/*` renders chrome-less for anonymous (`role===null`) and `CANDIDATO`
- [ ] 3.5 Confirm rollback: removing `pages/admision/`, `pages/portal/`, new `shared/` files, and router/AppLayout/main.tsx blocks restores prior state
