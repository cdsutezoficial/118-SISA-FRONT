import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronRight, UserPlus, RotateCcw, Users, Clock3, UserCheck } from 'lucide-react'
import { Toast } from '../../shared/ui'
import { usePendingToast } from '../../shared/hooks'
import { mockStudents, mockEnrollments, ACTIVE_PERIOD } from '../../shared/inscripciones/mockData'
import type { Student } from '../../shared/inscripciones/types'

/**
 * KPI derivation — see `shared/inscripciones/mockData.ts`'s module comment for
 * why `generacionIngreso === ACTIVE_PERIOD` marks "Nuevo Ingreso" (admitted
 * this period) vs. an `Enrollment` row with `periodo === ACTIVE_PERIOD` marking
 * "ya reinscrito este periodo" for a continuing student.
 */
const nuevoIngresoStudents = mockStudents.filter(s => s.generacionIngreso === ACTIVE_PERIOD)
const nuevoIngresoInscritos = nuevoIngresoStudents.filter(s => s.status === 'ACTIVE').length
const nuevoIngresoTotal = nuevoIngresoStudents.length

const continuingStudents = mockStudents.filter(s => s.generacionIngreso !== ACTIVE_PERIOD && s.status === 'ACTIVE')
const reinscripcionesCompletadas = continuingStudents.filter(s =>
  mockEnrollments.some(e => e.studentId === s.id && e.periodo === ACTIVE_PERIOD)
).length
const reinscripcionesTotal = continuingStudents.length

const pendientesInscripcion = mockStudents.filter(s => s.status === 'PENDING').length
const totalEstudiantesActivos = mockStudents.filter(s => s.status === 'ACTIVE').length

const kpiCards: { label: string; value: string; sub: string; color: string; icon: React.ReactNode; badge?: string; badgeClass?: string }[] = [
  {
    label: 'Nuevo Ingreso',
    value: `${nuevoIngresoInscritos} / ${nuevoIngresoTotal}`,
    sub: 'inscritos de admitidos',
    color: 'bg-blue-50 text-blue-600',
    icon: <UserPlus size={20} />,
  },
  {
    label: 'Reinscripciones',
    value: `${reinscripcionesCompletadas} / ${reinscripcionesTotal}`,
    sub: 'completadas de esperadas',
    color: 'bg-violet-50 text-violet-600',
    icon: <RotateCcw size={20} />,
  },
  {
    label: 'Pendientes de Inscripción',
    value: String(pendientesInscripcion),
    sub: 'estudiantes sin completar',
    color: 'bg-amber-50 text-amber-600',
    icon: <Clock3 size={20} />,
    badge: 'pendiente',
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  {
    label: 'Total de Estudiantes Activos',
    value: String(totalEstudiantesActivos),
    sub: 'en el sistema',
    color: 'bg-emerald-50 text-emerald-600',
    icon: <UserCheck size={20} />,
  },
]

interface ProgramaAvance {
  programa: string
  nivel: string
  nuevoIngreso: number
  reinscripciones: number
  total: number
}

/**
 * `nivel` shows the first student's `nivelActual` found for that programa —
 * a program row in this small mock dataset rarely spans more than one or two
 * cuatrimestres at once, so this is a reasonable stand-in for what a real
 * "most common nivel" aggregation would compute.
 */
function buildProgramaAvance(students: Student[]): ProgramaAvance[] {
  const map = new Map<string, ProgramaAvance>()
  for (const s of students) {
    const row = map.get(s.programa) ?? { programa: s.programa, nivel: s.nivelActual, nuevoIngreso: 0, reinscripciones: 0, total: 0 }
    if (s.generacionIngreso === ACTIVE_PERIOD) row.nuevoIngreso += 1
    else if (s.status === 'ACTIVE') row.reinscripciones += 1
    row.total += 1
    map.set(s.programa, row)
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

const programaAvance = buildProgramaAvance(mockStudents)

export default function InscripcionesDashboard() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <span className="text-[#333333] font-medium">Inicio</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Inscripciones</span>
      </nav>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">Inscripciones</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">
          Estado del proceso de inscripción y reinscripción del periodo activo: {ACTIVE_PERIOD}.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpiCards.map(card => (
          <div key={card.label} className="bg-white border border-[#E5E7EB] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${card.color}`}>{card.icon}</div>
              {card.badge && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${card.badgeClass}`}>
                  {card.badge}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-[#333333]">{card.value}</p>
            <p className="text-[12px] font-medium text-[#333333] mt-0.5">{card.label}</p>
            <p className="text-[11px] text-[#6B7280] mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Avance por Programa */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-[14px] font-semibold text-[#333333]">Avance por Programa</h2>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-6 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Programa</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Nivel</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Nuevo Ingreso</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Reinscripciones</th>
              <th className="text-right px-6 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody>
            {programaAvance.map(row => (
              <tr key={row.programa} className="border-b border-[#E5E7EB] last:border-0">
                <td className="px-6 py-3 text-[#333333] font-medium">{row.programa}</td>
                <td className="px-4 py-3 text-[#333333]">{row.nivel}</td>
                <td className="px-4 py-3 text-right text-[#333333]">{row.nuevoIngreso}</td>
                <td className="px-4 py-3 text-right text-[#333333]">{row.reinscripciones}</td>
                <td className="px-6 py-3 text-right text-[#333333] font-medium">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Acciones Rápidas */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6">
        <h2 className="text-[14px] font-semibold text-[#333333] mb-4">Acciones Rápidas</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/inscripciones/nuevo-ingreso')}
            className="flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] rounded-lg hover:border-[#009574] hover:bg-[#e6f5f1] transition-colors group"
          >
            <UserPlus size={16} className="text-[#6B7280] group-hover:text-[#009574] transition-colors" />
            <span className="text-[13px] font-medium text-[#333333]">Inscribir Nuevo Ingreso</span>
          </button>
          <button
            onClick={() => navigate('/inscripciones/reinscripcion')}
            className="flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] rounded-lg hover:border-[#009574] hover:bg-[#e6f5f1] transition-colors group"
          >
            <RotateCcw size={16} className="text-[#6B7280] group-hover:text-[#009574] transition-colors" />
            <span className="text-[13px] font-medium text-[#333333]">Procesar Reinscripción</span>
          </button>
          <button
            onClick={() => navigate('/inscripciones/estudiantes')}
            className="flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] rounded-lg hover:border-[#009574] hover:bg-[#e6f5f1] transition-colors group"
          >
            <Users size={16} className="text-[#6B7280] group-hover:text-[#009574] transition-colors" />
            <span className="text-[13px] font-medium text-[#333333]">Ver Todos los Estudiantes</span>
          </button>
        </div>
      </div>
    </div>
  )
}
