/**
 * Shared Admisión domain types.
 *
 * Centralizes the candidate shape and status-driven UI (badges, enabled row
 * actions) so the 17 Admisión screens don't each invent their own candidate
 * shape or duplicate the state-machine rules.
 *
 * Status state machine (see specs/admision-screens/spec.md — "Candidate
 * Status State Machine"):
 *   REGISTERED → PAID → EXAM_TAKEN → ACCEPTED|REJECTED → ENROLLED
 * Only ficha-payment confirmation (Screen 6), Director selection (Screen 11),
 * and matrícula generation (Screen 12) transition status. Exam results
 * (Screen 7) and induction results (Screen 8) are independent fields and
 * MUST NOT alter status. Publishing results (Screen 9) MUST NOT transition
 * status either.
 */
export type CandidateStatus =
  | 'REGISTERED'
  | 'PAYMENT_EXPIRED'
  | 'PAID'
  | 'EXAM_TAKEN'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ENROLLED'

/** Ficha/Inducción payment confirmation state (Screens 5, 6, 10, 14). */
export interface PaymentRecord {
  status: 'PENDIENTE' | 'CONFIRMADO' | 'EXENTO'
  monto: number
  /** Present when a partial discount applies (Screen 14) — the pre-discount amount. */
  montoOriginal?: number
  referencia?: string
  metodo?: string
  fecha?: string
}

// ── Screen 13 (ficha) real-backend flow types — mirror the backend DTOs ──
// Distinct from the mock `PaymentRecord` shape: `POST /candidates`, the ficha
// PDF route and `POST /candidates/{id}/payments/confirm` speak the backend's
// language (`referenceNumber`/`amount`/`registrationDeadline`/`PENDING|PAID`).

/**
 * The dates the ficha carries, and why they are separate fields.
 *
 * `registrationDeadline` is the sales window's closing day, snapshotted onto the
 * ticket at registration — the same boundary that stops new fichas from being
 * issued. `paymentClosesOn` is the tuition concept's `available_until`, read
 * live on every request; it is an engine-side boundary the catalog moves by
 * editing Conceptos de Pago, and it is NOT the date shown to the applicant.
 *
 * The date the screen promises as "Fecha límite de pago" is `paymentDeadline`:
 * the earlier of `registrationDeadline` and the ficha's own `registeredAt` +
 * N-day plazo. It is the only one the applicant can act on.
 *
 * Never merge these into one field again. The single `deadline` they replaced was
 * the registration snapshot labelled "Fecha límite de pago", so the number under
 * a promise of "pay by" was a date that had already passed and was enforced by
 * nothing.
 */
export interface VentanaFechas {
  /** `yyyy-MM-dd` — snapshot of `program_admission_config.closes_at`. */
  registrationDeadline: string | null
  /**
   * `yyyy-MM-dd` — live `payment_concept.available_until`, the engine boundary.
   * `null` when the concept has no closing date configured.
   */
  paymentClosesOn: string | null
  /**
   * `yyyy-MM-dd` — the date shown as "Fecha límite de pago": the earlier of the
   * sales window and the ficha's own plazo. `null` only when neither is known;
   * callers omit the row rather than printing a placeholder.
   */
  paymentDeadline: string | null
}

/** `RegisterCandidateUseCase.FichaPayment` — the ticket the POST generates. */
export interface FichaPaymentBackend extends VentanaFechas {
  referenceNumber: string
  amount: number
  /** Backend enum — `PENDING` (ficha generated, unpaid) or `PAID`. */
  status: 'PENDING' | 'PAID'
}

/** `POST /candidates/{id}/payments/confirm` — paid-ficha confirmation. */
export interface PaymentConfirmationBackend {
  candidateId: string
  folio: string
  candidateStatus: CandidateStatus
  referenceNumber: string
  amount: number
  paidAt: string
  receiptNumber: string
}

