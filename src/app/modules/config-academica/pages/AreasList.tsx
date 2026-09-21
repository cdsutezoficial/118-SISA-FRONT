import { useEffect, useState } from 'react'
import { Layers, Eye, Pencil, Plus as PlusIcon } from 'lucide-react'
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
  Pagination,
  MobilePagination,
  DataTable,
  MobileCards,
  type ColumnDef,
  type BadgeStyle,
} from '@app/core/components/list'

// ─── Types ─────────────────────────────────────────────────────────────────────
// `PaymentArea` (academic_config bounded context) — companion catalog to
// `PaymentConcept`: an area groups payment concepts (clave + nombre largo +
// descripción). Wired to `/payment-areas` following the same contract as
// `/divisions`. Status is a simple two-way toggle (ACTIVE/INACTIVE) via
// `PATCH /payment-areas/{id}/status` — same pattern as Generaciones/
// Divisiones/Conceptos: no physical delete.

type PaymentAreaStatus = 'ACTIVE' | 'INACTIVE'

const STATUS_BADGE_MAP: Record<PaymentAreaStatus, BadgeStyle> = {
  ACTIVE: { label: 'Activo', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  INACTIVE: { label: 'Inactivo', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
}

interface PaymentAreaListItem {
  id: string
  code: string
  name: string
  description?: string | null
  status: PaymentAreaStatus
}

interface PaymentAreasPageResponse {
  items: PaymentAreaListItem[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AreasList() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<PaymentAreaStatus | ''>('')
  const [page, setPage] = useState(1)
  const [areas, setAreas] = useState<PaymentAreaListItem[]>([])
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
    apiGet<PaymentAreasPageResponse>('/payment-areas', {
      status: statusFilter || undefined,
      search: debouncedSearch || undefined,
      page: page - 1,
      size: perPage,
    })
      .then(data => {
        if (cancelled) return
        setAreas(data.items)
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
          setErrorMsg('No tienes permiso para consultar áreas.')
        } else {
          setErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
  }, [statusFilter, debouncedSearch, page])

  async function handleToggleStatus(area: PaymentAreaListItem) {
    const nextStatus: PaymentAreaStatus = area.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setTogglingId(area.id)
    try {
      await apiPatch<void>(`/payment-areas/${area.id}/status`, { status: nextStatus })
      // Refetch-after-toggle keeps pagination metadata correct without
      // duplicating the PATCH response's (narrower) shape locally.
      const data = await apiGet<PaymentAreasPageResponse>('/payment-areas', {
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        page: page - 1,
        size: perPage,
      })
      setAreas(data.items)
      setTotalElements(data.totalElements)
      setTotalPages(data.totalPages)
      setToast(nextStatus === 'ACTIVE' ? 'Área activada.' : 'Área desactivada.')
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      setToast(apiErr.status === 403
        ? 'No tienes permiso para cambiar el estado de esta área.'
        : 'No se pudo actualizar el estado. Intenta de nuevo.')
    } finally {
      setTogglingId(null)
    }
  }

  const emptyHint = loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'

  const columns: ColumnDef<PaymentAreaListItem>[] = [
    { key: 'name', header: 'Nombre', type: 'name' },
    {
      key: 'code',
      header: 'Clave',
      className: 'w-32',
      render: row => <span className="font-mono text-[#6B7280] text-[12px]">{row.code}</span>,
    },
    {
      key: 'description',
      header: 'Descripción',
      cellClassName: 'max-w-xs truncate',
      render: row => (
        <span className="text-[#6B7280]">{row.description ? (row.description.length > 80 ? `${row.description.slice(0, 80)}…` : row.description) : '—'}</span>
      ),
    },
    { key: 'status', header: 'Estado', type: 'status', className: 'w-32' },
  ]

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Áreas' },
        ]}
      />

      <PageHeader
        title="Áreas de Conceptos de Pago"
        subtitle="Consulta y administra las áreas que agrupan los conceptos de pago."
        actions={[{ label: 'Registrar Área', icon: <PlusIcon />, onClick: () => navigate('/areas/new') }]}
      />

      {loadStatus === 'error' && errorMsg && <ErrorBanner message={errorMsg} />}

      <FilterBar>
        <FilterSelect
          value={statusFilter}
          onChange={v => { setStatusFilter(v as PaymentAreaStatus | ''); setPage(1) }}
          allLabel="Todos"
          options={[
            { value: 'ACTIVE', label: 'Activo' },
            { value: 'INACTIVE', label: 'Inactivo' },
          ]}
        />
        <SearchInput
          value={search}
          onChange={v => { setSearch(v); setPage(1) }}
          placeholder="Buscar por nombre o clave..."
        />
        <ResultCount count={totalElements} />
      </FilterBar>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        status={loadStatus}
        items={areas}
        keyFor={row => row.id}
        loadingLabel="Cargando áreas..."
        emptyTitle="No se encontraron áreas"
        emptyHint={emptyHint}
        emptyIcon={<Layers size={36} className="text-[#E5E7EB]" />}
        footer={<Pagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} />}
        actions={{
          view: row => navigate(`/areas/form?mode=view&id=${row.id}`),
          edit: row => navigate(`/areas/form?mode=edit&id=${row.id}`),
        }}
        onToggleStatus={handleToggleStatus}
        togglingId={togglingId}
      />

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <MobileCards
        status={loadStatus}
        items={areas}
        keyFor={row => row.id}
        renderItem={row => (
          <>
            {/* Top row: clave + estado */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#e6f5f1] text-[#009574] border border-[#009574]/20">
                {row.code}
              </span>
              <div className="flex items-center gap-2">
                <Switch
                  checked={row.status === 'ACTIVE'}
                  disabled={togglingId === row.id}
                  onChange={() => handleToggleStatus(row)}
                />
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE_MAP[row.status].className}`}>
                  {STATUS_BADGE_MAP[row.status].label}
                </span>
              </div>
            </div>
            {/* Nombre */}
            <p className="text-[13px] font-medium text-[#333333] mb-1 leading-snug">{row.name}</p>
            {/* Descripción */}
            {row.description && (
              <p className="text-[12px] text-[#6B7280] leading-snug mb-3 line-clamp-2">{row.description}</p>
            )}
            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB]">
              <button
                onClick={() => navigate(`/areas/form?mode=view&id=${row.id}`)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-[#6B7280] border border-[#E5E7EB] rounded-md hover:bg-[#F8F9FA] transition-colors"
              >
                <Eye size={14} />Ver
              </button>
              <button
                onClick={() => navigate(`/areas/form?mode=edit&id=${row.id}`)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-[#009574] border border-[#009574]/30 rounded-md hover:bg-[#e6f5f1] transition-colors"
              >
                <Pencil size={14} />Editar
              </button>
            </div>
          </>
        )}
        loadingLabel="Cargando áreas..."
        emptyTitle="No se encontraron áreas"
        emptyHint={emptyHint}
        emptyIcon={<Layers size={36} className="text-[#E5E7EB]" />}
        pagination={<MobilePagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} />}
      />
    </PageContainer>
  )
}