import { useState } from 'react'
import {
  Users,
  CreditCard,
  ClipboardList,
  CheckCircle2,
  UserPlus,
  Megaphone,
  IdCard,
} from 'lucide-react'
import { Toast } from '@app/core/components/ui'
import { usePendingToast } from '@app/core/infra/hooks'
import { Breadcrumb, PageHeader, DataTable, type ColumnDef } from '@app/core/components/list'
import { KpiCards, QuickAccess, type KpiCardData, type QuickAccessItem } from '@app/core/components/dashboard'
import { mockCandidates } from '../data/mockData'
import type { Candidate } from '../data/types'

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

/** Per the nav prompt: "Generar Matrículas" quick access is visible only while there's pending work — i.e. the mirror condition of `canPublicarResultados`. */
const hayMatriculasPendientes = mockCandidates.some(c => c.status === 'ACCEPTED')

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

const kpiCards: KpiCardData[] = [
  { label: 'Fichas Registradas', value: String(totalFichasRegistradas), sub: 'aspirantes registrados', color: 'bg-blue-50 text-blue-600', icon: <Users size={20} />, trend: false },
  { label: 'Pagos Confirmados', value: String(pagosConfirmados), sub: 'fichas pagadas', color: 'bg-emerald-50 text-emerald-600', icon: <CreditCard size={20} />, badge: 'confirmados', trend: false },
  { label: 'Exámenes Aplicados', value: String(examenesAplicados), sub: 'resultados capturados', color: 'bg-violet-50 text-violet-600', icon: <ClipboardList size={20} />, trend: false },
  { label: 'Admitidos', value: String(admitidos), sub: 'candidatos admitidos', color: 'bg-emerald-50 text-emerald-600', icon: <CheckCircle2 size={20} />, badge: 'confirmados', trend: false },
]

const topProgramasColumns: ColumnDef<ProgramaStat>[] = [
  { key: 'programa', header: 'Programa', type: 'name', value: r => r.programa },
  { key: 'fichas', header: 'Fichas', type: 'count', value: r => r.fichas, className: 'w-20' },
  { key: 'admitidos', header: 'Admitidos', type: 'count', value: r => r.admitidos, className: 'w-24' },
]

const estadoProgramasColumns: ColumnDef<ProgramaStat>[] = [
  { key: 'programa', header: 'Programa', type: 'name', value: r => r.programa },
  { key: 'enProceso', header: 'En Proceso', type: 'count', value: r => r.enProceso, className: 'w-24' },
  { key: 'completados', header: 'Completados', type: 'count', value: r => r.completados, className: 'w-24' },
]

const quickAccess: QuickAccessItem[] = [
  { label: 'Ver Candidatos', icon: <Users size={16} />, url: '/admision/candidatos' },
  { label: 'Registrar Candidato', icon: <UserPlus size={16} />, url: '/admision/candidatos/registrar' },
  ...(hayMatriculasPendientes ? [{ label: 'Generar Matrículas', icon: <IdCard size={16} />, url: '/admision/matriculas' }] : []),
  ...(canPublicarResultados ? [{ label: 'Publicar Resultados', icon: <Megaphone size={16} />, url: '/admision/publicar' }] : []),
]

export default function AdmisionDashboard() {
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <Breadcrumb items={[{ label: 'Inicio' }, { label: 'Admisión' }]} />

      <PageHeader
        title="Admisión"
        subtitle="Seguimiento del proceso de admisión del periodo activo: Enero – Abril 2026."
      />

      {/* KPI Cards */}
      <KpiCards cards={kpiCards} />

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
        <DataTable
          columns={topProgramasColumns}
          status="idle"
          items={programaStats}
          keyFor={r => r.programa}
          loadingLabel="Calculando programas..."
          emptyTitle="Sin candidatos"
          emptyHint="Los programas solicitados aparecerán aquí."
          showOnMobile
          header={
            <>
              <h2 className="text-[14px] font-semibold text-[#333333]">Top Programas Solicitados</h2>
            </>
          }
        />
        <DataTable
          columns={estadoProgramasColumns}
          status="idle"
          items={programaStats}
          keyFor={r => r.programa}
          loadingLabel="Calculando programas..."
          emptyTitle="Sin candidatos"
          emptyHint="El estado por programa aparecerá aquí."
          showOnMobile
          header={
            <>
              <h2 className="text-[14px] font-semibold text-[#333333]">Estado General por Programa</h2>
            </>
          }
        />
      </div>

      {/* Acciones Rápidas */}
      <QuickAccess items={quickAccess} title="Acciones Rápidas" variant="inline" />
    </div>
  )
}