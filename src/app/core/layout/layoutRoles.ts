import type { Role } from '../infra/RoleContext'

/**
 * Role catalog for the global shell (Navbar + Sidebar).
 *
 * Covers the `Role` enum from `RoleContext` (mock staff tiers + `CANDIDATO`).
 * Deliberately separate from `shared/identity/roles.ts`, whose `ROLE_LABELS`
 * covers the backend `RoleType` enum — a different value set. Merging them
 * would silently mislabel roles.
 */

export const STAFF_ROLES: Role[] = [
  'ADMINISTRADOR', 'GESTOR_ACADEMICO', 'SERVICIOS_ESCOLARES', 'FINANZAS', 'DIRECTOR_DIVISION',
]

export const ROLE_LABELS: Record<Role, string> = {
  ADMINISTRADOR: 'Administrador',
  GESTOR_ACADEMICO: 'Gestor Académico',
  SERVICIOS_ESCOLARES: 'Servicios Escolares',
  FINANZAS: 'Finanzas',
  DIRECTOR_DIVISION: 'Director de División',
  CANDIDATO: 'Candidato',
}