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
