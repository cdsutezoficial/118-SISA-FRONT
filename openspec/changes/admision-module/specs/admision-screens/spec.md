# Admisión Screens Specification

## Purpose

17-screen admission-flow UI (local mock state, prototype navigation) covering the candidate lifecycle from registration to enrollment, role-scoped per screen, including chrome-less public candidate routes (self-registration/ficha at `/portal/registro*`, induction access/payment at `/portal/induccion*`). Corrected versions of screens 3, 4, 5, 8, 9 (per `03-admision.md` "Correcciones") are authoritative over the original prompt text.

## Screen Role/Route Map

| # | Screen | Route | Role |
|---|--------|-------|------|
| 1 | Dashboard | `/admision` | Serv. Escolares |
| 2 | Canales Difusión | `/admision/canales` | Serv. Escolares |
| 3 | Candidatos Listado | `/admision/candidatos` | Serv. Escolares |
| 4 | Registro Wizard | Staff: `/admision/candidatos/registrar` (`AppLayout`) · Público: `/portal/registro` (`AuthLayout`) | Serv. Escolares (staff-assisted) + Candidato (autorregistro público) |
| 5 | Candidato Detalle | `/admision/candidatos/detalle` | Serv. Escolares |
| 6 | Confirmar Pago Ficha | `/admision/candidatos/pago-ficha` | Finanzas |
| 7 | Registro Examen | `/admision/candidatos/examen` | Serv. Escolares |
| 8 | Registro Inducción | `/admision/candidatos/induccion` | Serv. Escolares |
| 9 | Publicar Resultados | `/admision/publicar` | Serv. Escolares |
| 10 | Confirmar Pago Inducción | `/admision/candidatos/pago-induccion` | Finanzas |
| 11 | Selección Candidatos | `/admision/seleccion` | Director División |
| 12 | Generar Matrículas | `/admision/matriculas` | Serv. Escolares |
| 13 | Ficha Confirmación | Staff: `/admision/candidatos/ficha` (`AppLayout`) · Público: `/portal/registro/ficha` (`AuthLayout`) | Serv. Escolares (staff-assisted) + Candidato (autorregistro público) |
| 14 | Aplicar Descuento | `/admision/descuentos` | Serv. Escolares |
| 15 | Habilitar Inducción | `/admision/habilitacion` | Serv. Escolares |
| 16 | Portal Acceso | `/portal/induccion` | Candidato (público, sin chrome) |
| 17 | Portal Pago | `/portal/induccion/pago` | Candidato (público, sin chrome) |

### Dual-Mount Decision: Screens 4 & 13 (resolved)

PO confirmed (verbatim): "el candidato debe acceder a un formulario público donde pueda registrarse y el flujo lo lleve a pagar su ficha." Screens 4 (Registro Wizard) and 13 (Ficha Confirmación) are the **same components mounted twice** — once under `AppLayout` for staff-assisted registration (walk-in/phone), once under the bare `AuthLayout` for public self-service, mirroring the existing Login/reset-password chrome-less mounting pattern already used in this codebase. Data shape, fields, and validation are identical in both mounts; only the surrounding chrome and the post-submit landing route differ (each mount's wizard navigates to its own mount's Ficha Confirmación route — staff stays in `AppLayout`, público stays in `AuthLayout`). This replaces the previous staff-only assumption flagged for PO review.

## Requirements

### Requirement: Candidate Status State Machine

The system MUST model candidate status as a single enum: `REGISTERED → PAID → EXAM_TAKEN → ACCEPTED|REJECTED → ENROLLED`. Exam and induction results MUST be stored as independent fields and MUST NOT alter candidate status (induction is a selection input, not a status). Only ficha-payment confirmation, Director selection, and matrícula generation MUST transition status. Publishing results MUST NOT transition status.

#### Scenario: Ficha payment confirmed
- GIVEN a candidate in `REGISTERED`
- WHEN Screen 6 confirms ficha payment
- THEN status becomes `PAID`

#### Scenario: Director admits a candidate
- GIVEN a candidate in `PAID` or `EXAM_TAKEN` with exam and/or induction results recorded
- WHEN the Director clicks Admitir on Screen 11
- THEN status becomes `ACCEPTED` and the row's actions lock