/**
 * `POST /candidates/{id}/payments/checkout` — EVO Hosted Checkout session
 * (Fase 4). The frontend stores {@code orderId} for the verified return and
 * configures the official {@code checkout.min.js} with {@code sessionId};
 * on success the SDK reports a {@code resultIndicator} to cross-check.
 */
export interface CheckoutInitiationBackend {
  candidateId: string
  orderId: string
  sessionId: string
  merchant: string
  successIndicator: string
  checkoutJsUrl: string
}

/**
 * What `POST /candidates/{id}/payments/release` reports — the quota slot the
 * browser gave up on, settled against the gateway rather than against the
 * browser's word.
 *
 * The two fields are separate because they answer different questions, and the
 * applicant needs to hear something different about each: a freed slot invites
 * a retry, while `PAYMENT_CAPTURED` means the money already arrived and the
 * timeout was cosmetic. One boolean would collapse those into the same
 * message.
 */
export type PaymentReleaseOutcome =
  | 'SLOT_RELEASED'
  | 'PAYMENT_IN_PROGRESS'
  | 'PAYMENT_CAPTURED'
  | 'RETAINED_UNEXPLAINED'

export interface PaymentReleaseBackend {
  candidateId: string
  orderId: string
  outcome: PaymentReleaseOutcome
  slotReleased: boolean
}

/**
 * `POST /candidates/payment-access` — the "vuelve a pagar mi ficha" lookup.
 *
 * Reached with a sequential folio plus the last 3 characters of the CURP, so
 * this is deliberately a PAYMENT-ONLY projection: no address, no health or
 * income profile, no GPA. See the backend `AccessFichaPaymentUseCase` for why.
 * `alreadyPaid` + `receiptNumber` + `paidAt` let the screen show a receipt
 * without hitting EVO again (a checkout attempt would just 409).
 */
export interface FichaPaymentAccessBackend extends VentanaFechas {
  candidateId: string
  folio: string
  nombre: string | null
  programName: string | null
  amount: number
  referenceNumber: string
  paymentStatus: 'PENDING' | 'PAID'
  receiptNumber: string | null
  /** ISO instant, present only when `alreadyPaid`. */
  paidAt: string | null
  alreadyPaid: boolean
  /** The candidate's lifecycle state, so the screen can label it. */
  candidateStatus: CandidateStatus
  /**
   * Whether the ficha can still be paid **right now**.
   *
   * Not the same question as `candidateStatus`. The status is what the nightly
   * VENCEN_FICHAS sweep wrote down; this flag is what the backend computes live
   * from the window (the earlier of the ficha's own plazo and the closing day of
   * its admission process). Between a deadline passing and the sweep running they
   * disagree, and this is the one to obey when deciding whether to show "Pagar":
   * the checkout refuses an expired ficha with a 409, so a button offered during
   * that window is a button that cannot work.
   *
   * Do not re-derive it here from `paymentDeadline`. The screen has no access to
   * `registeredAt` on this endpoint, and a second copy of the window rule in
   * TypeScript is exactly how the portal and the engine start disagreeing.
   */
  paymentExpired: boolean
}

/** `GET /candidates/{id}` — ficha projection for route-refresh fallback. */
export interface CandidateFichaBackend extends VentanaFechas {
  candidateId: string
  folio: string
  candidateStatus: CandidateStatus
  registeredAt: string
  admissionConfigId: string
  programName: string
  curp: string
  firstName: string
  lastName1: string
  lastName2: string
  email: string
  referenceNumber: string
  amount: number
  paymentStatus: 'PENDING' | 'PAID'
  receiptNumber: string | null
  paidAt: string | null
}

/**
 * Route-state payload `CandidatoRegistro` hands to `FichaConfirmacion` (Screen
 * 13), built from the real `POST /candidates` response. Optional so a direct
 * mount / page refresh can fall back to `GET /candidates/{id}`.
 */
