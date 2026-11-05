import { useEffect, useState } from 'react'
import {
  Users,
  CreditCard,
  ClipboardList,
  CheckCircle2,
} from 'lucide-react'
import { Toast } from '@app/core/components/ui'
import { usePendingToast } from '@app/core/infra/hooks'
import { apiGet, getApiErrorMessage } from '@app/core/infra/apiClient'
import { MODALITY_LABELS, type ProgramModality } from '@app/core/infra/programLabel'
import {
  Breadcrumb,
  PageContainer,
  PageHeader,
  DataTable,
  ErrorBanner,
  FilterBar,
  FilterSelect,
  type ColumnDef,
} from '@app/core/components/list'
import { KpiCards, type KpiCardData } from '@app/core/components/dashboard'

/**
 * Tablero de Admisión con datos reales: `GET /admission/dashboard`.
 *
 * El periodo es el de destino de las configuraciones de admisión. Sin elegir uno,
 * el back toma el del proceso más reciente (el de una configuración abierta, o la
 * última que abrió). Un Director solo ve las carreras de su división.
 *
 * Cada etapa del embudo cuenta a quien llegó a ella o la pasó; las fichas vencidas
 * cuentan como registradas pero no siguen en el proceso.
 */

interface DashboardFunnel {
  registered: number
  paid: number
  examTaken: number
  inductionEnabled: number
  admitted: number
  expired: number
}

interface DashboardProgram {
  programId: string
  programName: string | null
  modality: ProgramModality | null
  registered: number
  paid: number
  admitted: number
  inProcess: number
  completed: number
  expired: number
}

interface AdmissionDashboardResponse {
  periodId: string | null
  periodName: string | null
  funnel: DashboardFunnel
  programs: DashboardProgram[]
}

interface PeriodSummary {
  id: string
  name: string
}

interface PeriodsPageResponse {
  items: PeriodSummary[]
}

function programName(p: DashboardProgram): string {
  const name = p.programName ?? '—'
  return p.modality ? `${name} (${MODALITY_LABELS[p.modality] ?? p.modality})` : name
}

const topProgramasColumns: ColumnDef<DashboardProgram>[] = [
  { key: 'programa', header: 'Carrera', type: 'name', value: r => programName(r) },
  { key: 'fichas', header: 'Fichas', type: 'count', value: r => r.registered, className: 'w-20' },
  { key: 'pagadas', header: 'Pagadas', type: 'count', value: r => r.paid, className: 'w-20' },
  { key: 'admitidos', header: 'Admitidos', type: 'count', value: r => r.admitted, className: 'w-24' },
]

const estadoProgramasColumns: ColumnDef<DashboardProgram>[] = [
  { key: 'programa', header: 'Carrera', type: 'name', value: r => programName(r) },
  { key: 'enProceso', header: 'En Proceso', type: 'count', value: r => r.inProcess, className: 'w-24' },
  { key: 'completados', header: 'Completados', type: 'count', value: r => r.completed, className: 'w-24' },
  { key: 'vencidas', header: 'Vencidas', type: 'count', value: r => r.expired, className: 'w-20' },
]

