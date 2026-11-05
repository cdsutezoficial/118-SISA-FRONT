import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import { PageContainer, Breadcrumb, PageHeader, ErrorBanner, LoadingState, EmptyState } from '@app/core/components/list'
import { Tabs } from '@app/core/components/ui'
import { apiGet, getApiErrorMessage } from '@app/core/infra/apiClient'

/**
 * Excedentes de pago para Finanzas (E1).
 *
 * Dinero que el banco cobró sin liquidar ningún cargo: un segundo cobro de una
 * ficha ya pagada o un cobro de un cargo cancelado. La conciliación ya lo dejó
 * como saldo a favor de la persona (F9); esta lista es para revisarlo sin leer
 * logs: de quién es, de qué cargo salió, la orden del banco y si ya se usó.
 */

type CreditStatus = 'AVAILABLE' | 'APPLIED' | 'CANCELLED'

interface Overpayment {
  id: string
  candidateId: string | null
  personName: string | null
  curp: string | null
  amount: number
  status: CreditStatus
  originReference: string | null
  appliedToReference: string | null
  externalOrderId: string
  createdAt: string
}

const ESTADO: Record<CreditStatus, { label: string; className: string }> = {
  AVAILABLE: { label: 'Saldo disponible', className: 'bg-[#E0F2FE] text-[#075985]' },
  APPLIED: { label: 'Ya se usó', className: 'bg-[#ECFDF5] text-[#065F46]' },
  CANCELLED: { label: 'Cancelado', className: 'bg-[#F3F4F6] text-[#6B7280]' },
}

const PESTANAS = [
  { key: 'AVAILABLE', label: 'Disponibles' },
  { key: 'APPLIED', label: 'Usados' },
  { key: 'ALL', label: 'Todos' },
]

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const mxn = (n: number) => `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ExcedentesPago() {
  const navigate = useNavigate()
  const [pestana, setPestana] = useState('AVAILABLE')
  const [excedentes, setExcedentes] = useState<Overpayment[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet<{ items: Overpayment[] }>('/finance/credits/overpayments')
      .then(r => setExcedentes(r.items))
      .catch(err => setError(getApiErrorMessage(err, 'No se pudieron cargar los excedentes.')))
      .finally(() => setCargando(false))
  }, [])

  const visibles = useMemo(
    () => (pestana === 'ALL' ? excedentes : excedentes.filter(e => e.status === pestana)),
    [excedentes, pestana],
  )
  const totalDisponible = excedentes.filter(e => e.status === 'AVAILABLE').reduce((s, e) => s + Number(e.amount), 0)

  return (
    <PageContainer>
      <Breadcrumb items={[{ label: 'Finanzas' }, { label: 'Excedentes de pago' }]} />
      <PageHeader
        title="Excedentes de pago"
        subtitle="Cobros del banco que no liquidaron ningún cargo. Cada uno ya es saldo a favor de la persona."
      />

      {!cargando && !error && excedentes.length > 0 && (
        <p className="text-[13px] text-[#6B7280]">
          Saldo disponible por excedentes: <span className="font-semibold text-[#333333]">{mxn(totalDisponible)}</span>
        </p>
      )}

      <Tabs tabs={PESTANAS} active={pestana} onSelect={setPestana} />

      {error && <ErrorBanner message={error} />}

      {cargando ? (
        <LoadingState label="Cargando excedentes…" />
      ) : visibles.length === 0 ? (
        <EmptyState
          title="No hay excedentes"
          hint="Cuando el banco cobre algo que no liquida ningún cargo, la conciliación lo dejará aquí como saldo a favor."
          icon={<CheckCircle2 size={28} className="text-[#009574]" />}
        />
      ) : (
        <div className="space-y-3">
          {visibles.map(e => (
            <article key={e.id} className="rounded-lg border border-[#E5E7EB] bg-white px-5 py-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ESTADO[e.status].className}`}>
                    {ESTADO[e.status].label}
                  </span>
                  <p className="mt-2 text-[14px] font-semibold text-[#333333]">
                    {e.personName ?? 'Persona sin identificar'} · {mxn(e.amount)}
                  </p>
                  {e.curp && <p className="mt-0.5 font-mono text-[12px] text-[#6B7280]">{e.curp}</p>}
                  <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-[12px] text-[#6B7280] sm:grid-cols-3">
                    <div>
                      <dt className="inline">Cargo de origen: </dt>
                      <dd className="inline font-mono text-[#333333]">{e.originReference ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="inline">Orden del banco: </dt>
                      <dd className="inline font-mono text-[#333333]">{e.externalOrderId}</dd>
                    </div>
                    {e.appliedToReference && (
                      <div>
                        <dt className="inline">Se usó en: </dt>
                        <dd className="inline font-mono text-[#333333]">{e.appliedToReference}</dd>
                      </div>
                    )}
                  </dl>
                </div>
                {e.candidateId && (
                  <button
                    type="button"
                    onClick={() => navigate(`/admision/candidatos/detalle?id=${e.candidateId}`)}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#009574] hover:underline"
                  >
                    Ver candidato <ExternalLink size={12} />
                  </button>
                )}
              </div>
              <p className="mt-3 border-t border-[#F3F4F6] pt-3 text-[12px] text-[#9CA3AF]">Registrado: {fechaHora(e.createdAt)}</p>
            </article>
          ))}
        </div>
      )}
    </PageContainer>
  )
}
