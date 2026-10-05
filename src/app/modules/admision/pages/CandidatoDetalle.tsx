import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { UserCheck, CreditCard, ClipboardCheck, GraduationCap, ArrowLeftRight } from 'lucide-react'
import { Toast, Tabs, ReadField } from '@app/core/components/ui'
import { FormHeader, FormCard, Button } from '@app/core/components/form'
import { Breadcrumb, PageContainer, BadgePill, ErrorBanner, type BadgeStyle } from '@app/core/components/list'
import { apiGet, getApiErrorMessage } from '@app/core/infra/apiClient'
import { usePendingToast } from '@app/core/infra/hooks'
import { CambiarProgramaModal } from '../components/CambiarProgramaModal'
import {
  type CandidateDetailBackend,
  type CandidateDetailPaymentBackend,
  STATUS_META,
  type CandidateStatus,
} from '../data/types'

// ─── Tabs ───────────────────────────────────────────────────────────────────

type TabKey = 'info' | 'pagos' | 'examen' | 'induccion'

// ─── Payment status meta ─────────────────────────────────────────────────────

const PAYMENT_STATUS_META: Record<CandidateDetailPaymentBackend['paymentStatus'], { label: string; badgeClass: string }> = {
  PENDING: { label: 'Pendiente', badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200' },
  PAID: { label: 'Confirmado', badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
}

// ─── Badge maps (para BadgePill core) ─────────────────────────────────────────

const statusBadgeMap: Record<string, BadgeStyle> = Object.fromEntries(
  (Object.keys(STATUS_META) as CandidateStatus[]).map(s => [s, { label: STATUS_META[s].label, className: STATUS_META[s].badgeClass }]),
)

const paymentBadgeMap: Record<string, BadgeStyle> = Object.fromEntries(
  (Object.keys(PAYMENT_STATUS_META) as CandidateDetailPaymentBackend['paymentStatus'][]).map(s => [s, { label: PAYMENT_STATUS_META[s].label, className: PAYMENT_STATUS_META[s].badgeClass }]),
)

interface ProgramSummary {
  id: string
  name: string
}

interface ProgramsPageResponse {
  items: ProgramSummary[]
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function CandidatoDetalle() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const idParam = searchParams.get('id')

  const pendingToast = usePendingToast()
  const [activeTab, setActiveTab] = useState<TabKey>('info')
  const [toast, setToast] = useState(pendingToast ?? '')
  const [showCambiarPrograma, setShowCambiarPrograma] = useState(false)
  const [candidate, setCandidate] = useState<CandidateDetailBackend | null>(null)
  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [loadStatus, setLoadStatus] = useState<'loading' | 'idle' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  const programas = programs.map(program => program.name).filter(name => name !== candidate?.programName)

  useEffect(() => {
    if (!idParam) {
      setLoadStatus('error')
      setErrorMsg('Falta el id del candidato a consultar.')
      return
    }

    let cancelled = false
    setLoadStatus('loading')
    setErrorMsg('')

    apiGet<CandidateDetailBackend>(`/candidates/${idParam}/detail`)
      .then(data => {
        if (cancelled) return
        setCandidate(data)
        setLoadStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadStatus('error')
        setErrorMsg(getApiErrorMessage(err, 'No se pudo cargar el detalle del candidato.'))
      })

    apiGet<ProgramsPageResponse>('/programs', { size: 100 })
      .then(data => { if (!cancelled) setPrograms(data.items) })
      .catch(() => {/* no crítico */})

    return () => { cancelled = true }
  }, [idParam])

  function handleCambiarPrograma(nuevoPrograma: string) {
    setCandidate(prev => (prev ? { ...prev, programName: nuevoPrograma } : prev))
    setShowCambiarPrograma(false)
    setToast(`Carrera actualizada a "${nuevoPrograma}".`)
  }

  function renderPaymentSection(title: string, payment: CandidateDetailPaymentBackend | null, pendingHint?: string) {
    return (
      <FormCard>
        <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-6">{title}</p>
        {!payment ? (
          <p className="text-[13px] text-[#6B7280]">
            {pendingHint ?? 'No hay un pago registrado para este concepto todavía.'}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado</p>
                <BadgePill value={payment.paymentStatus} map={paymentBadgeMap} />
              </div>
              <ReadField label="Referencia" value={payment.referenceNumber} mono />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <ReadField label="Monto" value={formatCurrency(payment.amount)} />
              <ReadField label="Fecha de Pago" value={formatDate(payment.paidAt)} />
              <ReadField label="Recibo" value={payment.receiptNumber ?? '—'} mono />
              <ReadField label="Orden EVO" value={payment.orderId ?? '—'} mono />
            </div>
          </>
        )}
      </FormCard>
    )
  }

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'info', label: 'Información General', icon: <UserCheck size={14} /> },
    { key: 'pagos', label: 'Pagos', icon: <CreditCard size={14} /> },
    { key: 'examen', label: 'Examen de Admisión', icon: <ClipboardCheck size={14} /> },
    { key: 'induccion', label: 'Curso de Inducción', icon: <GraduationCap size={14} /> },
  ]

  return (
    <PageContainer>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {showCambiarPrograma && candidate && (
        <CambiarProgramaModal
          candidate={{ nombre: candidate.fullName, programa: candidate.programName ?? '' }}
          programas={programas}
          onSave={handleCambiarPrograma}
          onCancel={() => setShowCambiarPrograma(false)}
        />
      )}

      <Breadcrumb
        items={[
          { label: 'Inicio', to: '/admision' },
          { label: 'Admisión' },
          { label: 'Candidatos', to: '/admision/candidatos' },
          { label: 'Detalle' },
        ]}
      />

      <FormHeader
        title={candidate?.fullName ?? 'Detalle del candidato'}
        subtitle="Expediente completo del candidato en el proceso de admisión."
      />

      {loadStatus === 'error' && errorMsg && <ErrorBanner message={errorMsg} />}

      {loadStatus === 'loading' ? (
        <FormCard loading loadingLabel="Cargando detalle del candidato..." />
      ) : !candidate ? null : (
        <>

          {/* Summary card */}
          <FormCard>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <ReadField label="Folio" value={candidate.folio} mono />
              <ReadField label="Carrera Solicitada" value={candidate.programName ?? '—'} />
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado Actual</p>
                <BadgePill value={candidate.candidateStatus} map={statusBadgeMap} />
              </div>
              <ReadField label="Fecha de Registro" value={formatDate(candidate.registeredAt)} />
            </div>
          </FormCard>

          {/* Tabs */}
          <Tabs tabs={tabs} active={activeTab} onSelect={k => setActiveTab(k as TabKey)} />

          {/* ── Tab 1: Información General ── */}
          {activeTab === 'info' && (
            <FormCard>
              <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-6">Datos Personales</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <ReadField label="Nombre Completo" value={candidate.fullName} />
                <ReadField label="CURP" value={candidate.curp} mono />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <ReadField label="Correo Electrónico" value={candidate.email ?? '—'} mono />
                <ReadField label="Teléfono de contacto" value={candidate.mobilePhone ?? candidate.homePhone ?? '—'} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <ReadField label="Canal por el que se enteró" value={candidate.outreachChannelName ?? '—'} />
                <ReadField label="División" value={candidate.divisionName ?? '—'} />
              </div>
            </FormCard>
          )}

          {/* ── Tab 2: Pagos (Ficha de Admisión + Curso de Inducción) ── */}
          {activeTab === 'pagos' && (
            <>
              {renderPaymentSection('Ficha de Admisión', candidate.admissionPayment)}
              {renderPaymentSection(
                'Curso de Inducción',
                candidate.inductionPayment,
                'El pago del curso de inducción aún no está integrado al backend de detalle administrativo.'
              )}
            </>
          )}

          {/* ── Tab 3: Examen de Admisión ── */}
          {activeTab === 'examen' && (
            <FormCard>
              <p className="text-[13px] text-[#6B7280]">
                El candidato aún no presenta el examen de admisión.
              </p>
            </FormCard>
          )}

          {/* ── Tab 4: Curso de Inducción ── */}
          {activeTab === 'induccion' && (
            <FormCard>
              <p className="text-[13px] text-[#6B7280]">
                El candidato aún no tiene un resultado de inducción registrado.
              </p>
            </FormCard>
          )}

          {/* Action zone — no Admitir/Rechazar: that decision belongs to the
              Director de División on Screen 11 (Selección de Candidatos). */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-8">
            <Button variant="secondary" onClick={() => navigate('/admision/candidatos')}>
              Regresar
            </Button>
            {candidate.candidateStatus !== 'ACCEPTED' && candidate.candidateStatus !== 'REJECTED' && candidate.candidateStatus !== 'ENROLLED' && (
              <Button variant="secondary" onClick={() => setShowCambiarPrograma(true)}>
                <ArrowLeftRight size={14} />Cambiar Carrera
              </Button>
            )}
          </div>
        </>
      )}
    </PageContainer>
  )
}
