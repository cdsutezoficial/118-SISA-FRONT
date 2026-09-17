/**
 * Mock front-only de roles → permisos para la vista "Roles" / "Permisos"
 * (Administración). No hay endpoint de roles/permisos en el backend: el
 * catálogo son los 11 `RoleType` de `identity/data/roles.ts` y los permisos
 * reflejan las reglas REALES de acceso de `SecurityFilterConfig.java`
 * (GET/POST/PUT/PATCH por aggregate) traducidas a acciones de UI.
 *
 * Se define como matriz `resource → rol → acciones` y se invierte a
 * `ROLE_PERMISSIONS` para no repetir la misma información 11 veces.
 */

import { ROLE_LABELS } from './roles'
import type { RoleType } from './roles'

export type PermissionAction = 'VER' | 'CREAR' | 'EDITAR' | 'ELIMINAR'

export const ACTION_LABELS: Record<PermissionAction, string> = {
  VER: 'Ver',
  CREAR: 'Crear',
  EDITAR: 'Editar',
  ELIMINAR: 'Eliminar',
}

export const ACTION_BADGE_STYLE: Record<PermissionAction, string> = {
  VER: 'bg-blue-50 text-blue-700 border border-blue-200',
  CREAR: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  EDITAR: 'bg-amber-50 text-amber-700 border border-amber-200',
  ELIMINAR: 'bg-red-50 text-red-700 border border-red-200',
}

export interface PermissionItem {
  resource: string
  actions: PermissionAction[]
}

export interface PermissionGroup {
  module: string
  items: PermissionItem[]
}

/** Descripción corta por rol (columna "Descripción" de la tablita). */
export const ROLE_DESCRIPTIONS: Record<RoleType, string> = {
  ADMIN: 'Acceso total al sistema: configuración, admisión, inscripciones e identidad.',
  SERVICIOS_ESCOLARES: 'Opera la configuración académica, admisión e inscripciones; consulta usuarios.',
  GESTOR_ACADEMICO: 'Gestiona la operación académica de su división.',
  DIRECTOR_DIVISION: 'Supervisa la operación académica de su división.',
  JEFATURA_ESTADIAS: 'Coordina el proceso de estadías.',
  ASISTENTE_ESTADIAS: 'Apoya el proceso de estadías.',
  COORDINACION_ESTADIAS_DIVISION: 'Coordina estadías a nivel división.',
  PERSONAL_FINANZAS: 'Administra los conceptos de pago y tarifas.',
  DOCENTE: 'Consulta catálogos e información de sus grupos.',
  ESTUDIANTE: 'Consulta catálogos e información de su trayectoria.',
  EGRESADO: 'Consulta catálogos e información de su trayectoria.',
}

// ─── Matriz de acceso (espejo de SecurityFilterConfig) ─────────────────────────

const RW: PermissionAction[] = ['VER', 'CREAR', 'EDITAR']
const FULL: PermissionAction[] = ['VER', 'CREAR', 'EDITAR', 'ELIMINAR']
const RO: PermissionAction[] = ['VER']

const ACADEMIC_CONFIG: RoleType[] = ['ADMIN', 'SERVICIOS_ESCOLARES']
const ADMISSION: RoleType[] = ['ADMIN', 'SERVICIOS_ESCOLARES']
const FINANCE: RoleType[] = ['ADMIN', 'PERSONAL_FINANZAS']
const ALL_STAFF_ROLES: RoleType[] = [
  'ADMIN', 'SERVICIOS_ESCOLARES', 'GESTOR_ACADEMICO', 'DIRECTOR_DIVISION',
  'JEFATURA_ESTADIAS', 'ASISTENTE_ESTADIAS', 'COORDINACION_ESTADIAS_DIVISION',
  'PERSONAL_FINANZAS', 'DOCENTE', 'ESTUDIANTE', 'EGRESADO',
]

interface ResourceDef {
  module: string
  resource: string
  access: Partial<Record<RoleType, PermissionAction[]>>
}

