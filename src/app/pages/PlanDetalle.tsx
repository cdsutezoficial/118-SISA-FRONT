import { useState, useEffect } from 'react'
import {
  ChevronRight, Pencil, History, Layers, BookMarked, Hash,
  GraduationCap, ChevronDown, ChevronUp, ArrowLeft, CheckCircle2, ClipboardList,
  MinusCircle, Plus,
} from 'lucide-react'
import type { NavigateFn } from '../shared/types'

interface Props { navigate: NavigateFn; pendingToast?: string }

type TabKey = 'niveles' | 'historial' | 'escalas'

interface Materia {
  nombre: string
  clave: string
  creditos: number
  clasificacion: string
}

interface Nivel {
  id: string
  nombre: string
  tipo: 'TSU' | 'Ingeniería'
  materias: Materia[]
}

const clasificacionStyle: Record<string, string> = {
  'Básica': 'bg-blue-50 text-blue-700 border border-blue-200',
  'Ciencias Básicas': 'bg-violet-50 text-violet-700 border border-violet-200',
  'Lengua Extranjera': 'bg-amber-50 text-amber-700 border border-amber-200',
  'Especialidad': 'bg-teal-50 text-teal-700 border border-teal-200',
  'Transversal': 'bg-gray-100 text-gray-600 border border-gray-200',
  'Matemáticas': 'bg-rose-50 text-rose-700 border border-rose-200',
}

const niveles: Nivel[] = [
  {
    id: 'n1', nombre: '1er Cuatrimestre TSU', tipo: 'TSU',
    materias: [
      { nombre: 'Fundamentos de Programación', clave: 'FP-101', creditos: 6, clasificacion: 'Básica' },
      { nombre: 'Cálculo Diferencial', clave: 'CAL-101', creditos: 8, clasificacion: 'Ciencias Básicas' },
      { nombre: 'Álgebra Lineal', clave: 'ALG-101', creditos: 6, clasificacion: 'Matemáticas' },
      { nombre: 'Inglés I', clave: 'ING-101', creditos: 4, clasificacion: 'Lengua Extranjera' },
    ],
  },
  {
    id: 'n2', nombre: '2do Cuatrimestre TSU', tipo: 'TSU',
    materias: [
      { nombre: 'Programación Orientada a Objetos', clave: 'POO-201', creditos: 8, clasificacion: 'Básica' },
      { nombre: 'Cálculo Integral', clave: 'CAL-201', creditos: 8, clasificacion: 'Ciencias Básicas' },
      { nombre: 'Bases de Datos I', clave: 'BD-201', creditos: 6, clasificacion: 'Especialidad' },
      { nombre: 'Inglés II', clave: 'ING-201', creditos: 4, clasificacion: 'Lengua Extranjera' },
    ],
  },
  {
    id: 'n3', nombre: '3er Cuatrimestre TSU', tipo: 'TSU',
    materias: [
      { nombre: 'Estructuras de Datos', clave: 'ED-301', creditos: 8, clasificacion: 'Básica' },
      { nombre: 'Bases de Datos II', clave: 'BD-301', creditos: 6, clasificacion: 'Especialidad' },
      { nombre: 'Desarrollo Web Frontend', clave: 'DW-301', creditos: 6, clasificacion: 'Especialidad' },
      { nombre: 'Inglés III', clave: 'ING-301', creditos: 4, clasificacion: 'Lengua Extranjera' },
    ],
  },
  {
    id: 'n4', nombre: '4to Cuatrimestre TSU', tipo: 'TSU',
    materias: [
      { nombre: 'Algoritmos Avanzados', clave: 'ALG-401', creditos: 8, clasificacion: 'Básica' },
      { nombre: 'Desarrollo de Software en Equipo', clave: 'DSE-401', creditos: 8, clasificacion: 'Especialidad' },
      { nombre: 'Redes de Computadoras', clave: 'RC-401', creditos: 6, clasificacion: 'Básica' },
    ],
  },
  {
    id: 'n5', nombre: '5to Cuatrimestre TSU', tipo: 'TSU',
    materias: [
      { nombre: 'Seguridad en Aplicaciones', clave: 'SA-501', creditos: 6, clasificacion: 'Especialidad' },
      { nombre: 'Gestión de Proyectos', clave: 'GP-501', creditos: 6, clasificacion: 'Transversal' },
      { nombre: 'Estadística', clave: 'EST-501', creditos: 6, clasificacion: 'Matemáticas' },
    ],
  },
  {
    id: 'n6', nombre: '6to Cuatrimestre TSU', tipo: 'TSU',
    materias: [
      { nombre: 'Residencia Profesional TSU', clave: 'RP-601', creditos: 12, clasificacion: 'Transversal' },
      { nombre: 'Desarrollo de Habilidades', clave: 'DH-601', creditos: 4, clasificacion: 'Transversal' },
    ],
  },
  {
    id: 'n7', nombre: '7mo Cuatrimestre — Continuidad Ing.', tipo: 'Ingeniería',
    materias: [
      { nombre: 'Diseño de Sistemas', clave: 'DS-701', creditos: 8, clasificacion: 'Especialidad' },
      { nombre: 'Arquitectura de Software', clave: 'AS-701', creditos: 8, clasificacion: 'Especialidad' },
      { nombre: 'Emprendimiento e Innovación', clave: 'EI-701', creditos: 4, clasificacion: 'Transversal' },
    ],
  },
  {
    id: 'n8', nombre: '8vo Cuatrimestre — Continuidad Ing.', tipo: 'Ingeniería',
    materias: [
      { nombre: 'Inteligencia Artificial', clave: 'IA-801', creditos: 8, clasificacion: 'Especialidad' },
      { nombre: 'Cloud Computing', clave: 'CC-801', creditos: 6, clasificacion: 'Especialidad' },
    ],
  },
  {
    id: 'n9', nombre: '9no Cuatrimestre — Continuidad Ing.', tipo: 'Ingeniería',
    materias: [
      { nombre: 'Gestión de Calidad de Software', clave: 'GCS-901', creditos: 6, clasificacion: 'Especialidad' },
      { nombre: 'Ética Profesional', clave: 'EP-901', creditos: 4, clasificacion: 'Transversal' },
    ],
  },
  {
    id: 'n10', nombre: '10mo Cuatrimestre — Continuidad Ing.', tipo: 'Ingeniería',
    materias: [
      { nombre: 'Seminario de Titulación', clave: 'ST-1001', creditos: 6, clasificacion: 'Transversal' },
      { nombre: 'Optativa I', clave: 'OPT-1001', creditos: 6, clasificacion: 'Especialidad' },
    ],
  },
  {
    id: 'n11', nombre: '11vo Cuatrimestre — Continuidad Ing.', tipo: 'Ingeniería',
    materias: [
      { nombre: 'Residencia Profesional Ing.', clave: 'RP-1101', creditos: 12, clasificacion: 'Transversal' },
    ],
  },
]

