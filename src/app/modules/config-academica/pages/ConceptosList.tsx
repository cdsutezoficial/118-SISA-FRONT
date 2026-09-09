import { useEffect, useState } from 'react'
import { Wallet, ClipboardList, Eye, Pencil, Plus as PlusIcon } from 'lucide-react'
import { Toast, Switch } from '@app/core/components/ui'
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
  type BadgeStyle,
} from '@app/core/components/list'

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

const TYPE_BADGE_MAP: Record<PaymentConceptType, BadgeStyle> = {
  ENROLLMENT: { label: TYPE_LABELS.ENROLLMENT, className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  REINSCRIPTION: { label: TYPE_LABELS.REINSCRIPTION, className: 'bg-purple-50 text-purple-700 border border-purple-200' },
  EXTRAORDINARY: { label: TYPE_LABELS.EXTRAORDINARY, className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  DOCUMENT: { label: TYPE_LABELS.DOCUMENT, className: 'bg-slate-50 text-slate-700 border border-slate-200' },
  OTHER: { label: TYPE_LABELS.OTHER, className: 'bg-gray-100 text-gray-600 border border-gray-200' },
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

  const emptyHint = loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'

  const columns: ColumnDef<PaymentConceptListItem>[] = [
    { key: 'name', header: 'Nombre', type: 'name' },
    { key: 'type', header: 'Tipo', type: 'badge', badge: TYPE_BADGE_MAP, className: 'w-32' },
    {
      key: 'isTuition',
      header: 'Cuota',
      className: 'w-28 text-center',
      cellClassName: 'text-center',
      render: row => (
        row.isTuition ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Wallet size={11} />Cuota
          </span>
        ) : null
      ),
    },
    { key: 'status', header: 'Estado', type: 'status', className: 'w-32' },
  ]

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/dashboard' },
          { label: 'Configuración Académica' },
          { label: 'Conceptos de Pago' },
        ]}
      />

      <PageHeader
        title="Conceptos de Pago"
        subtitle="Consulta y administra el catálogo de conceptos de pago."
        actions={[{ label: 'Registrar Concepto', icon: <PlusIcon />, onClick: () => navigate('/conceptos/new') }]}
      />

      {loadStatus === 'error' && errorMsg && <ErrorBanner message={errorMsg} />}

      <FilterBar>
        <FilterSelect
          value={statusFilter}
          onChange={v => { setStatusFilter(v as PaymentConceptStatus | ''); setPage(1) }}
          allLabel="Todos"
          options={[
            { value: 'ACTIVE', label: 'Activo' },
            { value: 'INACTIVE', label: 'Inactivo' },
          ]}
        />
        <SearchInput
          value={search}
          onChange={v => { setSearch(v); setPage(1) }}
          placeholder="Buscar por nombre de concepto..."
        />
        <ResultCount count={totalElements} />
      </FilterBar>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        status={loadStatus}
        items={concepts}
        keyFor={row => row.id}
        loadingLabel="Cargando conceptos..."
        emptyTitle="No se encontraron conceptos de pago"
        emptyHint={emptyHint}
        emptyIcon={<ClipboardList size={36} className="text-[#E5E7EB]" />}
        footer={<Pagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} />}
        actions={{
          view: row => navigate(`/conceptos/form?mode=view&id=${row.id}`),
          edit: row => navigate(`/conceptos/form?mode=edit&id=${row.id}`),
        }}
        onToggleStatus={handleToggleStatus}
        togglingId={togglingId}
      />

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <MobileCards
        status={loadStatus}
        items={concepts}
        keyFor={row => row.id}
        renderItem={row => (
          <>
            {/* Top row: tipo + estado */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE_MAP[row.type].className}`}>
                {TYPE_BADGE_MAP[row.type].label}
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
          </>
        )}
        loadingLabel="Cargando conceptos..."
        emptyTitle="No se encontraron conceptos de pago"
        emptyHint={emptyHint}
        emptyIcon={<ClipboardList size={36} className="text-[#E5E7EB]" />}
        pagination={<MobilePagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} />}
      />
    </PageContainer>
  )
}