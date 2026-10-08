import { useState, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Plus as PlusIcon, CreditCard, Eye as EyeIcon } from 'lucide-react'
import { Toast, ActionBtn } from '@app/core/components/ui'
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
  BadgePill,
  type ColumnDef,
  type BadgeStyle,
} from '@app/core/components/list'
import { apiGet, getApiErrorMessage } from '@app/core/infra/apiClient'
import { programLabel } from '@app/core/infra/programLabel'
import { usePendingToast } from '@app/core/infra/hooks'
import {
  STATUS_META,
  type CandidateStatus,
  type CandidateListPage,
  type CandidateListRow,
} from '../data/types'

// ─── Estado filter (corrected per `03-admision.md` — Corrección Pantalla 3) ───
// Uses the same 6 domain statuses + "Todos"; option labels/badges are sourced
// from STATUS_META so the filter and the row badges never drift out of sync.

// `PAYMENT_EXPIRED` sits right after `REGISTERED`, which is where it belongs in
// time: it is the same ficha, lapsed unpaid. Before it, an expired ficha looked
// identical to a live one and could be filtered into the same "Registrado"
// bucket; after it, it would be misfiled with the academic rejections.
const STATUS_ORDER: CandidateStatus[] = [
  'REGISTERED',
  'PAYMENT_EXPIRED',
  'PAID',
  'EXAM_TAKEN',
  'ACCEPTED',
  'REJECTED',
  'ENROLLED',
]
const estadoOptions = STATUS_ORDER.map(s => ({ value: s, label: STATUS_META[s].label }))
const statusBadgeMap: Record<string, BadgeStyle> = Object.fromEntries(
  STATUS_ORDER.map(s => [s, { label: STATUS_META[s].label, className: STATUS_META[s].badgeClass }]),
)

// ─── Reference-catalog shapes (mirror `GET /programs` + `GET /periods`) ───────

interface ProgramSummary {
  id: string
  name: string
  code: string
  modality?: string
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

/** ISO-8601 `Instant` → `dd/MM/yyyy` (browser-local). */
function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

// ─── Screen ────────────────────────────────────────────────────────────────────

/** Botón etiquetado del footer de la tarjeta móvil (mismo estilo que UsuariosList). */
function CardActionButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-[#009574] border border-[#009574]/30 rounded-md hover:bg-[#e6f5f1] transition-colors"
    >
      {icon}{label}
    </button>
  )
}

