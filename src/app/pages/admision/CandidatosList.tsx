import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  ChevronRight,
  Search,
  Plus,
  Eye,
  CreditCard,
  Receipt,
  ClipboardCheck,
  GraduationCap,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight as ChevRight,
} from 'lucide-react'
import { Toast, ActionBtn, SearchSelect, SimpleSelect } from '../../shared/ui'
import { mockCandidates } from '../../shared/admision/mockData'
import { STATUS_META, isAdmisionActionEnabled, type Candidate, type CandidateStatus } from '../../shared/admision/types'

// ─── Estado filter (corrected per `03-admision.md` — Corrección Pantalla 3) ───
// Uses the same 6 domain statuses + "Todos"; option labels come straight from
// STATUS_META so the filter and the badges never drift out of sync.

const STATUS_ORDER: CandidateStatus[] = ['REGISTERED', 'PAID', 'EXAM_TAKEN', 'ACCEPTED', 'REJECTED', 'ENROLLED']
const estadoOptions = STATUS_ORDER.map(s => STATUS_META[s].label)
const estadoLabelToStatus = new Map<string, CandidateStatus>(STATUS_ORDER.map(s => [STATUS_META[s].label, s]))

// Periodo de Admisión isn't modeled elsewhere yet — a static, preselected
// single-option select per the task scope ("can be a simple static select").
const PERIODO_ACTIVO = 'Enero – Abril 2026'

// ─── Cambiar Programa — inline modal, not a navigation ────────────────────────
// Per the nav-supplement prompt: "FLUJO: Cambio de Programa ... Modal inline
// con Select del nuevo programa + advertencia de cupo (no navega a otra
// pantalla)." Mirrors `CanalesDifusion.tsx`'s inline-modal convention.

