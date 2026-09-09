import { useEffect, useRef, useState } from 'react'
import { ArrowRightCircle, Eye, Pencil, Plus as PlusIcon, Loader2 } from 'lucide-react'
import { Toast, ConfirmModal } from '@app/core/components/ui'
import { useNavigate } from 'react-router'
import { usePendingToast } from '@app/core/infra/hooks'
import { apiGet, apiPatch, apiPost } from '@app/core/infra/apiClient'
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

type PeriodStatus = 'CONFIGURATION' | 'ENROLLMENT' | 'ACTIVE' | 'CLOSED'
type PeriodType = 'CUATRIMESTRAL' | 'SEMESTRAL' | 'BIMESTRAL'

interface PeriodListItem {
  id: string
  name: string
  year: number
  periodNumber: number
  type: PeriodType
  startDate: string
  endDate: string
  enrollmentStart: string
  enrollmentEnd: string
  status: PeriodStatus
}

interface PeriodsPageResponse {
  items: PeriodListItem[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

const STATUS_LABELS: Record<PeriodStatus, string> = {
  CONFIGURATION: 'En Configuración',
  ENROLLMENT: 'En Inscripciones',
  ACTIVE: 'Activo',
  CLOSED: 'Cerrado',
}

const STATUS_BADGE_MAP: Record<PeriodStatus, BadgeStyle> = {
  CONFIGURATION: { label: STATUS_LABELS.CONFIGURATION, className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  ENROLLMENT: { label: STATUS_LABELS.ENROLLMENT, className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  ACTIVE: { label: STATUS_LABELS.ACTIVE, className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  CLOSED: { label: STATUS_LABELS.CLOSED, className: 'bg-gray-100 text-gray-600 border border-gray-200' },
}

const TYPE_LABELS: Record<PeriodType, string> = {
  CUATRIMESTRAL: 'Cuatrimestral',
  SEMESTRAL: 'Semestral',
  BIMESTRAL: 'Bimestral',
}

// The academic period lifecycle is strictly sequential and forward-only —
// CONFIGURATION -> ENROLLMENT -> ACTIVE -> CLOSED, no skips, no going back,
// no re-sending the same status (PO-confirmed 2026-07-20, see
// docs/plans/2026-07-20-periodos-wiring.md). There is exactly ONE valid next
// status from any given current status, so — unlike Division/Program/
// Classification's ACTIVE/INACTIVE toggle — the row action is a single
// contextual button, not a switch. CLOSED is deliberately absent as a key:
// it's terminal, so no row in that status renders an action at all.
const NEXT_STATUS_ACTION: Partial<Record<PeriodStatus, {
  next: PeriodStatus
  label: string
  confirmTitle: string
  confirmMessage: string
}>> = {
  CONFIGURATION: {
    next: 'ENROLLMENT',
    label: 'Abrir Inscripciones',
    confirmTitle: 'Abrir Inscripciones',
    confirmMessage: 'El periodo pasará a inscripciones abiertas. ¿Deseas continuar?',
  },
  ENROLLMENT: {
    next: 'ACTIVE',
    label: 'Activar Periodo',
    confirmTitle: 'Activar Periodo',
    confirmMessage: 'El periodo pasará a estado activo y podrán asignarse grupos. ¿Deseas continuar?',
  },
  ACTIVE: {
    next: 'CLOSED',
    label: 'Cerrar Periodo',
    confirmTitle: 'Cerrar Periodo',
    confirmMessage: 'Al cerrar el periodo ya no podrá editarse ni asignarse nuevos grupos. ¿Deseas continuar?',
  },
}

// Backend returns dates as ISO `YYYY-MM-DD` strings (LocalDate). Formatting
// via string-split instead of `new Date(iso)` avoids the classic UTC-parse
// timezone shift that can display the wrong day depending on the browser's
// local offset.
function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PeriodosList() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [periods, setPeriods] = useState<PeriodListItem[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [confirmTarget, setConfirmTarget] = useState<PeriodListItem | null>(null)
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const perPage = 20

  // Debounce free-text search — the fetch effect below only reacts to
  // `debouncedSearch`, not every keystroke of `search` (mirrors ClasificacionesList.tsx).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // `POST /periods/advance-by-date` replays the backend's date-threshold walk
  // on demand, so this list opens with fresh statuses instead of waiting for
  // the daily 00:05 `AdvanceAcademicPeriodStatusJob`. Non-blocking and
  // idempotent, fired once per component mount: if it fails, the daily job is
  // the fallback and the list still loads (the count is not shown).
  const advanceByDatePromiseRef = useRef<Promise<void> | null>(null)
  useEffect(() => {
    if (!advanceByDatePromiseRef.current) {
      advanceByDatePromiseRef.current = apiPost<{ advanced: number }>('/periods/advance-by-date')
        .then(() => undefined)
        .catch(() => undefined)
    }
  }, [])

  function fetchPeriods() {
    return apiGet<PeriodsPageResponse>('/periods', {
      status: statusFilter || undefined,
      search: debouncedSearch || undefined,
      page: page - 1,
      size: perPage,
    })
  }

  useEffect(() => {
    let cancelled = false
    setLoadStatus('loading')
    setErrorMsg('')
    const load = async () => {
      // The very first fetch waits for the on-demand advance so the rows
      // reflect any status transitions triggered by elapsed dates. Later runs
      // (filters/pagination) find the promise already resolved, so they only
      // pay a microtask, and the advance is not repeated per page change.
      await advanceByDatePromiseRef.current
      if (cancelled) return
      try {
        const data = await fetchPeriods()
        if (cancelled) return
        setPeriods(data.items)
        setTotalElements(data.totalElements)
        setTotalPages(data.totalPages)
        setLoadStatus('idle')
      } catch (err) {
        if (cancelled) return
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 401) {
          setErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        } else if (apiErr.status === 403) {
          setErrorMsg('No tienes permiso para consultar periodos académicos.')
        } else {
          setErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      }
    }
    void load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, debouncedSearch, page])

  async function handleConfirmAdvance() {
    if (!confirmTarget) return
    const action = NEXT_STATUS_ACTION[confirmTarget.status]
    if (!action) { setConfirmTarget(null); return }
    setAdvancingId(confirmTarget.id)
    setConfirmTarget(null)
    try {
      await apiPatch<void>(`/periods/${confirmTarget.id}/status`, { status: action.next })
      // Refetch-after-transition keeps pagination metadata correct without
      // duplicating the PATCH response's shape locally (mirrors
      // DivisionesList.tsx's toggle-then-refetch pattern).
      const data = await fetchPeriods()
      setPeriods(data.items)
      setTotalElements(data.totalElements)
      setTotalPages(data.totalPages)
      setToast(`El periodo ahora está "${STATUS_LABELS[action.next]}".`)
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 403) {
        setToast('No tienes permiso para cambiar el estado de este periodo.')
      } else if (apiErr.status === 404) {
        setToast('El periodo ya no existe. Actualiza la lista.')
      } else if (apiErr.status === 400) {
        setToast(apiErr.message ?? 'La transición de estado no es válida.')
      } else {
        setToast('No se pudo actualizar el estado. Intenta de nuevo.')
      }
    } finally {
      setAdvancingId(null)
    }
  }

  const emptyHint = loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'

  const columns: ColumnDef<PeriodListItem>[] = [
    {
      key: 'period',
      header: 'Periodo',
      type: 'name',
      value: row => row.name,
      sub: row => `Año ${row.year} · Periodo ${row.periodNumber}`,
    },
    { key: 'startDate', header: 'Inicio', type: 'muted', value: row => formatIsoDate(row.startDate), className: 'w-24' },
    { key: 'endDate', header: 'Fin', type: 'muted', value: row => formatIsoDate(row.endDate), className: 'w-24' },
    { key: 'type', header: 'Tipo', value: row => TYPE_LABELS[row.type], className: 'w-28' },
    { key: 'status', header: 'Estado', type: 'badge', badge: STATUS_BADGE_MAP, className: 'w-32' },
  ]

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {confirmTarget && NEXT_STATUS_ACTION[confirmTarget.status] && (
        <ConfirmModal
          title={NEXT_STATUS_ACTION[confirmTarget.status]!.confirmTitle}
          message={NEXT_STATUS_ACTION[confirmTarget.status]!.confirmMessage}
          confirmLabel={NEXT_STATUS_ACTION[confirmTarget.status]!.label}
          onConfirm={handleConfirmAdvance}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Periodos Académicos' },
        ]}
      />

      <PageHeader
        title="Periodos Académicos"
        subtitle="Gestiona los periodos académicos del sistema."
        actions={[{ label: 'Registrar Periodo', icon: <PlusIcon />, onClick: () => navigate('/periodos/new') }]}
      />

      {loadStatus === 'error' && errorMsg && <ErrorBanner message={errorMsg} />}

      <FilterBar>
         <FilterSelect
          value={statusFilter}
          onChange={v => { setStatusFilter(v); setPage(1) }}
          allLabel="Todos los estados"
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <SearchInput
          value={search}
          onChange={v => { setSearch(v); setPage(1) }}
          placeholder="Buscar periodo…"
        />
       
        <ResultCount count={totalElements} />
      </FilterBar>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        status={loadStatus}
        items={periods}
        keyFor={row => row.id}
        loadingLabel="Cargando periodos..."
        emptyTitle="No se encontraron periodos"
        emptyHint={emptyHint}
        footer={<Pagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} />}
        actions={{
          view: row => navigate(`/periodos/form?mode=view&id=${row.id}`),
          edit: row => navigate(`/periodos/form?mode=edit&id=${row.id}`),
          editDisabled: row => row.status === 'CLOSED',
          extraFirst: row => {
            const action = NEXT_STATUS_ACTION[row.status]
            if (!action) return null
            return (
              <button
                onClick={() => setConfirmTarget(row)}
                disabled={advancingId === row.id}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-[#009574] border border-[#009574]/30 rounded-md hover:bg-[#e6f5f1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {advancingId === row.id ? <Loader2 size={13} className="animate-spin" /> : <ArrowRightCircle size={13} />}
                {action.label}
              </button>
            )
          },
        }}
      />

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <MobileCards
        status={loadStatus}
        items={periods}
        keyFor={row => row.id}
        renderItem={row => {
          const isClosed = row.status === 'CLOSED'
          const action = NEXT_STATUS_ACTION[row.status]
          return (
            <>
              {/* Top row: clave + estado */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono text-[12px] font-semibold bg-[#F8F9FA] border border-[#E5E7EB] px-2 py-0.5 rounded text-[#333333]">
                  Año {row.year} · P{row.periodNumber}
                </span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE_MAP[row.status].className}`}>
                  {STATUS_BADGE_MAP[row.status].label}
                </span>
              </div>
              {/* Name */}
              <p className="text-[13px] font-medium text-[#333333] mb-1 leading-snug">{row.name}</p>
              {/* Dates + type */}
              <p className="text-[12px] text-[#6B7280] mb-3">
                {formatIsoDate(row.startDate)} – {formatIsoDate(row.endDate)} · {TYPE_LABELS[row.type]}
              </p>
              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#E5E7EB]">
                {action && (
                  <button
                    onClick={() => setConfirmTarget(row)}
                    disabled={advancingId === row.id}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {advancingId === row.id ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightCircle size={14} />}
                    {action.label}
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/periodos/form?mode=view&id=${row.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-[#6B7280] border border-[#E5E7EB] rounded-md hover:bg-[#F8F9FA] transition-colors"
                  >
                    <Eye size={14} />Ver
                  </button>
                  <button
                    onClick={() => navigate(`/periodos/form?mode=edit&id=${row.id}`)}
                    disabled={isClosed}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-[#009574] border border-[#009574]/30 rounded-md hover:bg-[#e6f5f1] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Pencil size={14} />Editar
                  </button>
                </div>
              </div>
            </>
          )
        }}
        loadingLabel="Cargando periodos..."
        emptyTitle="No se encontraron periodos"
        emptyHint={emptyHint}
        pagination={<MobilePagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} />}
      />
    </PageContainer>
  )
}