const historial = [
  { fecha: '28/06/2026', hora: '11:42', usuario: 'M. González', cambio: "Asignó materia 'Cloud Computing' al 8vo cuatrimestre." },
  { fecha: '15/03/2026', hora: '09:15', usuario: 'A. Ramírez', cambio: "Actualizó créditos de 'Cálculo Diferencial' de 7 a 8." },
  { fecha: '10/01/2025', hora: '16:30', usuario: 'M. González', cambio: 'Creó el plan IDGS-2022 con 10 niveles iniciales.' },
  { fecha: '05/08/2024', hora: '10:00', usuario: 'L. Hernández', cambio: 'Agregó el nivel 11 (Residencia Profesional Ing.).' },
]

const totalMaterias = niveles.reduce((acc, n) => acc + n.materias.length, 0)
const totalCreditos = niveles.reduce((acc, n) => acc + n.materias.reduce((a, m) => a + m.creditos, 0), 0)

function QuitarBtn() {
  const [show, setShow] = useState(false)
  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="p-1 rounded-md text-[#6B7280] hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
      >
        <MinusCircle size={14} />
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-[#333333] text-white text-[11px] rounded whitespace-nowrap pointer-events-none z-50">
          Quitar materia del nivel
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#333333]" />
        </div>
      )}
    </div>
  )
}

