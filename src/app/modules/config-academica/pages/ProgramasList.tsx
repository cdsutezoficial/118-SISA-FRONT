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
  Pagination,
  MobilePagination,
  DataTable,
  MobileCards,
  type ColumnDef,
} from '@app/core/components/list'

// ─── Types ─────────────────────────────────────────────────────────────────────

type ProgramStatus = 'ACTIVE' | 'INACTIVE'

interface DivisionSummary {
  id: string
  name: string
  code: string
}

interface DivisionsPageResponse {
  items: DivisionSummary[]
}

interface ProgramListItem {
  id: string
  divisionId: string
  name: string
  offerName: string
  code: string
  level: string
  modality: string
  description: string | null
  dgpCode: string | null
  status: ProgramStatus
}

interface ProgramsPageResponse {
  items: ProgramListItem[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ProgramasList() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [divisionFilter, setDivisionFilter] = useState('')
  const [page, setPage] = useState(1)
  const [programs, setPrograms] = useState<ProgramListItem[]>([])
  const [divisions, setDivisions] = useState<DivisionSummary[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const perPage = 20

  // Load divisions once for the filter dropdown (code → id mapping).
  useEffect(() => {
    apiGet<DivisionsPageResponse>('/divisions', { size: 100 })
      .then(data => setDivisions(data.items))
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
    apiGet<ProgramsPageResponse>('/programs', {
      divisionId: divisionFilter || undefined,
      search: debouncedSearch || undefined,
      page: page - 1,
      size: perPage,
    })
      .then(data => {
        if (cancelled) return
        setPrograms(data.items)
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
          setErrorMsg('No tienes permiso para consultar programas educativos.')
        } else {
          setErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
  }, [divisionFilter, debouncedSearch, page])

  function divisionCode(divisionId: string): string {
    return divisions.find(d => d.id === divisionId)?.code ?? '—'
  }

  async function handleToggleStatus(program: ProgramListItem) {
    const nextStatus: ProgramStatus = program.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setTogglingId(program.id)
    try {
      await apiPatch<void>(`/programs/${program.id}/status`, { status: nextStatus })
      const data = await apiGet<ProgramsPageResponse>('/programs', {
        divisionId: divisionFilter || undefined,
        search: debouncedSearch || undefined,
        page: page - 1,
        size: perPage,
      })
      setPrograms(data.items)
      setTotalElements(data.totalElements)
      setTotalPages(data.totalPages)
      setToast(nextStatus === 'ACTIVE' ? 'Programa activado.' : 'Programa desactivado.')
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      setToast(apiErr.status === 403
        ? 'No tienes permiso para cambiar el estado de este programa.'
        : 'No se pudo actualizar el estado. Intenta de nuevo.')
    } finally {
      setTogglingId(null)
    }
  }

  const emptyHint = loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'

  const columns: ColumnDef<ProgramListItem>[] = [
    { key: 'name', header: 'Programa', type: 'name' },
    { key: 'code', header: 'Clave', type: 'code', className: 'w-24' },
    { key: 'divisionId', header: 'División', type: 'muted', value: row => divisionCode(row.divisionId), className: 'w-20' },
    { key: 'dgpCode', header: 'Clave DGP', type: 'muted', value: row => row.dgpCode ?? '—', className: 'w-32', cellClassName: 'font-mono text-[11px]' },
    { key: 'status', header: 'Estado', type: 'status', className: 'w-24' },
  ]

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Programas Educativos' },
        ]}
      />

      <PageHeader
        title="Programas Educativos"
        subtitle="Gestiona los programas educativos del sistema."
        actions={[{ label: 'Registrar Programa', icon: <PlusIcon />, onClick: () => navigate('/programas/new') }]}
      />

      {loadStatus === 'error' && errorMsg && <ErrorBanner message={errorMsg} />}

      <FilterBar>
        <FilterSelect
          value={divisionFilter}
          onChange={v => { setDivisionFilter(v); setPage(1) }}
          allLabel="Todas las divisiones"
          options={divisions.map(d => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
        />
        <SearchInput
          value={search}
          onChange={v => { setSearch(v); setPage(1) }}
          placeholder="Buscar por nombre o clave…"
        />
        <ResultCount count={totalElements} />
      </FilterBar>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        status={loadStatus}
        items={programs}
        keyFor={row => row.id}
        loadingLabel="Cargando programas..."
        emptyTitle="No se encontraron programas"
        emptyHint={emptyHint}
        footer={<Pagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} />}
        actions={{
          view: row => navigate(`/programas/form?mode=view&id=${row.id}`),
          edit: row => navigate(`/programas/form?mode=edit&id=${row.id}`),
        }}
        onToggleStatus={handleToggleStatus}
        togglingId={togglingId}
      />

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <MobileCards
        status={loadStatus}
        items={programs}
        keyFor={row => row.id}
        renderItem={row => (
          <>
            {/* Top row: clave + estado */}
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
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  row.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}>
                  {row.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
            {/* Name */}
            <p className="text-[13px] font-medium text-[#333333] mb-1 leading-snug">{row.name}</p>
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#6B7280] mb-3">
              <span>División: <span className="font-medium text-[#333333]">{divisionCode(row.divisionId)}</span></span>
              {row.dgpCode && (
                <span>DGP: <span className="font-mono font-medium text-[#333333]">{row.dgpCode}</span></span>
              )}
            </div>
            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB]">
              <button
                onClick={() => navigate(`/programas/form?mode=view&id=${row.id}`)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-[#6B7280] border border-[#E5E7EB] rounded-md hover:bg-[#F8F9FA] transition-colors"
              >
                <Eye size={14} />Ver
              </button>
              <button
                onClick={() => navigate(`/programas/form?mode=edit&id=${row.id}`)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-[#009574] border border-[#009574]/30 rounded-md hover:bg-[#e6f5f1] transition-colors"
              >
                <Pencil size={14} />Editar
              </button>
            </div>
          </>
        )}
        loadingLabel="Cargando programas..."
        emptyTitle="No se encontraron programas"
        emptyHint={emptyHint}
        pagination={<MobilePagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} />}
      />
    </PageContainer>
  )
}