function rw(roles: RoleType[]): Partial<Record<RoleType, PermissionAction[]>> {
  return Object.fromEntries(roles.map(r => [r, RW])) as Partial<Record<RoleType, PermissionAction[]>>
}

function full(roles: RoleType[]): Partial<Record<RoleType, PermissionAction[]>> {
  return Object.fromEntries(roles.map(r => [r, FULL])) as Partial<Record<RoleType, PermissionAction[]>>
}

function ro(roles: RoleType[]): Partial<Record<RoleType, PermissionAction[]>> {
  return Object.fromEntries(roles.map(r => [r, RO])) as Partial<Record<RoleType, PermissionAction[]>>
}

/** Admin siempre tiene acceso total salvo que la regla lo restrinja. */
const RESOURCES: ResourceDef[] = [
  // Configuración Académica
  { module: 'Configuración Académica', resource: 'Divisiones Académicas',   access: rw(ACADEMIC_CONFIG) },
  { module: 'Configuración Académica', resource: 'Programas Educativos',    access: rw(ACADEMIC_CONFIG) },
  { module: 'Configuración Académica', resource: 'Planes de Estudio',       access: full(ACADEMIC_CONFIG) },
  { module: 'Configuración Académica', resource: 'Clasificaciones de Materias', access: rw(ACADEMIC_CONFIG) },
  { module: 'Configuración Académica', resource: 'Periodos Académicos',     access: rw(ACADEMIC_CONFIG) },
  { module: 'Configuración Académica', resource: 'Generaciones',            access: rw(ACADEMIC_CONFIG) },
  { module: 'Configuración Académica', resource: 'Grupos',                  access: rw(ACADEMIC_CONFIG) },
  { module: 'Configuración Académica', resource: 'Configuración de Admisión', access: rw(ACADEMIC_CONFIG) },
  { module: 'Configuración Académica', resource: 'Conceptos de Pago',       access: rw(FINANCE) },

  // Admisión
  { module: 'Admisión', resource: 'Canales de Difusión',  access: rw(ADMISSION) },
  { module: 'Admisión', resource: 'Tipos de Bachillerato', access: rw(ADMISSION) },

  // Identidad
  { module: 'Identidad', resource: 'Usuarios', access: { ...full(['ADMIN']), ...ro(['SERVICIOS_ESCOLARES']) } },
  { module: 'Identidad', resource: 'Personas', access: { ...rw(['ADMIN']), ...ro(['SERVICIOS_ESCOLARES']) } },

  // Catálogos (cualquier usuario autenticado, solo lectura)
  { module: 'Catálogos', resource: 'Estados',     access: ro(ALL_STAFF_ROLES) },
  { module: 'Catálogos', resource: 'Municipios',  access: ro(ALL_STAFF_ROLES) },
]

function buildRolePermissions(): Record<RoleType, PermissionGroup[]> {
  const byRole = Object.fromEntries(
    (Object.keys(ROLE_LABELS) as RoleType[]).map(role => [role, [] as PermissionGroup[]]),
  ) as Record<RoleType, PermissionGroup[]>

  for (const resource of RESOURCES) {
    for (const [role, actions] of Object.entries(resource.access) as [RoleType, PermissionAction[]][]) {
      let group = byRole[role].find(g => g.module === resource.module)
      if (!group) {
        group = { module: resource.module, items: [] }
        byRole[role].push(group)
      }
      group.items.push({ resource: resource.resource, actions })
    }
  }
  return byRole
}

export const ROLE_PERMISSIONS: Record<RoleType, PermissionGroup[]> = buildRolePermissions()

/** Total de permisos (acciones) de un rol — columna "Permisos" de la tablita. */
export function permissionCountFor(role: RoleType): number {
  return ROLE_PERMISSIONS[role].reduce(
    (total, group) => total + group.items.reduce((sum, item) => sum + item.actions.length, 0),
    0,
  )
}
