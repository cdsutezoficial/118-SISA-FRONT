import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  ChevronRight,
  Search,
  Pencil,
  Plus,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight as ChevRight,
} from 'lucide-react'
import { Toast, ActionBtn, Switch } from '../../shared/ui'
import { apiGet, apiPost, apiPut, apiPatch } from '../../shared/apiClient'
import type { ApiError } from '../../shared/apiClient'

// ─── Types ───────────────────────────────────────────────────────────────────
// `OutreachChannel` (bounded context `admission`, backend closed 2026-07-28 —
// `118-SISA-BACK/docs/plans/2026-07-28-outreach-channel.md`). No
// "candidatosRegistrados" field exists on the backend response (would need
// `Candidate`, which doesn't exist yet) — the mock's count column is dropped
// rather than fabricated. Status is a simple idempotent toggle
// (ACTIVE/INACTIVE) — wired as a bidirectional `Switch`, replacing the mock's
// `ConfirmModal`, same convention as Generaciones/Grupos/Conceptos de Pago.

type ChannelStatus = 'ACTIVE' | 'INACTIVE'

interface ChannelListItem {
  id: string
  name: string
  status: ChannelStatus
}

interface ChannelsPageResponse {
  items: ChannelListItem[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

// ─── Inline registro/edición modal ──────────────────────────────────────────
// Kept as an inline modal (not a separate route) — the mock already used this
// pattern and the catalog is simple enough (one field) that a full-page form
// isn't warranted.

function CanalModal({ mode, initialName, onSave, onCancel, saving, errorMsg }: {
  mode: 'create' | 'edit'
  initialName: string
  onSave: (name: string) => void
  onCancel: () => void
  saving: boolean
  errorMsg: string
}) {
  const [name, setName] = useState(initialName)

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={saving ? undefined : onCancel} />
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
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={saving}
            placeholder="ej. Redes Sociales"
            className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574] disabled:opacity-60"
          />
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 mb-4 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-[12px] text-red-700">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            {errorMsg}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={() => name.trim() && onSave(name.trim())}
            disabled={!name.trim() || saving}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
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
  const [channels, setChannels] = useState<ChannelListItem[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState('')
  const [modalTarget, setModalTarget] = useState<ChannelListItem | 'new' | null>(null)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalErrorMsg, setModalErrorMsg] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const perPage = 20

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  function fetchChannels() {
    setLoadStatus('loading')
    setErrorMsg('')
    return apiGet<ChannelsPageResponse>('/outreach-channels', {
      search: debouncedSearch || undefined,
      page: page - 1,
      size: perPage,
    })
      .then(data => {
        setChannels(data.items)
        setTotalElements(data.totalElements)
        setTotalPages(data.totalPages)
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 401) setErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        else if (apiErr.status === 403) setErrorMsg('No tienes permiso para consultar canales de difusión.')
        else setErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
      })
  }

  useEffect(() => {
    fetchChannels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page])

