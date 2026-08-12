import { useEffect, useState } from 'react'
import {
  ChevronRight, Search, Eye, Pencil, Plus, ChevronLeft, ChevronRight as ChevRight,
  Loader2, AlertCircle, Wallet, ClipboardList,
} from 'lucide-react'
import { Toast, ActionBtn, Switch } from '../shared/ui'
import { useNavigate } from 'react-router'
import { usePendingToast } from '../shared/hooks'
import { apiGet, apiPatch } from '../shared/apiClient'
import type { ApiError } from '../shared/apiClient'

// ─── Types ─────────────────────────────────────────────────────────────────────
// `PaymentConcept` lives in `academic_config` (not the real Finance module —
// that one needs `Student` and is out of scope). This is Fase 3 of 4: only the
// catalog (`ConceptosList`/`ConceptosForm`) is wired here — tarifas
// (`PaymentRate`) come in Fase 4 with their own screen. Status is a simple
// two-way toggle (ACTIVE/INACTIVE) via `PATCH /payment-concepts/{id}/status`,
// same pattern as Generaciones/Divisiones/Grupos — there is NO physical
// delete for this aggregate (`ChangePaymentConceptStatusUseCase`).

type PaymentConceptType = 'ENROLLMENT' | 'REINSCRIPTION' | 'EXTRAORDINARY' | 'DOCUMENT' | 'OTHER'
type PaymentConceptStatus = 'ACTIVE' | 'INACTIVE'

const TYPE_LABELS: Record<PaymentConceptType, string> = {
  ENROLLMENT: 'Inscripción',
  REINSCRIPTION: 'Reinscripción',
  EXTRAORDINARY: 'Extraordinario',
  DOCUMENT: 'Documento',
  OTHER: 'Otro',
}

const TYPE_BADGE: Record<PaymentConceptType, string> = {
  ENROLLMENT: 'bg-blue-50 text-blue-700 border border-blue-200',
  REINSCRIPTION: 'bg-purple-50 text-purple-700 border border-purple-200',
  EXTRAORDINARY: 'bg-amber-50 text-amber-700 border border-amber-200',
  DOCUMENT: 'bg-slate-50 text-slate-700 border border-slate-200',
  OTHER: 'bg-gray-100 text-gray-600 border border-gray-200',
}

interface PaymentConceptListItem {
  id: string
  name: string
  type: PaymentConceptType
  isTuition: boolean
  isStandalone: boolean
  status: PaymentConceptStatus
}

interface PaymentConceptsPageResponse {
  items: PaymentConceptListItem[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ConceptosList() {
  const navigate = useNavigate()
  const pendingToast = usePendingToast()
  const [toast, setToast] = useState(pendingToast ?? '')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<PaymentConceptStatus | ''>('')
  const [page, setPage] = useState(1)
  const [concepts, setConcepts] = useState<PaymentConceptListItem[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const perPage = 20

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
    apiGet<PaymentConceptsPageResponse>('/payment-concepts', {
      status: statusFilter || undefined,
      search: debouncedSearch || undefined,
      page: page - 1,
      size: perPage,
    })
      .then(data => {
        if (cancelled) return
        setConcepts(data.items)
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
          setErrorMsg('No tienes permiso para consultar conceptos de pago.')
        } else {
          setErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
        }
      })
    return () => { cancelled = true }
  }, [statusFilter, debouncedSearch, page])

  const startRow = totalElements === 0 ? 0 : (page - 1) * perPage + 1
  const endRow = Math.min(page * perPage, totalElements)

