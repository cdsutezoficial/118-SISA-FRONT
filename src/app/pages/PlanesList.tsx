import { useEffect, useState } from 'react'
import {
  ChevronRight, Search, Eye, Pencil, ToggleLeft, Plus,
  ChevronLeft, ChevronRight as ChevRight, X, Loader2, AlertCircle, BookOpen, Layers,
} from 'lucide-react'
import { Toast, ActionBtn } from '../shared/ui'
import { useNavigate } from 'react-router'
import { usePendingToast } from '../shared/hooks'
import { apiGet } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'

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

// ─── Status badge ──────────────────────────────────────────────────────────────

function EstadoBadge({ status }: { status: PlanStatus }) {
  return status === 'ACTIVE' ? (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Activo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Inactivo
    </span>
  )
}

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

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Planes de Estudio</span>
      </nav>

      {/* Title + action */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-1">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">Planes de Estudio</h1>
          <p className="text-[14px] text-[#6B7280] mt-1 max-w-xl">
            Consulta y administra los planes de estudio de cada programa educativo. Cada programa puede tener múltiples planes vigentes simultáneamente.
          </p>
        </div>
        <button
          onClick={() => navigate('/planes/new')}
          className="flex items-center justify-center gap-2 bg-[#009574] hover:bg-[#007a5e] text-white text-[13px] font-semibold px-4 py-2 rounded-md transition-colors sm:whitespace-nowrap sm:self-start"
        >
          <Plus size={15} />Registrar Plan de Estudios
        </button>
      </div>

      <hr className="border-[#E5E7EB] my-5 sm:my-6" />

      {/* Error banner */}
      {loadStatus === 'error' && errorMsg && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mb-4">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {errorMsg}
        </div>
      )}

      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-5">
        <select
          value={programFilter}
          onChange={e => { setProgramFilter(e.target.value); setPage(1) }}
          className="w-full sm:w-64 px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
        >
          <option value="">Todos los programas</option>
          {programs.map(p => (
            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as PlanStatus | ''); setPage(1) }}
          className="w-full sm:w-36 px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activo</option>
          <option value="INACTIVE">Inactivo</option>
        </select>
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <input type="text" placeholder="Buscar por versión o clave de titulación..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-2 text-[13px] bg-white border border-[#E5E7EB] rounded-md text-[#333333] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574] transition" />
        </div>
        {hasFilters && (
          <button onClick={() => { setProgramFilter(''); setStatusFilter(''); setSearch(''); setPage(1) }}
            className="flex items-center gap-1 text-[12px] text-[#6B7280] hover:text-[#333333] transition-colors">
            <X size={13} />Limpiar filtros
          </button>
        )}
      </div>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <div className="hidden md:block bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-10">#</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Versión</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Vigencia</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Programa Educativo</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32 text-center">Vigente desde</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24 text-center">Niveles</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Estado</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loadStatus === 'loading' ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <Loader2 size={24} className="animate-spin text-[#009574]" />
                    <p className="text-[13px] font-medium">Cargando planes de estudio...</p>
                  </div>
                </td>
              </tr>
            ) : plans.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <BookOpen size={36} className="text-[#E5E7EB]" />
                    <p className="text-[13px] font-medium">No se encontraron planes de estudio</p>
                    <p className="text-[12px]">Intenta ajustar los filtros de búsqueda</p>
                  </div>
                </td>
              </tr>
            ) : (
              plans.map((row, i) => {
                const rowNum = (page - 1) * perPage + i + 1
                return (
                  <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                    <td className="px-4 py-3 text-[#6B7280] font-medium">{rowNum}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[12px] font-semibold bg-[#F8F9FA] border border-[#E5E7EB] px-2 py-0.5 rounded text-[#333333]">
                        {row.version}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#6B7280]">{row.validityPeriod}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-[#333333]">{programLabel(row.programId)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-[13px] text-[#333333] tabular-nums">{formatDate(row.effectiveFrom)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5 text-[12px] text-[#333333]">
                        <Layers size={13} className="text-[#6B7280]" />
                        <span className="font-semibold tabular-nums">{row.totalLevels}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        <ActionBtn icon={<Eye size={15} />} tooltip="Ver detalle" onClick={() => navigate(`/planes/detalle?id=${row.id}`)} />
                        <ActionBtn icon={<Pencil size={15} />} tooltip="Editar" onClick={() => navigate(`/planes/form?mode=edit&id=${row.id}`)} />
                        <ActionBtn icon={<ToggleLeft size={15} />} tooltip="Cambiar estado" danger />
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* Pagination footer — desktop */}
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
      </div>

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {loadStatus === 'loading' ? (
          <div className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-16 text-center">
            <div className="flex flex-col items-center gap-3 text-[#6B7280]">
              <Loader2 size={24} className="animate-spin text-[#009574]" />
              <p className="text-[13px] font-medium">Cargando planes de estudio...</p>
            </div>
          </div>
        ) : plans.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-16 text-center">
            <div className="flex flex-col items-center gap-3 text-[#6B7280]">
              <BookOpen size={36} className="text-[#E5E7EB]" />
              <p className="text-[13px] font-medium">No se encontraron planes de estudio</p>
              <p className="text-[12px]">Intenta ajustar los filtros de búsqueda</p>
            </div>
          </div>
        ) : (
          plans.map(row => (
            <div key={row.id} className="bg-white border border-[#E5E7EB] rounded-lg p-4">
              {/* Top row: versión + badge */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-mono text-[12px] font-semibold bg-[#F8F9FA] border border-[#E5E7EB] px-2 py-0.5 rounded text-[#333333]">
                  {row.version}
                </span>
                <EstadoBadge status={row.status} />
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
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-red-500 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                >
                  <ToggleLeft size={14} />Estado
                </button>
              </div>
            </div>
          ))
        )}

        {/* Pagination footer — mobile */}
        {totalElements > 0 && (
          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-[12px] text-[#6B7280]">
              Mostrando {startRow}–{endRow} de {totalElements} registros
            </p>
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
          </div>
        )}
      </div>
    </div>
  )
}
