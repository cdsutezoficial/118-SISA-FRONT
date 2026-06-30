import { useState, useEffect } from 'react'
import { ChevronRight, Search, Eye, Pencil, Trash2, Plus, X, ChevronLeft, ChevronRight as ChevRight } from 'lucide-react'
import { Toast, ActionBtn, ConfirmModal } from '../shared/ui'
import type { NavigateFn } from '../shared/types'

interface Props { navigate: NavigateFn; pendingToast?: string }

const tipoBadge: Record<string, string> = {
  Recurrente: 'bg-blue-50 text-blue-700 border border-blue-200',
  'Una vez': 'bg-amber-50 text-amber-700 border border-amber-200',
}

const rows = [
  { id: 1, nombre: 'Cuota Cuatrimestral', tipo: 'Recurrente', tarifas: 3, activo: true },
  { id: 2, nombre: 'Inscripción', tipo: 'Una vez', tarifas: 2, activo: true },
  { id: 3, nombre: 'Material y Laboratorio', tipo: 'Recurrente', tarifas: 4, activo: true },
  { id: 4, nombre: 'Titulación', tipo: 'Una vez', tarifas: 1, activo: false },
]

const tarifasDemo = [
  { programa: 'IDGS', nivel: '1er – 3er Cuatrimestre', monto: '$3,200.00', vigencia: '01/01/2026' },
  { programa: 'IDGS', nivel: '4to – 6to Cuatrimestre', monto: '$3,500.00', vigencia: '01/01/2026' },
  { programa: 'TSU-TI', nivel: '1er – 3er Cuatrimestre', monto: '$2,800.00', vigencia: '01/01/2026' },
]

export default function ConceptosList({ navigate, pendingToast }: Props) {
  const [toast, setToast] = useState(pendingToast ?? '')
  const [search, setSearch] = useState('')
  const [confirm, setConfirm] = useState<number | null>(null)
  const [slideOver, setSlideOver] = useState<number | null>(null)

  useEffect(() => { if (pendingToast) setToast(pendingToast) }, [pendingToast])

  const filtered = rows.filter(r =>
    r.nombre.toLowerCase().includes(search.toLowerCase())
  )

  const slideRow = rows.find(r => r.id === slideOver)

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {confirm !== null && (
        <ConfirmModal
          title="Eliminar concepto"
          message="Esta acción eliminará el concepto y todas sus tarifas. ¿Deseas continuar?"
          confirmLabel="Eliminar"
          onConfirm={() => setConfirm(null)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Slide-over panel */}
      {slideOver !== null && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/20" onClick={() => setSlideOver(null)} />
          <div className="fixed right-0 top-0 bottom-0 z-[110] w-[420px] bg-white border-l border-[#E5E7EB] shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-semibold text-[#333333]">Tarifas</h2>
                <p className="text-[12px] text-[#6B7280]">{slideRow?.nombre}</p>
              </div>
              <button onClick={() => setSlideOver(null)} className="p-1.5 rounded hover:bg-[#F8F9FA] text-[#6B7280]"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase">Programa</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase">Nivel</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase">Monto</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#6B7280] uppercase">Vigencia</th>
                  </tr>
                </thead>
                <tbody>
                  {tarifasDemo.map((t, i) => (
                    <tr key={i} className="border-b border-[#E5E7EB] last:border-0">
                      <td className="px-3 py-2 font-mono text-[#333333]">{t.programa}</td>
                      <td className="px-3 py-2 text-[#6B7280]">{t.nivel}</td>
                      <td className="px-3 py-2 text-right font-semibold text-[#333333]">{t.monto}</td>
                      <td className="px-3 py-2 text-[#6B7280]">{t.vigencia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate({ page: 'dashboard' })} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Conceptos de Pago</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">Conceptos de Pago</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">Gestiona los conceptos de pago y sus tarifas por programa y nivel.</p>
        </div>
        <button onClick={() => navigate({ page: 'concepto-form', mode: 'register' })} className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors">
          <Plus size={15} />Registrar Concepto
        </button>
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar concepto…" className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]" />
          </div>
          <span className="text-[12px] text-[#6B7280]">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Concepto</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Tipo</th>
              <th className="text-center px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Tarifas</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-20">Estado</th>
              <th className="px-4 py-3 w-28" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                <td className="px-4 py-3 font-medium text-[#333333]">{row.nombre}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tipoBadge[row.tipo] ?? 'bg-gray-100 text-gray-600'}`}>{row.tipo}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => setSlideOver(row.id)} className="text-[#009574] underline underline-offset-2 hover:text-[#007a5e] text-[12px] font-medium">
                    {row.tarifas} tarifas
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${row.activo ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                    {row.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <ActionBtn icon={<Eye size={15} />} tooltip="Ver" onClick={() => navigate({ page: 'concepto-form', mode: 'view' })} />
                    <ActionBtn icon={<Pencil size={15} />} tooltip="Editar" onClick={() => navigate({ page: 'concepto-form', mode: 'edit' })} />
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
