import type { RoleType } from './roles'

/** Descripción corta por rol (columna "Descripción" de la tablita). */
export const ROLE_DESCRIPTIONS: Record<RoleType, string> = {
  ADMIN: 'Acceso total al sistema: administración, configuración, finanzas, admisión e trayectoria.',
  SERVICIOS_ESCOLARES: 'Opera la configuración académica, general, admisión y trayectoria estudiantil.',
  GESTOR_ACADEMICO: 'Gestiona la operación académica de su división.',
  DIRECTOR_DIVISION: 'Supervisa la operación académica de su división y la configuración de admisión.',
  JEFATURA_ESTADIAS: 'Coordina el proceso de estadías.',
  ASISTENTE_ESTADIAS: 'Apoya el proceso de estadías.',
  COORDINACION_ESTADIAS_DIVISION: 'Coordina estadías a nivel división.',
  PERSONAL_FINANZAS: 'Administra las áreas de facturación, conceptos de pago y tarifas.',
  DOCENTE: 'Consulta catálogos e información de sus grupos.',
  ESTUDIANTE: 'Consulta catálogos e información de su trayectoria.',
  EGRESADO: 'Consulta catálogos e información de su trayectoria.',
}

const MODULE_ORDER: Record<string, number> = {
  Administración: 1,
  'Configuración Académica': 2,
  'Configuración General': 3,
  Finanzas: 4,
  Admisión: 5,
  'Trayectoria Estudiantil': 6,
  Catálogos: 7,
}

const RESOURCE_META: Record<string, { module: string; resource: string; resourceOrder: number }> = {
  ROLES: { module: 'Administración', resource: 'Roles', resourceOrder: 10 },
  PERMISSIONS: { module: 'Administración', resource: 'Permisos', resourceOrder: 20 },
  USERS: { module: 'Administración', resource: 'Usuarios', resourceOrder: 30 },
  PERSONS: { module: 'Administración', resource: 'Personas', resourceOrder: 40 },
  DIVISIONS: { module: 'Configuración Académica', resource: 'Divisiones Académicas', resourceOrder: 10 },
  CARRERAS: { module: 'Configuración Académica', resource: 'Carreras', resourceOrder: 20 },
  PLANS: { module: 'Configuración Académica', resource: 'Planes de Estudio', resourceOrder: 30 },
  SUBJECT_CLASSIFICATIONS: { module: 'Configuración Académica', resource: 'Clasificaciones de Materias', resourceOrder: 40 },
  PERIODS: { module: 'Configuración Académica', resource: 'Periodos Académicos', resourceOrder: 50 },
  GENERATIONS: { module: 'Configuración Académica', resource: 'Generaciones', resourceOrder: 60 },
  GROUPS: { module: 'Configuración Académica', resource: 'Grupos', resourceOrder: 70 },
  OUTREACH_CHANNELS: { module: 'Configuración General', resource: 'Canales de Difusión', resourceOrder: 10 },
  HIGH_SCHOOL_TYPES: { module: 'Configuración General', resource: 'Tipos de Bachillerato', resourceOrder: 20 },
  PAYMENT_AREAS: { module: 'Finanzas', resource: 'Áreas de Facturación', resourceOrder: 5 },
  PAYMENT_CONCEPTS: { module: 'Finanzas', resource: 'Conceptos de Pago', resourceOrder: 10 },
  PAYMENT_RATES: { module: 'Finanzas', resource: 'Tarifas de Pago', resourceOrder: 20 },
  PAYMENT_DISCOUNTS: { module: 'Finanzas', resource: 'Aplicar Descuentos', resourceOrder: 30 },
  PROGRAM_ADMISSION_CONFIGS: { module: 'Admisión', resource: 'Configuración de Admisión', resourceOrder: 10 },
  CANDIDATES: { module: 'Admisión', resource: 'Candidatos', resourceOrder: 20 },
  ADMISSION_SELECTION: { module: 'Admisión', resource: 'Selección de Candidatos', resourceOrder: 30 },
  ADMISSION_MATRICULATIONS: { module: 'Admisión', resource: 'Generar Matrículas', resourceOrder: 40 },
  ADMISSION_RESULTS: { module: 'Admisión', resource: 'Publicar Resultados', resourceOrder: 50 },
  ADMISSION_INDUCTION: { module: 'Admisión', resource: 'Habilitar Inducción', resourceOrder: 60 },
  STUDENTS: { module: 'Trayectoria Estudiantil', resource: 'Estudiantes', resourceOrder: 10 },
  STUDENT_ENROLLMENTS: { module: 'Trayectoria Estudiantil', resource: 'Nuevo Ingreso', resourceOrder: 20 },
  STUDENT_REENROLLMENTS: { module: 'Trayectoria Estudiantil', resource: 'Reinscripción', resourceOrder: 30 },
  STUDENT_DOCUMENTS: { module: 'Trayectoria Estudiantil', resource: 'Documentos Institucionales', resourceOrder: 40 },
  STUDENT_RECORDS: { module: 'Trayectoria Estudiantil', resource: 'Expediente', resourceOrder: 50 },
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

/**
 * Permisos de módulos/pantallas que el backend aún no expone (selección,
 * matrículas, resultados, inducción, descuentos, trayectoria, operación de
 * admisión). Se muestran en la tablita de RolPermisos como filas INACTIVE —
 * visibles pero no asignables — hasta que su módulo se construya del lado
 * servidor. `mergePlannedPermissions` los fusiona al catálogo devuelto por el
 * backend sin repetir claves que ya existan.
 */
export const PLANNED_PERMISSIONS: PermissionCatalogItem[] = [
  ...actions('CANDIDATES', 'Candidatos', ['READ', 'CREATE', 'UPDATE', 'CHANGE_STATUS']),
  ...actions('ADMISSION_SELECTION', 'Selección de Candidatos', ['READ', 'CREATE', 'UPDATE', 'CHANGE_STATUS']),
  ...actions('ADMISSION_MATRICULATIONS', 'Generar Matrículas', ['READ', 'CREATE']),
  ...actions('ADMISSION_RESULTS', 'Publicar Resultados', ['READ', 'CREATE']),
  ...actions('ADMISSION_INDUCTION', 'Habilitar Inducción', ['READ', 'CREATE', 'UPDATE']),
  ...actions('PAYMENT_DISCOUNTS', 'Aplicar Descuentos', ['READ', 'CREATE', 'UPDATE', 'CHANGE_STATUS']),
  ...actions('STUDENTS', 'Estudiantes', ['READ', 'CREATE', 'UPDATE', 'CHANGE_STATUS']),
  ...actions('STUDENT_ENROLLMENTS', 'Nuevo Ingreso', ['READ', 'CREATE']),
  ...actions('STUDENT_REENROLLMENTS', 'Reinscripción', ['READ', 'CREATE']),
  ...actions('STUDENT_DOCUMENTS', 'Documentos Institucionales', ['READ', 'CREATE', 'UPDATE']),
  ...actions('STUDENT_RECORDS', 'Expediente', ['READ']),
]

function actions(resource: string, label: string, suffixes: string[]): PermissionCatalogItem[] {
  return suffixes.map(suffix => ({
    id: `${resource}_${suffix}`,
    name: `${label} — ${suffix}`,
    key: `${resource}_${suffix}`,
    status: 'INACTIVE',
  }))
}

export function mergePlannedPermissions(catalog: PermissionCatalogItem[]): PermissionCatalogItem[] {
  const existing = new Set(catalog.map(permission => permission.key))
  const missing = PLANNED_PERMISSIONS.filter(permission => !existing.has(permission.key))
  return [...catalog, ...missing]
}
