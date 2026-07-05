import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronRight, Search, Plus, Eye, ArrowLeftRight, BookOpen, ChevronLeft, ChevronRight as ChevRight } from 'lucide-react'
import { Toast, ActionBtn, SearchSelect, SimpleSelect } from '../../shared/ui'
import { usePendingToast } from '../../shared/hooks'
import { mockStudents, ACTIVE_PERIOD } from '../../shared/inscripciones/mockData'
import { STUDENT_STATUS_META, type StudentStatus } from '../../shared/inscripciones/types'

// ─── Estado filter — same 7 domain statuses + "Todos", labels/badges sourced ──
// from STUDENT_STATUS_META so the filter and the row badges never drift apart.

const STATUS_ORDER: StudentStatus[] = ['PENDING', 'ACTIVE', 'PRE_LOW', 'TEMPORARY_LOW', 'LOW', 'GRADUATED', 'TITLED']
const estadoOptions = STATUS_ORDER.map(s => STUDENT_STATUS_META[s].label)
const estadoLabelToStatus = new Map<string, StudentStatus>(STATUS_ORDER.map(s => [STUDENT_STATUS_META[s].label, s]))

// Kardex lives in Módulo 05 (Calificaciones), not built yet in this frontend
// slice — the action is visible (per the Figma nav prompt) but disabled with
// an explanatory tooltip instead of navigating to a dead route.
const KARDEX_TOOLTIP = 'Kardex — disponible cuando se implemente el Módulo de Calificaciones'

const programaOptions = Array.from(new Set(mockStudents.map(s => s.programa)))
const nivelOptions = Array.from(new Set(mockStudents.map(s => s.nivelActual)))

export default function EstudiantesList() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [search, setSearch] = useState('')
  const [programaFilter, setProgramaFilter] = useState('')
  const [nivelFilter, setNivelFilter] = useState('')
  const [estadoLabel, setEstadoLabel] = useState('')

  const filtered = mockStudents.filter(s => {
    const matchPrograma = !programaFilter || s.programa === programaFilter
    const matchNivel = !nivelFilter || s.nivelActual === nivelFilter
    const matchEstado = !estadoLabel || s.status === estadoLabelToStatus.get(estadoLabel)
    const q = search.trim().toLowerCase()
    const matchSearch = !q || s.nombre.toLowerCase().includes(q) || s.matricula.toLowerCase().includes(q)
    return matchPrograma && matchNivel && matchEstado && matchSearch
  })

  const hasFilters = !!programaFilter || !!nivelFilter || !!estadoLabel || !!search

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/inscripciones')} className="hover:text-[#009574] transition-colors">
          Inicio
        </button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Inscripciones</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Estudiantes</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">Estudiantes</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">Consulta todos los estudiantes activos del sistema.</p>
        </div>
        <button
          onClick={() => navigate('/inscripciones/nuevo-ingreso')}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors whitespace-nowrap mt-1"
        >
          <Plus size={15} />Inscribir Nuevo Ingreso
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="w-52">
          <SimpleSelect options={[ACTIVE_PERIOD]} value={ACTIVE_PERIOD} onChange={() => {}} />
        </div>
        <div className="w-64">
          <SearchSelect
            options={programaOptions}
            value={programaFilter}
            onChange={setProgramaFilter}
            placeholder="Todos los programas"
          />
        </div>
        <div className="w-56">
          <SearchSelect
            options={nivelOptions}
            value={nivelFilter}
            onChange={setNivelFilter}
            placeholder="Todos los niveles"
          />
        </div>
        <div className="w-48">
          <SimpleSelect options={estadoOptions} value={estadoLabel} onChange={setEstadoLabel} placeholder="Todos" />
        </div>
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Buscar por nombre o matrícula..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-[#333333] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574] transition"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-10">#</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Matrícula</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Nombre Completo</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Programa</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Nivel Actual</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Grupo</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Estado</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <Search size={36} className="text-[#E5E7EB]" />
                    <p className="text-[13px] font-medium">No se encontraron estudiantes</p>
                    <p className="text-[12px]">Intenta ajustar los filtros de búsqueda</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                  <td className="px-4 py-3 text-[#6B7280] font-medium">{i + 1}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[#6B7280]">{row.matricula}</td>
                  <td className="px-4 py-3 font-medium text-[#333333]">{row.nombre}</td>
                  <td className="px-4 py-3 text-[#333333]">{row.programa}</td>
                  <td className="px-4 py-3 text-[#333333]">{row.nivelActual}</td>
                  <td className="px-4 py-3 text-[#333333]">{row.grupo}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STUDENT_STATUS_META[row.status].badgeClass}`}>
                      {STUDENT_STATUS_META[row.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5">
                      <ActionBtn
                        icon={<Eye size={15} />}
                        tooltip="Ver detalle"
                        onClick={() => navigate(`/inscripciones/estudiantes/detalle?id=${row.id}`)}
                      />
                      <ActionBtn
                        icon={<ArrowLeftRight size={15} />}
                        tooltip="Reinscribir"
                        onClick={() => navigate(`/inscripciones/reinscripcion?id=${row.id}`)}
                      />
                      <ActionBtn icon={<BookOpen size={15} />} tooltip={KARDEX_TOOLTIP} disabled />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination — static footer, mock data fits a single page (mirrors
            `CandidatosList.tsx`'s convention; no real pagination logic yet). */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB] bg-[#F8F9FA]">
          <p className="text-[12px] text-[#6B7280]">
            {filtered.length === 0
              ? hasFilters
                ? 'Sin resultados para los filtros aplicados'
                : 'Sin registros'
              : `Mostrando 1–${filtered.length} de ${filtered.length} registros`}
          </p>
          <div className="flex items-center gap-2">
            <button disabled className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[#333333] opacity-40 cursor-not-allowed">
              <ChevronLeft size={13} />Anterior
            </button>
            <button className="w-8 h-8 text-[12px] font-medium rounded-md border bg-[#009574] text-white border-[#009574]">1</button>
            <button disabled className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[#333333] opacity-40 cursor-not-allowed">
              Siguiente<ChevRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