#### Scenario: Matrícula generation enrolls candidate
- GIVEN an `ACCEPTED` candidate without a matrícula
- WHEN Screen 12 generates matrículas for their program
- THEN status becomes `ENROLLED` and a matrícula value is assigned

#### Scenario: Publish blocked until matrículas complete
- GIVEN at least one `ACCEPTED` candidate is not yet `ENROLLED`
- WHEN Servicios Escolares opens Screen 9
- THEN "Publicar Resultados" MUST be disabled with a blocking alert stating the pending count

#### Scenario: Dashboard publish shortcut gated by matrícula completion
- GIVEN all `ACCEPTED` candidates are `ENROLLED`
- WHEN Servicios Escolares views Screen 1
- THEN the "Publicar Resultados" quick action MUST be visible (not gated by an induction status, since induction never sets candidate status)

### Requirement: Candidatos Listado (Screen 3)

The list MUST show status badges and filter options for exactly the 6 enum values (Registrado/gris, Ficha Pagada/azul, Examen Aplicado/morado, Admitido/verde, Rechazado/rojo, Matriculado/verde oscuro). Row actions MUST be conditionally enabled: Confirmar Pago Ficha only if `REGISTERED`; Confirmar Pago Inducción only if `PAID` or `EXAM_TAKEN`; Registrar Examen only if `PAID`; Registrar Inducción only if (`PAID` or `EXAM_TAKEN`) AND induction payment confirmed; Cambiar Programa only if status is not `ACCEPTED`/`REJECTED`/`ENROLLED`.

#### Scenario: Actions hidden for ineligible status
- GIVEN a candidate with status `REGISTERED`
- WHEN Servicios Escolares views their row
- THEN "Registrar Examen" and "Registrar Inducción" MUST NOT be shown

### Requirement: Registro de Candidato Wizard (Screen 4)

**REVISED (2026-07-01)**: the PO provided the complete, authoritative field list for the "ficha de admisión" — ~56 field-slots across 7 conceptual sections, replacing the earlier 16-field draft. The Wizard is now **4 steps** and MUST be mountable in two contexts with identical data shape, fields, and validation: staff-assisted at `/admision/candidatos/registrar` (`AppLayout`, used by Servicios Escolares) and public self-service at `/portal/registro` (`AuthLayout`, no sidebar/navbar, used by the aspirant directly).

LlaveMX (per `00-TRANSVERSALES.md` RN-AUTH-005 and real-world CURP structure — the CURP itself encodes birth date, sex, and birth state) auto-fills and locks read-only: Nombre(s), Primer Apellido, Segundo Apellido, CURP, Fecha de Nacimiento, Sexo, and Estado de Nacimiento (locked only while Nacionalidad = Mexicana; editable free text while Extranjera, since LlaveMX/CURP has no foreign-birth-state data). Every other field is manually captured. Field names below mirror `00-shared-kernel.md`'s `Person`/`Address`/`HealthProfile`/`DiversityProfile`/`EmploymentInfo`/`HighSchoolBackground`.

#### Step 1 — Datos Generales, Domicilio Actual y Contacto

Identity verification gate MUST block "Siguiente" until the candidate clicks "Verificar con LlaveMX" (simulated) and a verified badge is shown, replacing any manual LlaveMX toggle. Once verified, the 7 locked fields above populate automatically.

Manual fields — *Datos Generales*: Nacionalidad (Mexicana/Extranjera radio); if Mexicana → Municipio de Nacimiento (select, from the Estado de Nacimiento LlaveMX provided); if Extranjera → País de Nacimiento, Estado de Nacimiento (now editable), Ciudad de Nacimiento; Estado Civil (select); Lengua Natal (select); ¿Tienes hijos? (Sí/No).
*Domicilio Actual*: Calle, Número Exterior, Número Interior (optional), Colonia, Estado, Municipio (depends on Estado), Localidad, Código Postal (5 digits).
*Contacto*: Email, Teléfono Casa, Celular.

#### Step 2 — Información Complementaria e Ingresos

