import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  ChevronRight,
  Search,
  Pencil,
  Power,
  Plus,
  ChevronLeft,
  ChevronRight as ChevRight,
} from 'lucide-react'
import { Toast, ActionBtn, ConfirmModal, Switch } from '../../shared/ui'

// ─── Types ───────────────────────────────────────────────────────────────────

type CanalEstado = 'Activo' | 'Inactivo'

interface Canal {
  id: number
  nombre: string
  candidatosRegistrados: number
  estado: CanalEstado
}

// ─── Data ────────────────────────────────────────────────────────────────────
// Simple local catalog — not part of shared/admision/mockData.ts (Candidate
// domain), per `03-admision.md` "Pantalla 2 — Canales de Difusión: Listado".

const initialCanales: Canal[] = [
  { id: 1, nombre: 'Redes Sociales', candidatosRegistrados: 142, estado: 'Activo' },
  { id: 2, nombre: 'Feria Universitaria', candidatosRegistrados: 89, estado: 'Activo' },
  { id: 3, nombre: 'Recomendación de egresado', candidatosRegistrados: 67, estado: 'Activo' },
  { id: 4, nombre: 'Página web institucional', candidatosRegistrados: 54, estado: 'Activo' },
  { id: 5, nombre: 'Radio y televisión', candidatosRegistrados: 12, estado: 'Activo' },
]

// ─── Inline registro/edición modal ──────────────────────────────────────────
// Per the navigation prompt, "+ Registrar Canal" and "Editar" both open this
// same inline modal (no page navigation); "Editar" precargates its fields.

function CanalModal({ mode, initialNombre, initialEstado, onSave, onCancel }: {
  mode: 'create' | 'edit'
  initialNombre: string
  initialEstado: CanalEstado
  onSave: (nombre: string, estado: CanalEstado) => void
  onCancel: () => void
}) {
  const [nombre, setNombre] = useState(initialNombre)
  const [estado, setEstado] = useState<CanalEstado>(initialEstado)

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-md mx-4 p-6">
        <h3 className="text-[15px] font-semibold text-[#333333] mb-4">
          {mode === 'create' ? 'Registrar Canal' : 'Editar Canal'}
        </h3>

        <div className="mb-4">
          <label className="block text-[12px] font-semibold text-[#333333] mb-1">
            Nombre del Canal<span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            autoFocus
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="ej. Redes Sociales"
            className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
          />
        </div>

        <div className="mb-6">
          <label className="block text-[12px] font-semibold text-[#333333] mb-1">Estado</label>
          <div className="flex items-center gap-2">
            <Switch checked={estado === 'Activo'} onChange={v => setEstado(v ? 'Activo' : 'Inactivo')} />
            <span className="text-[13px] text-[#333333]">{estado}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => nombre.trim() && onSave(nombre.trim(), estado)}
            disabled={!nombre.trim()}
            className="px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CanalesDifusion() {
  const navigate = useNavigate()
  const [canales, setCanales] = useState<Canal[]>(initialCanales)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [modalTarget, setModalTarget] = useState<Canal | 'new' | null>(null)
  const [statusTarget, setStatusTarget] = useState<Canal | null>(null)

  const filtered = canales.filter(c => c.nombre.toLowerCase().includes(search.toLowerCase()))

  function handleSave(nombre: string, estado: CanalEstado) {
    if (modalTarget === 'new') {
      const nextId = canales.reduce((max, c) => Math.max(max, c.id), 0) + 1
      setCanales(prev => [...prev, { id: nextId, nombre, candidatosRegistrados: 0, estado }])
      setToast('Canal registrado correctamente.')
    } else if (modalTarget) {
      const targetId = modalTarget.id
      setCanales(prev => prev.map(c => (c.id === targetId ? { ...c, nombre, estado } : c)))
      setToast('Canal actualizado correctamente.')
    }
    setModalTarget(null)
  }

  function handleToggleStatus() {
    if (!statusTarget) return
    const targetId = statusTarget.id
    const activating = statusTarget.estado === 'Inactivo'
    setCanales(prev =>
      prev.map(c => (c.id === targetId ? { ...c, estado: c.estado === 'Activo' ? 'Inactivo' : 'Activo' } : c))
    )
    setToast(`Canal ${activating ? 'activado' : 'desactivado'} correctamente.`)
    setStatusTarget(null)
  }

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {modalTarget !== null && (
        <CanalModal
          mode={modalTarget === 'new' ? 'create' : 'edit'}
          initialNombre={modalTarget === 'new' ? '' : modalTarget.nombre}
          initialEstado={modalTarget === 'new' ? 'Activo' : modalTarget.estado}
          onSave={handleSave}
          onCancel={() => setModalTarget(null)}
        />
      )}

      {statusTarget && (
        <ConfirmModal
          title="Cambiar estado del canal"
          message={`¿Deseas ${statusTarget.estado === 'Activo' ? 'desactivar' : 'activar'} el canal "${statusTarget.nombre}"?`}
          confirmLabel={statusTarget.estado === 'Activo' ? 'Desactivar' : 'Activar'}
          onConfirm={handleToggleStatus}
          onCancel={() => setStatusTarget(null)}
        />
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/admision')} className="hover:text-[#009574] transition-colors">
          Inicio
        </button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Admisión</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Canales de Difusión</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">Canales de Difusión</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            Administra los canales por los que los aspirantes se enteran de la universidad. Se usan para estadísticas de captación.
          </p>
        </div>
        <button
          onClick={() => setModalTarget('new')}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
        >
          <Plus size={15} />Registrar Canal
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
              placeholder="Buscar canal..."
              className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
            />
          </div>
          <span className="text-[12px] text-[#6B7280]">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-12">#</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Nombre del Canal</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-44">Candidatos Registrados</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Estado</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((canal, index) => (
              <tr key={canal.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                <td className="px-4 py-3 text-[#6B7280]">{index + 1}</td>
                <td className="px-4 py-3 font-medium text-[#333333]">{canal.nombre}</td>
                <td className="px-4 py-3 text-[#333333]">{canal.candidatosRegistrados}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      canal.estado === 'Activo'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    {canal.estado}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <ActionBtn icon={<Pencil size={15} />} tooltip="Editar" onClick={() => setModalTarget(canal)} />
                    <ActionBtn icon={<Power size={15} />} tooltip="Cambiar estado" onClick={() => setStatusTarget(canal)} />
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
