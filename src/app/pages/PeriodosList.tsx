import { useState } from 'react'
import { ChevronRight, Search, Eye, Pencil, LockKeyhole, Plus, ChevronLeft, ChevronRight as ChevRight } from 'lucide-react'
import { Toast, ActionBtn, ConfirmModal } from '../shared/ui'
import { useNavigate } from 'react-router'
import { usePendingToast } from '../shared/hooks'

const rows = [
  { id: 1, nombre: 'Enero – Abril 2026', clave: 'ENE-ABR-2026', inicio: '06/01/2026', fin: '25/04/2026', tipo: 'Cuatrimestral', estado: 'Activo' },
  { id: 2, nombre: 'Agosto – Diciembre 2025', clave: 'AGO-DIC-2025', inicio: '11/08/2025', fin: '12/12/2025', tipo: 'Cuatrimestral', estado: 'Cerrado' },
  { id: 3, nombre: 'Mayo – Agosto 2025', clave: 'MAY-AGO-2025', inicio: '05/05/2025', fin: '02/08/2025', tipo: 'Cuatrimestral', estado: 'Cerrado' },
]

const estadoBadge: Record<string, string> = {
  Activo: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Cerrado: 'bg-gray-100 text-gray-600 border border-gray-200',
}

export default function PeriodosList() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [search, setSearch] = useState('')
  const [confirm, setConfirm] = useState<number | null>(null)

  const filtered = rows.filter(r =>
    r.nombre.toLowerCase().includes(search.toLowerCase()) ||
    r.clave.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {confirm !== null && (
        <ConfirmModal
          title="Cerrar periodo"
          message="Al cerrar el periodo ya no podrá editarse ni asignarse nuevos grupos. ¿Deseas continuar?"
          confirmLabel="Cerrar Periodo"
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
        <span className="text-[#333333] font-medium">Periodos Académicos</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">Periodos Académicos</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">Gestiona los periodos académicos del sistema.</p>
        </div>
        <button onClick={() => navigate('/periodos/new')} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
          <Plus size={15} />Registrar Periodo
        </button>
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar periodo…" className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]" />
          </div>
          <span className="text-[12px] text-[#6B7280]">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Periodo</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Inicio</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Fin</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Tipo</th>
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
                    <p className="font-medium text-[#333333]">{row.nombre}</p>
                    <p className="text-[11px] text-[#6B7280] font-mono">{row.clave}</p>
                  </td>
                  <td className="px-4 py-3 text-[#6B7280]">{row.inicio}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{row.fin}</td>
                  <td className="px-4 py-3 text-[#333333]">{row.tipo}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${estadoBadge[row.estado]}`}>{row.estado}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <ActionBtn icon={<Eye size={15} />} tooltip="Ver" onClick={() => navigate(`/periodos/form?mode=view&id=${row.id}`)} />
                      <ActionBtn icon={<Pencil size={15} />} tooltip="Editar" disabled={isClosed} onClick={() => navigate(`/periodos/form?mode=edit&id=${row.id}`)} />
                      <ActionBtn icon={<LockKeyhole size={15} />} tooltip="Cerrar periodo" disabled={isClosed} onClick={() => setConfirm(row.id)} />
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
