import type { Role } from '../infra/RoleContext'

/**
 * Role catalog for the global shell (Navbar + Sidebar).
 *
 * Covers the `Role` enum from `RoleContext` (mock staff tiers + `CANDIDATO`).
 * Deliberately separate from `shared/identity/roles.ts`, whose `ROLE_LABELS`
 * covers the backend `RoleType` enum — a different value set. Merging them
 * would silently mislabel roles.
 */

/**
 * Catálogos académicos + administración de usuarios + Panel de Control — el
 * trío con acceso real a las pantallas de configuración. Espejo exacto de los
 * `hasAnyRole("ADMIN", "SERVICIOS_ESCOLARES")` del backend
 * (`SecurityFilterConfig`): sidebar y guardas de ruta deben usar esto, no una
 * lista de "todo staff", para que un rol sin permiso no vea el ítem ni entre
 * por URL.
 *
 * El Dashboard (`/dashboard`, "Panel de Control") usa esta lista porque su
 * contenido — KPIs y accesos rápidos de la configuración académica — sólo
 * tiene sentido para los roles que pueden operar esos módulos. Un Gestor,
 * Finanzas o Director llega a su propio módulo por `ROLE_DEFAULT_PATHS`, y no
 * ve este ítem en el sidebar.
 */
export const ADMIN_SERVICIOS_ROLES: Role[] = [
  'ADMINISTRADOR', 'SERVICIOS_ESCOLARES',
]

export const ROLE_LABELS: Record<Role, string> = {
  ADMINISTRADOR: 'Administrador',
  GESTOR_ACADEMICO: 'Gestor Académico',
  SERVICIOS_ESCOLARES: 'Servicios Escolares',
  FINANZAS: 'Finanzas',
  DIRECTOR_DIVISION: 'Director de División',
  CANDIDATO: 'Candidato',
}

/**
 * Main view each role lands on after a role switch (Navbar/Sidebar). Derives
 * from the module each role actually operates in — see `openspec/specs/`
 * (`admision-screens.md`, `inscripciones-screens.md`). `CANDIDATO` never
 * mounts inside the shell; its value is defensive only.
 *
 * When a role is switched while on a route it may not see in its sidebar,
 * `AppLayout` navigates here instead of leaving the user stranded (the old
 * behavior let `RequireRole` bounce them, or worse kept them on a view the
 * sidebar no longer showed for the new role).
 */
export const ROLE_DEFAULT_PATHS: Record<Role, string> = {
  ADMINISTRADOR: '/dashboard',
  GESTOR_ACADEMICO: '/inscripciones',
  SERVICIOS_ESCOLARES: '/admision',
  FINANZAS: '/admision',
  DIRECTOR_DIVISION: '/admision',
  CANDIDATO: '/portal/induccion',
}