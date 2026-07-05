import type {
  Student,
  Enrollment,
  EnrollmentSlip,
  StudentDocument,
  InstitutionalDocument,
  DocumentAcceptance,
  StudentProgramHistory,
} from './types'

/**
 * Active academic period for the whole module's mock data — same period the
 * Admisión module uses (`mockCandidates`' cohort), since both modules model
 * the same UTEZ academic calendar.
 */
export const ACTIVE_PERIOD = 'Enero – Abril 2026'

/**
 * Dependent Municipio catalog, keyed by Estado — Screen 4 Paso 2's domicilio
 * and antecedentes-de-bachillerato subsections both use this so the
 * "Municipio dependiente de Estado" cascade (Figma spec) is honored literally,
 * unlike Admisión's flat `MUNICIPIOS_CATALOGO` shortcut (see design.md's
 * "Municipio as a real dependent Select" decision). Morelos is fully seeded
 * (UTEZ's home state); a few neighboring estados carry a token entry each —
 * full INEGI depth is out of scope for this mock frontend.
 */
export const MUNICIPIOS_POR_ESTADO: Record<string, string[]> = {
  Morelos: ['Cuernavaca', 'Emiliano Zapata', 'Jiutepec', 'Temixco', 'Xochitepec', 'Yautepec'],
  'Ciudad de México': ['Álvaro Obregón', 'Coyoacán', 'Iztapalapa', 'Tlalpan'],
  'Estado de México': ['Toluca', 'Naucalpan', 'Ecatepec de Morelos'],
  Guerrero: ['Acapulco de Juárez', 'Chilpancingo de los Bravo'],
  Puebla: ['Puebla', 'Cholula de Rivadavia'],
}

/**
 * Example students spanning new-ingreso (this period) and reinscripción
 * (continuing from an earlier period) cases, plus a non-ACTIVE status
 * (`TEMPORARY_LOW`) so status badges have variety from the start.
 *
 * Ana García López / Luis Mendoza Ruiz / María Torres Soto / Pedro Ramírez Cruz
 * are the exact example rows from `figma/prompts/04-inscripciones.md` (Pantalla
 * 2 "Estudiantes — Listado"), reused here for consistency across Foundation A
 * and the future Screen 2 implementation. `programa`/`division` names for IDGS
 * and Ingeniería Industrial mirror `shared/admision/mockData.ts` exactly (same
 * catalog, same institution).
 */
