import { useState, useEffect } from 'react'
import { ChevronRight, Search, Eye, Pencil, Trash2, Plus, ChevronLeft, ChevronRight as ChevRight } from 'lucide-react'
import { Toast, ActionBtn, ConfirmModal } from '../shared/ui'
import type { NavigateFn } from '../shared/types'

interface Props { navigate: NavigateFn; pendingToast?: string }

const rows = [
  { id: 1, nombre: 'División de Tecnologías de la Información', clave: 'DTI', descripcion: 'Área de sistemas y software', programas: 4 },
  { id: 2, nombre: 'División de Ciencias Económico Administrativas', clave: 'DCEA', descripcion: 'Área de administración y negocios', programas: 3 },
  { id: 3, nombre: 'División de Ciencias de la Salud', clave: 'DCS', descripcion: 'Área de ciencias biomédicas', programas: 2 },
  { id: 4, nombre: 'División de Ingeniería', clave: 'DI', descripcion: 'Área de ingenierías diversas', programas: 5 },
]

export default function DivisionesList({ navigate, pendingToast }: Props) {
  const [toast, setToast] = useState(pendingToast ?? '')
  const [search, setSearch] = useState('')
  const [confirm, setConfirm] = useState<number | null>(null)

  useEffect(() => {
    if (pendingToast) setToast(pendingToast)
  }, [pendingToast])

  const filtered = rows.filter(r =>
    r.nombre.toLowerCase().includes(search.toLowerCase()) ||
    r.clave.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {confirm !== null && (
        <ConfirmModal
          title="Eliminar división"
          message="Esta acción no se puede deshacer. ¿Deseas continuar?"
          confirmLabel="Eliminar"
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
        <span className="text-[#333333] font-medium">Divisiones Académicas</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">Divisiones Académicas</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">Gestiona las divisiones académicas registradas en el sistema.</p>
        </div>
        <button
          onClick={() => navigate({ page: 'division-form', mode: 'register' })}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
        >
          <Plus size={15} />Registrar División
        </button>
      </div>

      {/* Search & table */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o clave…"
              className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
            />
          </div>
          <span className="text-[12px] text-[#6B7280]">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">División</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Clave</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Descripción</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Programas</th>
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
                <td className="px-4 py-3 text-[#6B7280]">{row.descripcion}</td>
                <td className="px-4 py-3 text-[#333333]">{row.programas}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <ActionBtn icon={<Eye size={15} />} tooltip="Ver" onClick={() => navigate({ page: 'division-form', mode: 'view' })} />
                    <ActionBtn icon={<Pencil size={15} />} tooltip="Editar" onClick={() => navigate({ page: 'division-form', mode: 'edit' })} />
                    <ActionBtn icon={<Trash2 size={15} />} tooltip="Eliminar" danger onClick={() => setConfirm(row.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Pagination */}
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
