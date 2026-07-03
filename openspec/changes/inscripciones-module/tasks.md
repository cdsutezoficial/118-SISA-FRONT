# Tasks: Inscripciones Module — Screens 2-7

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~1500-1900 total (6 screens) |
| 400-line budget risk | High (Screen 4); Low-Medium (others) |
| Chained PRs recommended | Yes |
| Suggested split | 6 PRs, one per screen |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main (Screen 4: size-exception) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Screen | PR | Est. lines | Risk |
|---|---|---|---|---|
| 1 | Estudiantes Listado | PR 1 | ~180-220 | Low |
| 2 | Estudiante Detalle | PR 2 | ~260-320 | Medium |
| 3 | Nuevo Ingreso Wizard | PR 3 (size:exception, sub-commits/step) | ~550-700 | High |
| 4 | Reinscripción Wizard | PR 4 | ~300-380 | Medium-High |
| 5 | Documentos Institucionales | PR 5 | ~200-260 | Medium |
| 6 | Expediente Recibidos | PR 6 (parallel to PR 5) | ~200-260 | Medium |

Order: PR1 → PR2 → PR3 → PR4 → (PR5 ∥ PR6), all base `main`.

## Phase 1: Estudiantes Listado (PR 1) [spec: Estudiantes Listado]

- [x] 1.1 Create `src/app/pages/inscripciones/EstudiantesList.tsx`: StudentStatus badges, filters (periodo/programa/nivel/estado), free-text search, row actions (Detalle/Reinscribir/Kardex)
- [x] 1.2 Wire `src/app/router.tsx` `estudiantes` stub → `<EstudiantesList />`
- [x] 1.3 Verify: filter by "Baja Temporal" narrows list correctly; tsc + build clean

## Phase 2: Estudiante Detalle (PR 2) [spec: Estudiante Detalle]

- [x] 2.1 Add `ProgramChangeType`/`StudentProgramHistory` to `src/app/shared/inscripciones/types.ts`; add `mockStudentProgramHistory` to `mockData.ts` (exactly one open row per student, `hasta: null`)
- [x] 2.2 Create `EstudianteDetalle.tsx`: summary card + 4 tabs (Info General/Historial Académico/Historial Programas/Documentos); Cambiar-Programa mock modal (Confirmar blocked until all 4 fields set)
- [x] 2.3 Wire `router.tsx` `estudiantes/detalle` stub → component
- [x] 2.4 Verify: one open program-history row per student; modal gate blocks partial fields; tsc + build clean

## Phase 3: Nuevo Ingreso Wizard (PR 3, size:exception) [spec: Nuevo Ingreso Wizard]

Single PR, sub-commit per step (form is lifted/shared across steps). Fallback split only if reviewer rejects the exception: PR-4a (shell + Pasos 1/3/4/5), PR-4b (Paso 2).

- [x] 3.1 [commit] Shell: `NuevoIngresoWizard.tsx` 5-step scaffold, lifted form state, wire `router.tsx` `nuevo-ingreso` stub
- [x] 3.2 [commit] Paso 1 — Datos del Admitido
- [x] 3.3 [commit] Paso 2 — Datos Complementarios: inline catalogs (estados/bachillerato/sangre/laboral); domicilio Estado/Municipio via `MUNICIPIOS_POR_ESTADO` (add to `mockData.ts`) when `nationality === 'Mexicana'`, else free-text; bachillerato INEGI+CCT vs País/Estado/Ciudad free-text branch on `studiedInMexico`
- [x] 3.4 [commit] Paso 3 — Grupo Asignado from `mockGroups` (add to `mockData.ts`)
- [x] 3.5 [commit] Paso 4 — Documentos Institucionales: accept-all gate disables Siguiente
- [x] 3.6 [commit] Paso 5 — Pago: hide método + show "cubierto por beneficio" when total is $0.00, else require método before Finalizar; success modal
- [x] 3.7 Verify: accept-all gate, $0-total hides payment, non-zero requires method, nationality/bachillerato branching scenarios; tsc + build clean; request size:exception if PR >400 lines
- [x] 3.8 [commit] PO correction: fix Paso 2 field editability (add Contacto + Contacto de Emergencia sections, read-only Nacionalidad/Bachillerato sourced from `fichaCompleta`, editable Área/Especialidad + Promedio + Periodo de Estudios) and Paso 3 pre-assigned read-only Grupo Asignado with manual-override exception; populate `fichaCompleta` mock data for 2 demo candidates

## Phase 4: Reinscripción Wizard (PR 4) [spec: Reinscripción Wizard]

- [ ] 4.1 Create `ReinscripcionWizard.tsx` 3-step: Paso 1 student search + `FinanceQueryPort.hasActiveDebt` gate blocks Siguiente with alert; Paso 2 materias table with RETAKE (Recursamiento) vs REGULAR badge; Paso 3 confirmación
- [ ] 4.2 Wire `router.tsx` `reinscripcion` stub → component
- [ ] 4.3 Verify: active-debt blocks Siguiente; previously-failed subject shows Recursamiento; tsc + build clean

## Phase 5: Documentos Institucionales (PR 5) [spec: Documentos Institucionales]

- [ ] 5.1 Create `DocumentosInstitucionales.tsx`: CRUD list + register/edit modal (FileUpload PDF); scope GLOBAL/DIVISION/PROGRAM field-gating (división required for DIVISION/PROGRAM, programa only for PROGRAM, both hidden for GLOBAL); ACTIVE/INACTIVE toggle; inline acceptance-list view
- [ ] 5.2 Wire `router.tsx` `documentos` stub → component
- [ ] 5.3 Verify: PROGRAM scope blocks save without división+programa; GLOBAL hides both fields; tsc + build clean

## Phase 6: Expediente Recibidos (PR 6, parallel to PR 5) [spec: Expediente Delivery Checklist]

- [ ] 6.1 Create `ExpedienteRecibidos.tsx`: delivered/total progress indicator, estado-expediente badge (Completo only when all required `StudentDocument` received); row select opens inline right side-panel checklist (Entregado/Pendiente, no navigation); marking delivered sets `receivedAt`/`receivedBy`, does NOT alter `Student.status`
- [ ] 6.2 Wire `router.tsx` `expediente` stub → component
- [ ] 6.3 Verify: last doc delivered flips badge to Completo (5/5); `Student.status` unchanged after delivery; tsc + build clean