export const mockStudents: Student[] = [
  {
    id: '1',
    matricula: '202630001',
    nombre: 'Ana García López',
    curp: 'GALA000115MMSRRN05',
    email: 'ana.garcia@utez.edu.mx',
    telefono: '777 234 5601',
    programa: 'Ingeniería en Desarrollo y Gestión de Software',
    division: 'División de Tecnologías de la Información',
    nivelActual: '1er Cuatrimestre TSU',
    grupo: 'IDGS-101-A',
    status: 'PENDING',
    fechaInscripcion: '15/01/2026',
    generacionIngreso: ACTIVE_PERIOD,
    modalidad: 'Presencial',
    originCandidateId: 'ADM-2026-0001',
  },
  {
    id: '2',
    matricula: '202520045',
    nombre: 'Luis Mendoza Ruiz',
    curp: 'MERL030512HMSNZS08',
    email: 'luis.mendoza@utez.edu.mx',
    telefono: '777 234 5602',
    programa: 'Ingeniería en Redes y Telecomunicaciones',
    division: 'División de Tecnologías de la Información',
    nivelActual: '5to Cuatrimestre TSU',
    grupo: 'IRT-501-B',
    status: 'ACTIVE',
    fechaInscripcion: '10/09/2023',
    generacionIngreso: 'Septiembre – Diciembre 2023',
    modalidad: 'Presencial',
    originCandidateId: 'ADM-2023-0045',
  },
  {
    id: '3',
    matricula: '202410089',
    nombre: 'María Torres Soto',
    curp: 'TOSM020803MMSRRR02',
    email: 'maria.torres@utez.edu.mx',
    telefono: '777 234 5603',
    programa: 'Ingeniería en Desarrollo y Gestión de Software',
    division: 'División de Tecnologías de la Información',
    nivelActual: '8vo Cuatrimestre Ing',
    grupo: 'IDGS-801-A',
    status: 'ACTIVE',
    fechaInscripcion: '05/09/2022',
    generacionIngreso: 'Septiembre – Diciembre 2022',
    modalidad: 'Presencial',
    originCandidateId: 'ADM-2022-0089',
  },
  {
    id: '4',
    matricula: '202630012',
    nombre: 'Pedro Ramírez Cruz',
    curp: 'RACP001120HMSMRD07',
    email: 'pedro.ramirez@utez.edu.mx',
    telefono: '777 234 5604',
    programa: 'Ingeniería Industrial',
    division: 'División de Ingeniería',
    nivelActual: '1er Cuatrimestre TSU',
    grupo: 'II-101-A',
    status: 'TEMPORARY_LOW',
    fechaInscripcion: '15/01/2026',
    generacionIngreso: ACTIVE_PERIOD,
    modalidad: 'Presencial',
    originCandidateId: 'ADM-2026-0012',
  },
  {
    id: '5',
    matricula: '202630002',
    nombre: 'Diego Fernández Ruiz',
    curp: 'FERD001203HMSRZG01',
    email: 'diego.fernandez@utez.edu.mx',
    telefono: '777 234 5605',
    programa: 'Ingeniería en Desarrollo y Gestión de Software',
    division: 'División de Tecnologías de la Información',
    nivelActual: '1er Cuatrimestre TSU',
    grupo: 'IDGS-101-A',
    status: 'ACTIVE',
    fechaInscripcion: '16/01/2026',
    generacionIngreso: ACTIVE_PERIOD,
    modalidad: 'Presencial',
    originCandidateId: 'ADM-2026-0002',
  },
  {
    id: '6',
    matricula: '202320078',
    nombre: 'Sofía Ramírez Cordero',
    curp: 'RACS000418MMSMRF03',
    email: 'sofia.ramirez@utez.edu.mx',
    telefono: '777 234 5606',
    programa: 'Licenciatura en Administración',
    division: 'División de Ciencias Económico Administrativas',
    nivelActual: '11vo Cuatrimestre Lic',
    grupo: 'LADM-1101-A',
    status: 'ACTIVE',
    fechaInscripcion: '02/05/2020',
    generacionIngreso: 'Mayo – Agosto 2020',
    modalidad: 'Mixta',
    originCandidateId: 'ADM-2020-0078',
  },
]

/**
 * Kardex rows. Only students who have completed inscription for
 * `ACTIVE_PERIOD` carry an Enrollment with `periodo === ACTIVE_PERIOD` — this
 * is how the Dashboard KPIs (Screen 1) tell "ya reinscrito este periodo" apart
 * from "activo pero aún no reinscrito" (see `mockStudents[2]`/María, who has
 * no ACTIVE_PERIOD row here on purpose).
 */
