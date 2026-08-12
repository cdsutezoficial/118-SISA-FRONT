import { useEffect, useRef, useState } from 'react'
import {
  ChevronRight, Search, Eye, Pencil, Plus, ChevronLeft, ChevronRight as ChevRight,
  Loader2, AlertCircle, Users2,
} from 'lucide-react'
import { Toast, ActionBtn, Switch, SearchSelectField } from '../shared/ui'
import type { SelectOption } from '../shared/ui'
import { useNavigate } from 'react-router'
import { usePendingToast } from '../shared/hooks'
import { apiGet, apiPatch } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'

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

const SHIFT_BADGE: Record<Shift, string> = {
  MORNING: 'bg-blue-50 text-blue-700 border border-blue-200',
  AFTERNOON: 'bg-amber-50 text-amber-700 border border-amber-200',
  MIXED: 'bg-purple-50 text-purple-700 border border-purple-200',
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

  // Display text for footer — based on client-filtered results, not server total
  const displayedStartRow = displayedGroups.length === 0 ? 0 : 1
  const displayedEndRow = displayedGroups.length
  const displayedTotal = displayedGroups.length

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

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Grupos</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">Grupos</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">Consulta y administra los grupos del periodo activo.</p>
        </div>
        <button
          onClick={() => navigate('/grupos/new')}
          className="flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors sm:whitespace-nowrap sm:self-start"
        >
          <Plus size={15} />Registrar Grupo
        </button>
      </div>

      {/* Error banner */}
      {loadStatus === 'error' && errorMsg && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mb-4">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {errorMsg}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-4">
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
        <div className="relative flex-1 sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar grupo..."
            className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
          />
        </div>
        <span className="text-[12px] text-[#6B7280] hidden sm:inline">
          {displayedGroups.length} resultado{displayedGroups.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <div className="hidden md:block bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-10">#</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Clave</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Programa</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Generación</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Nivel</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Periodo</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Turno</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Capacidad</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Estado</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {loadStatus === 'loading' ? (
              <tr>
                <td colSpan={10} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <Loader2 size={24} className="animate-spin text-[#009574]" />
                    <p className="text-[13px] font-medium">Cargando grupos...</p>
                  </div>
                </td>
              </tr>
            ) : displayedGroups.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <Users2 size={36} className="text-[#E5E7EB]" />
                    <p className="text-[13px] font-medium">No se encontraron grupos</p>
                    <p className="text-[12px]">
                      {loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              displayedGroups.map((row, i) => {
                const rowNum = i + 1
                return (
                  <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                    <td className="px-4 py-3 text-[#6B7280] font-medium">{rowNum}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] font-semibold bg-[#F8F9FA] border border-[#E5E7EB] px-1.5 py-0.5 rounded text-[#333333]">{row.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-[#333333]">{programLabel(row.programId)}</span>
                    </td>
                    <td className="px-4 py-3 text-[#6B7280]">{generationLabel(row.generationId)}</td>
                    <td className="px-4 py-3 text-[#6B7280]">{levelLabel(row)}</td>
                    <td className="px-4 py-3 text-[#6B7280]">{periodLabel(row.periodId)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${SHIFT_BADGE[row.shift]}`}>
                        {SHIFT_LABELS[row.shift]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#333333]">
                      {/* No enrolled-student count exists on `Group` yet (no
                          Inscripciones<->academic_config link) — shows
                          capacity only, not "inscritos/capacidad" as the
                          original mock/spec example implied. */}
                      {row.maxCapacity}
                      <span className="ml-1 text-[11px] text-[#6B7280]">cupo{row.maxCapacity !== 1 ? 's' : ''}</span>
                    </td>
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <ActionBtn icon={<Eye size={15} />} tooltip="Ver detalle" onClick={() => navigate(`/grupos/form?mode=view&id=${row.id}`)} />
                        <ActionBtn icon={<Pencil size={15} />} tooltip="Editar" onClick={() => navigate(`/grupos/form?mode=edit&id=${row.id}`)} />
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        {/* Pagination — desktop */}
        <div className="px-4 py-3 border-t border-[#E5E7EB] flex items-center justify-between">
          <span className="text-[12px] text-[#6B7280]">
            {displayedTotal === 0 ? 'Sin registros' : `Mostrando ${displayedStartRow}–${displayedEndRow} de ${displayedTotal}`}
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
              <p className="text-[13px] font-medium">Cargando grupos...</p>
            </div>
          </div>
        ) : displayedGroups.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-16 text-center">
            <div className="flex flex-col items-center gap-3 text-[#6B7280]">
              <Users2 size={36} className="text-[#E5E7EB]" />
              <p className="text-[13px] font-medium">No se encontraron grupos</p>
              <p className="text-[12px]">
                {loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'}
              </p>
            </div>
          </div>
        ) : (
          displayedGroups.map(row => (
            <div key={row.id} className="bg-white border border-[#E5E7EB] rounded-lg p-4">
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
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${SHIFT_BADGE[row.shift]}`}>
                  {SHIFT_LABELS[row.shift]}
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
            </div>
          ))
        )}

        {/* Pagination — mobile (always shown, mirrors desktop footer's "Sin registros" when empty) */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <p className="text-[12px] text-[#6B7280]">
            {displayedTotal === 0 ? 'Sin registros' : `Mostrando ${displayedStartRow}–${displayedEndRow} de ${displayedTotal}`}
          </p>
          {displayedTotal > 0 && (
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
          )}
        </div>
      </div>
    </div>
  )
}