*Información Complementaria* (7 Sí/No switches): ¿Enfermedad o diagnóstico preexistente?, ¿Discapacidad?, ¿Tu mamá o papá hablan alguna lengua indígena?, ¿Hablas alguna lengua indígena?, ¿Te identificas como No binario?, ¿Perteneces a la comunidad LGBTTTIQ+?, ¿Eres afrodescendiente?
*Ingresos*: Ingreso Mensual Familiar (numeric); ¿Trabajas? (Sí/No) — if Sí: Tipo de Trabajo, Teléfono de Trabajo, Ingreso Mensual, Nombre de la Empresa, Puesto, Hora de Inicio, Hora de Fin.

#### Step 3 — Selección de Carrera y Antecedentes Escolares

*Selección de Carrera*: Modalidad (Presencial/Mixta), Carrera (the existing "Programa Educativo Solicitado" search-select, relabeled/repositioned here), Medio de Difusión por el que se enteró (the existing "Canal" field, moved here), the required `isFirstChoice` radio (primera/segunda opción, moved here from the prior Step 2).
*Antecedentes Escolares*: Nombre de la Preparatoria de Procedencia, Tipo de Bachillerato (select), ¿Estudiaste el bachillerato en México? (Sí/No) — if Sí: Estado + Municipio de la Preparatoria; if No: País, Estado, Ciudad de la Preparatoria; Promedio (0–10); Clave de Centro de Trabajo (CCT); Confirmación de CCT (MUST match CCT — inline "Las claves no coinciden" error on mismatch, mirroring the password-confirmation pattern in `ResetConfirm.tsx`).

#### Step 4 — Confirmación (unchanged)

MUST require a payment-method selection (Evo Payments online / ventanilla) before "Finalizar Registro" is enabled. On submit, each mount MUST navigate to its own mount's Ficha Confirmación (Screen 13) — staff mount stays under `AppLayout`, público mount stays under `AuthLayout` — carrying the generated folio and payment instructions.

#### Scenario: Next blocked until identity verified
- GIVEN Step 1 is shown and identity is not yet verified
- WHEN the candidate has not clicked "Verificar con LlaveMX"
- THEN "Siguiente" MUST remain disabled

#### Scenario: Estado de Nacimiento locks and unlocks with Nacionalidad
- GIVEN identity is verified and Nacionalidad is set to "Mexicana"
- WHEN the candidate views Step 1
- THEN "Estado de Nacimiento" MUST show as a locked, LlaveMX-provided value
- GIVEN Nacionalidad is instead set to "Extranjera"
- WHEN the candidate views Step 1
- THEN "Estado de Nacimiento" MUST render as an editable free-text field alongside País and Ciudad de Nacimiento

#### Scenario: CCT confirmation mismatch blocks advancing
- GIVEN Step 3 is shown with a CCT value entered
- WHEN "Confirmación de CCT" does not match "CCT"
- THEN an inline "Las claves no coinciden" error MUST display and "Siguiente"/"Finalizar Registro" MUST stay disabled until they match

#### Scenario: Finalize requires payment method
- GIVEN Step 4 is shown with no payment method selected
- WHEN the user attempts to click "Finalizar Registro"
- THEN the button MUST stay disabled until a method is chosen

#### Scenario: Public self-registration lands on the public Ficha Confirmación
- GIVEN an aspirant completes the Wizard at `/portal/registro` (no staff session/role context)
- WHEN they click "Finalizar Registro"
- THEN they MUST land on `/portal/registro/ficha` (chrome-less, `AuthLayout`) — never on the staff route `/admision/candidatos/ficha`

#### Scenario: Staff-assisted registration lands on the staff Ficha Confirmación
- GIVEN Servicios Escolares completes the Wizard at `/admision/candidatos/registrar`
- WHEN they click "Finalizar Registro"
- THEN the app MUST navigate to `/admision/candidatos/ficha` within `AppLayout` (sidebar/navbar still present) — never to the public route

### Requirement: Candidato Detalle (Screen 5)

The "Pagos" tab MUST show two independent sections — Ficha de Admisión and Curso de Inducción — each with its own status/reference/amount/date, and a "Confirmar Pago" shortcut on the induction section only when its payment is pending. The screen MUST NOT show Admitir/Rechazar actions (that decision belongs exclusively to Screen 11).