export default function AdmisionDashboard() {
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [periods, setPeriods] = useState<PeriodSummary[]>([])
  const [periodoFilter, setPeriodoFilter] = useState('')
  const [data, setData] = useState<AdmissionDashboardResponse | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    apiGet<PeriodsPageResponse>('/periods', { size: 100 })
      .then(res => setPeriods(res.items))
      .catch(() => {/* no crítico: el filtro solo no se llena */})
  }, [])

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    apiGet<AdmissionDashboardResponse>('/admission/dashboard', { periodId: periodoFilter || undefined })
      .then(res => {
        if (cancelled) return
        setData(res)
        setStatus('idle')
      })
      .catch(err => {
        if (cancelled) return
        setErrorMsg(getApiErrorMessage(err, 'No se pudo cargar el tablero de admisión.'))
        setStatus('error')
      })
    return () => { cancelled = true }
  }, [periodoFilter])

  const funnel = data?.funnel
  const value = (n: number | undefined) => (status === 'loading' || n == null ? '—' : String(n))

  const kpiCards: KpiCardData[] = [
    { label: 'Fichas Registradas', value: value(funnel?.registered), sub: funnel && funnel.expired > 0 ? `${funnel.expired} vencidas sin pagar` : 'aspirantes registrados', color: 'bg-blue-50 text-blue-600', icon: <Users size={20} />, trend: false },
    { label: 'Pagos Confirmados', value: value(funnel?.paid), sub: 'fichas pagadas', color: 'bg-emerald-50 text-emerald-600', icon: <CreditCard size={20} />, badge: 'confirmados', trend: false },
    { label: 'Exámenes Aplicados', value: value(funnel?.examTaken), sub: 'resultados capturados', color: 'bg-violet-50 text-violet-600', icon: <ClipboardList size={20} />, trend: false },
    { label: 'Admitidos', value: value(funnel?.admitted), sub: 'candidatos admitidos', color: 'bg-emerald-50 text-emerald-600', icon: <CheckCircle2 size={20} />, badge: 'confirmados', trend: false },
  ]

  const funnelStages = [
    { label: 'Registrados', count: funnel?.registered ?? 0, color: 'bg-gray-400' },
    { label: 'Pagados', count: funnel?.paid ?? 0, color: 'bg-blue-500' },
    { label: 'Examen', count: funnel?.examTaken ?? 0, color: 'bg-violet-500' },
    { label: 'Inducción', count: funnel?.inductionEnabled ?? 0, color: 'bg-amber-500' },
    { label: 'Admitidos', count: funnel?.admitted ?? 0, color: 'bg-emerald-500' },
  ]
  const funnelMax = funnelStages[0].count || 1

  const subtitle = status === 'loading'
    ? 'Cargando el proceso de admisión…'
    : data?.periodName
      ? `Seguimiento del proceso de admisión del periodo: ${data.periodName}.`
      : 'Todavía no hay un proceso de admisión configurado.'

  const programs = data?.programs ?? []
  const tableStatus = status === 'loading' ? 'loading' : 'idle'

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <Breadcrumb items={[{ label: 'Inicio' }, { label: 'Admisión' }]} />

      <PageHeader title="Admisión" subtitle={subtitle} />

      <FilterBar>
        <FilterSelect
          value={periodoFilter}
          onChange={setPeriodoFilter}
          allLabel="Proceso más reciente"
          options={periods.map(p => ({ value: p.id, label: p.name }))}
        />
      </FilterBar>

      {status === 'error' && <ErrorBanner message={errorMsg} />}

      {/* KPI Cards */}
      <KpiCards cards={kpiCards} />

      {/* Embudo de Admisión */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
        <h2 className="text-[14px] font-semibold text-[#333333] mb-4">Embudo de Admisión</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {funnelStages.map(stage => (
            <div key={stage.label} className="flex flex-col gap-2">
              <p className="text-xl font-bold text-[#333333]">{status === 'loading' ? '—' : stage.count}</p>
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

      {/* Candidatos por carrera */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DataTable
          columns={topProgramasColumns}
          status={tableStatus}
          items={programs}
          keyFor={r => r.programId}
          loadingLabel="Calculando carreras..."
          emptyTitle="Sin candidatos"
          emptyHint="Las carreras solicitadas aparecerán aquí."
          showOnMobile
          header={
            <>
              <h2 className="text-[14px] font-semibold text-[#333333]">Carreras más solicitadas</h2>
            </>
          }
        />
        <DataTable
          columns={estadoProgramasColumns}
          status={tableStatus}
          items={programs}
          keyFor={r => r.programId}
          loadingLabel="Calculando carreras..."
          emptyTitle="Sin candidatos"
          emptyHint="El estado por carrera aparecerá aquí."
          showOnMobile
          header={
            <>
              <h2 className="text-[14px] font-semibold text-[#333333]">Estado general por carrera</h2>
            </>
          }
        />
      </div>
    </PageContainer>
  )
}