function NivelRow({ nivel, index, defaultOpen }: { nivel: Nivel; index: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const creditosNivel = nivel.materias.reduce((a, m) => a + m.creditos, 0)
  return (
    <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${open ? 'bg-[#e6f5f1]' : 'bg-white hover:bg-[#F8F9FA]'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${nivel.tipo === 'TSU' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
            {index + 1}
          </div>
          <div className="text-left">
            <p className={`text-[13px] font-semibold ${open ? 'text-[#009574]' : 'text-[#333333]'}`}>{nivel.nombre}</p>
            <p className="text-[11px] text-[#6B7280] mt-0.5">
              {nivel.materias.length} materia{nivel.materias.length !== 1 ? 's' : ''}
              <span className="mx-1.5 text-[#E5E7EB]">·</span>
              {creditosNivel} créditos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${nivel.tipo === 'TSU' ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
            {nivel.tipo}
          </span>
          {open ? <ChevronUp size={15} className="text-[#009574]" /> : <ChevronDown size={15} className="text-[#6B7280]" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-[#E5E7EB]">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-[#E5E7EB]">
                <th className="text-left px-5 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Materia</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Clave</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Clasificación</th>
                <th className="text-right px-5 py-2 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Créditos</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {nivel.materias.map((m, mi) => (
                <tr key={mi} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#FAFAFA] transition-colors group">
                  <td className="px-5 py-2.5 font-medium text-[#333333]">{m.nombre}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-[11px] bg-[#F8F9FA] border border-[#E5E7EB] px-1.5 py-0.5 rounded text-[#333333]">{m.clave}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${clasificacionStyle[m.clasificacion] ?? 'bg-gray-100 text-gray-600'}`}>{m.clasificacion}</span>
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums font-medium text-[#333333]">
                    {m.creditos}<span className="ml-1 text-[10px] text-[#6B7280] font-normal">cr.</span>
                  </td>
                  <td className="px-2 py-2.5">
                    <QuitarBtn />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#F8F9FA] border-t border-[#E5E7EB]">
                <td colSpan={3} className="px-5 py-2 text-[11px] text-[#6B7280]">Subtotal del nivel</td>
                <td className="px-5 py-2 text-right text-[12px] font-bold text-[#333333] tabular-nums">
                  {creditosNivel}<span className="ml-1 text-[10px] text-[#6B7280] font-normal">cr.</span>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
          {/* Asignar materia */}
          <div className="border-t border-[#E5E7EB] px-5 py-2.5">
            <button
              type="button"
              onClick={() => navigate({ page: 'asignar-materia' })}
              className="flex items-center gap-1.5 text-[12px] font-medium text-[#009574] hover:text-[#007a5e] transition-colors"
            >
              <Plus size={13} />Asignar Materia
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PlanDetalle({ navigate, pendingToast }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('niveles')
  const [toast, setToast] = useState(pendingToast ?? '')
  const tsuNiveles = niveles.filter(n => n.tipo === 'TSU')
  const ingNiveles = niveles.filter(n => n.tipo === 'Ingeniería')

  useEffect(() => { if (pendingToast) setToast(pendingToast) }, [pendingToast])

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {toast && (
        <div className="fixed top-5 right-5 z-[100] flex items-center gap-3 bg-white border border-emerald-200 shadow-lg rounded-lg px-4 py-3">
          <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
          <span className="text-[13px] font-medium text-[#333333]">{toast}</span>
          <button onClick={() => setToast('')} className="ml-2 text-[#6B7280] hover:text-[#333333]">✕</button>
        </div>
      )}
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate({ page: 'dashboard' })} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate({ page: 'planes-list' })} className="hover:text-[#009574] transition-colors">Planes de Estudio</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Detalle del Plan</span>
      </nav>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">Plan de Estudios — IDGS 2022</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">Visualiza la estructura completa del plan, sus niveles y materias asignadas.</p>
      </div>

      {/* Summary card */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Programa</p>
            <p className="text-[13px] font-medium text-[#333333]">Ing. en Desarrollo y Gestión de Software</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Clave del Plan</p>
            <span className="font-mono text-[13px] font-semibold bg-[#F8F9FA] border border-[#E5E7EB] px-2 py-0.5 rounded text-[#333333]">IDGS-2022</span>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Año de Vigencia</p>
            <p className="text-[13px] font-medium text-[#333333]">2022</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado</p>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Activo
            </span>
          </div>
        </div>

        <hr className="border-[#E5E7EB] my-4" />

        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#e6f5f1]"><Layers size={14} className="text-[#009574]" /></div>
            <div>
              <p className="text-[20px] font-bold text-[#333333] leading-none">{niveles.length}</p>
              <p className="text-[11px] text-[#6B7280]">niveles</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#e6f5f1]"><BookMarked size={14} className="text-[#009574]" /></div>
            <div>
              <p className="text-[20px] font-bold text-[#333333] leading-none">{totalMaterias}</p>
              <p className="text-[11px] text-[#6B7280]">materias</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#e6f5f1]"><Hash size={14} className="text-[#009574]" /></div>
            <div>
              <p className="text-[20px] font-bold text-[#333333] leading-none">{totalCreditos}</p>
              <p className="text-[11px] text-[#6B7280]">créditos totales</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-violet-50"><GraduationCap size={14} className="text-violet-600" /></div>
            <div>
              <p className="text-[13px] font-semibold text-[#333333]">{tsuNiveles.length} TSU</p>
              <p className="text-[11px] text-[#6B7280]">{ingNiveles.length} Ingeniería</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#E5E7EB] mb-6">
        {([
          { key: 'niveles' as TabKey, label: 'Niveles y Materias', icon: <Layers size={14} /> },
          { key: 'historial' as TabKey, label: 'Historial de cambios', icon: <History size={14} /> },
          { key: 'escalas' as TabKey, label: 'Escalas de Calificación', icon: <ClipboardList size={14} /> },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-[#009574] text-[#009574]'
                : 'border-transparent text-[#6B7280] hover:text-[#333333] hover:border-[#E5E7EB]'
            }`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'niveles' && (
        <div>
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">TSU</span>
              <span className="text-[12px] text-[#6B7280]">{tsuNiveles.length} cuatrimestres · {tsuNiveles.reduce((a, n) => a + n.materias.length, 0)} materias</span>
              <div className="flex-1 h-px bg-[#E5E7EB]" />
            </div>
            <div className="space-y-2">
              {tsuNiveles.map((n, i) => <NivelRow key={n.id} nivel={n} index={i} defaultOpen={i === 0} />)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Ingeniería</span>
              <span className="text-[12px] text-[#6B7280]">{ingNiveles.length} cuatrimestres · {ingNiveles.reduce((a, n) => a + n.materias.length, 0)} materias</span>
              <div className="flex-1 h-px bg-[#E5E7EB]" />
            </div>
            <div className="space-y-2">
              {ingNiveles.map((n, i) => <NivelRow key={n.id} nivel={n} index={tsuNiveles.length + i} />)}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'historial' && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-36">Fecha</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-36">Usuario</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Cambio realizado</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((h, i) => (
                <tr key={i} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                  <td className="px-4 py-3 text-[#6B7280]">
                    <span className="font-medium text-[#333333]">{h.fecha}</span>
                    <span className="ml-2 text-[#6B7280]">{h.hora}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#e6f5f1] text-[#009574] flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {h.usuario.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="text-[#333333] font-medium">{h.usuario}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#333333]">{h.cambio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'escalas' && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-8 flex flex-col items-center gap-4 text-center">
          <div className="p-3 rounded-full bg-[#e6f5f1]">
            <ClipboardList size={22} className="text-[#009574]" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#333333] mb-1">Escalas de Calificación</p>
            <p className="text-[13px] text-[#6B7280] max-w-md">
              Configura los rangos numéricos y su equivalencia en letra por clasificación de materia para este plan.
            </p>
          </div>
          <button
            onClick={() => navigate({ page: 'escalas-list' })}
            className="flex items-center gap-2 bg-[#009574] hover:bg-[#007a5e] text-white text-[13px] font-semibold px-4 py-2 rounded-md transition-colors"
          >
            <ClipboardList size={14} />Administrar escalas de calificación
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 mt-8">
        <button onClick={() => navigate({ page: 'planes-list' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
          <ArrowLeft size={14} />Regresar
        </button>
        <button onClick={() => navigate({ page: 'plan-form', mode: 'edit' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
          <Pencil size={14} />Editar Plan
        </button>
      </div>
    </div>
  )
}