export interface FichaRouteState {
  candidate: Candidate
  metodoPago: MetodoPagoFicha
  pagoFicha?: {
    referencia: string
    monto: number
    /** Snapshot of the sales window, under its own name — see {@link VentanaFechas}. */
    fechaLimiteInscripcion: string
    /**
     * The date the payment really closes. `''` means the concept has no closing
     * date, which the screen renders as no row at all.
     */
    fechaLimitePago: string
    estado: 'PENDING' | 'PAID'
    folio: string
  }
}

/** Screen 7 — captured independently of status; pass/fail is derived, not stored. */
export interface ExamResult {
  fecha: string
  calificacion: number
}

/** Screen 8 — captured independently of status. */
export interface InductionResult {
  fecha: string
  calificacion: number
  resultado: string
}

export interface Candidate {
  id: string
  folio: string
  nombre: string
  curp: string
  email: string
  telefono: string
  programa: string
  division: string
  /** Difusión channel the candidate came from (Screen 2). */
  canal: string
  status: CandidateStatus
  fechaRegistro: string
  examen: ExamResult | null
  induccionResultado: InductionResult | null
  /** Screen 15 — batch-enabled for induction; independent of payment confirmation. */
  induccionHabilitada: boolean
  pagoFicha: PaymentRecord
  pagoInduccion: PaymentRecord
  /** Assigned only on ENROLLED (Screen 12). */
  matricula?: string
  /**
   * Full "ficha de admisión" data captured by Screen 4's 4-step wizard, per the
   * PO's corrected complete field list (2026-07-01) and the domain fields
   * defined in `00-shared-kernel.md` (`Person`, `Address`, `HealthProfile`,
   * `DiversityProfile`, `EmploymentInfo`, `HighSchoolBackground`).
   *
   * Deliberately kept OFF the top-level `Candidate` fields (not flattened) so
   * already-shipped screens 1/3/5 — which only read `status`/`folio`/`programa`/
   * etc. — never need to change and keep typechecking with zero risk. Optional
   * because only the reworked Screen 4 wizard populates it going forward;
   * existing `mockCandidates` rows may leave it `undefined`.
   */
  fichaCompleta?: FichaAdmisionCompleta
}

/** Screen 4, Paso 1 — "Datos Generales" section of the ficha. */
export type Nacionalidad = 'Mexicana' | 'Extranjera'

/** Matches `00-shared-kernel.md`'s `MaritalStatus` enum (all values but `OTRO`, not requested by the PO's field list). */
export type EstadoCivil = 'Soltero/a' | 'Casado/a' | 'Unión libre' | 'Divorciado/a' | 'Viudo/a'

/** Catálogo de lengua natal — Español + lenguas indígenas más habladas en México. */
export type LenguaNatal = 'Español' | 'Náhuatl' | 'Maya' | 'Mixteco' | 'Zapoteco' | 'Otra'

/** Catálogo de tipo de bachillerato de procedencia (subsistemas educativos mexicanos más comunes). */
export type TipoBachillerato = 'General' | 'Tecnológico' | 'Bachillerato Técnico' | 'CONALEP' | 'Otro'

/** Matches `00-shared-kernel.md`'s `ProgramModality` enum (`PRESENCIAL`, `MIXTA`). */
export type ModalidadPrograma = 'Presencial' | 'Mixta'

export interface DatosGeneralesFicha {
  // LlaveMX-verified, read-only after verification — mirrors `Person`'s
  // identity fields; the CURP already encodes birth date/sex/birth state, so
  // these are identity-verification facts, not self-reported profile data.
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  curp: string
  fechaNacimiento: string
  sexo: string
  /** LlaveMX-provided (read-only) when `nacionalidad === 'Mexicana'`; free-text/editable when `'Extranjera'` (LlaveMX/CURP doesn't cover foreign birth states). */
  estadoNacimiento: string

