import { useState } from 'react'
import { ChevronRight, Search, Eye, Pencil, Trash2, Plus, ChevronLeft, ChevronRight as ChevRight } from 'lucide-react'
import { Toast, ActionBtn, ConfirmModal, SearchSelect } from '../shared/ui'
import { useNavigate } from 'react-router'
import { usePendingToast } from '../shared/hooks'

const clasificaciones = ['Básica', 'Ciencias Básicas', 'Especialidad', 'Lengua Extranjera', 'Matemáticas', 'Transversal']

const clasificacionStyle: Record<string, string> = {
  'Básica': 'bg-blue-50 text-blue-700 border border-blue-200',
  'Ciencias Básicas': 'bg-violet-50 text-violet-700 border border-violet-200',
  'Lengua Extranjera': 'bg-amber-50 text-amber-700 border border-amber-200',
  'Especialidad': 'bg-teal-50 text-teal-700 border border-teal-200',
  'Transversal': 'bg-gray-100 text-gray-600 border border-gray-200',
  'Matemáticas': 'bg-rose-50 text-rose-700 border border-rose-200',
}

const rows = [
  { id: 1, nombre: 'Fundamentos de Programación', clave: 'FP-101', clasificacion: 'Básica', creditos: 6, hrsTeo: 3, hrsPrac: 2, lab: true },
  { id: 2, nombre: 'Cálculo Diferencial', clave: 'CAL-101', clasificacion: 'Ciencias Básicas', creditos: 8, hrsTeo: 4, hrsPrac: 2, lab: false },
  { id: 3, nombre: 'Inglés I', clave: 'ING-101', clasificacion: 'Lengua Extranjera', creditos: 4, hrsTeo: 2, hrsPrac: 2, lab: false },
  { id: 4, nombre: 'Bases de Datos I', clave: 'BD-201', clasificacion: 'Especialidad', creditos: 6, hrsTeo: 3, hrsPrac: 2, lab: true },
]

export default function MateriasList() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [search, setSearch] = useState('')
  const [clasFilter, setClasFilter] = useState('')
  const [confirm, setConfirm] = useState<number | null>(null)

  const filtered = rows.filter(r => {
    const matchClas = !clasFilter || r.clasificacion === clasFilter
    const matchSearch = r.nombre.toLowerCase().includes(search.toLowerCase()) || r.clave.toLowerCase().includes(search.toLowerCase())
    return matchClas && matchSearch
  })

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {confirm !== null && (
        <ConfirmModal
          title="Eliminar materia"
          message="Esta acción no se puede deshacer. ¿Deseas continuar?"
          confirmLabel="Eliminar"
          onConfirm={() => setConfirm(null)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Materias</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">Materias</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">Gestiona el catálogo de materias del sistema.</p>
        </div>
        <button onClick={() => navigate('/materias/new')} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
          <Plus size={15} />Registrar Materia
        </button>
      </div>

      {/* Classification filter strip */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setClasFilter('')}
          className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-colors ${!clasFilter ? 'bg-[#009574] text-white border-[#009574]' : 'border-[#E5E7EB] text-[#6B7280] hover:border-[#009574] hover:text-[#009574]'}`}
        >
          Todas
        </button>
        {clasificaciones.map(c => (
          <button
            key={c}
            onClick={() => setClasFilter(c === clasFilter ? '' : c)}
            className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-colors ${clasFilter === c ? 'bg-[#009574] text-white border-[#009574]' : 'border-[#E5E7EB] text-[#6B7280] hover:border-[#009574] hover:text-[#009574]'}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center gap-3">
          <div className="w-52">
            <SearchSelect options={clasificaciones} value={clasFilter} onChange={setClasFilter} placeholder="Clasificación…" />
          </div>
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar materia…" className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]" />
          </div>
          <span className="text-[12px] text-[#6B7280]">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Materia</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Clave</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-36">Clasificación</th>
              <th className="text-center px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-20">Créditos</th>
              <th className="text-center px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-20">Hrs T</th>
              <th className="text-center px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-20">Hrs P</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                <td className="px-4 py-3 font-medium text-[#333333]">{row.nombre}</td>
                <td className="px-4 py-3">
                  <span className="font-mono text-[11px] bg-[#F8F9FA] border border-[#E5E7EB] px-1.5 py-0.5 rounded text-[#333333]">{row.clave}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${clasificacionStyle[row.clasificacion] ?? 'bg-gray-100 text-gray-600'}`}>{row.clasificacion}</span>
                </td>
                <td className="px-4 py-3 text-center text-[#333333]">{row.creditos}</td>
                <td className="px-4 py-3 text-center text-[#333333]">{row.hrsTeo}</td>
                <td className="px-4 py-3 text-center text-[#333333]">{row.hrsPrac}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <ActionBtn icon={<Eye size={15} />} tooltip="Ver" onClick={() => navigate(`/materias/form?mode=view&id=${row.id}`)} />
                    <ActionBtn icon={<Pencil size={15} />} tooltip="Editar" onClick={() => navigate(`/materias/form?mode=edit&id=${row.id}`)} />
                    <ActionBtn icon={<Trash2 size={15} />} tooltip="Eliminar" danger onClick={() => setConfirm(row.id)} />
                  </div>
                </td>
              </tr>
            ))}
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