#### Scenario: No admit/reject actions present
- GIVEN any candidate detail view
- WHEN Servicios Escolares views action buttons
- THEN only Regresar and Cambiar Programa MUST appear

### Requirement: Confirmar Pago Ficha (Screen 6)

Finanzas MUST capture payment date, method, amount received, and bank reference for concept `ADMISSION_FICHA`, with optional receipt upload, transitioning the candidate to `PAID` on confirm.

#### Scenario: Confirm payment transitions status
- GIVEN a `REGISTERED` candidate with expected amount $500.00
- WHEN Finanzas submits the form with a valid reference
- THEN status becomes `PAID` and a success toast is shown

### Requirement: Registro de Examen (Screen 7)

The form MUST capture exam date and score (0–100) and MUST compute and display Aprobado/Reprobado in real time against a minimum passing score of 60, without altering candidate status.

#### Scenario: Live pass/fail computation
- GIVEN a score of 55 is entered
- WHEN the field loses focus or changes
- THEN "Resultado: Reprobado" MUST display immediately

### Requirement: Registro de Inducción (Screen 8)

The form MUST be gated by induction-payment confirmation: if unpaid, fields and "Guardar Resultado" MUST be disabled and a blocking banner with a "Confirmar Pago del Curso de Inducción" shortcut to Screen 10 MUST display; once paid, the form MUST be enabled. Saving MUST NOT alter candidate status.

#### Scenario: Form locked when induction payment pending
- GIVEN induction payment is not confirmed for a candidate
- WHEN Servicios Escolares opens Screen 8 for that candidate
- THEN the form MUST be disabled and the warning banner MUST display

### Requirement: Publicar Resultados (Screen 9)

The screen MUST display total processed, admitted, rejected, and matrículas-generated counts, MUST block publishing while any `ACCEPTED` candidate lacks a matrícula, and on confirmed publish MUST only notify/lock the list (no status transitions, per the state-machine requirement).

#### Scenario: Confirm publish shows final toast
- GIVEN all `ACCEPTED` candidates are `ENROLLED`
- WHEN Servicios Escolares confirms "Confirmar y Publicar"
- THEN a toast confirms candidates can consult their matrícula

### Requirement: Confirmar Pago Inducción (Screen 10)

Finanzas MUST capture payment date, method, amount, and receipt number for concept `INDUCTION_COURSE`, with optional file upload, enabling Screen 8 to unlock for that candidate.

#### Scenario: Confirm unlocks induction result entry
- GIVEN induction payment is confirmed
- WHEN Servicios Escolares reopens Screen 8 for that candidate
- THEN the form MUST be enabled

### Requirement: Selección de Candidatos (Screen 11)

The Director MUST see only candidates in their division's programs, with Admitir/Rechazar actions disabled once a decision exists for that candidate. Decisions MUST be permitted even when exam or induction results are missing.

#### Scenario: Decision locks the row
- GIVEN a candidate with no prior decision
- WHEN the Director clicks Admitir
- THEN the row badge updates to "Admitido" and both action buttons become disabled

### Requirement: Generar Matrículas (Screen 12)

The screen MUST list `ACCEPTED`-candidate counts per program with a per-program "Generar" action and a global "Generar para Todos los Pendientes" action; each MUST require confirmation before assigning matrícula values. The "Publicar resultados de admisión" navigation button MUST only appear once every program shows Completado.

#### Scenario: Generate transitions all accepted candidates in a program
- GIVEN program IDGS has 48 `ACCEPTED` candidates and 0 matrículas
- WHEN Servicios Escolares confirms generation for IDGS
- THEN all 48 transition to `ENROLLED` with assigned matrícula values and the row shows Completado

### Requirement: Ficha de Admisión Confirmación (Screen 13)