export const mockEnrollments: Enrollment[] = [
  // Luis (id 2) — reinscrito este periodo.
  { id: 'e1', studentId: '2', materia: 'Redes Inalámbricas', clave: 'RIN-501', creditos: 7, grupo: 'IRT-501-B', type: 'REGULAR', status: 'ENROLLED', periodo: ACTIVE_PERIOD, calificacionFinal: null },
  { id: 'e2', studentId: '2', materia: 'Seguridad en Redes', clave: 'SRD-501', creditos: 6, grupo: 'IRT-501-B', type: 'REGULAR', status: 'ENROLLED', periodo: ACTIVE_PERIOD, calificacionFinal: null },
  { id: 'e3', studentId: '2', materia: 'Cálculo Diferencial', clave: 'CAL-101', creditos: 8, grupo: 'IRT-501-B', type: 'RETAKE', status: 'ENROLLED', periodo: ACTIVE_PERIOD, calificacionFinal: null },

  // María (id 3) — activa pero AÚN NO reinscrita este periodo (su última inscripción fue el periodo anterior).
  { id: 'e4', studentId: '3', materia: 'Ingeniería de Software Avanzada', clave: 'ISA-801', creditos: 8, grupo: 'IDGS-801-A', type: 'REGULAR', status: 'PASSED', periodo: 'Septiembre – Diciembre 2025', calificacionFinal: 88 },
  { id: 'e5', studentId: '3', materia: 'Arquitectura de Software', clave: 'ARQ-801', creditos: 7, grupo: 'IDGS-801-A', type: 'REGULAR', status: 'PASSED', periodo: 'Septiembre – Diciembre 2025', calificacionFinal: 91 },

  // Diego (id 5) — nuevo ingreso, ya inscrito este periodo (primer cuatrimestre).
  { id: 'e6', studentId: '5', materia: 'Fundamentos de Programación', clave: 'FP-101', creditos: 6, grupo: 'IDGS-101-A', type: 'REGULAR', status: 'ENROLLED', periodo: ACTIVE_PERIOD, calificacionFinal: null },
  { id: 'e7', studentId: '5', materia: 'Cálculo Diferencial', clave: 'CAL-101', creditos: 8, grupo: 'IDGS-101-A', type: 'REGULAR', status: 'ENROLLED', periodo: ACTIVE_PERIOD, calificacionFinal: null },

  // Sofía (id 6) — reinscrita este periodo.
  { id: 'e8', studentId: '6', materia: 'Seminario de Titulación I', clave: 'SEM-1101', creditos: 6, grupo: 'LADM-1101-A', type: 'REGULAR', status: 'ENROLLED', periodo: ACTIVE_PERIOD, calificacionFinal: null },
]

/**
 * One `EnrollmentSlip` per student (unique per `studentId` per the domain
 * invariant) — represents the one-time "ficha de inscripción" generated when
 * the student's very first payment is confirmed, not a per-period document.
 * `mockStudents[0]`/Ana has no slip yet (still `PENDING`, hasn't paid).
 */
export const mockEnrollmentSlips: EnrollmentSlip[] = [
  { id: 's2', studentId: '2', status: 'DELIVERED', generatedAt: '12/09/2023', deliveredAt: '20/09/2023' },
  { id: 's3', studentId: '3', status: 'DELIVERED', generatedAt: '08/09/2022', deliveredAt: '14/09/2022' },
  { id: 's4', studentId: '4', status: 'DELIVERED', generatedAt: '16/01/2026', deliveredAt: '22/01/2026' },
  { id: 's5', studentId: '5', status: 'READY', generatedAt: '17/01/2026', deliveredAt: null },
  { id: 's6', studentId: '6', status: 'DELIVERED', generatedAt: '04/05/2020', deliveredAt: '11/05/2020' },
]

/**
 * Groups a new-ingreso student can be assigned to (Screen 4 Paso 3). Lighter
 * than a full `Class` aggregate — per design.md's "Screen 3 tabs & Screen 7
 * side-panel need two deferred entities" decision, `Class`/`CourseClass`
 * isn't modeled yet; this is the minimal shape the wizard's Grupo step needs
 * (nivel/turno/capacidad + a materias-of-the-group table).
 */
