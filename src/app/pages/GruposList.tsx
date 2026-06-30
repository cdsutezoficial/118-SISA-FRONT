import { useState, useEffect } from 'react'
import { ChevronRight, Search, Eye, Pencil, LockKeyhole, Plus, ChevronLeft, ChevronRight as ChevRight } from 'lucide-react'
import { Toast, ActionBtn, ConfirmModal, SearchSelect, SimpleSelect } from '../shared/ui'
import type { NavigateFn } from '../shared/types'

interface Props { navigate: NavigateFn; pendingToast?: string }

const periodosOpts = ['Todos los periodos', 'ENE-ABR-2026', 'AGO-DIC-2025']
const programasOpts = ['Todos los programas', 'IDGS', 'TSU-TI', 'LAE']
const nivelesOpts = ['Todos los niveles', '1er Cuatrimestre', '2do Cuatrimestre', '3er Cuatrimestre']

const rows = [
  { id: 1, clave: 'IDGS-101-A', programa: 'IDGS', nivel: '1er Cuatrimestre', sufijo: 'A', periodo: 'ENE-ABR-2026', capacidad: 30, inscritos: 28, estado: 'Activo' },
  { id: 2, clave: 'IDGS-101-B', programa: 'IDGS', nivel: '1er Cuatrimestre', sufijo: 'B', periodo: 'ENE-ABR-2026', capacidad: 30, inscritos: 25, estado: 'Activo' },
  { id: 3, clave: 'IDGS-201-A', programa: 'IDGS', nivel: '2do Cuatrimestre', sufijo: 'A', periodo: 'ENE-ABR-2026', capacidad: 30, inscritos: 22, estado: 'Cerrado' },
]

const estadoBadge: Record<string, string> = {
  Activo: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Cerrado: 'bg-gray-100 text-gray-600 border border-gray-200',
}

export default function GruposList({ navigate, pendingToast }: Props) {
  const [toast, setToast] = useState(pendingToast ?? '')
  const [search, setSearch] = useState('')
  const [periodo, setPeriodo] = useState('Todos los periodos')
  const [programa, setPrograma] = useState('Todos los programas')
  const [nivel, setNivel] = useState('Todos los niveles')
  const [confirm, setConfirm] = useState<number | null>(null)

  useEffect(() => { if (pendingToast) setToast(pendingToast) }, [pendingToast])

  const filtered = rows.filter(r => {
    const matchPeriodo = periodo === 'Todos los periodos' || r.periodo === periodo
    const matchPrograma = programa === 'Todos los programas' || r.programa === programa
    const matchNivel = nivel === 'Todos los niveles' || r.nivel === nivel
    const matchSearch = r.clave.toLowerCase().includes(search.toLowerCase())
    return matchPeriodo && matchPrograma && matchNivel && matchSearch
  })

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {confirm !== null && (
        <ConfirmModal
          title="Cerrar grupo"
          message="Al cerrar el grupo ya no se podrán realizar cambios. ¿Deseas continuar?"
          confirmLabel="Cerrar Grupo"
          onConfirm={() => setConfirm(null)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate({ page: 'dashboard' })} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Grupos</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">Grupos</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">Gestiona los grupos académicos por periodo y programa.</p>
        </div>
        <button onClick={() => navigate({ page: 'grupo-form', mode: 'register' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
          <Plus size={15} />Registrar Grupo
        </button>
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E7EB] flex flex-wrap items-center gap-3">
          <div className="w-44">
            <SearchSelect options={periodosOpts} value={periodo} onChange={setPeriodo} placeholder="Periodo…" />
          </div>
          <div className="w-44">
            <SearchSelect options={programasOpts} value={programa} onChange={setPrograma} placeholder="Programa…" />
          </div>
          <div className="w-44">
            <SimpleSelect options={nivelesOpts} value={nivel} onChange={setNivel} placeholder="Nivel…" />
          </div>
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar grupo…" className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]" />
          </div>
          <span className="text-[12px] text-[#6B7280]">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Grupo</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Periodo</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Nivel</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Capacidad</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Estado</th>
              <th className="px-4 py-3 w-28" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => {
              const isClosed = row.estado === 'Cerrado'
              return (
                <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-[#333333]">{row.clave}</span>
                  </td>
                  <td className="px-4 py-3 text-[#6B7280]">{row.periodo}</td>
                  <td className="px-4 py-3 text-[#333333]">{row.nivel}</td>
                  <td className="px-4 py-3 text-[#333333]">
                    {row.inscritos}/{row.capacidad}
                    <span className="ml-1 text-[11px] text-[#6B7280]">alumnos</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${estadoBadge[row.estado]}`}>{row.estado}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <ActionBtn icon={<Eye size={15} />} tooltip="Ver" onClick={() => navigate({ page: 'grupo-form', mode: 'view' })} />
                      <ActionBtn icon={<Pencil size={15} />} tooltip="Editar" disabled={isClosed} onClick={() => navigate({ page: 'grupo-form', mode: 'edit' })} />
                      <ActionBtn icon={<LockKeyhole size={15} />} tooltip="Cerrar grupo" disabled={isClosed} onClick={() => setConfirm(row.id)} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-[#E5E7EB] flex items-center justify-between">
          <span className="text-[12px] text-[#6B7280]">Mostrando 1–{filtered.length} de {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button disabled className="p-1.5 rounded border border-[#E5E7EB] text-[#6B7280] opacity-40"><ChevronLeft size={14} /></button>
            <button className="px-3 py-1 rounded border border-[#009574] bg-[#009574] text-white text-[12px] font-semibold">1</button>
            <button disabled className="p-1.5 rounded border border-[#E5E7EB] text-[#6B7280] opacity-40"><ChevRight size={14} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}