The screen MUST be mountable in the same two contexts as Screen 4, with identical content/behavior: staff at `/admision/candidatos/ficha` (`AppLayout`) and público at `/portal/registro/ficha` (`AuthLayout`, no sidebar/navbar). In both mounts it MUST display the folio, payment amount, reference, due date, and tabbed instructions for both payment methods (online pre-selected), with simulated "Pagar en línea" (overlay, no real redirect) and toast-only "Enviar instrucciones a mi correo". The "← Volver al listado de candidatos" link MUST only appear in the staff mount (no candidate listing exists in the público mount).

#### Scenario: Pay online shows simulated overlay
- GIVEN the online tab is active
- WHEN the candidate clicks "Pagar en línea"
- THEN a "Redirigiendo a Evo Payments..." overlay MUST display with no real navigation

#### Scenario: Público mount hides the staff "back to listing" link
- GIVEN the screen is rendered at `/portal/registro/ficha`
- WHEN the page renders
- THEN the "← Volver al listado de candidatos" link MUST NOT appear (no sidebar/listing context exists for an anonymous candidate)

### Requirement: Aplicar Descuento (Screen 14)

Servicios Escolares MUST search a candidate by folio/name/CURP, choose concept (ficha or inducción) and discount type (percentage 1–99 or 100%-free). A 100% discount MUST auto-confirm the targeted payment without Finanzas action; a 100% induction discount MUST also auto-enable the candidate for induction.

#### Scenario: 100% induction discount auto-enables
- GIVEN a candidate with ficha paid
- WHEN Servicios Escolares applies a 100% discount to "Curso de Inducción"
- THEN the induction payment is auto-confirmed and the candidate becomes auto-enabled for induction without using Screen 15

### Requirement: Habilitar para Inducción (Screen 15)

The list MUST only include candidates with ficha paid (`PAID` or later), MUST support individual and batch (checkbox) enabling, and MUST exclude already-`Exento` (100%-discounted) candidates from the actionable selection.

#### Scenario: Batch enable
- GIVEN 2 eligible candidates are checked
- WHEN Servicios Escolares clicks "Habilitar seleccionados (2)"
- THEN both rows update to "Habilitado" and a toast confirms the count

### Requirement: Portal Candidato — Acceso (Screen 16)

The public, chrome-less screen MUST offer two access paths: simulated LlaveMX (button triggers a simulated flow, no real OAuth) and folio + last-3-CURP-digits (client-side format validation only: folio pattern, exactly 3 digits). On success it MUST navigate to Screen 17; on failure it MUST show an inline error without navigating, and the screen MUST NOT call any real authentication backend.

#### Scenario: Invalid CURP digits format
- GIVEN the candidate enters 2 digits in the CURP field
- WHEN they submit "Acceder"
- THEN an inline validation error MUST display and no navigation MUST occur

#### Scenario: Valid mock credentials proceed
- GIVEN a folio and 3-digit CURP suffix are entered
- WHEN the candidate submits "Acceder"
- THEN the app navigates to Screen 17 using local mock matching (no backend call)

### Requirement: Portal Candidato — Pago Inducción (Screen 17)

The screen MUST show candidate name/program/folio, the induction amount (with struck-through original price when a partial discount applies), and tabbed payment instructions, OR — when payment is already confirmed — an alternate "already paid" state (confirmation date, receipt folio, green badge) instead of the payment tabs. "Pagar en línea" MUST only show the simulated overlay.

#### Scenario: Already-paid variant suppresses payment tabs
- GIVEN the candidate's induction payment is confirmed
- WHEN they load Screen 17
- THEN payment tabs MUST be hidden and the "¡Pago confirmado!" banner MUST display instead

## Risks / Assumptions Flagged for PO

- **Resolved**: Screens 4/13 staff-only vs. public — see "Dual-Mount Decision" note above the Requirements section. Both screens now ship as dual-mount (staff under `AppLayout`, público under `AuthLayout` at `/portal/registro` and `/portal/registro/ficha`), same components, identical data/validation, route-dependent landing only.
- **New open question for design phase**: the public self-registration mount (`/portal/registro`) needs a `router.tsx` entry separate from the staff mount but sharing the same page component(s) — confirm at design time whether this is two thin route wrappers around one shared component, or one component branching on a `isPublicMount` prop/context. Not a spec-level concern (WHAT only), but flagging so `sdd-design` addresses it explicitly.