export const mockGroups: {
  grupo: string
  nivel: string
  turno: string
  capacidad: number
  materias: { materia: string; clave: string; creditos: number; horario: string }[]
}[] = [
  {
    grupo: 'IDGS-101-A',
    nivel: '1er Cuatrimestre TSU',
    turno: 'Matutino',
    capacidad: 35,
    materias: [
      { materia: 'Fundamentos de Programación', clave: 'FP-101', creditos: 6, horario: 'Lun-Vie 07:00-09:00' },
      { materia: 'Cálculo Diferencial', clave: 'CAL-101', creditos: 8, horario: 'Lun-Vie 09:00-11:00' },
      { materia: 'Taller de Ética', clave: 'ETI-101', creditos: 4, horario: 'Mar-Jue 11:00-12:30' },
    ],
  },
  {
    grupo: 'IDGS-101-B',
    nivel: '1er Cuatrimestre TSU',
    turno: 'Vespertino',
    capacidad: 30,
    materias: [
      { materia: 'Fundamentos de Programación', clave: 'FP-101', creditos: 6, horario: 'Lun-Vie 16:00-18:00' },
      { materia: 'Cálculo Diferencial', clave: 'CAL-101', creditos: 8, horario: 'Lun-Vie 18:00-20:00' },
      { materia: 'Taller de Ética', clave: 'ETI-101', creditos: 4, horario: 'Mar-Jue 20:00-21:30' },
    ],
  },
  {
    grupo: 'II-101-A',
    nivel: '1er Cuatrimestre TSU',
    turno: 'Matutino',
    capacidad: 32,
    materias: [
      { materia: 'Fundamentos de Programación', clave: 'FP-101', creditos: 6, horario: 'Lun-Vie 07:00-09:00' },
      { materia: 'Cálculo Diferencial', clave: 'CAL-101', creditos: 8, horario: 'Lun-Vie 09:00-11:00' },
      { materia: 'Procesos de Manufactura', clave: 'PM-101', creditos: 6, horario: 'Mié-Vie 11:00-13:00' },
    ],
  },
]

/** Expediente físico — only seeded for a couple of students; Screen 7 will expand this. */
export const mockStudentDocuments: StudentDocument[] = [
  { id: 'd1', studentId: '2', documentType: 'ACTA_NACIMIENTO', receivedAt: '20/09/2023', receivedBy: 'Rosa Elena Pacheco' },
  { id: 'd2', studentId: '2', documentType: 'CURP', receivedAt: '20/09/2023', receivedBy: 'Rosa Elena Pacheco' },
  { id: 'd3', studentId: '2', documentType: 'CERTIFICADO_BACHILLERATO', receivedAt: null, receivedBy: null },
  { id: 'd4', studentId: '2', documentType: 'FOTOGRAFIA', receivedAt: '20/09/2023', receivedBy: 'Rosa Elena Pacheco' },
  { id: 'd5', studentId: '2', documentType: 'COMPROBANTE_DOMICILIO', receivedAt: null, receivedBy: null },
  { id: 'd6', studentId: '5', documentType: 'ACTA_NACIMIENTO', receivedAt: null, receivedBy: null },
  { id: 'd7', studentId: '5', documentType: 'CURP', receivedAt: '17/01/2026', receivedBy: 'Rosa Elena Pacheco' },
  { id: 'd8', studentId: '5', documentType: 'CERTIFICADO_BACHILLERATO', receivedAt: null, receivedBy: null },
  { id: 'd9', studentId: '5', documentType: 'FOTOGRAFIA', receivedAt: null, receivedBy: null },
  { id: 'd10', studentId: '5', documentType: 'COMPROBANTE_DOMICILIO', receivedAt: null, receivedBy: null },
]

/** Matches Screen 6's example rows exactly. */
export const mockInstitutionalDocuments: InstitutionalDocument[] = [
  {
    id: 'doc1',
    name: 'Reglamento Escolar 2026',
    description: null,
    driveUrl: 'https://drive.google.com/reglamento-escolar-2026',
    type: 'REGLAMENTO',
    scope: 'GLOBAL',
    divisionId: null,
    programId: null,
    periodId: null,
    status: 'ACTIVE',
    version: 'v3.2',
    vigenteDesde: '01/01/2026',
    aceptaciones: 1203,
  },
  {
    id: 'doc2',
    name: 'Aviso de Privacidad UTEZ',
    description: null,
    driveUrl: 'https://drive.google.com/aviso-privacidad-utez',
    type: 'AVISO_PRIVACIDAD',
    scope: 'GLOBAL',
    divisionId: null,
    programId: null,
    periodId: null,
    status: 'ACTIVE',
    version: 'v2.0',
    vigenteDesde: '15/08/2025',
    aceptaciones: 1203,
  },
  {
    id: 'doc3',
    name: 'Reglamento de Laboratorios',
    description: null,
    driveUrl: 'https://drive.google.com/reglamento-laboratorios',
    type: 'REGLAMENTO',
    scope: 'GLOBAL',
    divisionId: null,
    programId: null,
    periodId: null,
    status: 'ACTIVE',
    version: 'v1.5',
    vigenteDesde: '01/01/2026',
    aceptaciones: 1203,
  },
]

