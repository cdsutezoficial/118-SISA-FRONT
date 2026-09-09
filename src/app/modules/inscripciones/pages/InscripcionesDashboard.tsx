import { useState } from 'react'
import { UserPlus, RotateCcw, Users, Clock3, UserCheck, Activity } from 'lucide-react'
import { Toast } from '@app/core/components/ui'
import { usePendingToast } from '@app/core/infra/hooks'
import { Breadcrumb, PageHeader, DataTable, type ColumnDef } from '@app/core/components/list'
import { KpiCards, QuickAccess, type KpiCardData, type QuickAccessItem } from '@app/core/components/dashboard'
import { mockStudents, mockEnrollments, ACTIVE_PERIOD } from '../data/mockData'
import type { Student } from '../data/types'

/**
 * KPI derivation — see `shared/inscripciones/mockData.ts`'s module comment for
 * why `generacionIngreso === ACTIVE_PERIOD` marks "Nuevo Ingreso" (admitted
 * this period) vs. an `Enrollment` row with `periodo === ACTIVE_PERIOD` marking
 * "ya reinscrito este periodo" for a continuing student.
 */
const nuevoIngresoStudents = mockStudents.filter(s => s.generacionIngreso === ACTIVE_PERIOD)
const nuevoIngresoInscritos = nuevoIngresoStudents.filter(s => s.status === 'ACTIVE').length
const nuevoIngresoTotal = nuevoIngresoStudents.length

/** A continuing student "reinscribió" this period iff they have an `Enrollment` row for `ACTIVE_PERIOD`. */
function hasActiveEnrollmentThisPeriod(student: Student): boolean {
  return mockEnrollments.some(e => e.studentId === student.id && e.periodo === ACTIVE_PERIOD)
}

const continuingStudents = mockStudents.filter(s => s.generacionIngreso !== ACTIVE_PERIOD && s.status === 'ACTIVE')
const reinscripcionesCompletadas = continuingStudents.filter(hasActiveEnrollmentThisPeriod).length
const reinscripcionesTotal = continuingStudents.length

const pendientesInscripcion = mockStudents.filter(s => s.status === 'PENDING').length
const totalEstudiantesActivos = mockStudents.filter(s => s.status === 'ACTIVE').length

const kpiCards: KpiCardData[] = [
  { label: 'Nuevo Ingreso', value: `${nuevoIngresoInscritos} / ${nuevoIngresoTotal}`, sub: 'inscritos de admitidos', color: 'bg-blue-50 text-blue-600', icon: <UserPlus size={20} />, trend: false },
  { label: 'Reinscripciones', value: `${reinscripcionesCompletadas} / ${reinscripcionesTotal}`, sub: 'completadas de esperadas', color: 'bg-violet-50 text-violet-600', icon: <RotateCcw size={20} />, trend: false },
  {
    label: 'Pendientes de Inscripción',
    value: String(pendientesInscripcion),
    sub: 'estudiantes sin completar',
    color: 'bg-amber-50 text-amber-600',
    icon: <Clock3 size={20} />,
    badge: 'pendiente',
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
    trend: false,
  },
  { label: 'Total de Estudiantes Activos', value: String(totalEstudiantesActivos), sub: 'en el sistema', color: 'bg-emerald-50 text-emerald-600', icon: <UserCheck size={20} />, trend: false },
]

interface ProgramaAvance {
  programa: string
  nivel: string
  nuevoIngresoCompletado: number
  nuevoIngresoTotal: number
  reinscripcionesCompletadas: number
  reinscripcionesTotal: number
}

/**
 * `nivel` shows the first student's `nivelActual` found for that programa —
 * a program row in this small mock dataset rarely spans more than one or two
 * cuatrimestres at once, so this is a reasonable stand-in for what a real
 * "most common nivel" aggregation would compute.
 *
 * Each column tracks "completado / total" (same semantics as the KPI cards
 * above), and the row's Total is always the sum of the two `*Total` fields —
 * computed at render time, never accumulated independently — so it can never
 * drift from `nuevoIngreso* + reinscripciones*` the way a separately-tracked
 * counter could.
 */
function buildProgramaAvance(students: Student[]): ProgramaAvance[] {
  const map = new Map<string, ProgramaAvance>()
  for (const s of students) {
    const row = map.get(s.programa) ?? {
      programa: s.programa,
      nivel: s.nivelActual,
      nuevoIngresoCompletado: 0,
      nuevoIngresoTotal: 0,
      reinscripcionesCompletadas: 0,
      reinscripcionesTotal: 0,
    }
    if (s.generacionIngreso === ACTIVE_PERIOD) {
      row.nuevoIngresoTotal += 1
      if (s.status === 'ACTIVE') row.nuevoIngresoCompletado += 1
    } else if (s.status === 'ACTIVE') {
      row.reinscripcionesTotal += 1
      if (hasActiveEnrollmentThisPeriod(s)) row.reinscripcionesCompletadas += 1
    }
    map.set(s.programa, row)
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      b.nuevoIngresoTotal + b.reinscripcionesTotal - (a.nuevoIngresoTotal + a.reinscripcionesTotal),
  )
}

const programaAvance = buildProgramaAvance(mockStudents)

const avanceColumns: ColumnDef<ProgramaAvance>[] = [
  { key: 'programa', header: 'Programa', type: 'name', value: r => r.programa },
  { key: 'nivel', header: 'Nivel', type: 'text', value: r => r.nivel },
  { key: 'nuevoIngreso', header: 'Nuevo Ingreso', type: 'count', value: r => `${r.nuevoIngresoCompletado} / ${r.nuevoIngresoTotal}`, className: 'w-32' },
  { key: 'reinscripciones', header: 'Reinscripciones', type: 'count', value: r => `${r.reinscripcionesCompletadas} / ${r.reinscripcionesTotal}`, className: 'w-32' },
  { key: 'total', header: 'Total', type: 'count', value: r => r.nuevoIngresoTotal + r.reinscripcionesTotal, className: 'w-20' },
]

const quickAccess: QuickAccessItem[] = [
  { label: 'Inscribir Nuevo Ingreso', icon: <UserPlus size={16} />, url: '/inscripciones/nuevo-ingreso' },
  { label: 'Procesar Reinscripción', icon: <RotateCcw size={16} />, url: '/inscripciones/reinscripcion' },
  { label: 'Ver Todos los Estudiantes', icon: <Users size={16} />, url: '/inscripciones/estudiantes' },
]

export default function InscripcionesDashboard() {
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <Breadcrumb items={[{ label: 'Inicio' }, { label: 'Inscripciones' }]} />

      <PageHeader
        title="Inscripciones"
        subtitle={`Estado del proceso de inscripción y reinscripción del periodo activo: ${ACTIVE_PERIOD}.`}
      />

      {/* KPI Cards */}
      <KpiCards cards={kpiCards} />

      {/* Avance por Programa */}
      <DataTable
        columns={avanceColumns}
        status="idle"
        items={programaAvance}
        keyFor={r => r.programa}
        loadingLabel="Calculando avance..."
        emptyTitle="Sin programas registrados"
        emptyHint="El avance por programa aparecerá aquí."
        showOnMobile
        header={
          <>
            <Activity size={15} className="text-[#6B7280]" />
            <h2 className="text-[14px] font-semibold text-[#333333]">Avance por Programa</h2>
          </>
        }
      />

      {/* Acciones Rápidas */}
      <QuickAccess items={quickAccess} title="Acciones Rápidas" variant="inline" />
    </div>
  )
}