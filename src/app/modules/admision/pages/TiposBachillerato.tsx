import { useEffect, useState } from 'react'
import { Pencil, Plus, AlertCircle } from 'lucide-react'
import { Toast, Switch } from '@app/core/components/ui'
import { Button, TextField } from '@app/core/components/form'
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
} from '@app/core/components/list'
import { apiGet, apiPost, apiPut, apiPatch } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'

// ─── Types ───────────────────────────────────────────────────────────────────
// `HighSchoolType` (bounded context `admission`). CRUD espejo de
// `CanalesDifusion` sobre `/high-school-types` (GET paginado, POST 201, PUT,
// PATCH status). El select "Tipo de Bachillerato" del formulario de registro
// lee `GET /high-school-types/options` (solo ACTIVE, público); para que
// aparezca una opción basta registrarla aquí como Activo.

type TypeStatus = 'ACTIVE' | 'INACTIVE'

interface TypeListItem {
  id: string
  name: string
  status: TypeStatus
}

interface TypesPageResponse {
  items: TypeListItem[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

// ─── Inline registro/edición modal ──────────────────────────────────────────
// Misma convención que `CanalesDifusion`: modal inline de un solo campo.

function TypeModal({ mode, initialName, onSave, onCancel, saving, errorMsg }: {
  mode: 'create' | 'edit'
  initialName: string
  onSave: (name: string) => void
  onCancel: () => void
  saving: boolean
  errorMsg: string
}) {
  const [name, setName] = useState(initialName)

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={saving ? undefined : onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-md mx-4 p-6">
        <h3 className="text-[15px] font-semibold text-[#333333] mb-4">
          {mode === 'create' ? 'Registrar Tipo de Bachillerato' : 'Editar Tipo de Bachillerato'}
        </h3>

        <TextField
          label="Nombre del Tipo"
          required
          autoFocus
          value={name}
          onChange={setName}
          disabled={saving}
          placeholder="ej. Bachillerato General"
          className="mb-4"
        />

        {errorMsg && (
          <div className="flex items-start gap-2 mb-4 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-[12px] text-red-700">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            {errorMsg}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => name.trim() && onSave(name.trim())} disabled={!name.trim() || saving} loading={saving}>
            Guardar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function TiposBachillerato() {
  const [types, setTypes] = useState<TypeListItem[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState('')
  const [modalTarget, setModalTarget] = useState<TypeListItem | 'new' | null>(null)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalErrorMsg, setModalErrorMsg] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const perPage = 20

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  function fetchTypes() {
    setLoadStatus('loading')
    setErrorMsg('')
    return apiGet<TypesPageResponse>('/high-school-types', {
      search: debouncedSearch || undefined,
      page: page - 1,
      size: perPage,
    })
      .then(data => {
        setTypes(data.items)
        setTotalElements(data.totalElements)
        setTotalPages(data.totalPages)
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 401) setErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        else if (apiErr.status === 403) setErrorMsg('No tienes permiso para consultar tipos de bachillerato.')
        else setErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
      })
  }

  useEffect(() => {
    fetchTypes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page])

  async function handleSave(name: string) {
    setModalSaving(true)
    setModalErrorMsg('')
    try {
      if (modalTarget === 'new') {
        await apiPost('/high-school-types', { name })
        setToast('Tipo de bachillerato registrado correctamente.')
      } else if (modalTarget) {
        await apiPut(`/high-school-types/${modalTarget.id}`, { name })
        setToast('Tipo de bachillerato actualizado correctamente.')
      }
      setModalTarget(null)
      await fetchTypes()
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 400) setModalErrorMsg(apiErr.message ?? 'Revisa los datos capturados.')
      else if (apiErr.status === 401) setModalErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
      else if (apiErr.status === 403) setModalErrorMsg('No tienes permiso para realizar esta acción.')
      else setModalErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
    } finally {
      setModalSaving(false)
    }
  }

  async function handleToggleStatus(type: TypeListItem) {
    const nextStatus: TypeStatus = type.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setTogglingId(type.id)
    try {
      await apiPatch<void>(`/high-school-types/${type.id}/status`, { status: nextStatus })
      await fetchTypes()
      setToast(nextStatus === 'ACTIVE' ? 'Tipo activado.' : 'Tipo desactivado.')
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      setToast(apiErr.status === 403
        ? 'No tienes permiso para cambiar el estado de este tipo.'
        : 'No se pudo actualizar el estado. Intenta de nuevo.')
    } finally {
      setTogglingId(null)
    }
  }

  const emptyHint = loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'

  const columns: ColumnDef<TypeListItem>[] = [
    { key: 'name', header: 'Tipo de Bachillerato', type: 'name' },
    { key: 'status', header: 'Estado', type: 'status', activeLabel: 'Activo', inactiveLabel: 'Inactivo', className: 'w-32' },
  ]

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {modalTarget !== null && (
        <TypeModal
          mode={modalTarget === 'new' ? 'create' : 'edit'}
          initialName={modalTarget === 'new' ? '' : modalTarget.name}
          onSave={handleSave}
          onCancel={() => { setModalTarget(null); setModalErrorMsg('') }}
          saving={modalSaving}
          errorMsg={modalErrorMsg}
        />
      )}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/admision' },
          { label: 'Admisión' },
          { label: 'Tipos de Bachillerato' },
        ]}
      />

      <PageHeader
        title="Tipos de Bachillerato"
        subtitle="Administra los tipos de bachillerato disponibles para el formulario de registro de aspirantes."
        actions={[{ label: 'Registrar Tipo', icon: <Plus size={15} />, onClick: () => setModalTarget('new') }]}
      />

      {loadStatus === 'error' && errorMsg && <ErrorBanner message={errorMsg} />}

      <FilterBar>
        <SearchInput
          value={search}
          onChange={v => { setSearch(v); setPage(1) }}
          placeholder="Buscar tipo de bachillerato..."
        />
        <ResultCount count={totalElements} />
      </FilterBar>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        status={loadStatus}
        items={types}
        keyFor={row => row.id}
        numbered
        rowNumberOffset={(page - 1) * perPage}
        loadingLabel="Cargando tipos de bachillerato..."
        emptyTitle="No se encontraron tipos de bachillerato"
        emptyHint={emptyHint}
        footer={<Pagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} />}
        actions={{ edit: row => setModalTarget(row) }}
        onToggleStatus={handleToggleStatus}
        togglingId={togglingId}
      />

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <MobileCards
        status={loadStatus}
        items={types}
        keyFor={row => row.id}
        renderItem={row => (
          <>
            {/* Top row: name + estado */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[13px] font-medium text-[#333333]">{row.name}</span>
              <div className="flex items-center gap-2">
                <Switch
                  checked={row.status === 'ACTIVE'}
                  disabled={togglingId === row.id}
                  onChange={() => handleToggleStatus(row)}
                />
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                  row.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                }`}>
                  {row.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB]">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setModalTarget(row)}>
                <Pencil size={14} />Editar
              </Button>
            </div>
          </>
        )}
        loadingLabel="Cargando tipos de bachillerato..."
        emptyTitle="No se encontraron tipos de bachillerato"
        emptyHint={emptyHint}
        pagination={<MobilePagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} />}
      />
    </PageContainer>
  )
}