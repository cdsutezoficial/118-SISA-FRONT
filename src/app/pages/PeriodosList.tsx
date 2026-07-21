import { useEffect, useState } from 'react'
import { ChevronRight, Search, Eye, Pencil, ArrowRightCircle, Plus, ChevronLeft, ChevronRight as ChevRight, Loader2, AlertCircle } from 'lucide-react'
import { Toast, ActionBtn, ConfirmModal } from '../shared/ui'
import { useNavigate } from 'react-router'
import { usePendingToast } from '../shared/hooks'
import { apiGet, apiPatch } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'

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

const STATUS_BADGE: Record<PeriodStatus, string> = {
  CONFIGURATION: 'bg-amber-50 text-amber-700 border border-amber-200',
  ENROLLMENT: 'bg-blue-50 text-blue-700 border border-blue-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  CLOSED: 'bg-gray-100 text-gray-600 border border-gray-200',
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
    fetchPeriods()
      .then(data => {
        if (cancelled) return
        setPeriods(data.items)
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
          setErrorMsg('No tienes permiso para consultar periodos académicos.')
        } else {
          setErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, debouncedSearch, page])

  const startRow = totalElements === 0 ? 0 : (page - 1) * perPage + 1
  const endRow = Math.min(page * perPage, totalElements)

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

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
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

      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Periodos Académicos</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">Periodos Académicos</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">Gestiona los periodos académicos del sistema.</p>
        </div>
        <button
          onClick={() => navigate('/periodos/new')}
          className="flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors sm:whitespace-nowrap sm:self-start"
        >
          <Plus size={15} />Registrar Periodo
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
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative flex-1 sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar periodo…"
            className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="w-full sm:w-auto px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
        >
          <option value="">Todos los estados</option>
          <option value="CONFIGURATION">En Configuración</option>
          <option value="ENROLLMENT">En Inscripciones</option>
          <option value="ACTIVE">Activo</option>
          <option value="CLOSED">Cerrado</option>
        </select>
        <span className="text-[12px] text-[#6B7280] hidden sm:inline">
          {totalElements} resultado{totalElements !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <div className="hidden md:block bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Periodo</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Inicio</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Fin</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Tipo</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loadStatus === 'loading' ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <Loader2 size={24} className="animate-spin text-[#009574]" />
                    <p className="text-[13px] font-medium">Cargando periodos...</p>
                  </div>
                </td>
              </tr>
            ) : periods.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <Search size={36} className="text-[#E5E7EB]" />
                    <p className="text-[13px] font-medium">No se encontraron periodos</p>
                    <p className="text-[12px]">
                      {loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              periods.map(row => {
                const isClosed = row.status === 'CLOSED'
                const action = NEXT_STATUS_ACTION[row.status]
                return (
                  <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#333333]">{row.name}</p>
                      <p className="text-[11px] text-[#6B7280] font-mono">Año {row.year} · Periodo {row.periodNumber}</p>
                    </td>
                    <td className="px-4 py-3 text-[#6B7280]">{formatIsoDate(row.startDate)}</td>
                    <td className="px-4 py-3 text-[#6B7280]">{formatIsoDate(row.endDate)}</td>
                    <td className="px-4 py-3 text-[#333333]">{TYPE_LABELS[row.type]}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[row.status]}`}>{STATUS_LABELS[row.status]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {action && (
                          <button
                            onClick={() => setConfirmTarget(row)}
                            disabled={advancingId === row.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-[#009574] border border-[#009574]/30 rounded-md hover:bg-[#e6f5f1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            {advancingId === row.id ? <Loader2 size={13} className="animate-spin" /> : <ArrowRightCircle size={13} />}
                            {action.label}
                          </button>
                        )}
                        <ActionBtn icon={<Eye size={15} />} tooltip="Ver" onClick={() => navigate(`/periodos/form?mode=view&id=${row.id}`)} />
                        <ActionBtn icon={<Pencil size={15} />} tooltip="Editar" disabled={isClosed} onClick={() => navigate(`/periodos/form?mode=edit&id=${row.id}`)} />
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
            {totalElements === 0 ? 'Sin registros' : `Mostrando ${startRow}–${endRow} de ${totalElements}`}
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
              <p className="text-[13px] font-medium">Cargando periodos...</p>
            </div>
          </div>
        ) : periods.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-16 text-center">
            <div className="flex flex-col items-center gap-3 text-[#6B7280]">
              <Search size={36} className="text-[#E5E7EB]" />
              <p className="text-[13px] font-medium">No se encontraron periodos</p>
              <p className="text-[12px]">Intenta ajustar los filtros de búsqueda</p>
            </div>
          </div>
        ) : (
          periods.map(row => {
            const isClosed = row.status === 'CLOSED'
            const action = NEXT_STATUS_ACTION[row.status]
            return (
              <div key={row.id} className="bg-white border border-[#E5E7EB] rounded-lg p-4">
                {/* Top row: clave + estado */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-[12px] font-semibold bg-[#F8F9FA] border border-[#E5E7EB] px-2 py-0.5 rounded text-[#333333]">
                    Año {row.year} · P{row.periodNumber}
                  </span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[row.status]}`}>
                    {STATUS_LABELS[row.status]}
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
              </div>
            )
          })
        )}

        {/* Pagination — mobile */}
        {totalElements > 0 && (
          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-[12px] text-[#6B7280]">
              Mostrando {startRow}–{endRow} de {totalElements}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[#333333] disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronLeft size={13} />Anterior
              </button>
              <span className="px-3 py-1.5 text-[12px] font-semibold text-[#009574] border border-[#009574] rounded-md bg-white tabular-nums">
                {page} / {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}
                className="flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[#333333] disabled:opacity-40 disabled:cursor-not-allowed">
                Siguiente<ChevRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
