import { useState } from 'react'
import {
  ChevronRight, Plus, Pencil, Trash2, ChevronLeft,
  ChevronRight as ChevRight, BookOpen, Hash, AlertCircle, Info, CheckCircle2,
} from 'lucide-react'
import type { NavigateFn } from '../shared/types'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Escala {
  id: number
  clasificacion: string
  rangoMin: number
  rangoMax: number
  rangos: number
}

// ─── Data ──────────────────────────────────────────────────────────────────────

const allEscalas: Escala[] = [
  { id: 1, clasificacion: 'Básica',          rangoMin: 0, rangoMax: 100, rangos: 3 },
  { id: 2, clasificacion: 'Integradora',     rangoMin: 0, rangoMax: 100, rangos: 3 },
  { id: 3, clasificacion: 'Ciencias Básicas',rangoMin: 0, rangoMax: 100, rangos: 3 },
]

const clasificacionStyle: Record<string, string> = {
  'Básica':            'bg-blue-50 text-blue-700 border border-blue-200',
  'Integradora':       'bg-teal-50 text-teal-700 border border-teal-200',
  'Ciencias Básicas':  'bg-violet-50 text-violet-700 border border-violet-200',
  'Lengua Extranjera': 'bg-amber-50 text-amber-700 border border-amber-200',
  'Especialidad':      'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Transversal':       'bg-gray-100 text-gray-600 border border-gray-200',
}

// ─── Confirm modal ─────────────────────────────────────────────────────────────

function ConfirmModal({ clasificacion, onConfirm, onCancel }: {
  clasificacion: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle size={18} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[#333333] mb-1">Eliminar escala de calificación</h3>
            <p className="text-[13px] text-[#6B7280]">
              Estás a punto de eliminar la escala para la clasificación{' '}
              <strong className="text-[#333333]">{clasificacion}</strong>. Esta acción no se puede deshacer.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-2.5 mb-6 text-[12px] text-red-700">
          <Info size={13} className="flex-shrink-0 mt-0.5" />
          Las materias de esta clasificación quedarán sin escala asignada en este plan.
        </div>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} className="px-4 py-2 text-[13px] font-semibold bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors">
            Sí, eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed top-5 right-5 z-[100] flex items-center gap-3 bg-white border border-emerald-200 shadow-lg rounded-lg px-4 py-3">
      <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
      <span className="text-[13px] font-medium text-[#333333]">{message}</span>
      <button onClick={onClose} className="ml-1 text-[#6B7280] hover:text-[#333333] text-[16px] leading-none">×</button>
    </div>
  )
}

// ─── Action btn with tooltip ───────────────────────────────────────────────────

