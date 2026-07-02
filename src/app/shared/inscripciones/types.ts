/**
 * Shared Inscripciones (Enrollment) domain types.
 *
 * Mirrors `dominio/04-inscripciones.md` (Bounded Context: Enrollment). Centralizes
 * the Student/Enrollment/EnrollmentSlip/StudentDocument/InstitutionalDocument/
 * DocumentAcceptance shapes so the 7 Inscripciones screens share one source of
 * truth, the same way `shared/admision/types.ts` does for the Admisión module.
 *
 * `StudentProgramHistory` (RF-INS-007, program-change bitácora) and `Class`
 * (Group + Subject + Teacher) are intentionally NOT modeled here — no screen in
 * this first slice (Foundation A + Screen 1 Dashboard) reads them. Add them when
 * Screen 3 ("Historial de Programas" tab) or Screen 4 ("Grupo Asignado" step)
 * are implemented.
 */

/** Matches `00-shared-kernel.md`'s `StudentStatus` enum. */
export type StudentStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'PRE_LOW'
  | 'TEMPORARY_LOW'
  | 'LOW'
  | 'GRADUATED'
  | 'TITLED'

/** Matches `00-shared-kernel.md`'s `ProgramModality` enum. */
export type ModalidadInscripcion = 'Presencial' | 'Mixta'

export interface Student {
  id: string
  /** Format `{año4}{periodo1}{consecutivo4}` per `00-TRANSVERSALES.md` — permanent, never changes. */
  matricula: string
  nombre: string
  curp: string
  email: string
  telefono: string
  programa: string
  division: string
  /** e.g. "1er Cuatrimestre TSU", "8vo Cuatrimestre Ing" — `AcademicLevel` rendered as a human label for this mock frontend. */
  nivelActual: string
  grupo: string
  status: StudentStatus
  /** Fecha de primer ingreso (`enrollmentDate` in the domain doc). */
  fechaInscripcion: string
  /**
   * Human period label for the student's admission cohort (e.g. "Enero – Abril
   * 2026"). Not a formal `Student` attribute in `04-inscripciones.md`, but the
   * Figma prompt (Screen 3, Tab 1) calls this out explicitly as "generación de
   * ingreso" — kept here as a UI/reporting convenience field so the Dashboard
   * can group "Nuevo Ingreso" vs. "Reinscripción" without re-deriving it from
   * `enrollmentDate` + a period-boundary lookup table.
   */
  generacionIngreso: string
  modalidad: ModalidadInscripcion
  /** FK → Candidate (Admission context) — set for every student, since `CreateStudentUseCase` is only invoked from Admission. */
  originCandidateId: string
}

export interface StatusMeta {
  label: string
  badgeClass: string
}

