import { useEffect, useRef, useState } from 'react'
import { Users2, Eye, Pencil, Plus as PlusIcon } from 'lucide-react'
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
// `Group` (grupo) is a full standalone aggregate (backend: `GroupController`,
// plan `118-SISA-BACK/docs/plans/2026-07-20-generation-group.md`). Unlike
// `Generation`, `GET /groups` only supports `status`/`search`/`programId`/
// `generationId` as real server-side filters (see `ListGroupsUseCase.
// ListGroupsQuery`) — there is NO `periodId` or `planLevelId` (Nivel) query
// param on the backend yet. The corrected Pantalla 8 spec still asks for a
// Periodo filter (preselected to the active period) and a Nivel filter, so
// both are applied CLIENT-SIDE over the current server page below (see the
// `displayedGroups` memo) instead of being sent as query params — documented
// here so a future reader doesn't assume they're real filters.

type Shift = 'MORNING' | 'AFTERNOON' | 'MIXED'
type GroupStatus = 'OPEN' | 'CLOSED'
type PeriodStatus = 'CONFIGURATION' | 'ENROLLMENT' | 'ACTIVE' | 'CLOSED'

const SHIFT_LABELS: Record<Shift, string> = {
  MORNING: 'Matutino',
  AFTERNOON: 'Vespertino',
  MIXED: 'Mixto',
}