export default function CandidatosList() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [candidates, setCandidates] = useState<CandidateListRow[]>([])
  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [periods, setPeriods] = useState<PeriodSummary[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [programaFilter, setProgramaFilter] = useState('')
  const [periodoFilter, setPeriodoFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  const programaOptions = programs.map(p => ({ value: p.id, label: programLabel(p) }))
  const periodoOptions = periods.map(p => ({ value: p.id, label: p.name }))

  // Load programs/periods once — programs/periods populate the filter dropdowns.
  useEffect(() => {
    apiGet<ProgramsPageResponse>('/programs', { size: 100 })
      .then(data => setPrograms(data.items))
      .catch(() => {/* non-critical — filter just won't populate */})
    apiGet<PeriodsPageResponse>('/periods', { size: 100 })
      .then(data => setPeriods(data.items))
      .catch(() => {/* non-critical — filter just won't populate */})
  }, [])

  // Preselect the active period (per Pantalla 3: the list follows the active
  // admission process). Runs once; doesn't fight a manual clear afterwards.
  useEffect(() => {
    let cancelled = false
    apiGet<PeriodsPageResponse>('/periods', { status: 'ACTIVE', size: 1 })
      .then(data => {
        if (cancelled || !data.items[0]) return
        setPeriodoFilter(data.items[0].id)
        setPage(1)
      })
      .catch(() => {/* non-critical — filter simply starts empty */})
    return () => { cancelled = true }
  }, [])

  // Debounce free-text search.
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    setLoadStatus('loading')
    setErrorMsg('')
    apiGet<CandidateListPage>('/candidates', {
      status: estadoFilter || undefined,
      programId: programaFilter || undefined,
      periodId: periodoFilter || undefined,
      search: debouncedSearch.trim() || undefined,
      page: page - 1,
      size: perPage,
    })
      .then(data => {
        if (cancelled) return
        setCandidates(data.items)
        setTotalElements(data.totalElements)
        setTotalPages(data.totalPages)
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        setErrorMsg(getApiErrorMessage(err, 'No tienes permiso para consultar los candidatos.'))
      })
    return () => { cancelled = true }
  }, [estadoFilter, programaFilter, periodoFilter, debouncedSearch, page, perPage])

  const emptyHint = loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'

  const columns: ColumnDef<CandidateListRow>[] = [
    { key: 'folio', header: 'Folio', type: 'code', className: 'w-32' },
    { key: 'fullName', header: 'Nombre Completo', type: 'name' },
    { key: 'programName', header: 'Carrera Solicitada', type: 'text' },
    { key: 'status', header: 'Estado', type: 'badge', badge: statusBadgeMap, className: 'w-28' },
    { key: 'registeredAt', header: 'Fecha de Registro', type: 'muted', value: row => formatDate(row.registeredAt), className: 'w-24' },
  ]

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Admisión', to: '/admision' },
          { label: 'Candidatos' },
        ]}
      />

      <PageHeader
        title="Candidatos"
        subtitle="Seguimiento de todos los aspirantes del periodo de admisión activo."
        actions={[{ label: 'Registrar Candidato', icon: <PlusIcon />, onClick: () => navigate('/admision/candidatos/registrar') }]}
      />

      {loadStatus === 'error' && errorMsg && <ErrorBanner message={errorMsg} />}

      <FilterBar>
        <FilterSelect
          value={programaFilter}
          onChange={v => { setProgramaFilter(v); setPage(1) }}
          allLabel="Todas las carreras"
          className="w-full sm:w-64"
          options={programaOptions}
        />
        <FilterSelect
          value={estadoFilter}
          onChange={v => { setEstadoFilter(v); setPage(1) }}
          allLabel="Todos los estados"
          options={estadoOptions}
        />
        <FilterSelect
          value={periodoFilter}
          onChange={v => { setPeriodoFilter(v); setPage(1) }}
          allLabel="Todos los periodos"
          options={periodoOptions}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre, CURP o folio..."
        />
        <ResultCount count={totalElements} />
      </FilterBar>

      {/* Tabla desktop (md+) */}
      <DataTable
        columns={columns}
        status={loadStatus}
        items={candidates}
        keyFor={row => row.id}
        numbered
        rowNumberOffset={(page - 1) * perPage}
        loadingLabel="Cargando candidatos..."
        emptyTitle="No se encontraron candidatos"
        emptyHint={emptyHint}
        footer={<Pagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} onPerPageChange={n => { setPerPage(n); setPage(1) }} />}
        actions={{
          view: row => navigate(`/admision/candidatos/detalle?id=${row.id}`),
          viewTooltip: 'Ver detalle',
          extra: row => (
            <>
              {row.status === 'REGISTERED' && (
                <ActionBtn
                  icon={<CreditCard size={15} />}
                  tooltip="Confirmar Pago Ficha"
                  onClick={() => navigate(`/admision/candidatos/pago-ficha?id=${row.id}`)}
                />
              )}
            </>
          ),
        }}
      />

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <MobileCards
        status={loadStatus}
        items={candidates}
        keyFor={row => row.id}
        renderItem={row => (
          <>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-medium text-[13px] text-[#333333]">{row.fullName}</span>
              <BadgePill value={row.status} map={statusBadgeMap} />
            </div>
            <p className="font-mono text-[11px] text-[#6B7280] mb-1">Folio: {row.folio}</p>
            <p className="text-[12px] text-[#6B7280] mb-1">{row.programName}</p>
            <p className="text-[12px] text-[#6B7280] mb-3">{formatDate(row.registeredAt)}</p>
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E5E7EB]">
              <CardActionButton
                icon={<EyeIcon size={13} />}
                label="Ver detalle"
                onClick={() => navigate(`/admision/candidatos/detalle?id=${row.id}`)}
              />
              {row.status === 'REGISTERED' && (
                <CardActionButton icon={<CreditCard size={13} />} label="Pago Ficha" onClick={() => navigate(`/admision/candidatos/pago-ficha?id=${row.id}`)} />
              )}
            </div>
          </>
        )}
        loadingLabel="Cargando candidatos..."
        emptyTitle="No se encontraron candidatos"
        emptyHint={emptyHint}
        pagination={<MobilePagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} onPerPageChange={n => { setPerPage(n); setPage(1) }} />}
      />
    </PageContainer>
  )
}