/** One acceptance record per student who has completed the enrollment wizard's document step. */
export const mockDocumentAcceptances: DocumentAcceptance[] = [
  {
    id: 'da5',
    studentId: '5',
    acceptedAt: '17/01/2026 10:32',
    signatureHash: 'sha256:5f3a...d02c',
    items: [
      { id: 'dai1', documentId: 'doc1' },
      { id: 'dai2', documentId: 'doc2' },
    ],
  },
]

/**
 * Mock stand-in for `FinanceQueryPort.hasActiveDebt(studentId)` (see
 * `04-inscripciones.md`'s RN-INS-001 and the Reinscripción invariant) — no
 * Finanzas bounded context exists in this frontend slice, so Screen 5's debt
 * gate reads this lookup instead of a real cross-module query. Only María
 * Torres Soto (id `3`) carries an active debt: she's ACTIVE but hasn't
 * reinscrito this period yet (see the `mockEnrollments` comment above), which
 * makes her the natural "blocked by debt" demo candidate — no story
 * contradiction with an already-completed reinscripción.
 */
export const mockActiveDebts: Record<string, boolean> = {
  '3': true,
}

/**
 * Program-change bitácora (RF-INS-007) for Screen 3's "Historial de
 * Programas" tab. Invariant enforced by construction: every `studentId` has
 * exactly one open row (`hasta: null`). Luis (id 2) carries two rows —
 * closed `IRT-2021` → open `IRT-2022` — to demonstrate a real `CAMBIO_PLAN`
 * history; every other student only has their original `INGRESO` row.
 */
export const mockStudentProgramHistory: StudentProgramHistory[] = [
  { id: 'ph1', studentId: '1', programa: 'Ingeniería en Desarrollo y Gestión de Software', plan: 'IDGS-2022', desde: '15/01/2026', hasta: null, tipoCambio: 'INGRESO' },
  { id: 'ph2', studentId: '2', programa: 'Ingeniería en Redes y Telecomunicaciones', plan: 'IRT-2021', desde: '10/09/2023', hasta: '05/09/2024', tipoCambio: 'INGRESO' },
  { id: 'ph3', studentId: '2', programa: 'Ingeniería en Redes y Telecomunicaciones', plan: 'IRT-2022', desde: '06/09/2024', hasta: null, tipoCambio: 'CAMBIO_PLAN' },
  { id: 'ph4', studentId: '3', programa: 'Ingeniería en Desarrollo y Gestión de Software', plan: 'IDGS-2022', desde: '05/09/2022', hasta: null, tipoCambio: 'INGRESO' },
  { id: 'ph5', studentId: '4', programa: 'Ingeniería Industrial', plan: 'II-2021', desde: '15/01/2026', hasta: null, tipoCambio: 'INGRESO' },
  { id: 'ph6', studentId: '5', programa: 'Ingeniería en Desarrollo y Gestión de Software', plan: 'IDGS-2022', desde: '16/01/2026', hasta: null, tipoCambio: 'INGRESO' },
  { id: 'ph7', studentId: '6', programa: 'Licenciatura en Administración', plan: 'LADM-2015', desde: '02/05/2020', hasta: null, tipoCambio: 'INGRESO' },
]
