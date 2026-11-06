import { useCallback, useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { PageContainer, Breadcrumb, PageHeader, ErrorBanner, LoadingState, EmptyState, Pagination } from '@app/core/components/list'
import { Button, TextField } from '@app/core/components/form'
import { apiGet, getApiErrorMessage } from '@app/core/infra/apiClient'

/**
 * Log de auditoría (RF-AUD-003). Solo el Administrador lo consulta (RN-AUD-004)
 * y es de solo lectura (RN-AUD-001): no hay acciones sobre las entradas.
 *
 * Cada fila es un campo que cambió: quién, cuándo, sobre qué, antes y después.
 * Hoy lo alimenta la edición de la ficha del candidato (F4).
 */

interface AuditEntry {
  id: string
  occurredAt: string
  actorId: string | null
  actorName: string | null
  action: string
  entityType: string
  entityId: string | null
  field: string | null
  oldValue: string | null
  newValue: string | null
}

interface AuditPage {
  items: AuditEntry[]
  total: number
  page: number
  size: number
}

const ACCIONES: Record<string, string> = {
  CANDIDATE_FICHA_EDITED: 'Edición de ficha',
}

const ENTIDADES: Record<string, string> = {
  CANDIDATE: 'Candidato',
}

const POR_PAGINA = 50

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

/** `yyyy-mm-dd` local → instante ISO al inicio de ese día (o del siguiente, para el límite exclusivo). */
const inicioDelDia = (fecha: string, diasExtra = 0) => {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d + diasExtra).toISOString()
}

export default function BitacoraAuditoria() {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [entidadId, setEntidadId] = useState('')
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', entidadId: '' })
  const [pagina, setPagina] = useState(1)
  const [resultado, setResultado] = useState<AuditPage | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      setResultado(await apiGet<AuditPage>('/audit-log', {
        from: filtros.desde ? inicioDelDia(filtros.desde) : undefined,
        to: filtros.hasta ? inicioDelDia(filtros.hasta, 1) : undefined,
        entityId: filtros.entidadId.trim() || undefined,
        page: pagina - 1,
        size: POR_PAGINA,
      }))
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo consultar el log de auditoría.'))
    } finally {
      setCargando(false)
    }
  }, [filtros, pagina])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const buscar = () => {
    setPagina(1)
    setFiltros({ desde, hasta, entidadId })
  }

  const items = resultado?.items ?? []
  const total = resultado?.total ?? 0

  return (
    <PageContainer>
      <Breadcrumb items={[{ label: 'Administración' }, { label: 'Log de auditoría' }]} />
      <PageHeader title="Log de auditoría" subtitle="Quién cambió qué y cuándo. Solo lectura." />

      <div className="grid grid-cols-12 items-end gap-4 rounded-lg border border-[#E5E7EB] bg-white px-5 py-4">
        <TextField label="Desde" type="date" value={desde} onChange={setDesde} className="col-span-12 sm:col-span-3" />
        <TextField label="Hasta" type="date" value={hasta} onChange={setHasta} className="col-span-12 sm:col-span-3" />
        <TextField
          label="Id de la entidad (opcional)"
          value={entidadId}
          onChange={setEntidadId}
          placeholder="Id del candidato"
          className="col-span-12 sm:col-span-4"
        />
        <div className="col-span-12 sm:col-span-2">
          <Button onClick={buscar} className="w-full">Buscar</Button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {cargando ? (
        <LoadingState label="Consultando el log…" />
      ) : items.length === 0 ? (
        <EmptyState
          title="Sin movimientos"
          hint="No hay cambios registrados con esos filtros."
          icon={<History size={28} className="text-[#9CA3AF]" />}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#E5E7EB] bg-white">
          <table className="min-w-full text-[13px]">
            <thead className="bg-[#F9FAFB] text-left text-[11px] uppercase tracking-wide text-[#6B7280]">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Acción</th>
                <th className="px-4 py-3">Entidad</th>
                <th className="px-4 py-3">Campo</th>
                <th className="px-4 py-3">Antes</th>
                <th className="px-4 py-3">Después</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {items.map(e => (
                <tr key={e.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 text-[#6B7280]">{fechaHora(e.occurredAt)}</td>
                  <td className="px-4 py-2.5 text-[#333333]">{e.actorName ?? (e.actorId ? e.actorId : 'Sistema')}</td>
                  <td className="px-4 py-2.5 text-[#333333]">{ACCIONES[e.action] ?? e.action}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-[#333333]">{ENTIDADES[e.entityType] ?? e.entityType}</span>
                    {e.entityId && <span className="block font-mono text-[11px] text-[#9CA3AF]">{e.entityId}</span>}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-[#333333]">{e.field ?? '—'}</td>
                  <td className="max-w-[220px] break-words px-4 py-2.5 text-[#991B1B]">{e.oldValue ?? '—'}</td>
                  <td className="max-w-[220px] break-words px-4 py-2.5 text-[#065F46]">{e.newValue ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={pagina}
            totalPages={Math.max(1, Math.ceil(total / POR_PAGINA))}
            totalElements={total}
            perPage={POR_PAGINA}
            onPageChange={setPagina}
          />
        </div>
      )}
    </PageContainer>
  )
}
