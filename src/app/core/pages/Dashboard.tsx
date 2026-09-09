import { useState } from 'react'
import { Building2, GraduationCap, BookOpen, BookMarked, CalendarRange, Users, CreditCard, ClipboardList, CheckCircle2, Activity } from 'lucide-react'
import { usePendingToast } from '../infra/hooks'
import { Breadcrumb, PageHeader, DataTable, type ColumnDef, type BadgeStyle } from '@app/core/components/list'
import { KpiCards, QuickAccess, InitialAvatar, type KpiCardData, type QuickAccessItem } from '@app/core/components/dashboard'

const kpiCards: KpiCardData[] = [
  { label: 'Divisiones Académicas', value: '4', sub: '+1 este ciclo', color: 'bg-blue-50 text-blue-600', icon: <Building2 size={20} /> },
  { label: 'Programas Educativos', value: '12', sub: '+2 este ciclo', color: 'bg-violet-50 text-violet-600', icon: <GraduationCap size={20} /> },
  { label: 'Materias Registradas', value: '148', sub: '+8 este ciclo', color: 'bg-amber-50 text-amber-600', icon: <BookMarked size={20} /> },
  { label: 'Grupos Activos', value: '36', sub: 'Periodo ENE-ABR 2026', color: 'bg-emerald-50 text-emerald-600', icon: <Users size={20} /> },
]

const quickAccess: QuickAccessItem[] = [
  { label: 'Divisiones', icon: <Building2 size={20} />, url: '/divisiones' },
  { label: 'Programas', icon: <GraduationCap size={20} />, url: '/programas' },
  { label: 'Planes de Estudio', icon: <BookOpen size={20} />, url: '/planes' },
  { label: 'Materias', icon: <BookMarked size={20} />, url: '/materias' },
  { label: 'Periodos', icon: <CalendarRange size={20} />, url: '/periodos' },
  { label: 'Grupos', icon: <Users size={20} />, url: '/grupos' },
  { label: 'Conceptos de Pago', icon: <CreditCard size={20} />, url: '/conceptos' },
  { label: 'Escalas de Cal.', icon: <ClipboardList size={20} />, url: '/escalas' },
]

const recentActivity = [
  { fecha: '28/06/2026', usuario: 'M. González', accion: 'Registró el grupo IDGS-101-A para ENE-ABR 2026', tipo: 'Grupo' },
  { fecha: '27/06/2026', usuario: 'A. Ramírez', accion: 'Actualizó la materia Fundamentos de Programación', tipo: 'Materia' },
  { fecha: '25/06/2026', usuario: 'L. Hernández', accion: 'Cerró el periodo AGO-DIC 2025', tipo: 'Periodo' },
  { fecha: '20/06/2026', usuario: 'M. González', accion: 'Registró el concepto Cuota Cuatrimestral con 3 tarifas', tipo: 'Concepto' },
  { fecha: '15/06/2026', usuario: 'C. Mendoza', accion: 'Agregó el programa Ing. en Inteligencia Artificial', tipo: 'Programa' },
]

const tipoBadge: Record<string, BadgeStyle> = {
  Grupo: { label: 'Grupo', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  Materia: { label: 'Materia', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  Periodo: { label: 'Periodo', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  Concepto: { label: 'Concepto', className: 'bg-violet-50 text-violet-700 border border-violet-200' },
  Programa: { label: 'Programa', className: 'bg-teal-50 text-teal-700 border border-teal-200' },
}

type RecentActivityItem = {
  fecha: string
  usuario: string
  accion: string
  tipo: string
}

const activityColumns: ColumnDef<RecentActivityItem>[] = [
  { key: 'fecha', header: 'Fecha', type: 'muted', value: row => row.fecha, className: 'w-32' },
  {
    key: 'usuario',
    header: 'Usuario',
    type: 'text',
    className: 'w-36',
    render: row => (
      <div className="flex items-center gap-2">
        <InitialAvatar name={row.usuario} />
        <span className="text-[#333333] font-medium">{row.usuario}</span>
      </div>
    ),
  },
  { key: 'accion', header: 'Acción', type: 'name', value: row => row.accion },
  { key: 'tipo', header: 'Módulo', type: 'badge', value: row => row.tipo, badge: tipoBadge, className: 'w-28' },
]

export default function Dashboard() {
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
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
      <KpiCards cards={kpiCards} />

      {/* Quick access */}
      <QuickAccess items={quickAccess} />

      {/* Recent activity */}
      <DataTable
        columns={activityColumns}
        status="idle"
        items={recentActivity}
        keyFor={row => `${row.fecha}-${row.usuario}-${row.accion}`}
        loadingLabel="Cargando actividad..."
        emptyTitle="Sin actividad reciente"
        emptyHint="Los movimientos del sistema aparecerán aquí."
        showOnMobile
        header={
          <>
            <Activity size={15} className="text-[#6B7280]" />
            <h2 className="text-[14px] font-semibold text-[#333333]">Actividad reciente</h2>
          </>
        }
      />
    </div>
  )
}