const SHIFT_BADGE_MAP: Record<Shift, BadgeStyle> = {
  MORNING: { label: SHIFT_LABELS.MORNING, className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  AFTERNOON: { label: SHIFT_LABELS.AFTERNOON, className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  MIXED: { label: SHIFT_LABELS.MIXED, className: 'bg-purple-50 text-purple-700 border border-purple-200' },
}

interface GroupListItem {
  id: string
  generationId: string
  periodId: string
  planLevelId: string
  programId: string
  code: string
  maxCapacity: number
  shift: Shift
  status: GroupStatus
}

interface GroupsPageResponse {
  items: GroupListItem[]
  totalPages: number
}

interface ProgramSummary {
  id: string
  name: string
  code: string
}

interface ProgramsPageResponse {
  items: ProgramSummary[]
}

// Only the fields needed here: `code` for the Generación column/filter label
// (e.g. "2026-7") and `planId` to resolve plan levels for the Nivel
// column/filter (see `ensurePlanLevels` below — `PlanLevel` has no
// standalone catalog endpoint, the only way to read a plan's levels is
// `GET /plans/{id}`, same as `PlanForm.tsx`).
interface GenerationSummary {
  id: string
  code: string
  programId: string
  planId: string
}

interface GenerationsPageResponse {
  items: GenerationSummary[]
}

interface PeriodSummary {
  id: string
  name: string
  status: PeriodStatus
}

interface PeriodsPageResponse {
  items: PeriodSummary[]
}

interface PlanLevelSummary {
  id: string
  levelNumber: number
}

interface AcademicPlanDetail {
  id: string
  levels: PlanLevelSummary[]
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function GruposList() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [programFilter, setProgramFilter] = useState('')
  const [generationFilter, setGenerationFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [page, setPage] = useState(1)
  const [groups, setGroups] = useState<GroupListItem[]>([])
  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [generations, setGenerations] = useState<GenerationSummary[]>([])
  const [periods, setPeriods] = useState<PeriodSummary[]>([])
  const [planLevelsCache, setPlanLevelsCache] = useState<Record<string, PlanLevelSummary[]>>({})
  const [totalPages, setTotalPages] = useState(0)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const fetchedPlanIdsRef = useRef<Set<string>>(new Set())
  const perPage = 20

  const programOptions: SelectOption[] = programs.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` }))
  // Generación filter — depends on Programa (disabled until one is picked),
  // same cascading pattern as GruposForm.tsx's Programa → Generación select.
  const generationOptions: SelectOption[] = generations
    .filter(g => g.programId === programFilter)
    .map(g => ({ value: g.id, label: g.code }))
  const periodOptions: SelectOption[] = periods.map(p => ({ value: p.id, label: p.name }))
  // Nivel filter — `PlanLevel` has no standalone catalog, so it only makes
  // sense once a Generación is selected (its `planId` is what tells us which
  // levels exist). Disabled otherwise — simplest option consistent with the
  // same "depends on a parent select" cascading convention used everywhere
  // else in this module, rather than inventing a plan-agnostic level list.
  const selectedGeneration = generations.find(g => g.id === generationFilter)
  const levelOptions: SelectOption[] = selectedGeneration
    ? (planLevelsCache[selectedGeneration.planId] ?? []).map(l => ({ value: l.id, label: `Nivel ${l.levelNumber}` }))
    : []

  function ensurePlanLevels(planId: string) {
    if (fetchedPlanIdsRef.current.has(planId)) return
    fetchedPlanIdsRef.current.add(planId)
    apiGet<AcademicPlanDetail>(`/plans/${planId}`)
      .then(data => setPlanLevelsCache(prev => ({ ...prev, [planId]: data.levels })))
      .catch(() => {/* non-critical — level label/filter just won't populate for this plan */})
  }

  // Load programs/generations/periods once — used to resolve ids to display
  // labels in the table (mirrors GeneracionesList.tsx) and to populate the
  // cascading filters.
  useEffect(() => {
    apiGet<ProgramsPageResponse>('/programs', { size: 100 })
      .then(data => setPrograms(data.items))
      .catch(() => {/* non-critical — filter/labels just won't populate */})
    apiGet<GenerationsPageResponse>('/generations', { size: 200 })
      .then(data => setGenerations(data.items))
      .catch(() => {/* non-critical — filter/labels just won't populate */})
    apiGet<PeriodsPageResponse>('/periods', { size: 100 })
      .then(data => setPeriods(data.items))
      .catch(() => {/* non-critical — filter/labels just won't populate */})
  }, [])

  // Preselect the active period (per corrected Pantalla 8) — `AcademicPeriod`
  // status is a 4-state lifecycle (CONFIGURATION -> ENROLLMENT -> ACTIVE ->
  // CLOSED, see PeriodosList.tsx) with at most one ACTIVE period at a time.
  // Runs once; doesn't fight with the user manually clearing the filter
  // afterwards.
  useEffect(() => {
    apiGet<PeriodsPageResponse>('/periods', { status: 'ACTIVE', size: 1 })
      .then(data => { if (data.items[0]) setPeriodFilter(data.items[0].id) })
      .catch(() => {/* non-critical — filter simply starts empty */})
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
    apiGet<GroupsPageResponse>('/groups', {
      search: debouncedSearch || undefined,
      programId: programFilter || undefined,
      generationId: generationFilter || undefined,
      page: page - 1,
      size: perPage,
    })
      .then(data => {
        if (cancelled) return
        setGroups(data.items)
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
          setErrorMsg('No tienes permiso para consultar grupos.')
        } else {
          setErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
  }, [debouncedSearch, programFilter, generationFilter, page])

  // Resolve plan levels for every generation present on the current page —
  // needed to render the Nivel column (see `levelLabel` below).
  useEffect(() => {
    for (const row of groups) {
      const gen = generations.find(g => g.id === row.generationId)
      if (gen) ensurePlanLevels(gen.planId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, generations])

  useEffect(() => {
    if (selectedGeneration) ensurePlanLevels(selectedGeneration.planId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationFilter, generations])

  // Periodo/Nivel are NOT real backend query params (see type-block comment
  // above) — applied here over the already-fetched server page. This means
  // the "resultados" count and pagination reflect the server's raw
  // programId/generationId/search filtering, not this extra refinement;
  // acceptable for a first slice given the backend has no periodId/
  // planLevelId filter on `GET /groups` yet.
  const displayedGroups = groups.filter(row => {
    const matchPeriod = !periodFilter || row.periodId === periodFilter
    const matchLevel = !levelFilter || row.planLevelId === levelFilter
    return matchPeriod && matchLevel
  })

  function programLabel(programId: string): string {
    const p = programs.find(p => p.id === programId)
    return p ? p.code : '—'
  }

  function generationLabel(generationId: string): string {
    const g = generations.find(g => g.id === generationId)
    return g ? g.code : '—'
  }

  function periodLabel(periodId: string): string {
    const per = periods.find(per => per.id === periodId)
    return per ? per.name : '—'
  }

  function levelLabel(row: GroupListItem): string {
    const gen = generations.find(g => g.id === row.generationId)
    if (!gen) return '—'
    const level = (planLevelsCache[gen.planId] ?? []).find(l => l.id === row.planLevelId)
    return level ? `Nivel ${level.levelNumber}` : '—'
  }

  async function handleToggleStatus(group: GroupListItem) {
    const nextStatus: GroupStatus = group.status === 'OPEN' ? 'CLOSED' : 'OPEN'
    setTogglingId(group.id)
    try {
      await apiPatch<void>(`/groups/${group.id}/status`, { status: nextStatus })
      const data = await apiGet<GroupsPageResponse>('/groups', {
        search: debouncedSearch || undefined,
        programId: programFilter || undefined,
        generationId: generationFilter || undefined,
        page: page - 1,
        size: perPage,
      })
      setGroups(data.items)
      setTotalPages(data.totalPages)
      setToast(nextStatus === 'OPEN' ? 'Grupo abierto.' : 'Grupo cerrado.')
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      setToast(apiErr.status === 403
        ? 'No tienes permiso para cambiar el estado de este grupo.'
        : 'No se pudo actualizar el estado. Intenta de nuevo.')
    } finally {
      setTogglingId(null)
    }
  }

  const emptyHint = loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'

  const columns: ColumnDef<GroupListItem>[] = [
    { key: 'code', header: 'Clave', type: 'code' },
    { key: 'programId', header: 'Programa', type: 'name', value: row => programLabel(row.programId) },
    { key: 'generationId', header: 'Generación', type: 'muted', value: row => generationLabel(row.generationId) },
    { key: 'planLevelId', header: 'Nivel', type: 'muted', value: row => levelLabel(row) },
    { key: 'periodId', header: 'Periodo', type: 'muted', value: row => periodLabel(row.periodId) },
    { key: 'shift', header: 'Turno', type: 'badge', badge: SHIFT_BADGE_MAP, className: 'w-24' },
    { key: 'maxCapacity', header: 'Capacidad', type: 'count', sub: row => `cupo${row.maxCapacity !== 1 ? 's' : ''}`, className: 'w-28' },
    { key: 'status', header: 'Estado', type: 'status', activeLabel: 'Abierto', inactiveLabel: 'Cerrado', className: 'w-28' },
  ]

  const desktopFooter = (
    <Pagination
      page={page}
      totalPages={totalPages}
      totalElements={displayedGroups.length}
      perPage={perPage}
      onPageChange={setPage}
      suffix="registros"
    />
  )

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Grupos' },
        ]}
      />

      <PageHeader
        title="Grupos"
        subtitle="Consulta y administra los grupos del periodo activo."
        actions={[{ label: 'Registrar Grupo', icon: <PlusIcon />, onClick: () => navigate('/grupos/new') }]}
      />

      {loadStatus === 'error' && errorMsg && <ErrorBanner message={errorMsg} />}

      <FilterBar>
        <div className="w-full sm:w-56">
          <SearchSelectField
            options={periodOptions}
            value={periodFilter}
            onChange={v => { setPeriodFilter(v); setPage(1) }}
            placeholder="Todos los periodos"
            searchPlaceholder="Buscar periodo…"
          />
        </div>
        <div className="w-full sm:w-64">
          <SearchSelectField
            options={programOptions}
            value={programFilter}
            onChange={v => { setProgramFilter(v); setGenerationFilter(''); setLevelFilter(''); setPage(1) }}
            placeholder="Todos los programas"
            searchPlaceholder="Buscar programa…"
          />
        </div>
        <div className="w-full sm:w-56">
          <SearchSelectField
            options={generationOptions}
            value={generationFilter}
            onChange={v => { setGenerationFilter(v); setLevelFilter(''); setPage(1) }}
            placeholder="Todas las generaciones"
            disabled={!programFilter}
            searchPlaceholder="Buscar generación…"
          />
        </div>
        <div className="w-full sm:w-56">
          <SearchSelectField
            options={levelOptions}
            value={levelFilter}
            onChange={v => { setLevelFilter(v); setPage(1) }}
            placeholder="Todos los niveles"
            disabled={!generationFilter}
            searchPlaceholder="Buscar nivel…"
          />
        </div>
        <SearchInput
          value={search}
          onChange={v => { setSearch(v); setPage(1) }}
          placeholder="Buscar grupo..."
        />
        <ResultCount count={displayedGroups.length} />
      </FilterBar>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <DataTable
        numbered
        columns={columns}
        status={loadStatus}
        items={displayedGroups}
        keyFor={row => row.id}
        loadingLabel="Cargando grupos..."
        emptyTitle="No se encontraron grupos"
        emptyHint={emptyHint}
        emptyIcon={<Users2 size={36} className="text-[#E5E7EB]" />}
        footer={desktopFooter}
        actions={{
          view: row => navigate(`/grupos/form?mode=view&id=${row.id}`),
          edit: row => navigate(`/grupos/form?mode=edit&id=${row.id}`),
          viewTooltip: 'Ver detalle',
        }}
        activeValue="OPEN"
        onToggleStatus={handleToggleStatus}
        togglingId={togglingId}
      />

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <MobileCards
        status={loadStatus}
        items={displayedGroups}
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
                  checked={row.status === 'OPEN'}
                  disabled={togglingId === row.id}
                  onChange={() => handleToggleStatus(row)}
                />
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  row.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}>
                  {row.status === 'OPEN' ? 'Abierto' : 'Cerrado'}
                </span>
              </div>
            </div>
            {/* Programa + Generación */}
            <p className="text-[13px] font-medium text-[#333333] mb-1 leading-snug">
              {programLabel(row.programId)} · {generationLabel(row.generationId)}
            </p>
            {/* Nivel + Periodo + Turno */}
            <p className="text-[12px] text-[#6B7280] mb-1">
              {levelLabel(row)} · {periodLabel(row.periodId)}
            </p>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${SHIFT_BADGE_MAP[row.shift].className}`}>
                {SHIFT_BADGE_MAP[row.shift].label}
              </span>
              <span className="text-[12px] text-[#6B7280]">{row.maxCapacity} cupo{row.maxCapacity !== 1 ? 's' : ''}</span>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB]">
              <button
                onClick={() => navigate(`/grupos/form?mode=view&id=${row.id}`)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-[#333333] border border-[#E5E7EB] rounded-md hover:bg-[#F8F9FA] transition-colors"
              >
                <Eye size={14} />Ver
              </button>
              <button
                onClick={() => navigate(`/grupos/form?mode=edit&id=${row.id}`)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-[#009574] border border-[#009574]/30 rounded-md hover:bg-[#e6f5f1] transition-colors"
              >
                <Pencil size={14} />Editar
              </button>
            </div>
          </>
        )}
        loadingLabel="Cargando grupos..."
        emptyTitle="No se encontraron grupos"
        emptyHint={emptyHint}
        emptyIcon={<Users2 size={36} className="text-[#E5E7EB]" />}
        pagination={(
          <MobilePagination
            page={page}
            totalPages={totalPages}
            totalElements={displayedGroups.length}
            perPage={perPage}
            onPageChange={setPage}
            suffix="registros"
          />
        )}
      />
    </PageContainer>
  )
}