  async function handleToggleStatus(concept: PaymentConceptListItem) {
    const nextStatus: PaymentConceptStatus = concept.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setTogglingId(concept.id)
    try {
      await apiPatch<void>(`/payment-concepts/${concept.id}/status`, { status: nextStatus })
      // Refetch-after-toggle keeps pagination metadata correct without
      // duplicating the PATCH response's (narrower) shape locally.
      const data = await apiGet<PaymentConceptsPageResponse>('/payment-concepts', {
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        page: page - 1,
        size: perPage,
      })
      setConcepts(data.items)
      setTotalElements(data.totalElements)
      setTotalPages(data.totalPages)
      setToast(nextStatus === 'ACTIVE' ? 'Concepto activado.' : 'Concepto desactivado.')
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      setToast(apiErr.status === 403
        ? 'No tienes permiso para cambiar el estado de este concepto.'
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
        <span className="text-[#333333] font-medium">Conceptos de Pago</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#333333]">Conceptos de Pago</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">Consulta y administra el catálogo de conceptos de pago.</p>
        </div>
        <button
          onClick={() => navigate('/conceptos/new')}
          className="flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors sm:whitespace-nowrap sm:self-start"
        >
          <Plus size={15} />Registrar Concepto
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
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as PaymentConceptStatus | ''); setPage(1) }}
          className="w-full sm:w-40 px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
        >
          <option value="">Todos</option>
          <option value="ACTIVE">Activo</option>
          <option value="INACTIVE">Inactivo</option>
        </select>
        <div className="relative flex-1 sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por nombre de concepto..."
            className="w-full pl-9 pr-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#009574]/30 focus:border-[#009574]"
          />
        </div>
        <span className="text-[12px] text-[#6B7280] hidden sm:inline">
          {totalElements} resultado{totalElements !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <div className="hidden md:block bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Nombre</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Tipo</th>
              <th className="text-center px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Cuota</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-32">Estado</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {loadStatus === 'loading' ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <Loader2 size={24} className="animate-spin text-[#009574]" />
                    <p className="text-[13px] font-medium">Cargando conceptos...</p>
                  </div>
                </td>
              </tr>
            ) : concepts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <ClipboardList size={36} className="text-[#E5E7EB]" />
                    <p className="text-[13px] font-medium">No se encontraron conceptos de pago</p>
                    <p className="text-[12px]">
                      {loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              concepts.map(row => (
                <tr key={row.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F8F9FA] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#333333]">{row.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[row.type]}`}>
                      {TYPE_LABELS[row.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.isTuition && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Wallet size={11} />Cuota
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
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
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <ActionBtn icon={<Eye size={15} />} tooltip="Ver" onClick={() => navigate(`/conceptos/form?mode=view&id=${row.id}`)} />
                      <ActionBtn icon={<Pencil size={15} />} tooltip="Editar" onClick={() => navigate(`/conceptos/form?mode=edit&id=${row.id}`)} />
                    </div>
                  </td>
                </tr>
              ))
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
              <p className="text-[13px] font-medium">Cargando conceptos...</p>
            </div>
          </div>
        ) : concepts.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-16 text-center">
            <div className="flex flex-col items-center gap-3 text-[#6B7280]">
              <ClipboardList size={36} className="text-[#E5E7EB]" />
              <p className="text-[13px] font-medium">No se encontraron conceptos de pago</p>
              <p className="text-[12px]">Intenta ajustar los filtros de búsqueda</p>
            </div>
          </div>
        ) : (
          concepts.map(row => (
            <div key={row.id} className="bg-white border border-[#E5E7EB] rounded-lg p-4">
              {/* Top row: tipo + estado */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[row.type]}`}>
                  {TYPE_LABELS[row.type]}
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
              {/* Nombre */}
              <p className="text-[13px] font-medium text-[#333333] mb-1 leading-snug">{row.name}</p>
              {/* Cuota flag */}
              {row.isTuition && (
                <p className="mb-3">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Wallet size={11} />Cuota cuatrimestral
                  </span>
                </p>
              )}
              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB]">
                <button
                  onClick={() => navigate(`/conceptos/form?mode=view&id=${row.id}`)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium text-[#6B7280] border border-[#E5E7EB] rounded-md hover:bg-[#F8F9FA] transition-colors"
                >
                  <Eye size={14} />Ver
                </button>
                <button
                  onClick={() => navigate(`/conceptos/form?mode=edit&id=${row.id}`)}
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
