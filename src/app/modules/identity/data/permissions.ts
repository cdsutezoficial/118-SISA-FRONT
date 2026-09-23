import type { RoleType } from './roles'

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

const MODULE_ORDER: Record<string, number> = {
  Identidad: 1,
  'Configuración Académica': 2,
  'Pagos y Finanzas': 3,
  Admisión: 4,
  Catálogos: 5,
}

const RESOURCE_META: Record<string, { module: string; resource: string; resourceOrder: number }> = {
  ROLES: { module: 'Identidad', resource: 'Roles', resourceOrder: 10 },
  PERMISSIONS: { module: 'Identidad', resource: 'Permisos', resourceOrder: 20 },
  USERS: { module: 'Identidad', resource: 'Usuarios', resourceOrder: 30 },
  PERSONS: { module: 'Identidad', resource: 'Personas', resourceOrder: 40 },
  DIVISIONS: { module: 'Configuración Académica', resource: 'Divisiones Académicas', resourceOrder: 10 },
  PROGRAMS: { module: 'Configuración Académica', resource: 'Carreras', resourceOrder: 20 },
  PLANS: { module: 'Configuración Académica', resource: 'Planes de Estudio', resourceOrder: 30 },
  SUBJECT_CLASSIFICATIONS: { module: 'Configuración Académica', resource: 'Clasificaciones de Materias', resourceOrder: 40 },
  PERIODS: { module: 'Configuración Académica', resource: 'Periodos Académicos', resourceOrder: 50 },
  GENERATIONS: { module: 'Configuración Académica', resource: 'Generaciones', resourceOrder: 60 },
  GROUPS: { module: 'Configuración Académica', resource: 'Grupos', resourceOrder: 70 },
  PROGRAM_ADMISSION_CONFIGS: { module: 'Configuración Académica', resource: 'Configuración de Admisión', resourceOrder: 80 },
  PAYMENT_AREAS: { module: 'Pagos y Finanzas', resource: 'Áreas de Facturación', resourceOrder: 5 },
  PAYMENT_CONCEPTS: { module: 'Pagos y Finanzas', resource: 'Conceptos de Pago', resourceOrder: 10 },
  PAYMENT_RATES: { module: 'Pagos y Finanzas', resource: 'Tarifas de Pago', resourceOrder: 20 },
  OUTREACH_CHANNELS: { module: 'Admisión', resource: 'Canales de Difusión', resourceOrder: 10 },
  HIGH_SCHOOL_TYPES: { module: 'Admisión', resource: 'Tipos de Bachillerato', resourceOrder: 20 },
  STATES: { module: 'Catálogos', resource: 'Estados', resourceOrder: 10 },
  MUNICIPALITIES: { module: 'Catálogos', resource: 'Municipios', resourceOrder: 20 },
}

const ACTION_META = [
  { suffix: 'READ', label: 'Ver', actionOrder: 10 },
  { suffix: 'CREATE', label: 'Crear', actionOrder: 20 },
  { suffix: 'UPDATE', label: 'Editar', actionOrder: 30 },
  { suffix: 'DELETE', label: 'Eliminar', actionOrder: 40 },
  { suffix: 'CHANGE_STATUS', label: 'Cambiar estado', actionOrder: 50 },
  { suffix: 'ASSIGN_PERMISSIONS', label: 'Asignar permisos', actionOrder: 60 },
  { suffix: 'ASSIGN_ROLE', label: 'Asignar rol', actionOrder: 70 },
  { suffix: 'REVOKE_ROLE', label: 'Revocar rol', actionOrder: 80 },
  { suffix: 'UNLOCK', label: 'Desbloquear usuario', actionOrder: 90 },
  { suffix: 'ADVANCE_BY_DATE', label: 'Avanzar por fecha', actionOrder: 100 },
] as const

export interface PermissionCatalogItem {
  id: string
  name: string
  key: string
  status: 'ACTIVE' | 'INACTIVE'
}

export interface PermissionDisplayItem extends PermissionCatalogItem {
  module: string
  resource: string
  actionLabel: string
  actionSuffix: string
  moduleOrder: number
  resourceOrder: number
  actionOrder: number
}

export interface PermissionDisplayGroup {
  module: string
  items: PermissionDisplayItem[]
  resources: PermissionResourceGroup[]
}

export interface PermissionResourceGroup {
  resource: string
  items: PermissionDisplayItem[]
}

function titleizeKey(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function isRoleType(roleKey: string): roleKey is RoleType {
  return roleKey in ROLE_DESCRIPTIONS
}

export function describeRole(roleKey: string, fallbackDescription: string): string {
  return isRoleType(roleKey) ? ROLE_DESCRIPTIONS[roleKey] : fallbackDescription
}

export function getPermissionDisplayItem(permission: PermissionCatalogItem): PermissionDisplayItem {
  const actionMeta = ACTION_META.find(candidate => permission.key.endsWith(`_${candidate.suffix}`))
  const resourceKey = actionMeta
    ? permission.key.slice(0, -(actionMeta.suffix.length + 1))
    : permission.key
  const resourceMeta = RESOURCE_META[resourceKey]

  return {
    ...permission,
    module: resourceMeta?.module ?? 'Otros',
    resource: resourceMeta?.resource ?? titleizeKey(resourceKey),
    actionLabel: actionMeta?.label ?? permission.name,
    actionSuffix: actionMeta?.suffix ?? 'OTHER',
    moduleOrder: MODULE_ORDER[resourceMeta?.module ?? 'Otros'] ?? 99,
    resourceOrder: resourceMeta?.resourceOrder ?? 99,
    actionOrder: actionMeta?.actionOrder ?? 999,
  }
}

export function groupPermissionCatalog(permissions: PermissionCatalogItem[]): PermissionDisplayGroup[] {
  const displayItems = permissions
    .map(getPermissionDisplayItem)
    .sort((left, right) => (
      left.moduleOrder - right.moduleOrder ||
      left.resourceOrder - right.resourceOrder ||
      left.actionOrder - right.actionOrder ||
      left.name.localeCompare(right.name)
    ))

  const groups = new Map<string, PermissionDisplayItem[]>()
  for (const item of displayItems) {
    const current = groups.get(item.module)
    if (current) current.push(item)
    else groups.set(item.module, [item])
  }

  return Array.from(groups.entries()).map(([module, items]) => {
    const resources = new Map<string, PermissionDisplayItem[]>()
    for (const item of items) {
      const current = resources.get(item.resource)
      if (current) current.push(item)
      else resources.set(item.resource, [item])
    }

    return {
      module,
      items,
      resources: Array.from(resources.entries()).map(([resource, resourceItems]) => ({
        resource,
        items: resourceItems,
      })),
    }
  })
}