/** Badge label + Tailwind classes per `StudentStatus`, following the same color intent as Admisión's `STATUS_META` (gris = en trámite, verde = activo/positivo, rojo = baja, ámbar = transición). */
export const STUDENT_STATUS_META: Record<StudentStatus, StatusMeta> = {
  PENDING: { label: 'Pendiente', badgeClass: 'bg-gray-100 text-gray-600 border border-gray-200' },
  ACTIVE: { label: 'Activo', badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  PRE_LOW: { label: 'Pre-Baja', badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200' },
  TEMPORARY_LOW: { label: 'Baja Temporal', badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200' },
  LOW: { label: 'Baja Definitiva', badgeClass: 'bg-red-50 text-red-700 border border-red-200' },
  GRADUATED: { label: 'Egresado', badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200' },
  TITLED: { label: 'Titulado', badgeClass: 'bg-emerald-700 text-white border border-emerald-800' },
}

/** Matches `04-inscripciones.md`'s `EnrollmentType` enum. */
export type EnrollmentType = 'REGULAR' | 'RETAKE' | 'ACCREDITED'

/** Matches `04-inscripciones.md`'s `EnrollmentStatus` enum. */
export type EnrollmentStatus = 'ENROLLED' | 'DROPPED' | 'PASSED' | 'FAILED' | 'EXTRAORDINARY_PENDING'

/**
 * One row of a student's kardex — mirrors the `Enrollment` aggregate. `materia`/
 * `clave`/`creditos` stand in for the real `Class` → `Subject` join (Class isn't
 * modeled yet in this frontend slice — see the module doc comment above).
 */
export interface Enrollment {
  id: string
  studentId: string
  materia: string
  clave: string
  creditos: number
  grupo: string
  type: EnrollmentType
  status: EnrollmentStatus
  /** Human period label this Enrollment belongs to (e.g. "Enero – Abril 2026") — the mock stand-in for the real `classId` → `Class` → period join. */
  periodo: string
  calificacionFinal: number | null
}

/** Matches `04-inscripciones.md`'s `EnrollmentSlip.status` (`DocumentStatus` from the shared kernel). */
export type EnrollmentSlipStatus = 'PENDING' | 'GENERATING' | 'READY' | 'DELIVERED' | 'CANCELLED'

/** Ficha de inscripción — one per student (unique), generated automatically when payment is confirmed (RN-INS-001). */
export interface EnrollmentSlip {
  id: string
  studentId: string
  status: EnrollmentSlipStatus
  generatedAt: string | null
  deliveredAt: string | null
}

/** Matches `04-inscripciones.md`'s `StudentDocument.documentType` enum. */
export type StudentDocumentType =
  | 'ACTA_NACIMIENTO'
  | 'CURP'
  | 'CERTIFICADO_BACHILLERATO'
  | 'FOTOGRAFIA'
  | 'COMPROBANTE_DOMICILIO'
  | 'OTHER'

/** Display labels for `StudentDocumentType`, for Screen 7 (Expediente). */
export const STUDENT_DOCUMENT_TYPE_LABELS: Record<StudentDocumentType, string> = {
  ACTA_NACIMIENTO: 'Acta de Nacimiento',
  CURP: 'CURP',
  CERTIFICADO_BACHILLERATO: 'Certificado de Bachillerato',
  FOTOGRAFIA: 'Fotografía',
  COMPROBANTE_DOMICILIO: 'Comprobante de domicilio',
  OTHER: 'Otro',
}

/** Expediente físico — tracks delivery only; the system never stores the file itself. */
export interface StudentDocument {
  id: string
  studentId: string
  documentType: StudentDocumentType
  receivedAt: string | null
  /** Name of the `SERVICIOS_ESCOLARES` staff member who registered the receipt — nullable until received. */
  receivedBy: string | null
}

/** Matches `04-inscripciones.md`'s `InstitutionalDocument.type` enum. */
export type InstitutionalDocumentType = 'REGLAMENTO' | 'TERMINOS_CONDICIONES' | 'AVISO_PRIVACIDAD' | 'OTHER'

/** Matches `04-inscripciones.md`'s `InstitutionalDocument.scope` enum. */
export type InstitutionalDocumentScope = 'GLOBAL' | 'DIVISION' | 'PROGRAM'

export type InstitutionalDocumentStatus = 'ACTIVE' | 'INACTIVE'

/** Reglamentos / avisos de privacidad the student must read and accept during enrollment (RF-INS-001). Configured by `SERVICIOS_ESCOLARES` (Screen 6). */
export interface InstitutionalDocument {
  id: string
  name: string
  description: string | null
  driveUrl: string
  type: InstitutionalDocumentType
  scope: InstitutionalDocumentScope
  divisionId: string | null
  programId: string | null
  periodId: string | null
  status: InstitutionalDocumentStatus
  /** e.g. "v3.2" — shown in Screen 6's listing; not itemized in the aggregate table of `04-inscripciones.md` but explicit in the Figma prompt's example rows. */
  version: string
  vigenteDesde: string
  /** Count of students who have accepted this document — denormalized for Screen 6's listing (real system would derive this via a query, not store it). */
  aceptaciones: number
}

/** One accepted document within a `DocumentAcceptance` — matches `DocumentAcceptanceItem`. */
export interface DocumentAcceptanceItem {
  id: string
  documentId: string
}

/**
 * Evidence that a student read and accepted the institutional documents
 * presented during enrollment (RF-INS-001). NOT the institutional e-signature
 * system (`transversales/firma-electronica.md`) — a single-click acceptance.
 */
export interface DocumentAcceptance {
  id: string
  studentId: string
  acceptedAt: string
  /** Mock stand-in for the real hash of `studentId` + `documentId[]` + `acceptedAt`. */
  signatureHash: string
  items: DocumentAcceptanceItem[]
}
