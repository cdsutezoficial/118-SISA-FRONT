# Inscripciones Screens Specification

## Purpose

6-screen UI (local mock state, prototype navigation) covering the Enrollment student lifecycle entry: new-student enrollment, reinscription, institutional-document management, and physical-document expediente tracking. Screen 1 (Dashboard) is already implemented as a prior baseline and is not part of this spec. All routes below are verified against `src/app/router.tsx` — every screen mounts as a child of `{ path: 'inscripciones' }` under `AppLayout`, so real URLs carry the `/inscripciones/` prefix (correcting an earlier proposal draft that described them as flat/unprefixed).

## Screen Role/Route Map

| # | Screen | Route | Role |
|---|--------|-------|------|
| 1 | Dashboard (baseline, out of this spec) | `/inscripciones` | (unguarded — mirrors Admisión's index-route exception) |
| 2 | Estudiantes — Listado | `/inscripciones/estudiantes` | Gestor Académico |
| 3 | Estudiante — Detalle | `/inscripciones/estudiantes/detalle` | Gestor Académico |
| 4 | Inscripción Nuevo Ingreso — Wizard (5 pasos) | `/inscripciones/nuevo-ingreso` | Gestor Académico |
| 5 | Reinscripción — Wizard (3 pasos) | `/inscripciones/reinscripcion` | Gestor Académico |
| 6 | Documentos Institucionales — Gestión | `/inscripciones/documentos` | Administrador |
| 7 | Expediente — Documentos Recibidos | `/inscripciones/expediente` | Servicios Escolares |

## Requirements

### Requirement: Role-Scoped Access

The system MUST guard Screens 2–5 to `GESTOR_ACADEMICO`, Screen 6 to `ADMINISTRADOR`, and Screen 7 to `SERVICIOS_ESCOLARES`, redirecting any other role to `/inscripciones`. The Dashboard index route MUST remain unguarded (redirect target).

#### Scenario: Unauthorized role redirected
- GIVEN a user with role `FINANZAS`
- WHEN they navigate to `/inscripciones/documentos`
- THEN they MUST be redirected to `/inscripciones`

#### Scenario: Authorized role renders the screen
- GIVEN a user with role `GESTOR_ACADEMICO`
- WHEN they navigate to `/inscripciones/estudiantes`
- THEN the Estudiantes Listado screen MUST render

### Requirement: Estudiantes Listado (Screen 2)

The list MUST show each student's `StudentStatus` as a badge (Pendiente/Activo/Pre-Baja/Baja Temporal/Baja Definitiva/Egresado/Titulado) and MUST support filtering by periodo, programa, nivel, and estado, plus free-text search by name or matrícula. Row actions MUST route to Detalle, Reinscribir (Screen 5), and Kardex.

#### Scenario: Filter by estado narrows results
- GIVEN students with mixed statuses are listed
- WHEN Gestor Académico filters by "Baja Temporal"
- THEN only students with that status MUST remain visible

### Requirement: Estudiante Detalle (Screen 3)

The screen MUST show 4 tabs — Información General, Historial Académico, Historial de Programas, Documentos — plus a summary card with matrícula, programa, nivel, grupo, and status badge. "Historial de Programas" MUST reflect `StudentProgramHistory` (only one open record with `endedAt = null` at a time). "Cambiar Programa/Plan" MUST open a mock modal (target programa/plan/grupo/motivo) without executing any cross-module equivalence flow.

#### Scenario: Only one active program-history row is open
- GIVEN a student's program-history table
- WHEN it is rendered
- THEN exactly one row MUST show no "Hasta" date (the current stage)

#### Scenario: Cambiar Programa requires all fields before confirm
- GIVEN the modal is open with Programa selected but Plan/Grupo/Motivo empty
- WHEN Gestor Académico attempts "Confirmar cambio"
- THEN the action MUST remain blocked until all four fields are filled

### Requirement: Nuevo Ingreso Wizard — Step Gating (Screen 4)

The 5-step wizard (Datos del Admitido / Datos Complementarios / Grupo Asignado / Documentos Institucionales / Pago) MUST disable "Siguiente" on step 4 until every listed institutional document is accepted. Step 5 MUST hide the payment-method section and show a covered-by-benefit message when the total is `$0.00`; otherwise it MUST require a payment-method selection before enabling "Finalizar Inscripción".

#### Scenario: Accept-all gate blocks advancing
- GIVEN step 4 shows 3 institutional documents, only 2 accepted
- WHEN the user attempts "Siguiente"
- THEN the button MUST stay disabled

#### Scenario: Zero total hides payment method
- GIVEN a 100% scholarship reduces the total to $0.00
- WHEN step 5 renders
- THEN the payment-method section MUST be hidden and a "cubierto por beneficio" message MUST show instead

#### Scenario: Non-zero total requires a method
- GIVEN the total is greater than $0.00 and no method is selected
- WHEN the user attempts "Finalizar Inscripción"
- THEN the button MUST stay disabled until a method is chosen

### Requirement: Nuevo Ingreso Wizard — Nationality/Origin Branching (Step 2)

Step 2 MUST render INEGI Estado/Municipio selects for domicilio when the candidate's registered `nationality` (read-only, sourced from `Candidate.fichaCompleta.datosGenerales.nacionalidad`) is "Mexicana", and free-text Estado/Municipio inputs otherwise. Independently, the read-only bachillerato subsection MUST render Estado/Municipio + CCT when `studiedInMexico = true`, and País/Ciudad when `false` — mirroring the `Person`/`HighSchoolBackground` invariants in the shared kernel.

#### Scenario: Foreign nationality renders free-text address fields
- GIVEN the candidate's nationality is not "Mexicana"
- WHEN step 2 renders the Domicilio subsection
- THEN Estado and Municipio MUST render as free-text inputs, not selects

#### Scenario: Bachillerato outside Mexico renders foreign fields
- GIVEN `studiedInMexico = false` for the prellenado bachillerato data
- WHEN step 2 renders the read-only Antecedentes subsection
- THEN País and Ciudad MUST render read-only and CCT MUST NOT be shown

### Requirement: Nuevo Ingreso Wizard — Paso 2 Field Editability (Step 2, PO correction 2026-07-03)

Step 2 MUST let the candidate-turned-student update ONLY the following fields: Domicilio (calle, número exterior, número interior, colonia, estado, municipio, localidad, código postal), Contacto (teléfono, correo — new section), Área/Especialidad de Bachillerato (new field), Promedio (update), Periodo de Estudios in `YYYY-YYYY` format with end year greater than start year (new field), Laboral (unchanged), and Contacto de Emergencia (nombre de padre/madre/tutor, correo de tutor, teléfono de contacto — new section). Nacionalidad and the rest of Antecedentes de Bachillerato (nombre de preparatoria, tipo de bachillerato, estudió-en-México toggle, ubicación de la preparatoria, CCT) MUST render read-only, sourced from `Candidate.fichaCompleta` when present, since they were already captured during Admisión. When a candidate has no `fichaCompleta`, read-only fields MUST show a graceful fallback ("No disponible") instead of blank.

#### Scenario: Bachillerato fields render read-only from Admisión data
- GIVEN the selected candidate has `fichaCompleta.antecedentesEscolares` populated
- WHEN step 2 renders the Antecedentes de Bachillerato subsection
- THEN nombre de preparatoria, tipo de bachillerato, and CCT MUST render as read-only fields showing the Admisión-captured values, not editable inputs

#### Scenario: Periodo de Estudios rejects an invalid range
- GIVEN the user enters "2026-2024" in Periodo de Estudios
- WHEN the field is validated
- THEN Paso 2 MUST remain invalid until the end year is greater than the start year and both are 4-digit years

#### Scenario: Candidate without fichaCompleta shows graceful fallback
- GIVEN the selected candidate has no `fichaCompleta`
- WHEN step 2 renders the read-only Nacionalidad/Antecedentes fields
- THEN each MUST display "No disponible" instead of a blank value

### Requirement: Nuevo Ingreso Wizard — Grupo Asignado Pre-Assignment (Step 3, PO correction 2026-07-03)

Step 3 MUST display the candidate's already pre-assigned group (assigned randomly during Admisión's matrícula generation, per `GenerateMatriculasUseCase`) as a read-only field by default — not a free-pick grid. The step MUST expose a secondary, low-visual-weight action to reveal a manual-override picker for edge cases only; once a manual group is chosen, the screen MUST show a visible "reasignado manualmente" indicator. "Siguiente" MUST NOT require any user action when a pre-assigned group exists; it MUST require an explicit pick only if the manual-override picker was opened and no group has been chosen there yet.

