import { useEffect, useState } from 'react'
import {
  ChevronRight, Pencil, Plus, ChevronLeft, ChevronRight as ChevRight,
  Loader2, AlertCircle, Ticket,
} from 'lucide-react'
import { Toast, ActionBtn, Switch, SearchSelectField } from '../shared/ui'
import type { SelectOption } from '../shared/ui'
import { useNavigate } from 'react-router'
import { usePendingToast } from '../shared/hooks'
import { apiGet, apiPatch } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'

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

  const startRow = totalElements === 0 ? 0 : (page - 1) * perPage + 1
  const endRow = Math.min(page * perPage, totalElements)

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

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Configuración Académica</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Configuración de Admisión</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">Configuración de Admisión</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">Configura qué programas se ofertan en cada proceso de admisión, su cupo y ventana de venta de fichas.</p>
        </div>
        <button
          onClick={() => navigate('/configuracion-admision/new')}
          className="flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors sm:whitespace-nowrap sm:self-start"
        >
          <Plus size={15} />Configurar Programa
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
        <div className="w-full sm:w-72">
          <SearchSelectField
            options={programOptions}
            value={programFilter}
            onChange={v => { setProgramFilter(v); setPage(1) }}
            placeholder="Todos los programas"
            searchPlaceholder="Buscar programa…"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as ConfigStatus | ''); setPage(1) }}
          className="w-full sm:w-40 px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
        >
          <option value="">Todos</option>
          <option value="OPEN">Abierto</option>
          <option value="CLOSED">Cerrado</option>
        </select>
        <span className="text-[12px] text-[#6B7280] hidden sm:inline sm:ml-auto">
          {totalElements} resultado{totalElements !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <div className="hidden md:block bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-10">#</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Programa Educativo</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Periodo Destino</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Generación Destino</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Cupo Máximo</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Ventana de Venta</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Estado</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {loadStatus === 'loading' ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <Loader2 size={24} className="animate-spin text-[#009574]" />
                    <p className="text-[13px] font-medium">Cargando configuración de admisión...</p>
                  </div>
                </td>
              </tr>
            ) : configs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <Ticket size={36} className="text-[#E5E7EB]" />
                    <p className="text-[13px] font-medium">No se encontraron configuraciones</p>
                    <p className="text-[12px]">
                      {loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              configs.map((row, i) => {
                const rowNum = (page - 1) * perPage + i + 1
                return (
                  <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                    <td className="px-4 py-3 text-[#6B7280] font-medium">{rowNum}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-[#333333]">{programLabel(row.programId)}</span>
                    </td>
                    <td className="px-4 py-3 text-[#6B7280]">{periodLabel(row.periodId)}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] font-semibold bg-[#F8F9FA] border border-[#E5E7EB] px-1.5 py-0.5 rounded text-[#333333]">{generationLabel(row.targetGenerationId)}</span>
                    </td>
                    <td className="px-4 py-3 text-[#6B7280] tabular-nums">{row.maxCandidates}</td>
                    <td className="px-4 py-3 text-[#6B7280] whitespace-nowrap">{formatDateTime(row.opensAt)} – {formatDateTime(row.closesAt)}</td>
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
                        <ActionBtn icon={<Pencil size={15} />} tooltip="Editar" onClick={() => navigate(`/configuracion-admision/form?mode=edit&id=${row.id}`)} />
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
              <p className="text-[13px] font-medium">Cargando configuración de admisión...</p>
            </div>
          </div>
        ) : configs.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-16 text-center">
            <div className="flex flex-col items-center gap-3 text-[#6B7280]">
              <Ticket size={36} className="text-[#E5E7EB]" />
              <p className="text-[13px] font-medium">No se encontraron configuraciones</p>
              <p className="text-[12px]">Intenta ajustar los filtros de búsqueda</p>
            </div>
          </div>
        ) : (
          configs.map(row => (
            <div key={row.id} className="bg-white border border-[#E5E7EB] rounded-lg p-4">
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
            </div>
          ))
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