  async function handleSave(name: string) {
    setModalSaving(true)
    setModalErrorMsg('')
    try {
      if (modalTarget === 'new') {
        await apiPost('/outreach-channels', { name })
        setToast('Canal registrado correctamente.')
      } else if (modalTarget) {
        await apiPut(`/outreach-channels/${modalTarget.id}`, { name })
        setToast('Canal actualizado correctamente.')
      }
      setModalTarget(null)
      await fetchChannels()
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 400) setModalErrorMsg(apiErr.message ?? 'Revisa los datos capturados.')
      else if (apiErr.status === 401) setModalErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
      else if (apiErr.status === 403) setModalErrorMsg('No tienes permiso para realizar esta acción.')
      else setModalErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
    } finally {
      setModalSaving(false)
    }
  }

  async function handleToggleStatus(channel: ChannelListItem) {
    const nextStatus: ChannelStatus = channel.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setTogglingId(channel.id)
    try {
      await apiPatch<void>(`/outreach-channels/${channel.id}/status`, { status: nextStatus })
      await fetchChannels()
      setToast(nextStatus === 'ACTIVE' ? 'Canal activado.' : 'Canal desactivado.')
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      setToast(apiErr.status === 403
        ? 'No tienes permiso para cambiar el estado de este canal.'
        : 'No se pudo actualizar el estado. Intenta de nuevo.')
    } finally {
      setTogglingId(null)
    }
  }

  const startRow = totalElements === 0 ? 0 : (page - 1) * perPage + 1
  const endRow = Math.min(page * perPage, totalElements)

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {modalTarget !== null && (
        <CanalModal
          mode={modalTarget === 'new' ? 'create' : 'edit'}
          initialName={modalTarget === 'new' ? '' : modalTarget.name}
          onSave={handleSave}
          onCancel={() => { setModalTarget(null); setModalErrorMsg('') }}
          saving={modalSaving}
          errorMsg={modalErrorMsg}
        />
      )}

      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/admision')} className="hover:text-[#009574] transition-colors">
          Inicio
        </button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Admisión</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Canales de Difusión</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">Canales de Difusión</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            Administra los canales por los que los aspirantes se enteran de la universidad.
          </p>
        </div>
        <button
          onClick={() => setModalTarget('new')}
          className="flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors sm:whitespace-nowrap sm:self-start"
        >
          <Plus size={15} />Registrar Canal
        </button>
      </div>

      {/* Error banner */}
      {loadStatus === 'error' && errorMsg && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mb-4">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {errorMsg}
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar canal..."
            className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
          />
        </div>
        <span className="text-[12px] text-[#6B7280] hidden sm:inline">
          {totalElements} resultado{totalElements !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <div className="hidden md:block bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-12">#</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Nombre del Canal</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Estado</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {loadStatus === 'loading' ? (
              <tr>
                <td colSpan={4} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <Loader2 size={24} className="animate-spin text-[#009574]" />
                    <p className="text-[13px] font-medium">Cargando canales...</p>
                  </div>
                </td>
              </tr>
            ) : channels.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-16 text-center">
                  <p className="text-[13px] font-medium text-[#6B7280]">No se encontraron canales de difusión</p>
                </td>
              </tr>
            ) : (
              channels.map((channel, i) => {
                const rowNum = (page - 1) * perPage + i + 1
                return (
                  <tr key={channel.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                    <td className="px-4 py-3 text-[#6B7280]">{rowNum}</td>
                    <td className="px-4 py-3 font-medium text-[#333333]">{channel.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={channel.status === 'ACTIVE'}
                          disabled={togglingId === channel.id}
                          onChange={() => handleToggleStatus(channel)}
                        />
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          channel.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>
                          {channel.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <ActionBtn icon={<Pencil size={15} />} tooltip="Editar" onClick={() => setModalTarget(channel)} />
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-[#E5E7EB] flex items-center justify-between">
          <span className="text-[12px] text-[#6B7280]">
            {totalElements === 0 ? 'Sin registros' : `Mostrando ${startRow}–${endRow} de ${totalElements}`}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded border border-[#E5E7EB] text-[#6B7280] disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-[#F8F9FA]">
              <ChevronLeft size={14} />
            </button>
            <button className="px-3 py-1 rounded border border-[#009574] bg-[#009574] text-white text-[12px] font-semibold">{page}</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}
              className="p-1.5 rounded border border-[#E5E7EB] text-[#6B7280] disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-[#F8F9FA]">
              <ChevRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {loadStatus === 'loading' ? (
          <div className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-16 text-center">
            <div className="flex flex-col items-center gap-3 text-[#6B7280]">
              <Loader2 size={24} className="animate-spin text-[#009574]" />
              <p className="text-[13px] font-medium">Cargando canales...</p>
            </div>
          </div>
        ) : channels.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-16 text-center">
            <p className="text-[13px] font-medium text-[#6B7280]">No se encontraron canales de difusión</p>
          </div>
        ) : (
          channels.map(channel => (
            <div key={channel.id} className="bg-white border border-[#E5E7EB] rounded-lg p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[13px] font-medium text-[#333333]">{channel.name}</span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={channel.status === 'ACTIVE'}
                    disabled={togglingId === channel.id}
                    onChange={() => handleToggleStatus(channel)}
                  />
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    channel.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                  }`}>
                    {channel.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB]">
                <button
                  onClick={() => setModalTarget(channel)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-[#009574] border border-[#009574]/30 rounded-md hover:bg-[#e6f5f1] transition-colors"
                >
                  <Pencil size={14} />Editar
                </button>
              </div>
            </div>
          ))
        )}

        {totalElements > 0 && (
          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-[12px] text-[#6B7280]">
              Mostrando {startRow}–{endRow} de {totalElements}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[#333333] disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronLeft size={13} />Anterior
              </button>
              <span className="px-3 py-1.5 text-[12px] font-semibold text-[#009574] border border-[#009574] rounded-md bg-white tabular-nums">
                {page} / {totalPages || 1}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}
                className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[#333333] disabled:opacity-40 disabled:cursor-not-allowed">
                Siguiente<ChevRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