  // Manually captured
  nacionalidad: Nacionalidad | ''
  /** Required + shown only when `nacionalidad === 'Mexicana'`. */
  municipioNacimiento: string
  /** Required + shown only when `nacionalidad === 'Extranjera'`. */
  paisNacimiento: string
  /** Required + shown only when `nacionalidad === 'Extranjera'`. */
  ciudadNacimiento: string
  estadoCivil: EstadoCivil | ''
  lenguaNatal: LenguaNatal | ''
  tieneHijos: boolean
}

/** Screen 4, Paso 1 — "Domicilio Actual" section. Mirrors `00-shared-kernel.md`'s `Address` VO (Mexicana branch only — this mock frontend doesn't model the foreign-address branch since the wizard's domicilio section doesn't ask nationality again). */
export interface DomicilioFicha {
  calle: string
  numeroExterior: string
  numeroInterior: string
  colonia: string
  estado: string
  municipio: string
  localidad: string
  codigoPostal: string
}

/** Screen 4, Paso 1 — "Contacto" section (email lives on `Candidate.email`; only the extra phone fields live here). */
export interface ContactoFicha {
  telefonoCasa: string
  celular: string
}

/** Screen 4, Paso 2 — "Información Complementaria". Mirrors `00-shared-kernel.md`'s `HealthProfile` + `DiversityProfile` VOs, flattened to booleans (no free-text description sub-fields — not requested by the PO's field list). */
export interface InformacionComplementariaFicha {
  tieneEnfermedadPreexistente: boolean
  /** Solo se captura si tieneEnfermedadPreexistente = true. Mirrors HealthProfile.conditionDescription. */
  descripcionEnfermedad?: string
  tieneDiscapacidad: boolean
  /** Solo se captura si tieneDiscapacidad = true. Mirrors HealthProfile.disabilityDescription. */
  descripcionDiscapacidad?: string
  padresHablanLenguaIndigena: boolean
  /** Solo se captura si padresHablanLenguaIndigena = true. Mirrors DiversityProfile.parentsIndigenousLanguage. */
  lenguaIndigenaPadres?: string
  hablaLenguaIndigena: boolean
  /** Solo se captura si hablaLenguaIndigena = true. Mirrors DiversityProfile.indigenousLanguage. */
  lenguaIndigenaPropia?: string
  /** Autoidentificación — dato distinto de hablar la lengua o de que los padres la hablen (RN-ADM-014). */
  seIdentificaIndigena: boolean
  seIdentificaNoBinario: boolean
  perteneceComunidadLgbttiq: boolean
  esAfrodescendiente: boolean
  /** Solo se captura si esAfrodescendiente = true (RN-ADM-015). Autoidentificación, distinta de la ascendencia. */
  seIdentificaAfrodescendiente?: boolean
}

/** Screen 4, Paso 2 — "Ingresos". Mirrors `00-shared-kernel.md`'s `monthlyFamilyIncome` (on `Person`) + `EmploymentInfo` VO. */
export interface IngresosFicha {
  ingresoMensualFamiliar: number
  trabaja: boolean
  /** Required + shown only when `trabaja === true`. */
  tipoTrabajo: string
  telefonoTrabajo: string
  ingresoMensual: number | null
  nombreEmpresa: string
  puesto: string
  horaInicio: string
  horaFin: string
}

/** Screen 4, Paso 3 — "Selección de Carrera". `programa`/`canal`/`isFirstChoice` stay on the existing top-level `Candidate.programa`/`canal` fields and the wizard's local step state — only the new `modalidad` field is added here. */
export interface SeleccionCarreraFicha {
  modalidad: ModalidadPrograma | ''
}

/** Screen 4, Paso 3 — "Antecedentes Escolares". Mirrors `00-shared-kernel.md`'s `HighSchoolBackground` VO. */
export interface AntecedentesEscolaresFicha {
  nombrePreparatoria: string
  tipoBachillerato: TipoBachillerato | ''
  estudioBachilleratoEnMexico: boolean
  /** Required + shown when `estudioBachilleratoEnMexico === true`. */
  estadoPreparatoria: string
  /** Required + shown only when `estudioBachilleratoEnMexico === true`. */
  municipioPreparatoria: string
  /** Required + shown only when `estudioBachilleratoEnMexico === false`. */
  paisPreparatoria: string
  /** Required + shown only when `estudioBachilleratoEnMexico === false`. */
  ciudadPreparatoria: string
  promedio: number
  /** Clave de Centro de Trabajo (catálogo SEP). */
  cct: string
  /** Confirmation-only field — must match `cct`; never persisted separately once validated. */
  cctConfirmacion: string
}

