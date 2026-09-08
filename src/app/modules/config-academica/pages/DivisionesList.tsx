import { useEffect, useState } from 'react'
import { Eye, Pencil, Plus as PlusIcon } from 'lucide-react'
import { Toast, Switch } from '@app/core/components/ui'
import { useNavigate } from 'react-router'
import { usePendingToast } from '@app/core/infra/hooks'
import { apiGet, apiPatch } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
  SearchInput,
  FilterBar,
  FilterSelect,
  ResultCount,
  ErrorBanner,
  LoadingState,
  EmptyState,
  Pagination,
  MobilePagination,
  StatusBadge,
  ViewEditActions,
} from '@app/core/components/list'

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

  async function handleToggleStatus(division: DivisionListItem) {
    const nextStatus: DivisionStatus = division.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setTogglingId(division.id)
    try {
      await apiPatch<void>(`/divisions/${division.id}/status`, { status: nextStatus })
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
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Divisiones Académicas' },
        ]}
      />

      <PageHeader
        title="Divisiones Académicas"
        subtitle="Gestiona las divisiones académicas registradas en el sistema."
        actions={[{ label: 'Registrar División', icon: <PlusIcon />, onClick: () => navigate('/divisiones/new') }]}
      />

      {loadStatus === 'error' && errorMsg && <ErrorBanner message={errorMsg} />}

      <FilterBar>
        <FilterSelect
          value={statusFilter}
          onChange={v => { setStatusFilter(v); setPage(1) }}
          allLabel="Todos los estados"
          options={[
            { value: 'ACTIVE', label: 'Activo' },
            { value: 'INACTIVE', label: 'Inactivo' },
          ]}
        />
        <SearchInput
          value={search}
          onChange={v => { setSearch(v); setPage(1) }}
          placeholder="Buscar por nombre o clave…"
        />
        <ResultCount count={totalElements} />
      </FilterBar>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <div className="hidden md:block bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
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
                  <LoadingState label="Cargando divisiones..." />
                </td>
              </tr>
            ) : divisions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <EmptyState
                    title="No se encontraron divisiones"
                    hint={loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'}
                  />
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
                      <StatusBadge active={row.status === 'ACTIVE'} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ViewEditActions
                      onView={() => navigate(`/divisiones/form?mode=view&id=${row.id}`)}
                      onEdit={() => navigate(`/divisiones/form?mode=edit&id=${row.id}`)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} />
      </div>

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {loadStatus === 'loading' ? (
          <div className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-16 text-center">
            <LoadingState label="Cargando divisiones..." />
          </div>
        ) : divisions.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-16 text-center">
            <EmptyState
              title="No se encontraron divisiones"
              hint={loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'}
            />
          </div>
        ) : (
          divisions.map(row => (
            <div key={row.id} className="bg-white border border-[#E5E7EB] rounded-lg p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono text-[12px] font-semibold bg-[#F8F9FA] border border-[#E5E7EB] px-2 py-0.5 rounded text-[#333333]">
                  {row.code}
                </span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={row.status === 'ACTIVE'}
                    disabled={togglingId === row.id}
                    onChange={() => handleToggleStatus(row)}
                  />
                  <StatusBadge active={row.status === 'ACTIVE'} />
                </div>
              </div>
              <p className="text-[13px] font-medium text-[#333333] mb-1 leading-snug">{row.name}</p>
              {row.description && (
                <p className="text-[12px] text-[#6B7280] mb-2 leading-snug line-clamp-2">{row.description}</p>
              )}
              <p className="text-[12px] text-[#6B7280] mb-3">
                <span className="font-semibold text-[#333333]">{row.programCount}</span> programa{row.programCount !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB]">
                <button
                  onClick={() => navigate(`/divisiones/form?mode=view&id=${row.id}`)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-[#6B7280] border border-[#E5E7EB] rounded-md hover:bg-[#F8F9FA] transition-colors"
                >
                  <Eye size={14} />Ver
                </button>
                <button
                  onClick={() => navigate(`/divisiones/form?mode=edit&id=${row.id}`)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-[#009574] border border-[#009574]/30 rounded-md hover:bg-[#e6f5f1] transition-colors"
                >
                  <Pencil size={14} />Editar
                </button>
              </div>
            </div>
          ))
        )}

        <MobilePagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} />
      </div>
    </PageContainer>
  )
}

