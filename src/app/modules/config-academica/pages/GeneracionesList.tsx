import { useEffect, useState } from 'react'
import { Users2, Pencil, Plus as PlusIcon } from 'lucide-react'
import { Toast, Switch, SearchSelectField } from '@app/core/components/ui'
import type { SelectOption } from '@app/core/components/ui'
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
// `Generation` = a cohort of students entering a specific `AcademicPlan` in a
// specific `AcademicPeriod` (e.g. code "2026-7" = year 2026, consecutive #7
// within that program). `programId` travels denormalized on the entity — no
// need to resolve it via `planId`. Status is a simple two-way toggle
// (ACTIVE/FINISHED), unlike AcademicPeriod's strict one-way sequence.

type GenerationStatus = 'ACTIVE' | 'FINISHED'

interface GenerationListItem {
  id: string
  planId: string
  startPeriodId: string
  programId: string
  number: number
  code: string
  status: GenerationStatus
}

interface GenerationsPageResponse {
  items: GenerationListItem[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

interface ProgramSummary {
  id: string
  name: string
  code: string
}

interface ProgramsPageResponse {
  items: ProgramSummary[]
}

interface PlanSummary {
  id: string
  version: string
}

interface PlansPageResponse {
  items: PlanSummary[]
}

interface PeriodSummary {
  id: string
  name: string
}

interface PeriodsPageResponse {
  items: PeriodSummary[]
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function GeneracionesList() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [programFilter, setProgramFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<GenerationStatus | ''>('')
  const [page, setPage] = useState(1)
  const [generations, setGenerations] = useState<GenerationListItem[]>([])
  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [periods, setPeriods] = useState<PeriodSummary[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const perPage = 20

  const programOptions: SelectOption[] = programs.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` }))

  // Load programs/plans/periods once — used only to resolve ids to display
  // labels in the table (mirrors `programLabel()` in PlanesList.tsx). Not
  // re-fetched on filter/page changes.
  useEffect(() => {
    apiGet<ProgramsPageResponse>('/programs', { size: 100 })
      .then(data => setPrograms(data.items))
      .catch(() => {/* non-critical — filter/labels just won't populate */})
    apiGet<PlansPageResponse>('/plans', { size: 200 })
      .then(data => setPlans(data.items))
      .catch(() => {/* non-critical — labels just won't populate */})
    apiGet<PeriodsPageResponse>('/periods', { size: 100 })
      .then(data => setPeriods(data.items))
      .catch(() => {/* non-critical — labels just won't populate */})
  }, [])

  // Debounce free-text search — the fetch effect below only reacts to
  // `debouncedSearch`, not every keystroke of `search`.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    setLoadStatus('loading')
    setErrorMsg('')
    apiGet<GenerationsPageResponse>('/generations', {
      status: statusFilter || undefined,
      search: debouncedSearch || undefined,
      programId: programFilter || undefined,
      page: page - 1,
      size: perPage,
    })
      .then(data => {
        if (cancelled) return
        setGenerations(data.items)
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
          setErrorMsg('No tienes permiso para consultar generaciones.')
        } else {
          setErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
  }, [statusFilter, debouncedSearch, programFilter, page])

  function programLabel(programId: string): string {
    const p = programs.find(p => p.id === programId)
    return p ? `${p.code} — ${p.name}` : '—'
  }

  function planLabel(planId: string): string {
    const pl = plans.find(pl => pl.id === planId)
    return pl ? pl.version : '—'
  }

  function periodLabel(periodId: string): string {
    const per = periods.find(per => per.id === periodId)
    return per ? per.name : '—'
  }

  async function handleToggleStatus(generation: GenerationListItem) {
    const nextStatus: GenerationStatus = generation.status === 'ACTIVE' ? 'FINISHED' : 'ACTIVE'
    setTogglingId(generation.id)
    try {
      await apiPatch<void>(`/generations/${generation.id}/status`, { status: nextStatus })
      // Refetch-after-toggle keeps pagination metadata correct without
      // duplicating the PATCH response's (narrower) shape locally.
      const data = await apiGet<GenerationsPageResponse>('/generations', {
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        programId: programFilter || undefined,
        page: page - 1,
        size: perPage,
      })
      setGenerations(data.items)
      setTotalElements(data.totalElements)
      setTotalPages(data.totalPages)
      setToast(nextStatus === 'ACTIVE' ? 'Generación activada.' : 'Generación finalizada.')
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      setToast(apiErr.status === 403
        ? 'No tienes permiso para cambiar el estado de esta generación.'
        : 'No se pudo actualizar el estado. Intenta de nuevo.')
    } finally {
      setTogglingId(null)
    }
  }

  const emptyHint = loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'

  const columns: ColumnDef<GenerationListItem>[] = [
    { key: 'code', header: 'Código', type: 'code', className: 'w-24' },
    { key: 'programId', header: 'Programa Educativo', type: 'name', value: row => programLabel(row.programId) },
    { key: 'planId', header: 'Plan de Estudios', type: 'muted', value: row => planLabel(row.planId), className: 'w-28' },
    { key: 'startPeriodId', header: 'Periodo de Inicio', type: 'muted', value: row => periodLabel(row.startPeriodId) },
    { key: 'status', header: 'Estado', type: 'status', activeLabel: 'Activa', inactiveLabel: 'Finalizada', className: 'w-28' },
  ]

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Generaciones' },
        ]}
      />

      <PageHeader
        title="Generaciones"
        subtitle="Consulta y administra las generaciones (cohortes de ingreso) por programa educativo."
        actions={[{ label: 'Registrar Generación', icon: <PlusIcon />, onClick: () => navigate('/generaciones/new') }]}
      />

      {loadStatus === 'error' && errorMsg && <ErrorBanner message={errorMsg} />}

      <FilterBar>
        <div className="w-full sm:w-72">
          <SearchSelectField
            options={programOptions}
            value={programFilter}
            onChange={v => { setProgramFilter(v); setPage(1) }}
            placeholder="Todos los programas"
            searchPlaceholder="Buscar programa…"
          />
        </div>
        <FilterSelect
          value={statusFilter}
          onChange={v => { setStatusFilter(v as GenerationStatus | ''); setPage(1) }}
          allLabel="Todos"
          options={[
            { value: 'ACTIVE', label: 'Activa' },
            { value: 'FINISHED', label: 'Finalizada' },
          ]}
        />
        <SearchInput
          value={search}
          onChange={v => { setSearch(v); setPage(1) }}
          placeholder="Buscar por código de generación..."
        />
        <ResultCount count={totalElements} />
      </FilterBar>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <DataTable
        numbered
        rowNumberOffset={(page - 1) * perPage}
        columns={columns}
        status={loadStatus}
        items={generations}
        keyFor={row => row.id}
        loadingLabel="Cargando generaciones..."
        emptyTitle="No se encontraron generaciones"
        emptyHint={emptyHint}
        emptyIcon={<Users2 size={36} className="text-[#E5E7EB]" />}
        footer={<Pagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} />}
        actions={{ edit: row => navigate(`/generaciones/form?mode=edit&id=${row.id}`) }}
        activeValue="ACTIVE"
        onToggleStatus={handleToggleStatus}
        togglingId={togglingId}
      />

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <MobileCards
        status={loadStatus}
        items={generations}
        keyFor={row => row.id}
        renderItem={row => (
          <>
            {/* Top row: código + estado */}
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
                  {row.status === 'ACTIVE' ? 'Activa' : 'Finalizada'}
                </span>
              </div>
            </div>
            {/* Program */}
            <p className="text-[13px] font-medium text-[#333333] mb-1 leading-snug">{programLabel(row.programId)}</p>
            {/* Plan + Periodo */}
            <p className="text-[12px] text-[#6B7280] mb-3">
              {planLabel(row.planId)} · {periodLabel(row.startPeriodId)}
            </p>
            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB]">
              <button
                onClick={() => navigate(`/generaciones/form?mode=edit&id=${row.id}`)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-[#009574] border border-[#009574]/30 rounded-md hover:bg-[#e6f5f1] transition-colors"
              >
                <Pencil size={14} />Editar
              </button>
            </div>
          </>
        )}
        loadingLabel="Cargando generaciones..."
        emptyTitle="No se encontraron generaciones"
        emptyHint={emptyHint}
        emptyIcon={<Users2 size={36} className="text-[#E5E7EB]" />}
        pagination={<MobilePagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} />}
      />
    </PageContainer>
  )
}