/**
 * Full "ficha de admisión" — the complete candidate profile captured across
 * Screen 4's 4 steps, grouped by conceptual section (see field-by-field
 * mapping in `specs/admision-screens/spec.md`, "Registro de Candidato Wizard
 * (Screen 4)").
 */
export interface FichaAdmisionCompleta {
  datosGenerales: DatosGeneralesFicha
  domicilio: DomicilioFicha
  contacto: ContactoFicha
  informacionComplementaria: InformacionComplementariaFicha
  ingresos: IngresosFicha
  seleccionCarrera: SeleccionCarreraFicha
  antecedentesEscolares: AntecedentesEscolaresFicha
}

/** Minimum passing score for Screen 7's live Aprobado/Reprobado computation. */
export const EXAM_PASSING_SCORE = 60

export function getExamResultLabel(calificacion: number): 'Aprobado' | 'Reprobado' {
  return calificacion >= EXAM_PASSING_SCORE ? 'Aprobado' : 'Reprobado'
}

/** Minimum passing score for Screen 8's live Aprobado/Reprobado computation (per `03-admision.md` Pantalla 8: distinct minimum from the exam's 60). */
export const INDUCTION_PASSING_SCORE = 70

export function getInductionResultLabel(calificacion: number): 'Aprobado' | 'Reprobado' {
  return calificacion >= INDUCTION_PASSING_SCORE ? 'Aprobado' : 'Reprobado'
}

export interface StatusMeta {
  label: string
  badgeClass: string
}

/**
 * Badge label + Tailwind classes per status, per the corrected color scheme
 * in `03-admision.md`: Registrado gris, Ficha Pagada azul, Examen Aplicado
 * morado, Admitido verde, Rechazado rojo, Matriculado verde oscuro.
 */
