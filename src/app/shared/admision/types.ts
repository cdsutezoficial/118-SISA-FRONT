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

/** Screen 7 — captured independently of status; pass/fail is derived, not stored. */
export interface ExamResult {
  fecha: string
  calificacion: number
}

/** Screen 8 — captured independently of status. */
export interface InductionResult {
  fecha: string
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
  tieneDiscapacidad: boolean
  padresHablanLenguaIndigena: boolean
  hablaLenguaIndigena: boolean
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
 */
export const STATUS_ACTIONS: Record<CandidateStatus, AdmisionAction[]> = {
  REGISTERED: ['CONFIRMAR_PAGO_FICHA', 'CAMBIAR_PROGRAMA'],
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