#### Scenario: Pre-assigned group is valid without user action
- GIVEN the selected candidate has a pre-assigned group
- WHEN step 3 renders
- THEN "Siguiente" MUST already be enabled without requiring any group selection

#### Scenario: Manual override shows a reassignment indicator
- GIVEN the user opens the manual-override picker and selects a different group
- WHEN step 3 re-renders
- THEN a "Grupo reasignado manualmente" indicator MUST be visible

### Requirement: Reinscripción Wizard — Debt Gate and Retake Flagging (Screen 5)

The wizard MUST let Gestor Académico search and select an active student, MUST block "Siguiente" while `FinanceQueryPort.hasActiveDebt` is true for that student, and MUST flag subjects the student previously failed as `RETAKE` (Recursamiento badge) distinct from `REGULAR` subjects in the materias-to-enroll table.

#### Scenario: Active debt blocks advancing
- GIVEN the selected student has an active debt
- WHEN Gestor Académico views step 1
- THEN "Siguiente" MUST be disabled and a blocking alert MUST display

#### Scenario: Failed subject shows Recursamiento
- GIVEN the student failed "Cálculo Diferencial" in a prior period
- WHEN step 2 renders the materias table
- THEN that row MUST show a "Recursamiento" badge instead of "Regular"

### Requirement: Documentos Institucionales — CRUD and Scope (Screen 6)

