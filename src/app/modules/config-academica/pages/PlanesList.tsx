import { useEffect, useState } from 'react'
import {
  Eye, Pencil, X, ChevronLeft, ChevronRight as ChevRight,
  BookOpen, Layers, Plus as PlusIcon,
} from 'lucide-react'
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
  DataTable,
  MobileCards,
  MobilePagination,
  type ColumnDef,
} from '@app/core/components/list'

// ─── Types ─────────────────────────────────────────────────────────────────────

type PlanStatus = 'ACTIVE' | 'INACTIVE'

interface ProgramSummary {
  id: string
  name: string
  code: string
}

interface ProgramsPageResponse {
  items: ProgramSummary[]
}

interface PlanListItem {
  id: string
  programId: string
  version: string
  validityPeriod: string
  effectiveFrom: string
  totalLevels: number
  status: PlanStatus
}

interface PlansPageResponse {
  items: PlanListItem[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

// ─── Format helpers ────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  // Date-only ISO strings parse as UTC midnight; build a local date to avoid
  // showing the previous day in timezones west of UTC.
  const [y, m, d] = iso.split('-').map(Number)
  const date = y && m && d ? new Date(y, m - 1, d) : new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PlanesList() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [programFilter, setProgramFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<PlanStatus | ''>('')
  const [page, setPage] = useState(1)
  const [plans, setPlans] = useState<PlanListItem[]>([])
  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const perPage = 20

  // Load programs once for the filter dropdown (id → name/code mapping).
  useEffect(() => {
    apiGet<ProgramsPageResponse>('/programs', { size: 100 })
      .then(data => setPrograms(data.items))
      .catch(() => {/* non-critical — filter just won't populate */})
  }, [])

  // Debounce free-text search.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    setLoadStatus('loading')
    setErrorMsg('')
    apiGet<PlansPageResponse>('/plans', {
      programId: programFilter || undefined,
      status: statusFilter || undefined,
      search: debouncedSearch || undefined,
      page: page - 1,
      size: perPage,
    })
      .then(data => {
        if (cancelled) return
        setPlans(data.items)
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
          setErrorMsg('No tienes permiso para consultar planes de estudio.')
        } else {
          setErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
  }, [programFilter, statusFilter, debouncedSearch, page])

  const startRow = totalElements === 0 ? 0 : (page - 1) * perPage + 1
  const endRow = Math.min(page * perPage, totalElements)
  const hasFilters = !!programFilter || !!statusFilter || !!search

  function programLabel(programId: string): string {
    const p = programs.find(p => p.id === programId)
    return p ? `${p.code} — ${p.name}` : '—'
  }

  async function handleToggleStatus(plan: PlanListItem) {
    const nextStatus: PlanStatus = plan.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setTogglingId(plan.id)
    try {
      await apiPatch<void>(`/plans/${plan.id}/status`, { status: nextStatus })
      const data = await apiGet<PlansPageResponse>('/plans', {
        programId: programFilter || undefined,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        page: page - 1,
        size: perPage,
      })
      setPlans(data.items)
      setTotalElements(data.totalElements)
      setTotalPages(data.totalPages)
      setToast(nextStatus === 'ACTIVE' ? 'Plan de estudio activado.' : 'Plan de estudio desactivado.')
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      setToast(apiErr.status === 403
        ? 'No tienes permiso para cambiar el estado de este plan de estudio.'
        : 'No se pudo actualizar el estado. Intenta de nuevo.')
    } finally {
      setTogglingId(null)
    }
  }

  const emptyHint = loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'

  const columns: ColumnDef<PlanListItem>[] = [
    { key: 'version', header: 'Versión', type: 'code', className: 'w-28' },
    { key: 'validityPeriod', header: 'Vigencia', type: 'muted', className: 'w-24' },
    { key: 'programId', header: 'Programa Educativo', type: 'name', value: row => programLabel(row.programId) },
    { key: 'effectiveFrom', header: 'Vigente desde', type: 'count', value: row => formatDate(row.effectiveFrom), className: 'w-32 text-center', cellClassName: 'text-center tabular-nums' },
    {
      key: 'levels',
      header: 'Niveles',
      type: 'count',
      value: row => row.totalLevels,
      icon: <Layers size={13} className="text-[#6B7280]" />,
      className: 'w-24 text-center',
      cellClassName: 'text-center',
    },
    { key: 'status', header: 'Estado', type: 'status', className: 'w-24' },
  ]

  const desktopFooter = (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB] bg-[#F8F9FA]">
      <p className="text-[12px] text-[#6B7280]">
        {totalElements === 0 ? 'Sin registros' : `Mostrando ${startRow}–${endRow} de ${totalElements} registros`}
      </p>
      <div className="flex items-center gap-2">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
          className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[#333333] disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-[#F8F9FA] transition-colors">
          <ChevronLeft size={13} />Anterior
        </button>
        <span className="px-3 py-1.5 text-[12px] font-semibold text-white bg-[#009574] border border-[#009574] rounded-md tabular-nums">
          {page} / {totalPages || 1}
        </span>
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}
          className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[#333333] disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-[#F8F9FA] transition-colors">
          Siguiente<ChevRight size={13} />
        </button>
      </div>
    </div>
  )

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Planes de Estudio' },
        ]}
      />

      <PageHeader
        divider
        title="Planes de Estudio"
        subtitle="Consulta y administra los planes de estudio de cada programa educativo. Cada programa puede tener múltiples planes vigentes simultáneamente."
        actions={[{ icon: <PlusIcon size={15} />, label: 'Registrar Plan de Estudios', onClick: () => navigate('/planes/new') }]}
      />

      {loadStatus === 'error' && errorMsg && <ErrorBanner message={errorMsg} />}

      {/* Filters + search */}
      <FilterBar>
        <FilterSelect
          value={programFilter}
          onChange={v => { setProgramFilter(v); setPage(1) }}
          allLabel="Todos los programas"
          className="sm:w-64"
          options={programs.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
        />
        <FilterSelect
          value={statusFilter}
          onChange={v => { setStatusFilter(v as PlanStatus | ''); setPage(1) }}
          allLabel="Todos los estados"
          className="sm:w-36"
          options={[
            { value: 'ACTIVE', label: 'Activo' },
            { value: 'INACTIVE', label: 'Inactivo' },
          ]}
        />
        <SearchInput
          value={search}
          onChange={v => { setSearch(v); setPage(1) }}
          placeholder="Buscar por versión o clave de titulación..."
        />
        {hasFilters && (
          <button onClick={() => { setProgramFilter(''); setStatusFilter(''); setSearch(''); setPage(1) }}
            className="flex items-center gap-1 text-[12px] text-[#6B7280] hover:text-[#333333] transition-colors">
            <X size={13} />Limpiar filtros
          </button>
        )}
        <ResultCount count={totalElements} />
      </FilterBar>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <DataTable
        numbered
        rowNumberOffset={(page - 1) * perPage}
        columns={columns}
        status={loadStatus}
        items={plans}
        keyFor={row => row.id}
        loadingLabel="Cargando planes de estudio..."
        emptyTitle="No se encontraron planes de estudio"
        emptyHint={emptyHint}
        emptyIcon={<BookOpen size={36} className="text-[#E5E7EB]" />}
        footer={desktopFooter}
        actions={{
          view: row => navigate(`/planes/detalle?id=${row.id}`),
          edit: row => navigate(`/planes/form?mode=edit&id=${row.id}`),
          viewTooltip: 'Ver detalle',
        }}
        onToggleStatus={handleToggleStatus}
        togglingId={togglingId}
      />

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <MobileCards
        status={loadStatus}
        items={plans}
        keyFor={row => row.id}
        renderItem={row => (
          <>
            {/* Top row: versión + estado */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="font-mono text-[12px] font-semibold bg-[#F8F9FA] border border-[#E5E7EB] px-2 py-0.5 rounded text-[#333333]">
                {row.version}
              </span>
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
            </div>
            {/* Program name */}
            <p className="text-[13px] font-medium text-[#333333] mb-3 leading-snug">{programLabel(row.programId)}</p>
            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#6B7280] mb-3">
              <span className="text-[#333333]">{row.validityPeriod}</span>
              <span className="text-[#E5E7EB]">·</span>
              <span className="tabular-nums">{formatDate(row.effectiveFrom)}</span>
              <span className="text-[#E5E7EB]">·</span>
              <div className="flex items-center gap-1">
                <Layers size={12} />
                <span className="font-semibold tabular-nums text-[#333333]">{row.totalLevels}</span>
                <span>niveles</span>
              </div>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB]">
              <button
                onClick={() => navigate(`/planes/detalle?id=${row.id}`)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-[#6B7280] border border-[#E5E7EB] rounded-md hover:bg-[#F8F9FA] transition-colors"
              >
                <Eye size={14} />Ver
              </button>
              <button
                onClick={() => navigate(`/planes/form?mode=edit&id=${row.id}`)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-[#009574] border border-[#009574]/30 rounded-md hover:bg-[#e6f5f1] transition-colors"
              >
                <Pencil size={14} />Editar
              </button>
            </div>
          </>
        )}
        loadingLabel="Cargando planes de estudio..."
        emptyTitle="No se encontraron planes de estudio"
        emptyHint={emptyHint}
        emptyIcon={<BookOpen size={36} className="text-[#E5E7EB]" />}
        pagination={<MobilePagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} suffix="registros" onPageChange={setPage} />}
      />
    </PageContainer>
  )
}