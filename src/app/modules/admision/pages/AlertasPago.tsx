import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { PageContainer, Breadcrumb, PageHeader, ErrorBanner, LoadingState, EmptyState } from '@app/core/components/list'
import { Tabs, Modal, Toast } from '@app/core/components/ui'
import { Button, TextAreaField } from '@app/core/components/form'
import { apiGet, apiPatch, getApiErrorMessage } from '@app/core/infra/apiClient'
import { useRole } from '@app/core/infra/RoleContext'

/**
 * Alertas de pago para Finanzas (E4).
 *
 * Pagos que una persona tiene que revisar a mano. Las abre el back:
 * - AUTHORIZED_NOT_CAPTURED: el banco autorizó el monto y no lo cobra desde
 *   hace más de 3 días. La conciliación lo encuentra cada noche, pero no abre
 *   una alerta nueva cada vez.
 * - PAID_WITHOUT_QUOTA: el banco cobró después de que venció el apartado y la
 *   carrera ya estaba llena. El dinero quedó como saldo a favor.
 * - OVERPAYMENT: un cobro que no liquidó ningún cargo (segundo cobro o cargo
 *   cancelado). También quedó como saldo a favor.
 *
 * Al abrirse una alerta se manda correo a Finanzas; esta pantalla es el
 * registro. "Marcar como revisada" guarda quién, cuándo y una nota.
 */

type AlertType = 'AUTHORIZED_NOT_CAPTURED' | 'PAID_WITHOUT_QUOTA' | 'OVERPAYMENT'
type AlertStatus = 'OPEN' | 'RESOLVED'

interface FinanceAlert {
  id: string
  type: AlertType
  status: AlertStatus
  candidateId: string | null
  paymentId: string | null
  orderId: string
  folio: string | null
  amount: number | null
  detail: string | null
  createdAt: string
  lastSeenAt: string
  resolvedAt: string | null
  resolvedBy: string | null
  resolutionNote: string | null
}

const TIPO: Record<AlertType, { label: string; className: string }> = {
  AUTHORIZED_NOT_CAPTURED: { label: 'Autorizado sin cobrar', className: 'bg-[#FEF3C7] text-[#92400E]' },
  PAID_WITHOUT_QUOTA: { label: 'Pago sin cupo', className: 'bg-[#FEE2E2] text-[#991B1B]' },
  OVERPAYMENT: { label: 'Pago sin cargo', className: 'bg-[#E0F2FE] text-[#075985]' },
}

const PESTANAS = [
  { key: 'OPEN', label: 'Por revisar' },
  { key: 'RESOLVED', label: 'Revisadas' },
  { key: 'ALL', label: 'Todas' },
]

const fechaHora = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

const mxn = (n: number | null) =>
  n == null ? '—' : `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function AlertasPago() {
  const { hasPermission } = useRole()
  const puedeResolver = hasPermission('FINANCE_ALERTS_RESOLVE')

  const [pestana, setPestana] = useState('OPEN')
  const [alertas, setAlertas] = useState<FinanceAlert[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [resolviendo, setResolviendo] = useState<FinanceAlert | null>(null)
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const query = pestana === 'ALL' ? '' : `?status=${pestana}`
      setAlertas(await apiGet<FinanceAlert[]>(`/finance/alerts${query}`))
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar las alertas de pago.'))
    } finally {
      setCargando(false)
    }
  }, [pestana])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const marcarRevisada = async () => {
    if (!resolviendo) return
    setGuardando(true)
    try {
      await apiPatch<FinanceAlert>(`/finance/alerts/${resolviendo.id}/resolve`, { note: nota.trim() || null })
      setResolviendo(null)
      setNota('')
      setToast('La alerta quedó marcada como revisada.')
      await cargar()
    } catch (err) {
      setToast(getApiErrorMessage(err, 'No se pudo marcar la alerta como revisada.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <Breadcrumb items={[{ label: 'Finanzas' }, { label: 'Alertas de pago' }]} />
      <PageHeader
        title="Alertas de pago"
        subtitle="Pagos que el sistema no pudo resolver solo y necesitan revisión de Finanzas."
      />

      <Tabs tabs={PESTANAS} active={pestana} onSelect={setPestana} />

      {error && <ErrorBanner message={error} />}

      {cargando ? (
        <LoadingState label="Cargando alertas…" />
      ) : alertas.length === 0 ? (
        <EmptyState
          title={pestana === 'OPEN' ? 'No hay alertas por revisar' : 'No hay alertas'}
          hint="Cuando un pago necesite revisión aparecerá aquí y se avisará por correo a Finanzas."
          icon={<CheckCircle2 size={28} className="text-[#009574]" />}
        />
      ) : (
        <div className="space-y-3">
          {alertas.map(alerta => (
            <article key={alerta.id} className="rounded-lg border border-[#E5E7EB] bg-white px-5 py-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TIPO[alerta.type].className}`}>
                      {TIPO[alerta.type].label}
                    </span>
                    {alerta.status === 'RESOLVED' && (
                      <span className="rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#065F46]">
                        Revisada
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[14px] font-semibold text-[#333333]">
                    {alerta.folio ?? 'Sin folio'} · {mxn(alerta.amount)}
                  </p>
                  <p className="mt-0.5 font-mono text-[12px] text-[#6B7280]">Orden {alerta.orderId}</p>
                  {alerta.detail && <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]">{alerta.detail}</p>}
                </div>
                {alerta.status === 'OPEN' && puedeResolver && (
                  <Button size="sm" onClick={() => setResolviendo(alerta)}>
                    Marcar como revisada
                  </Button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-[#F3F4F6] pt-3 text-[12px] text-[#9CA3AF]">
                <span>Detectada: {fechaHora(alerta.createdAt)}</span>
                {alerta.status === 'OPEN' && alerta.lastSeenAt !== alerta.createdAt && (
                  <span>Vista por última vez: {fechaHora(alerta.lastSeenAt)}</span>
                )}
                {alerta.status === 'RESOLVED' && <span>Revisada: {fechaHora(alerta.resolvedAt)}</span>}
                {alerta.resolutionNote && <span className="text-[#6B7280]">Nota: {alerta.resolutionNote}</span>}
              </div>
            </article>
          ))}
        </div>
      )}

      {resolviendo && (
        <Modal
          title="Marcar alerta como revisada"
          subtitle={`${TIPO[resolviendo.type].label} · ${resolviendo.folio ?? 'Sin folio'} · ${mxn(resolviendo.amount)}`}
          onClose={() => !guardando && setResolviendo(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setResolviendo(null)} disabled={guardando}>
                Cancelar
              </Button>
              <Button onClick={() => void marcarRevisada()} loading={guardando}>
                Marcar como revisada
              </Button>
            </>
          }
        >
          <div className="mb-4 flex gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2.5 text-[12px] leading-relaxed text-[#92400E]">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            Marcarla no mueve dinero ni cambia la ficha: solo deja constancia de que Finanzas la revisó.
          </div>
          <TextAreaField
            label="Qué se hizo (opcional)"
            value={nota}
            onChange={setNota}
            maxLength={500}
            rows={3}
            placeholder="Ej. El banco liberó la autorización el 06/11."
          />
        </Modal>
      )}
    </PageContainer>
  )
}