function ActionBtn({ icon, tooltip, danger, onClick }: {
  icon: React.ReactNode; tooltip: string; danger?: boolean; onClick?: () => void
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative inline-flex">
      <button onClick={onClick} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        className={`p-1.5 rounded-md transition-colors ${danger ? 'text-[#6B7280] hover:bg-red-50 hover:text-red-600' : 'text-[#6B7280] hover:bg-[#e6f5f1] hover:text-[#009574]'}`}>
        {icon}
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-[#333333] text-white text-[11px] rounded whitespace-nowrap pointer-events-none z-50">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#333333]" />
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

interface Props { navigate: NavigateFn; pendingToast?: string }

export default function EscalasList({ navigate, pendingToast }: Props) {
  const [escalas, setEscalas] = useState<Escala[]>(allEscalas)
  const [confirmTarget, setConfirmTarget] = useState<Escala | null>(null)
  const [toast, setToast] = useState(pendingToast ?? '')
  const [page, setPage] = useState(1)
  const perPage = 10

  const totalPages = Math.ceil(escalas.length / perPage)
  const paginated  = escalas.slice((page - 1) * perPage, page * perPage)
  const startRow   = escalas.length === 0 ? 0 : (page - 1) * perPage + 1
  const endRow     = Math.min(page * perPage, escalas.length)

  function handleDelete() {
    if (!confirmTarget) return
    const nombre = confirmTarget.clasificacion
    setEscalas(prev => prev.filter(e => e.id !== confirmTarget.id))
    setConfirmTarget(null)
    setToast(`Escala "${nombre}" eliminada exitosamente.`)
    setTimeout(() => setToast(''), 3500)
  }

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {confirmTarget && (
        <ConfirmModal
          clasificacion={confirmTarget.clasificacion}
          onConfirm={handleDelete}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4 flex-wrap">
        <button onClick={() => navigate({ page: 'dashboard' })} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate({ page: 'planes-list' })} className="hover:text-[#009574] transition-colors">Planes de Estudio</button>
        <ChevronRight size={13} />
        <button onClick={() => navigate({ page: 'plan-detalle' })} className="hover:text-[#009574] transition-colors font-mono text-[12px]">IDGS-2022</button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Escalas de Calificación</span>
      </nav>

      {/* Title + action */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">Escalas de Calificación</h1>
          <p className="text-[14px] text-[#6B7280] mt-1 max-w-xl">
            Configura los rangos numéricos y su equivalencia en letra por clasificación de materia para este plan de estudios.
          </p>
        </div>
        <button onClick={() => navigate({ page: 'escala-form', mode: 'register' })} className="flex items-center gap-2 bg-[#009574] hover:bg-[#007a5e] text-white text-[13px] font-semibold px-4 py-2 rounded-md transition-colors whitespace-nowrap mt-1">
          <Plus size={15} />Agregar Escala
        </button>
      </div>

      <hr className="border-[#E5E7EB] my-6" />

      {/* Context card */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg px-5 py-4 mb-6 flex items-center gap-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-[#e6f5f1]">
            <BookOpen size={16} className="text-[#009574]" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-0.5">Plan</p>
            <p className="text-[13px] font-semibold text-[#333333]">
              <span className="font-mono mr-1.5">IDGS-2022</span>
              <span className="font-normal text-[#6B7280]">— Ingeniería en Desarrollo y Gestión de Software</span>
            </p>
          </div>
        </div>
        <div className="w-px h-8 bg-[#E5E7EB] flex-shrink-0" />
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-emerald-50">
            <Hash size={16} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-0.5">Mínima Aprobatoria del Plan</p>
            <p className="text-[20px] font-bold text-[#333333] leading-none tabular-nums">70</p>
          </div>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => navigate({ page: 'plan-detalle' })}
            className="flex items-center gap-1.5 text-[12px] font-medium text-[#009574] hover:text-[#007a5e] transition-colors"
          >
            <ChevronLeft size={13} />Ver detalle del plan
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-10">#</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Clasificación de Materia</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-40">Rango Numérico</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-44">Rangos Configurados</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <BookOpen size={36} className="text-[#E5E7EB]" />
                    <p className="text-[13px] font-medium">Sin escalas configuradas</p>
                    <p className="text-[12px]">Agrega una escala para comenzar</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => {
                const rowNum = (page - 1) * perPage + i + 1
                return (
                  <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                    <td className="px-4 py-3 text-[#6B7280] font-medium">{rowNum}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${clasificacionStyle[row.clasificacion] ?? 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                        {row.clasificacion}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[12px] tabular-nums text-[#333333] font-medium">
                        {row.rangoMin} – {row.rangoMax}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {Array.from({ length: row.rangos }).map((_, ri) => (
                            <div key={ri} className="w-5 h-5 rounded bg-[#e6f5f1] border border-[#009574]/20 flex items-center justify-center">
                              <span className="text-[9px] font-bold text-[#009574]">{ri + 1}</span>
                            </div>
                          ))}
                        </div>
                        <span className="text-[12px] text-[#6B7280]">
                          {row.rangos} {row.rangos === 1 ? 'rango' : 'rangos'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        <ActionBtn icon={<Pencil size={15} />} tooltip="Editar" onClick={() => navigate({ page: 'escala-form', mode: 'edit' })} />
                        <ActionBtn icon={<Trash2 size={15} />} tooltip="Eliminar" danger onClick={() => setConfirmTarget(row)} />
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB] bg-[#F8F9FA]">
          <p className="text-[12px] text-[#6B7280]">
            {escalas.length === 0 ? 'Sin registros' : `Mostrando ${startRow}–${endRow} de ${escalas.length} registros`}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[#333333] disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-[#F8F9FA] transition-colors">
              <ChevronLeft size={13} />Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-8 h-8 text-[12px] font-medium rounded-md border transition-colors ${p === page ? 'bg-[#009574] text-white border-[#009574]' : 'bg-white text-[#333333] border-[#E5E7EB] hover:bg-[#F8F9FA]'}`}>
                {p}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}
              className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[#333333] disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-[#F8F9FA] transition-colors">
              Siguiente<ChevRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