function CambiarProgramaModal({ candidate, programas, onSave, onCancel }: {
  candidate: Candidate
  programas: string[]
  onSave: (nuevoPrograma: string) => void
  onCancel: () => void
}) {
  const opciones = programas.filter(p => p !== candidate.programa)
  const [nuevoPrograma, setNuevoPrograma] = useState(opciones[0] ?? '')

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-md mx-4 p-6">
        <h3 className="text-[15px] font-semibold text-[#333333] mb-1">Cambiar Programa</h3>
        <p className="text-[13px] text-[#6B7280] mb-4">
          Candidato: <strong className="text-[#333333]">{candidate.nombre}</strong> · Programa actual:{' '}
          <strong className="text-[#333333]">{candidate.programa}</strong>
        </p>

        <div className="mb-4">
          <label className="block text-[12px] font-semibold text-[#333333] mb-1">Nuevo Programa</label>
          <SearchSelect
            options={opciones}
            value={nuevoPrograma}
            onChange={setNuevoPrograma}
            placeholder="Selecciona un programa"
          />
        </div>

        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5 mb-6 text-[12px] text-amber-700">
          Verifica que el nuevo programa cuente con cupo disponible en el periodo activo antes de confirmar el cambio.
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => nuevoPrograma && onSave(nuevoPrograma)}
            disabled={!nuevoPrograma}
            className="px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cambiar Programa
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function CandidatosList() {
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState<Candidate[]>(mockCandidates)
  const [search, setSearch] = useState('')
  const [programaFilter, setProgramaFilter] = useState('')
  const [estadoLabel, setEstadoLabel] = useState('')
  const [toast, setToast] = useState('')
  const [cambiarProgramaTarget, setCambiarProgramaTarget] = useState<Candidate | null>(null)

  const programas = Array.from(new Set(mockCandidates.map(c => c.programa)))

  const filtered = candidates.filter(c => {
    const matchPrograma = !programaFilter || c.programa === programaFilter
    const matchEstado = !estadoLabel || c.status === estadoLabelToStatus.get(estadoLabel)
    const q = search.trim().toLowerCase()
    const matchSearch =
      !q ||
      c.nombre.toLowerCase().includes(q) ||
      c.curp.toLowerCase().includes(q) ||
      c.folio.toLowerCase().includes(q)
    return matchPrograma && matchEstado && matchSearch
  })

  const hasFilters = !!programaFilter || !!estadoLabel || !!search

  function handleCambiarPrograma(nuevoPrograma: string) {
    if (!cambiarProgramaTarget) return
    const targetId = cambiarProgramaTarget.id
    const nombre = cambiarProgramaTarget.nombre
    setCandidates(prev => prev.map(c => (c.id === targetId ? { ...c, programa: nuevoPrograma } : c)))
    setCambiarProgramaTarget(null)
    setToast(`Programa actualizado para ${nombre}.`)
  }

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {cambiarProgramaTarget && (
        <CambiarProgramaModal
          candidate={cambiarProgramaTarget}
          programas={programas}
          onSave={handleCambiarPrograma}
          onCancel={() => setCambiarProgramaTarget(null)}
        />
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/admision')} className="hover:text-[#009574] transition-colors">
          Inicio
        </button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Admisión</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Candidatos</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">Candidatos</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            Seguimiento de todos los aspirantes del periodo de admisión activo.
          </p>
        </div>
        <button
          onClick={() => navigate('/admision/candidatos/registrar')}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors whitespace-nowrap mt-1"
        >
          <Plus size={15} />Registrar Candidato
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="w-52">
          <SimpleSelect options={[PERIODO_ACTIVO]} value={PERIODO_ACTIVO} onChange={() => {}} />
        </div>
        <div className="w-64">
          <SearchSelect
            options={programas}
            value={programaFilter}
            onChange={setProgramaFilter}
            placeholder="Todos los programas"
          />
        </div>
        <div className="w-48">
          <SimpleSelect
            options={estadoOptions}
            value={estadoLabel}
            onChange={setEstadoLabel}
            placeholder="Todos"
          />
        </div>
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Buscar por nombre, CURP o folio..."
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
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-40">Folio</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Nombre Completo</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Programa Solicitado</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-36">Estado</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Fecha de Registro</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-40">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <Search size={36} className="text-[#E5E7EB]" />
                    <p className="text-[13px] font-medium">No se encontraron candidatos</p>
                    <p className="text-[12px]">Intenta ajustar los filtros de búsqueda</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                  <td className="px-4 py-3 text-[#6B7280] font-medium">{i + 1}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[#6B7280]">{row.folio}</td>
                  <td className="px-4 py-3 font-medium text-[#333333]">{row.nombre}</td>
                  <td className="px-4 py-3 text-[#333333]">{row.programa}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_META[row.status].badgeClass}`}>
                      {STATUS_META[row.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#6B7280]">{row.fechaRegistro}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5">
                      <ActionBtn
                        icon={<Eye size={15} />}
                        tooltip="Ver detalle"
                        onClick={() => navigate(`/admision/candidatos/detalle?id=${row.id}`)}
                      />
                      {isAdmisionActionEnabled(row, 'CONFIRMAR_PAGO_FICHA') && (
                        <ActionBtn
                          icon={<CreditCard size={15} />}
                          tooltip="Confirmar Pago Ficha"
                          onClick={() => navigate(`/admision/candidatos/pago-ficha?id=${row.id}`)}
                        />
                      )}
                      {isAdmisionActionEnabled(row, 'CONFIRMAR_PAGO_INDUCCION') && (
                        <ActionBtn
                          icon={<Receipt size={15} />}
                          tooltip="Confirmar Pago Inducción"
                          onClick={() => navigate(`/admision/candidatos/pago-induccion?id=${row.id}`)}
                        />
                      )}
                      {isAdmisionActionEnabled(row, 'REGISTRAR_EXAMEN') && (
                        <ActionBtn
                          icon={<ClipboardCheck size={15} />}
                          tooltip="Registrar Examen"
                          onClick={() => navigate(`/admision/candidatos/examen?id=${row.id}`)}
                        />
                      )}
                      {isAdmisionActionEnabled(row, 'REGISTRAR_INDUCCION') && (
                        <ActionBtn
                          icon={<GraduationCap size={15} />}
                          tooltip="Registrar Inducción"
                          onClick={() => navigate(`/admision/candidatos/induccion?id=${row.id}`)}
                        />
                      )}
                      {isAdmisionActionEnabled(row, 'CAMBIAR_PROGRAMA') && (
                        <ActionBtn
                          icon={<ArrowLeftRight size={15} />}
                          tooltip="Cambiar Programa"
                          onClick={() => setCambiarProgramaTarget(row)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination — static footer, mock data fits a single page (mirrors
            `CanalesDifusion.tsx`'s convention; no real pagination logic yet). */}
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
