import { useNavigate } from 'react-router'
import {
  ChevronRight,
  Users,
  CreditCard,
  ClipboardList,
  CheckCircle2,
  UserPlus,
  Megaphone,
} from 'lucide-react'
import { mockCandidates } from '../../shared/admision/mockData'
import type { Candidate } from '../../shared/admision/types'

/**
 * KPI counts derived from `mockCandidates` — see
 * `openspec/changes/admision-module/specs/admision-screens/spec.md`
 * ("Candidate Status State Machine") for the status semantics behind each count.
 */
const totalFichasRegistradas = mockCandidates.length
const pagosConfirmados = mockCandidates.filter(c => c.pagoFicha.status !== 'PENDIENTE').length
const examenesAplicados = mockCandidates.filter(c => c.examen !== null).length
const induccionCompletada = mockCandidates.filter(c => c.induccionResultado !== null).length
const admitidos = mockCandidates.filter(c => c.status === 'ACCEPTED' || c.status === 'ENROLLED').length

/**
 * Publish shortcut gating per the spec's CORRECTED scenario ("Dashboard publish
 * shortcut gated by matrícula completion"): visible only when every ACCEPTED
 * candidate has already been ENROLLED (matrícula generated) — NOT gated by an
 * induction-completion count, which was the original (superseded) UX prompt rule.
 */
const canPublicarResultados = !mockCandidates.some(c => c.status === 'ACCEPTED')

const funnelStages: { label: string; count: number; color: string }[] = [
  { label: 'Registrados', count: totalFichasRegistradas, color: 'bg-gray-400' },
  { label: 'Pagados', count: pagosConfirmados, color: 'bg-blue-500' },
  { label: 'Examen', count: examenesAplicados, color: 'bg-violet-500' },
  { label: 'Inducción', count: induccionCompletada, color: 'bg-amber-500' },
  { label: 'Admitidos', count: admitidos, color: 'bg-emerald-500' },
]
const funnelMax = funnelStages[0]?.count || 1

interface ProgramaStat {
  programa: string
  fichas: number
  admitidos: number
  enProceso: number
  completados: number
}

function buildProgramaStats(candidates: Candidate[]): ProgramaStat[] {
  const map = new Map<string, ProgramaStat>()
  for (const c of candidates) {
    const stat = map.get(c.programa) ?? { programa: c.programa, fichas: 0, admitidos: 0, enProceso: 0, completados: 0 }
    stat.fichas += 1
    if (c.status === 'ACCEPTED' || c.status === 'ENROLLED') stat.admitidos += 1
    if (c.status === 'ENROLLED' || c.status === 'REJECTED') stat.completados += 1
    else stat.enProceso += 1
    map.set(c.programa, stat)
  }
  return Array.from(map.values()).sort((a, b) => b.fichas - a.fichas)
}

const programaStats = buildProgramaStats(mockCandidates)

const kpiCards: { label: string; value: number; sub: string; color: string; icon: React.ReactNode; badge?: string }[] = [
  {
    label: 'Fichas Registradas',
    value: totalFichasRegistradas,
    sub: 'aspirantes registrados',
    color: 'bg-blue-50 text-blue-600',
    icon: <Users size={20} />,
  },
  {
    label: 'Pagos Confirmados',
    value: pagosConfirmados,
    sub: 'fichas pagadas',
    color: 'bg-emerald-50 text-emerald-600',
    icon: <CreditCard size={20} />,
    badge: 'confirmados',
  },
  {
    label: 'Exámenes Aplicados',
    value: examenesAplicados,
    sub: 'resultados capturados',
    color: 'bg-violet-50 text-violet-600',
    icon: <ClipboardList size={20} />,
  },
  {
    label: 'Admitidos',
    value: admitidos,
    sub: 'candidatos admitidos',
    color: 'bg-emerald-50 text-emerald-600',
    icon: <CheckCircle2 size={20} />,
    badge: 'confirmados',
  },
]

export default function AdmisionDashboard() {
  const navigate = useNavigate()

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <span className="text-[#333333] font-medium">Inicio</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Admisión</span>
      </nav>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">Admisión</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">
          Seguimiento del proceso de admisión del periodo activo: Enero – Abril 2026.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpiCards.map(card => (
          <div key={card.label} className="bg-white border border-[#E5E7EB] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${card.color}`}>{card.icon}</div>
              {card.badge && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
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

      {/* Embudo de Admisión */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
        <h2 className="text-[14px] font-semibold text-[#333333] mb-4">Embudo de Admisión</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {funnelStages.map(stage => (
            <div key={stage.label} className="flex flex-col gap-2">
              <p className="text-xl font-bold text-[#333333]">{stage.count}</p>
              <p className="text-[12px] font-medium text-[#333333]">{stage.label}</p>
              <div className="h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
                <div
                  className={`h-full rounded-full ${stage.color}`}
                  style={{ width: `${Math.round((stage.count / funnelMax) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Candidatos por Programa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E7EB]">
            <h2 className="text-[14px] font-semibold text-[#333333]">Top Programas Solicitados</h2>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Programa</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Fichas</th>
                <th className="text-right px-6 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Admitidos</th>
              </tr>
            </thead>
            <tbody>
              {programaStats.map(stat => (
                <tr key={stat.programa} className="border-b border-[#E5E7EB] last:border-0">
                  <td className="px-6 py-3 text-[#333333] font-medium">{stat.programa}</td>
                  <td className="px-4 py-3 text-right text-[#333333]">{stat.fichas}</td>
                  <td className="px-6 py-3 text-right text-[#333333]">{stat.admitidos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E7EB]">
            <h2 className="text-[14px] font-semibold text-[#333333]">Estado General por Programa</h2>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Programa</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">En Proceso</th>
                <th className="text-right px-6 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Completados</th>
              </tr>
            </thead>
            <tbody>
              {programaStats.map(stat => (
                <tr key={stat.programa} className="border-b border-[#E5E7EB] last:border-0">
                  <td className="px-6 py-3 text-[#333333] font-medium">{stat.programa}</td>
                  <td className="px-4 py-3 text-right text-[#333333]">{stat.enProceso}</td>
                  <td className="px-6 py-3 text-right text-[#333333]">{stat.completados}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Acciones Rápidas */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6">
        <h2 className="text-[14px] font-semibold text-[#333333] mb-4">Acciones Rápidas</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/admision/candidatos')}
            className="flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] rounded-lg hover:border-[#009574] hover:bg-[#e6f5f1] transition-colors group"
          >
            <Users size={16} className="text-[#6B7280] group-hover:text-[#009574] transition-colors" />
            <span className="text-[13px] font-medium text-[#333333]">Ver Candidatos</span>
          </button>
          <button
            onClick={() => navigate('/admision/candidatos/registrar')}
            className="flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] rounded-lg hover:border-[#009574] hover:bg-[#e6f5f1] transition-colors group"
          >
            <UserPlus size={16} className="text-[#6B7280] group-hover:text-[#009574] transition-colors" />
            <span className="text-[13px] font-medium text-[#333333]">Registrar Candidato</span>
          </button>
          {canPublicarResultados && (
            <button
              onClick={() => navigate('/admision/publicar')}
              className="flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] rounded-lg hover:border-[#009574] hover:bg-[#e6f5f1] transition-colors group"
            >
              <Megaphone size={16} className="text-[#6B7280] group-hover:text-[#009574] transition-colors" />
              <span className="text-[13px] font-medium text-[#333333]">Publicar Resultados</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