Administrador MUST create/edit `InstitutionalDocument` records with a required `scope` (GLOBAL/DIVISION/PROGRAM). División MUST be required when scope is DIVISION or PROGRAM; Programa (dependent on división) MUST be required only when scope is PROGRAM; both MUST be hidden when scope is GLOBAL. Each record MUST support toggling ACTIVE/INACTIVE status and viewing its acceptance list, inline, without navigating away from the list.

#### Scenario: Scope PROGRAM requires division and program
- GIVEN the registration modal has Alcance = "Por Programa"
- WHEN Administrador attempts "Guardar documento" without selecting División/Programa
- THEN the action MUST remain blocked until both are selected

#### Scenario: Scope GLOBAL hides division/program fields
- GIVEN Alcance is set to "Global"
- WHEN the modal re-renders
- THEN the División and Programa fields MUST NOT be shown

### Requirement: Expediente — Delivery Checklist (Screen 7)

Servicios Escolares MUST see, per student, a delivered/total progress indicator and an "estado expediente" badge (Completo only when every required `StudentDocument` is received, Incompleto otherwise). Selecting a row MUST open an inline side panel (no navigation) listing each required document with Entregado/Pendiente state; marking a pending document as delivered MUST record `receivedAt`/`receivedBy` and MUST NOT alter `Student.status`.

#### Scenario: All documents delivered flips badge to Completo
- GIVEN a student has 4 of 5 required documents delivered
- WHEN Servicios Escolares marks the last one as entregado
- THEN the row's badge MUST change to "Completo" and the counter MUST read "5 / 5"

#### Scenario: Marking delivery does not change student status
- GIVEN a student's `StudentStatus` is `ACTIVE`
- WHEN Servicios Escolares marks a document as delivered
- THEN `Student.status` MUST remain `ACTIVE` (delivery is expediente-only, per RN-INS-001)

## Out of Scope (traceability)

- `EnrollmentSlip` physical-delivery confirmation (`READY → DELIVERED`) — not built in Screen 7.
- Extraordinarios (RF-INS-003), reincorporaciones (RF-INS-004/005), recursamientos por materia (RF-INS-006), equivalencias (RF-INS-007) — capture UI lives in Calificaciones/Control Escolar; Enrollment only reacts to their events.
