import { useEffect, useState } from 'react'
import { ChevronRight, Search, Eye, Pencil, Plus, ChevronLeft, ChevronRight as ChevRight, Loader2, AlertCircle } from 'lucide-react'
import { Toast, ActionBtn, Switch } from '../shared/ui'
import { useNavigate } from 'react-router'
import { usePendingToast } from '../shared/hooks'
import { apiGet, apiPatch } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────

type DivisionStatus = 'ACTIVE' | 'INACTIVE'

interface DivisionListItem {
  id: string
  name: string
  code: string
  description: string
  directorPersonId: string | null
  status: DivisionStatus
  programCount: number
}

interface DivisionsPageResponse {
  items: DivisionListItem[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DivisionesList() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [divisions, setDivisions] = useState<DivisionListItem[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const perPage = 20

  // Debounce free-text search — the fetch effect below only reacts to
  // `debouncedSearch`, not every keystroke of `search` (mirrors UsuariosList.tsx).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    setLoadStatus('loading')
    setErrorMsg('')
    apiGet<DivisionsPageResponse>('/divisions', {
      status: statusFilter || undefined,
      search: debouncedSearch || undefined,
      page: page - 1,
      size: perPage,
    })
      .then(data => {
        if (cancelled) return
        setDivisions(data.items)
        setTotalElements(data.totalElements)
        setTotalPages(data.totalPages)
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 401) {
          setErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        } else if (apiErr.status === 403) {
          setErrorMsg('No tienes permiso para consultar divisiones académicas.')
        } else {
          setErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
  }, [statusFilter, debouncedSearch, page])

  const startRow = totalElements === 0 ? 0 : (page - 1) * perPage + 1
  const endRow = Math.min(page * perPage, totalElements)

  async function handleToggleStatus(division: DivisionListItem) {
    const nextStatus: DivisionStatus = division.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setTogglingId(division.id)
    try {
      await apiPatch<void>(`/divisions/${division.id}/status`, { status: nextStatus })
      // Refetch-after-toggle keeps `programCount`/pagination metadata correct
      // without duplicating the PATCH response's (narrower) shape locally.
      const data = await apiGet<DivisionsPageResponse>('/divisions', {
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        page: page - 1,
        size: perPage,
      })
      setDivisions(data.items)
      setTotalElements(data.totalElements)
      setTotalPages(data.totalPages)
      setToast(nextStatus === 'ACTIVE' ? 'División activada.' : 'División desactivada.')
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      setToast(apiErr.status === 403
        ? 'No tienes permiso para cambiar el estado de esta división.'
        : 'No se pudo actualizar el estado. Intenta de nuevo.')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
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
          onClick={() => navigate('/divisiones/new')}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
        >
          <Plus size={15} />Registrar División
        </button>
      </div>

      {/* Error banner */}
      {loadStatus === 'error' && errorMsg && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mb-4">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {errorMsg}
        </div>
      )}

      {/* Search, filter & table */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Buscar por nombre o clave…"
              className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activo</option>
            <option value="INACTIVE">Inactivo</option>
          </select>
          <span className="text-[12px] text-[#6B7280]">
            {totalElements} resultado{totalElements !== 1 ? 's' : ''}
          </span>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">División</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Clave</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Descripción</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Programas</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Estado</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {loadStatus === 'loading' ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <Loader2 size={24} className="animate-spin text-[#009574]" />
                    <p className="text-[13px] font-medium">Cargando divisiones...</p>
                  </div>
                </td>
              </tr>
            ) : divisions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <Search size={36} className="text-[#E5E7EB]" />
                    <p className="text-[13px] font-medium">No se encontraron divisiones</p>
                    <p className="text-[12px]">
                      {loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              divisions.map(row => (
                <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#333333]">{row.name}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[11px] bg-[#F8F9FA] border border-[#E5E7EB] px-1.5 py-0.5 rounded text-[#333333]">{row.code}</span>
                  </td>
                  <td className="px-4 py-3 text-[#6B7280]">{row.description}</td>
                  <td className="px-4 py-3 text-[#333333]">{row.programCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={row.status === 'ACTIVE'}
                        disabled={togglingId === row.id}
                        onChange={() => handleToggleStatus(row)}
                      />
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        row.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                        {row.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <ActionBtn icon={<Eye size={15} />} tooltip="Ver" onClick={() => navigate(`/divisiones/form?mode=view&id=${row.id}`)} />
                      <ActionBtn icon={<Pencil size={15} />} tooltip="Editar" onClick={() => navigate(`/divisiones/form?mode=edit&id=${row.id}`)} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {/* Pagination */}
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
    </div>
  )
}
