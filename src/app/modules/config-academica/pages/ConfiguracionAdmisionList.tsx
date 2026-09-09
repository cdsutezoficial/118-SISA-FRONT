import { useEffect, useState } from 'react'
import { Pencil, Ticket, Plus as PlusIcon } from 'lucide-react'
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
// `ProgramAdmissionConfig` (RF-ADM-001) controls which programs are offered in
// a given admission process: quota, sale window, and destination generation.
// Unlike `Generation`/`Group`, `programId` is a REAL submitted field on the
// backend request (not resolved server-side from another id) — see
// `CreateProgramAdmissionConfigRequest`. `status` (OPEN/CLOSED) is a simple
// two-way toggle, same convention as Generaciones/Grupos/Conceptos.
// `selectionStatus` is out of scope for this screen (plan §"Fuera de alcance").

type ConfigStatus = 'OPEN' | 'CLOSED'

interface ConfigListItem {
  id: string
  programId: string
  periodId: string
  targetGenerationId: string
  isOffered: boolean
  maxCandidates: number
  opensAt: string
  closesAt: string
  status: ConfigStatus
}

interface ConfigsPageResponse {
  items: ConfigListItem[]
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

interface PeriodSummary {
  id: string
  name: string
}

interface PeriodsPageResponse {
  items: PeriodSummary[]
}

interface GenerationSummary {
  id: string
  code: string
}

interface GenerationsPageResponse {
  items: GenerationSummary[]
}

// ─── Formatting helpers ─────────────────────────────────────────────────────
// `opensAt`/`closesAt` arrive as ISO-8601 `Instant` strings (e.g.
// "2029-06-01T00:00:00Z") — the first date+time field wired in the frontend
// (everything else so far is `LocalDate`-only). Rendered in the browser's
// local time as dd/MM/yyyy HH:mm, matching the Pantalla 24 example
// ("15/06/2026 09:00 – 30/08/2026 23:59").
function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ConfiguracionAdmisionList() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [programFilter, setProgramFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<ConfigStatus | ''>('')
  const [page, setPage] = useState(1)
  const [configs, setConfigs] = useState<ConfigListItem[]>([])
  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [periods, setPeriods] = useState<PeriodSummary[]>([])
  const [generations, setGenerations] = useState<GenerationSummary[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const perPage = 20

  const programOptions: SelectOption[] = programs.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` }))

  // Load programs/periods/generations once — used only to resolve ids to
  // display labels in the table (mirrors `programLabel()` in
  // GeneracionesList.tsx). Not re-fetched on filter/page changes.
  useEffect(() => {
    apiGet<ProgramsPageResponse>('/programs', { size: 100 })
      .then(data => setPrograms(data.items))
      .catch(() => {/* non-critical — filter/labels just won't populate */})
    apiGet<PeriodsPageResponse>('/periods', { size: 100 })
      .then(data => setPeriods(data.items))
      .catch(() => {/* non-critical — labels just won't populate */})
    apiGet<GenerationsPageResponse>('/generations', { size: 200 })
      .then(data => setGenerations(data.items))
      .catch(() => {/* non-critical — labels just won't populate */})
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoadStatus('loading')
    setErrorMsg('')
    apiGet<ConfigsPageResponse>('/program-admission-configs', {
      status: statusFilter || undefined,
      programId: programFilter || undefined,
      page: page - 1,
      size: perPage,
    })
      .then(data => {
        if (cancelled) return
        setConfigs(data.items)
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
          setErrorMsg('No tienes permiso para consultar la configuración de admisión.')
        } else {
          setErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
  }, [statusFilter, programFilter, page])

  function programLabel(programId: string): string {
    const p = programs.find(p => p.id === programId)
    return p ? `${p.code} — ${p.name}` : '—'
  }

  function periodLabel(periodId: string): string {
    const per = periods.find(per => per.id === periodId)
    return per ? per.name : '—'
  }

  function generationLabel(generationId: string): string {
    const gen = generations.find(g => g.id === generationId)
    return gen ? gen.code : '—'
  }

  async function handleToggleStatus(config: ConfigListItem) {
    const nextStatus: ConfigStatus = config.status === 'OPEN' ? 'CLOSED' : 'OPEN'
    setTogglingId(config.id)
    try {
      await apiPatch<void>(`/program-admission-configs/${config.id}/status`, { status: nextStatus })
      // Refetch-after-toggle keeps pagination metadata correct without
      // duplicating the PATCH response's (narrower) shape locally.
      const data = await apiGet<ConfigsPageResponse>('/program-admission-configs', {
        status: statusFilter || undefined,
        programId: programFilter || undefined,
        page: page - 1,
        size: perPage,
      })
      setConfigs(data.items)
      setTotalElements(data.totalElements)
      setTotalPages(data.totalPages)
      setToast(nextStatus === 'OPEN' ? 'Configuración abierta.' : 'Configuración cerrada.')
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      setToast(apiErr.status === 403
        ? 'No tienes permiso para cambiar el estado de esta configuración.'
        : 'No se pudo actualizar el estado. Intenta de nuevo.')
    } finally {
      setTogglingId(null)
    }
  }

  const emptyHint = loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'

  const columns: ColumnDef<ConfigListItem>[] = [
    { key: 'programId', header: 'Programa Educativo', type: 'name', value: row => programLabel(row.programId) },
    { key: 'periodId', header: 'Periodo Destino', type: 'muted', value: row => periodLabel(row.periodId) },
    { key: 'targetGenerationId', header: 'Generación Destino', type: 'code', value: row => generationLabel(row.targetGenerationId), className: 'w-24' },
    { key: 'maxCandidates', header: 'Cupo Máximo', type: 'count', className: 'w-24', cellClassName: 'tabular-nums' },
    { key: 'saleWindow', header: 'Ventana de Venta', type: 'muted', value: row => `${formatDateTime(row.opensAt)} – ${formatDateTime(row.closesAt)}`, className: 'whitespace-nowrap' },
    { key: 'status', header: 'Estado', type: 'status', activeLabel: 'Abierto', inactiveLabel: 'Cerrado', className: 'w-28' },
  ]

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Configuración de Admisión' },
        ]}
      />

      <PageHeader
        title="Configuración de Admisión"
        subtitle="Configura qué programas se ofertan en cada proceso de admisión, su cupo y ventana de venta de fichas."
        actions={[{ label: 'Configurar Programa', icon: <PlusIcon />, onClick: () => navigate('/configuracion-admision/new') }]}
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
          onChange={v => { setStatusFilter(v as ConfigStatus | ''); setPage(1) }}
          allLabel="Todos"
          options={[
            { value: 'OPEN', label: 'Abierto' },
            { value: 'CLOSED', label: 'Cerrado' },
          ]}
        />
        <ResultCount count={totalElements} />
      </FilterBar>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <DataTable
        numbered
        rowNumberOffset={(page - 1) * perPage}
        columns={columns}
        status={loadStatus}
        items={configs}
        keyFor={row => row.id}
        loadingLabel="Cargando configuración de admisión..."
        emptyTitle="No se encontraron configuraciones"
        emptyHint={emptyHint}
        emptyIcon={<Ticket size={36} className="text-[#E5E7EB]" />}
        footer={<Pagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} />}
        actions={{ edit: row => navigate(`/configuracion-admision/form?mode=edit&id=${row.id}`) }}
        activeValue="OPEN"
        onToggleStatus={handleToggleStatus}
        togglingId={togglingId}
      />

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <MobileCards
        status={loadStatus}
        items={configs}
        keyFor={row => row.id}
        renderItem={row => (
          <>
            {/* Top row: generación + estado */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-mono text-[12px] font-semibold bg-[#F8F9FA] border border-[#E5E7EB] px-2 py-0.5 rounded text-[#333333]">
                {generationLabel(row.targetGenerationId)}
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
            {/* Program */}
            <p className="text-[13px] font-medium text-[#333333] mb-1 leading-snug">{programLabel(row.programId)}</p>
            {/* Periodo + cupo */}
            <p className="text-[12px] text-[#6B7280] mb-1">
              {periodLabel(row.periodId)} · Cupo {row.maxCandidates}
            </p>
            {/* Ventana de venta */}
            <p className="text-[12px] text-[#6B7280] mb-3">
              {formatDateTime(row.opensAt)} – {formatDateTime(row.closesAt)}
            </p>
            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB]">
              <button
                onClick={() => navigate(`/configuracion-admision/form?mode=edit&id=${row.id}`)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-[#009574] border border-[#009574]/30 rounded-md hover:bg-[#e6f5f1] transition-colors"
              >
                <Pencil size={14} />Editar
              </button>
            </div>
          </>
        )}
        loadingLabel="Cargando configuración de admisión..."
        emptyTitle="No se encontraron configuraciones"
        emptyHint={emptyHint}
        emptyIcon={<Ticket size={36} className="text-[#E5E7EB]" />}
        pagination={<MobilePagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} />}
      />
    </PageContainer>
  )
}