import { useState, useEffect } from 'react'
import { Building2, GraduationCap, BookOpen, BookMarked, CalendarRange, Users, CreditCard, ClipboardList, ChevronRight, TrendingUp, CheckCircle2 } from 'lucide-react'
import type { NavigateFn } from '../shared/types'

interface Props { navigate: NavigateFn; pendingToast?: string }

const kpiCards = [
  { label: 'Divisiones Académicas', value: '4', delta: '+1 este ciclo', color: 'bg-blue-50 text-blue-600', icon: <Building2 size={20} /> },
  { label: 'Programas Educativos', value: '12', delta: '+2 este ciclo', color: 'bg-violet-50 text-violet-600', icon: <GraduationCap size={20} /> },
  { label: 'Materias Registradas', value: '148', delta: '+8 este ciclo', color: 'bg-amber-50 text-amber-600', icon: <BookMarked size={20} /> },
  { label: 'Grupos Activos', value: '36', delta: 'Periodo ENE-ABR 2026', color: 'bg-emerald-50 text-emerald-600', icon: <Users size={20} /> },
]

const quickAccess = [
  { label: 'Divisiones', icon: <Building2 size={20} />, page: 'divisiones-list' as const },
  { label: 'Programas', icon: <GraduationCap size={20} />, page: 'programas-list' as const },
  { label: 'Planes de Estudio', icon: <BookOpen size={20} />, page: 'planes-list' as const },
  { label: 'Materias', icon: <BookMarked size={20} />, page: 'materias-list' as const },
  { label: 'Periodos', icon: <CalendarRange size={20} />, page: 'periodos-list' as const },
  { label: 'Grupos', icon: <Users size={20} />, page: 'grupos-list' as const },
  { label: 'Conceptos de Pago', icon: <CreditCard size={20} />, page: 'conceptos-list' as const },
  { label: 'Escalas de Cal.', icon: <ClipboardList size={20} />, page: 'escalas-list' as const },
]

const recentActivity = [
  { fecha: '28/06/2026', usuario: 'M. González', accion: 'Registró el grupo IDGS-101-A para ENE-ABR 2026', tipo: 'Grupo' },
  { fecha: '27/06/2026', usuario: 'A. Ramírez', accion: 'Actualizó la materia Fundamentos de Programación', tipo: 'Materia' },
  { fecha: '25/06/2026', usuario: 'L. Hernández', accion: 'Cerró el periodo AGO-DIC 2025', tipo: 'Periodo' },
  { fecha: '20/06/2026', usuario: 'M. González', accion: 'Registró el concepto Cuota Cuatrimestral con 3 tarifas', tipo: 'Concepto' },
  { fecha: '15/06/2026', usuario: 'C. Mendoza', accion: 'Agregó el programa Ing. en Inteligencia Artificial', tipo: 'Programa' },
]

const tipoBadge: Record<string, string> = {
  Grupo: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Materia: 'bg-amber-50 text-amber-700 border border-amber-200',
  Periodo: 'bg-blue-50 text-blue-700 border border-blue-200',
  Concepto: 'bg-violet-50 text-violet-700 border border-violet-200',
  Programa: 'bg-teal-50 text-teal-700 border border-teal-200',
}

export default function Dashboard({ navigate, pendingToast }: Props) {
  const [toast, setToast] = useState(pendingToast ?? '')
  useEffect(() => { if (pendingToast) setToast(pendingToast) }, [pendingToast])
  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {toast && (
        <div className="fixed top-5 right-5 z-[100] flex items-center gap-3 bg-white border border-emerald-200 shadow-lg rounded-lg px-4 py-3">
          <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
          <span className="text-[13px] font-medium text-[#333333]">{toast}</span>
          <button onClick={() => setToast('')} className="ml-1 text-[#6B7280] hover:text-[#333333] text-[16px] leading-none">×</button>
        </div>
      )}
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <span className="text-[#333333] font-medium">Inicio</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Configuración Académica</span>
      </nav>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">Panel de Control</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">Resumen general de la configuración académica del sistema.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpiCards.map(card => (
          <div key={card.label} className="bg-white border border-[#E5E7EB] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${card.color}`}>{card.icon}</div>
              <TrendingUp size={14} className="text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-[#333333]">{card.value}</p>
            <p className="text-[12px] font-medium text-[#333333] mt-0.5">{card.label}</p>
            <p className="text-[11px] text-[#6B7280] mt-1">{card.delta}</p>
          </div>
        ))}
      </div>

      {/* Quick access */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
        <h2 className="text-[14px] font-semibold text-[#333333] mb-4">Acceso rápido</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickAccess.map(item => (
            <button
              key={item.label}
              onClick={() => navigate({ page: item.page })}
              className="flex flex-col items-center gap-2 p-4 border border-[#E5E7EB] rounded-lg hover:border-[#009574] hover:bg-[#e6f5f1] transition-colors group"
            >
              <div className="text-[#6B7280] group-hover:text-[#009574] transition-colors">{item.icon}</div>
              <span className="text-[12px] font-medium text-[#333333] text-center">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
          <Activity size={15} className="text-[#6B7280]" />
          <h2 className="text-[14px] font-semibold text-[#333333]">Actividad reciente</h2>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-6 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Fecha</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-36">Usuario</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Acción</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Módulo</th>
            </tr>
          </thead>
          <tbody>
            {recentActivity.map((row, i) => (
              <tr key={i} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                <td className="px-6 py-3 text-[#6B7280] font-medium">{row.fecha}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#e6f5f1] text-[#009574] flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {row.usuario.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <span className="text-[#333333] font-medium">{row.usuario}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#333333]">{row.accion}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tipoBadge[row.tipo] ?? 'bg-gray-100 text-gray-600'}`}>{row.tipo}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