export const STATUS_META: Record<CandidateStatus, StatusMeta> = {
  REGISTERED: { label: 'Registrado', badgeClass: 'bg-gray-100 text-gray-600 border border-gray-200' },
  // Not a rejection: the ficha lapsed unpaid and the CURP is free again, which is
  // a different thing to say to the office than "Rechazado" (that one belongs to
  // the academic evaluation and would corrupt the admission reports).
  PAYMENT_EXPIRED: { label: 'Pago Vencido', badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200' },
  PAID: { label: 'Ficha Pagada', badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200' },
  EXAM_TAKEN: { label: 'Examen Aplicado', badgeClass: 'bg-violet-50 text-violet-700 border border-violet-200' },
  ACCEPTED: { label: 'Admitido', badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  REJECTED: { label: 'Rechazado', badgeClass: 'bg-red-50 text-red-700 border border-red-200' },
  ENROLLED: { label: 'Matriculado', badgeClass: 'bg-emerald-700 text-white border border-emerald-800' },
}

/** Row actions gated by candidate status on Screen 3 (Candidatos Listado). */
export type AdmisionAction =
  | 'CONFIRMAR_PAGO_FICHA'
  | 'CONFIRMAR_PAGO_INDUCCION'
  | 'REGISTRAR_EXAMEN'
  | 'REGISTRAR_INDUCCION'
  | 'CAMBIAR_PROGRAMA'

/**
 * Baseline per-status action eligibility, per the corrected Pantalla 3 rules:
 * - Confirmar Pago Ficha only if REGISTERED
 * - Confirmar Pago Inducción only if PAID or EXAM_TAKEN
 * - Registrar Examen only if PAID
 * - Registrar Inducción only if (PAID or EXAM_TAKEN) — ALSO requires induction
 *   payment confirmed at the candidate-instance level; use `canRegistrarInduccion`
 *   below rather than this map alone for that action.
 * - Cambiar Programa only if status is not ACCEPTED/REJECTED/ENROLLED
 *
 * `PAYMENT_EXPIRED` gets nothing: the window closed unpaid, so there is no
 * payment left to confirm and the CURP is free again. It is also not terminal the
 * way ACCEPTED/REJECTED are — the person may register a new ficha, which is a
 * different folio rather than a new row action here.
 */
export const STATUS_ACTIONS: Record<CandidateStatus, AdmisionAction[]> = {
  REGISTERED: ['CONFIRMAR_PAGO_FICHA', 'CAMBIAR_PROGRAMA'],
  PAYMENT_EXPIRED: [],
  PAID: ['CONFIRMAR_PAGO_INDUCCION', 'REGISTRAR_EXAMEN', 'REGISTRAR_INDUCCION', 'CAMBIAR_PROGRAMA'],
  EXAM_TAKEN: ['CONFIRMAR_PAGO_INDUCCION', 'REGISTRAR_INDUCCION', 'CAMBIAR_PROGRAMA'],
  ACCEPTED: [],
  REJECTED: [],
  ENROLLED: [],
}

/**
 * Full eligibility check for a given row action, combining `STATUS_ACTIONS`
 * with the one compound rule that depends on the candidate instance
 * (Registrar Inducción also requires induction payment confirmed).
 */
export function isAdmisionActionEnabled(candidate: Candidate, action: AdmisionAction): boolean {
  if (!STATUS_ACTIONS[candidate.status].includes(action)) return false
  if (action === 'REGISTRAR_INDUCCION') return candidate.pagoInduccion.status === 'CONFIRMADO'
  return true
}

/** Screen 13 payment-method choice — mirrors `CandidatoRegistro`'s `MetodoPago`. */
export type MetodoPagoFicha = 'ONLINE' | 'VENTANILLA'

// ── Screen 3 (Candidatos Listado) real-backend flow types ─────────────────────
// Mirrors `GET /candidates` (`CandidateListItemResponse` / `CandidateListResponse`).
// Deliberately leaner than the mock `Candidate` shape: the list renders exactly
// these columns and row actions, so payments/induction flags/exam results stay on
// `GET /candidates/{id}` instead of leaking onto the list.

/** A single row of `GET /candidates` — `{id, folio, fullName, curp, programId, programName, status, registeredAt}`. */
export interface CandidateListRow {
  id: string
  folio: string
  fullName: string
  curp: string
  /** Id of the chosen `AcademicProgram` (NOT the admission-config id). */
  programId: string
  programName: string
  status: CandidateStatus
  /** ISO-8601 `Instant`. */
  registeredAt: string
}

/** `GET /candidates` envelope — same `{items, totalElements, totalPages, page, size}` as every paginated list. */
export interface CandidateListPage {
  items: CandidateListRow[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

/** One payment section of the staff candidate detail (`GET /candidates/{id}/detail`). */
export interface CandidateDetailPaymentBackend {
  concept: 'ADMISSION_FICHA' | 'INDUCTION_COURSE'
  amount: number
  referenceNumber: string
  paymentStatus: 'PENDING' | 'PAID'
  receiptNumber: string | null
  paidAt: string | null
  orderId: string | null
}

/** Staff-facing detail payload for the first two tabs of `CandidatoDetalle.tsx`. */
export interface CandidateDetailBackend {
  candidateId: string
  folio: string
  fullName: string
  candidateStatus: CandidateStatus
  registeredAt: string
  programName: string | null
  divisionName: string | null
  curp: string
  email: string | null
  homePhone: string | null
  mobilePhone: string | null
  outreachChannelName: string | null
  admissionPayment: CandidateDetailPaymentBackend
  inductionPayment: CandidateDetailPaymentBackend | null
}
