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
import { useFieldValidation } from '@app/core/validation/useFieldValidation'
import { required, maxLength, noControlChars, normalizeText } from '@app/core/validation/fieldRules'

// ─── Types ───────────────────────────────────────────────────────────────────
// `OutreachChannel` (bounded context `admission`, backend closed 2026-07-28 —
// `118-SISA-BACK/docs/plans/2026-07-28-outreach-channel.md`). No
// "candidatosRegistrados" field exists on the backend response (would need
// `Candidate`, which doesn't exist yet) — the mock's count column is dropped
// rather than fabricated. Status is a simple idempotent toggle
// (ACTIVE/INACTIVE) — wired as a bidirectional `Switch`, replacing the mock's
// `ConfirmModal`, same convention as Generaciones/Grupos/Conceptos de Pago.

type ChannelStatus = 'ACTIVE' | 'INACTIVE'

interface ChannelListItem {
  id: string
  name: string
  status: ChannelStatus
}

interface ChannelsPageResponse {
  items: ChannelListItem[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

// ─── Validación (Fase 9) ─────────────────────────────────────────────────────
// El `code` del 409 de nombre duplicado. Se ramifica sobre el código y no sobre
// el texto del mensaje a propósito: el javadoc de `ErrorResponse` lo dice
// explícitamente, porque el copy se reescribe sin aviso. Espejo de
// `GlobalExceptionHandler#CODE_OUTREACH_CHANNEL_NAME_DUPLICATE`.
const CHANNEL_NAME_DUPLICATE = 'OUTREACH_CHANNEL_NAME_DUPLICATE'

// `name` es un texto libre: NO lleva `normalize`, porque recortar en cada
// pulsación impediría escribir el espacio entre palabras. Se usa
// `validateOn: normalizeText`, que sólo limpia el valor al evaluar las reglas —
// el input conserva lo que el usuario teclea y el cursor no salta — y el
// payload se arma con el mismo `normalizeText`.
//
// Sin regla de letras ni de signos, a diferencia de `DivisionesForm.name`: aquí
// el nombre es de libre elección de la institución ("Radio UTEZ 102.5",
// "TikTok", "1a opción"), y el backend tampoco las aplica. Lo único que se
// rechaza son los caracteres de control, que no se leen en pantalla y rompen la
// búsqueda del listado.
const CHANNEL_SCHEMA = {
  name: {
    validateOn: normalizeText,
    rules: [required('nombre del canal'), maxLength(150, 'nombre del canal'), noControlChars('nombre del canal')],
  },
} as const

const CHANNEL_INITIAL_VALUES = { name: '' }

/**
 * Resultado de `onSave`: el modal decide a qué campo pegar el error, así que el
 * padre sólo lo reporta y no guarda estado de error de campo. `null` = guardado
 * bien (el padre ya cerró el modal).
 */
type SaveOutcome = { field: 'name'; message: string } | null

// ─── Inline registro/edición modal ──────────────────────────────────────────
// Kept as an inline modal (not a separate route) — the mock already used this
// pattern and the catalog is simple enough (one field) that a full-page form
// isn't warranted.

function CanalModal({ mode, initialName, onSave, onCancel, saving, errorMsg }: {
  mode: 'create' | 'edit'
  initialName: string
  onSave: (name: string) => Promise<SaveOutcome>
  onCancel: () => void
  saving: boolean
  errorMsg: string
}) {
  const { values, fieldError, handleChange, handleBlur, setFieldValue, setFieldError, validate, isValid } =
    useFieldValidation(CHANNEL_SCHEMA, CHANNEL_INITIAL_VALUES)

  // El modal se monta de cero cada vez que se abre, así que `initialName` sólo
  // hay que sembrarlo una vez. Va por `setFieldValue` y no por `handleChange` a
  // propósito: sembrar no debe marcar el campo como tocado, o el modal abriría
  // en rojo cuando se edita un canal con un nombre que ya es válido.
  useEffect(() => {
    setFieldValue('name', initialName)
  }, [initialName, setFieldValue])

  async function handleSubmit() {
    // Valida antes de pedir nada: un 400 por nombre vacío o con caracteres de
    // control es un viaje de ida y vuelta que el formulario ya puede evitar.
    if (!validate()) return
    const outcome = await onSave(normalizeText(values.name))
    // El 409 lo inyecta el hook, que además lo borra solo en cuanto el usuario
    // vuelve a teclear, y marca el campo como tocado para que se vea sin que el
    // usuario haya tocado el input.
    if (outcome) setFieldError(outcome.field, outcome.message)
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={saving ? undefined : onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-md mx-4 p-6">
        <h3 className="text-[15px] font-semibold text-[#333333] mb-4">
          {mode === 'create' ? 'Registrar Canal' : 'Editar Canal'}
        </h3>

        <TextField
          label="Nombre del Canal"
          required
          autoFocus
          value={values.name}
          onChange={handleChange('name')}
          onBlur={handleBlur('name')}
          disabled={saving}
          error={fieldError('name')}
          maxLength={150}
          placeholder="ej. Redes Sociales"
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
          {/* `isValid` sin tocar nada: vacío el modal abre con el botón apagado,
              como antes, y los errores de las reglas salen al teclear o al
              pulsar, ya inyectados en el campo. */}
          <Button onClick={handleSubmit} disabled={!isValid || saving} loading={saving}>
            Guardar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CanalesDifusion() {
  const [channels, setChannels] = useState<ChannelListItem[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState('')
  const [modalTarget, setModalTarget] = useState<ChannelListItem | 'new' | null>(null)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalErrorMsg, setModalErrorMsg] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const perPage = 20

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  function fetchChannels() {
    setLoadStatus('loading')
    setErrorMsg('')
    return apiGet<ChannelsPageResponse>('/outreach-channels', {
      search: debouncedSearch || undefined,
      page: page - 1,
      size: perPage,
    })
      .then(data => {
        setChannels(data.items)
        setTotalElements(data.totalElements)
        setTotalPages(data.totalPages)
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        setLoadStatus('error')
        const apiErr = err as Partial<ApiError>
        if (apiErr.status === 401) setErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
        else if (apiErr.status === 403) setErrorMsg('No tienes permiso para consultar canales de difusión.')
        else setErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
      })
  }

  useEffect(() => {
    fetchChannels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page])

  // Devuelve el error de campo en vez de ponerlo en el banner: un nombre
  // duplicado es un error de ese campo, y el modal lo muestra bajo el input
  // dejando lo tecleado a la vista. Todo lo demás sigue siendo banner, porque no
  // pertenece a ningún campo en concreto. El modal se queda abierto en ambos
  // casos — sólo se cierra en el `try`.
  async function handleSave(name: string): Promise<SaveOutcome> {
    setModalSaving(true)
    setModalErrorMsg('')
    try {
      if (modalTarget === 'new') {
        await apiPost('/outreach-channels', { name })
        setToast('Canal registrado correctamente.')
      } else if (modalTarget) {
        await apiPut(`/outreach-channels/${modalTarget.id}`, { name })
        setToast('Canal actualizado correctamente.')
      }
      setModalTarget(null)
      await fetchChannels()
      return null
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 409 && apiErr.code === CHANNEL_NAME_DUPLICATE) {
        // El error va al campo y al banner del modal, con el mismo mensaje.
        const message = apiErr.message ?? 'El nombre del canal ya está en uso.'
        setModalErrorMsg(message)
        return { field: 'name', message }
      }
      if (apiErr.status === 400) setModalErrorMsg(apiErr.message ?? 'Revisa los datos capturados.')
      else if (apiErr.status === 401) setModalErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.')
      else if (apiErr.status === 403) setModalErrorMsg('No tienes permiso para realizar esta acción.')
      else setModalErrorMsg('No se pudo conectar con el servidor. Intenta de nuevo más tarde.')
      return null
    } finally {
      setModalSaving(false)
    }
  }

  async function handleToggleStatus(channel: ChannelListItem) {
    const nextStatus: ChannelStatus = channel.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setTogglingId(channel.id)
    try {
      await apiPatch<void>(`/outreach-channels/${channel.id}/status`, { status: nextStatus })
      await fetchChannels()
      setToast(nextStatus === 'ACTIVE' ? 'Canal activado.' : 'Canal desactivado.')
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      setToast(apiErr.status === 403
        ? 'No tienes permiso para cambiar el estado de este canal.'
        : 'No se pudo actualizar el estado. Intenta de nuevo.')
    } finally {
      setTogglingId(null)
    }
  }

  const emptyHint = loadStatus === 'error' ? 'Vuelve a intentarlo en unos momentos.' : 'Intenta ajustar los filtros de búsqueda'

  const columns: ColumnDef<ChannelListItem>[] = [
    { key: 'name', header: 'Nombre del Canal', type: 'name' },
    { key: 'status', header: 'Estado', type: 'status', activeLabel: 'Activo', inactiveLabel: 'Inactivo', className: 'w-32' },
  ]

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {modalTarget !== null && (
        <CanalModal
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
          { label: 'Canales de Difusión' },
        ]}
      />

      <PageHeader
        title="Canales de Difusión"
        subtitle="Administra los canales por los que los aspirantes se enteran de la universidad."
        actions={[{ label: 'Registrar Canal', icon: <Plus size={15} />, onClick: () => setModalTarget('new') }]}
      />

      {loadStatus === 'error' && errorMsg && <ErrorBanner message={errorMsg} />}

      <FilterBar>
        <SearchInput
          value={search}
          onChange={v => { setSearch(v); setPage(1) }}
          placeholder="Buscar canal..."
        />
        <ResultCount count={totalElements} />
      </FilterBar>

      {/* ── Desktop table (md+) ─────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        status={loadStatus}
        items={channels}
        keyFor={row => row.id}
        numbered
        rowNumberOffset={(page - 1) * perPage}
        loadingLabel="Cargando canales..."
        emptyTitle="No se encontraron canales de difusión"
        emptyHint={emptyHint}
        footer={<Pagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} />}
        actions={{ edit: row => setModalTarget(row) }}
        onToggleStatus={handleToggleStatus}
        togglingId={togglingId}
      />

      {/* ── Mobile cards (< md) ─────────────────────────────────────────────── */}
      <MobileCards
        status={loadStatus}
        items={channels}
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
        loadingLabel="Cargando canales..."
        emptyTitle="No se encontraron canales de difusión"
        emptyHint={emptyHint}
        pagination={<MobilePagination page={page} totalPages={totalPages} totalElements={totalElements} perPage={perPage} onPageChange={setPage} />}
      />
    </PageContainer>
  )
}
