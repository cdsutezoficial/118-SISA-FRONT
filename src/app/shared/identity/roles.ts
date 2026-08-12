/**
 * Shared `RoleType` catalog for the Usuarios/Identidad screens
 * (`UsuariosForm.tsx`, `UsuarioDetalle.tsx`, `AsignarRol.tsx`).
 *
 * Extracted here because all three screens need the exact same 11-value
 * enum + Spanish labels + division-scope rule — before this fix,
 * `UsuariosForm.tsx`/`AsignarRol.tsx` each had their own STALE local copy
 * (5-6 fake role names, wrong division-scope set). `UsuariosList.tsx` keeps
 * its own copy for now (list-only screen, doesn't need division-scope) —
 * not migrated here to keep this change minimal, but it defines the exact
 * same values, so a future pass could safely consolidate it too.
 *
 * Division-scoped set confirmed with José (2026-07-28): ONLY
 * `GESTOR_ACADEMICO`, `DIRECTOR_DIVISION`, `COORDINACION_ESTADIAS_DIVISION`
 * require a `divisionId` — matches backend's `DIVISION_SCOPED_ROLES`.
 * `JEFATURA_ESTADIAS`/`ASISTENTE_ESTADIAS` are global scope (the old mock
 * wrongly treated them as division-scoped).
 */

export type RoleType =
  | 'ADMIN'
  | 'SERVICIOS_ESCOLARES'
  | 'GESTOR_ACADEMICO'
  | 'DIRECTOR_DIVISION'
  | 'JEFATURA_ESTADIAS'
  | 'ASISTENTE_ESTADIAS'
  | 'COORDINACION_ESTADIAS_DIVISION'
  | 'PERSONAL_FINANZAS'
  | 'DOCENTE'
  | 'ESTUDIANTE'
  | 'EGRESADO'

export const ROLE_LABELS: Record<RoleType, string> = {
  ADMIN: 'Administrador',
  SERVICIOS_ESCOLARES: 'Servicios Escolares',
  GESTOR_ACADEMICO: 'Gestor Académico',
  DIRECTOR_DIVISION: 'Director de División',
  JEFATURA_ESTADIAS: 'Jefatura de Estadías',
  ASISTENTE_ESTADIAS: 'Asistente de Estadías',
  COORDINACION_ESTADIAS_DIVISION: 'Coordinación de Estadías de División',
  PERSONAL_FINANZAS: 'Personal de Finanzas',
  DOCENTE: 'Docente',
  ESTUDIANTE: 'Estudiante',
  EGRESADO: 'Egresado',
}

export const ROLE_BADGE_STYLE: Record<RoleType, string> = {
  ADMIN: 'bg-[#e6f5f1] text-[#009574] border border-[#009574]/30',
  SERVICIOS_ESCOLARES: 'bg-blue-50 text-blue-700 border border-blue-200',
  GESTOR_ACADEMICO: 'bg-teal-50 text-teal-700 border border-teal-200',
  DIRECTOR_DIVISION: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  JEFATURA_ESTADIAS: 'bg-purple-50 text-purple-700 border border-purple-200',
  ASISTENTE_ESTADIAS: 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200',
  COORDINACION_ESTADIAS_DIVISION: 'bg-pink-50 text-pink-700 border border-pink-200',
  PERSONAL_FINANZAS: 'bg-amber-50 text-amber-700 border border-amber-200',
  DOCENTE: 'bg-violet-50 text-violet-700 border border-violet-200',
  ESTUDIANTE: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  EGRESADO: 'bg-orange-50 text-orange-700 border border-orange-200',
}

/** Roles that require a `divisionId` scope — everything else is global. */
export const DIVISION_SCOPED_ROLES: ReadonlySet<RoleType> = new Set<RoleType>([
  'GESTOR_ACADEMICO',
  'DIRECTOR_DIVISION',
  'COORDINACION_ESTADIAS_DIVISION',
])

export const ROLE_OPTIONS: { value: RoleType; label: string }[] = (
  Object.keys(ROLE_LABELS) as RoleType[]
).map(value => ({ value, label: ROLE_LABELS[value] }))
