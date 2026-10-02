import { useEffect, useState } from 'react'
import { Building2, GraduationCap, BookOpen, BookMarked, CalendarRange, Users, Tags, Users2, CheckCircle2, RefreshCw } from 'lucide-react'
import { usePendingToast } from '../infra/hooks'
import { useRole } from '../infra/RoleContext'
import { Breadcrumb, PageHeader, ErrorBanner } from '@app/core/components/list'
import { KpiCards, QuickAccess, type KpiCardData, type QuickAccessItem } from '@app/core/components/dashboard'
import { apiGet, getApiErrorMessage } from '@app/core/infra/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────
// El dashboard NO hace una consulta por módulo: el BACK expone
// `GET /config-academica/statistics` (backend `ConfigurationStatisticsController`),
// que responde todos los contadores KPI en una sola llamada. La sección
// "Actividad reciente" no existe todavía porque no hay auditoría.

interface ConfigStatistics {
  divisions: number
  programs: number
  subjects: number
  groupsForCurrentPeriod: number
  currentPeriod: { id: string; name: string; active: boolean } | null
}

interface DashboardQuickAccessItem extends QuickAccessItem {
  permissionKey?: string
}

const quickAccess: DashboardQuickAccessItem[] = [
  { label: 'Divisiones', icon: <Building2 size={20} />, url: '/divisiones', permissionKey: 'DIVISIONS_READ' },
  { label: 'Carreras', icon: <GraduationCap size={20} />, url: '/carreras', permissionKey: 'CARRERAS_READ' },
  { label: 'Planes de Estudio', icon: <BookOpen size={20} />, url: '/planes', permissionKey: 'PLANS_READ' },
  { label: 'Clasificaciones', icon: <Tags size={20} />, url: '/clasificaciones', permissionKey: 'SUBJECT_CLASSIFICATIONS_READ' },
  { label: 'Periodos', icon: <CalendarRange size={20} />, url: '/periodos', permissionKey: 'PERIODS_READ' },
  { label: 'Grupos', icon: <Users size={20} />, url: '/grupos', permissionKey: 'GROUPS_READ' },
  { label: 'Generaciones', icon: <Users2 size={20} />, url: '/generaciones', permissionKey: 'GENERATIONS_READ' },
]

export default function Dashboard() {
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [statistics, setStatistics] = useState<ConfigStatistics | null>(null)
  const [loadStatus, setLoadStatus] = useState<'loading' | 'idle' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const { hasAnyPermission } = useRole()

  function loadStatistics() {
    setLoadStatus('loading')
    setErrorMsg('')
    let cancelled = false
    apiGet<ConfigStatistics>('/config-academica/statistics')
      .then(data => {
        if (cancelled) return
        setStatistics(data)
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        setErrorMsg(getApiErrorMessage(err))
      })
    return () => { cancelled = true }
  }

  useEffect(() => loadStatistics(), [])

  const loading = loadStatus === 'loading'

  const kpiCards: KpiCardData[] = [
    { label: 'Divisiones Académicas', value: loading ? '—' : String(statistics?.divisions ?? 0), sub: loading ? 'Consultando datos…' : 'Divisiones registradas', color: 'bg-blue-50 text-blue-600', icon: <Building2 size={20} />, trend: false },
    { label: 'Carreras', value: loading ? '—' : String(statistics?.programs ?? 0), sub: loading ? 'Consultando datos…' : 'Carreras registradas', color: 'bg-violet-50 text-violet-600', icon: <GraduationCap size={20} />, trend: false },
    { label: 'Materias', value: loading ? '—' : String(statistics?.subjects ?? 0), sub: loading ? 'Consultando datos…' : 'Materias registradas', color: 'bg-amber-50 text-amber-600', icon: <BookMarked size={20} />, trend: false },
    { label: 'Grupos', value: loading ? '—' : String(statistics?.groupsForCurrentPeriod ?? 0), sub: loading ? 'Consultando datos…' : statistics?.currentPeriod ? `${statistics.currentPeriod.active ? 'Periodo vigente' : 'Periodo más reciente'}: ${statistics.currentPeriod.name}` : 'Sin periodos configurados', color: 'bg-emerald-50 text-emerald-600', icon: <Users size={20} />, trend: false },
  ]

  const visibleQuickAccess = quickAccess.filter(item => !item.permissionKey || hasAnyPermission([item.permissionKey]))

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {toast && (
        <div className="fixed top-5 right-5 z-[100] flex items-center gap-3 bg-white border border-emerald-200 shadow-lg rounded-lg px-4 py-3">
          <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
          <span className="text-[13px] font-medium text-[#333333]">{toast}</span>
          <button onClick={() => setToast('')} className="ml-1 text-[#6B7280] hover:text-[#333333] text-[16px] leading-none">×</button>
        </div>
      )}
      <Breadcrumb items={[{ label: 'Inicio' }, { label: 'Configuración Académica' }]} />

      <PageHeader
        title="Panel de Control"
        subtitle="Resumen general de la configuración académica del sistema."
      />

      {/* KPI Cards */}
      {loadStatus === 'error' ? (
        <div className="mb-8 space-y-3">
          <ErrorBanner message={errorMsg} />
          <button
            type="button"
            onClick={loadStatistics}
            className="inline-flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-[#333333] border border-[#E5E7EB] rounded-md hover:border-[#009574] hover:text-[#009574] transition-colors"
          >
            <RefreshCw size={14} />
            Reintentar
          </button>
        </div>
      ) : (
        <KpiCards cards={kpiCards} />
      )}

      {/* Quick access */}
      <QuickAccess items={visibleQuickAccess} />
    </div>
  )
}