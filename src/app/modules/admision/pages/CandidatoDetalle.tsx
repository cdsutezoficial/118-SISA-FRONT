import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { UserCheck, CreditCard, ClipboardCheck, GraduationCap, ArrowLeftRight } from 'lucide-react'
import { Toast, Tabs, ReadField } from '@app/core/components/ui'
import { FormHeader, FormCard, Button } from '@app/core/components/form'
import { Breadcrumb, PageContainer, BadgePill, type BadgeStyle } from '@app/core/components/list'
import { usePendingToast } from '@app/core/infra/hooks'
import { CambiarProgramaModal } from '../components/CambiarProgramaModal'
import { mockCandidates } from '../data/mockData'
import {
  STATUS_META,
  getExamResultLabel,
  type Candidate,
  type CandidateStatus,
  type PaymentRecord,
} from '../data/types'

// ─── Tabs ───────────────────────────────────────────────────────────────────

type TabKey = 'info' | 'pagos' | 'examen' | 'induccion'

// ─── Payment status meta (Screen 5 "Pagos" tab, corrected per `03-admision.md`
// — Corrección Pantalla 5). `PaymentRecord.status` has 3 values in the shared
// domain type (PENDIENTE/CONFIRMADO/EXENTO); the corrected prompt only shows
// Confirmado/Pendiente badges, so EXENTO gets a third color here to stay
// consistent with the domain without inventing a new PaymentRecord shape. ───

const PAYMENT_STATUS_META: Record<PaymentRecord['status'], { label: string; badgeClass: string }> = {
  PENDIENTE: { label: 'Pendiente', badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200' },
  CONFIRMADO: { label: 'Confirmado', badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  EXENTO: { label: 'Exento', badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200' },
}

// ─── Badge maps (para BadgePill core) ─────────────────────────────────────────

const statusBadgeMap: Record<string, BadgeStyle> = Object.fromEntries(
  (Object.keys(STATUS_META) as CandidateStatus[]).map(s => [s, { label: STATUS_META[s].label, className: STATUS_META[s].badgeClass }]),
)

const paymentBadgeMap: Record<string, BadgeStyle> = Object.fromEntries(
  (Object.keys(PAYMENT_STATUS_META) as PaymentRecord['status'][]).map(s => [s, { label: PAYMENT_STATUS_META[s].label, className: PAYMENT_STATUS_META[s].badgeClass }]),
)

const examenBadgeMap: Record<string, BadgeStyle> = {
  Aplicado: { label: 'Aplicado', className: STATUS_META.EXAM_TAKEN.badgeClass },
  Pendiente: { label: 'Pendiente', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
}

const induccionBadgeMap: Record<string, BadgeStyle> = {
  Completado: { label: 'Completado', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  Pendiente: { label: 'Pendiente', className: 'bg-gray-100 text-gray-600 border border-gray-200' },
}

const examenResultadoBadgeMap: Record<string, BadgeStyle> = {
  Aprobado: { label: 'Aprobado', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  Reprobado: { label: 'Reprobado', className: 'bg-red-50 text-red-700 border border-red-200' },
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function CandidatoDetalle() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const idParam = searchParams.get('id')

  const found = mockCandidates.find(c => c.id === idParam)
  const [candidate, setCandidate] = useState<Candidate>(found ?? mockCandidates[0])

  const pendingToast = usePendingToast()
  const [activeTab, setActiveTab] = useState<TabKey>('info')
  const [toast, setToast] = useState(pendingToast ?? '')
  const [showCambiarPrograma, setShowCambiarPrograma] = useState(false)

  const programas = Array.from(new Set(mockCandidates.map(c => c.programa)))

  function handleCambiarPrograma(nuevoPrograma: string) {
    setCandidate(prev => ({ ...prev, programa: nuevoPrograma }))
    setShowCambiarPrograma(false)
    setToast(`Programa actualizado a "${nuevoPrograma}".`)
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

      {showCambiarPrograma && (
        <CambiarProgramaModal
          candidate={candidate}
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
        title={candidate.nombre}
        subtitle="Expediente completo del candidato en el proceso de admisión."
      />

      {/* Summary card */}
      <FormCard>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <ReadField label="Folio" value={candidate.folio} mono />
          <ReadField label="Programa Solicitado" value={candidate.programa} />
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado Actual</p>
            <BadgePill value={candidate.status} map={statusBadgeMap} />
          </div>
          <ReadField label="Fecha de Registro" value={candidate.fechaRegistro} />
        </div>
      </FormCard>

      {/* Tabs */}
      <Tabs tabs={tabs} active={activeTab} onSelect={k => setActiveTab(k as TabKey)} />

      {/* ── Tab 1: Información General ── */}
      {activeTab === 'info' && (
        <FormCard>
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-6">Datos Personales</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <ReadField label="Nombre Completo" value={candidate.nombre} />
            <ReadField label="CURP" value={candidate.curp} mono />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <ReadField label="Correo Electrónico" value={candidate.email} mono />
            <ReadField label="Teléfono Celular" value={candidate.telefono} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <ReadField label="Canal por el que se enteró" value={candidate.canal} />
            <ReadField label="División" value={candidate.division} />
          </div>
        </FormCard>
      )}

      {/* ── Tab 2: Pagos (corrected — Ficha de Admisión + Curso de Inducción) ── */}
      {activeTab === 'pagos' && (
        <>
          {/* Sección Ficha de Admisión */}
          <FormCard>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-6">Ficha de Admisión</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado</p>
                <BadgePill value={candidate.pagoFicha.status} map={paymentBadgeMap} />
              </div>
              <ReadField label="Referencia" value={candidate.pagoFicha.referencia ?? 'Sin referencia generada'} mono />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <ReadField label="Monto" value={`$${candidate.pagoFicha.monto.toFixed(2)}`} />
              <ReadField label="Fecha de Pago" value={candidate.pagoFicha.fecha ?? '—'} />
              <ReadField label="Método" value={candidate.pagoFicha.metodo ?? '—'} />
            </div>
          </FormCard>

          {/* Sección Curso de Inducción */}
          <FormCard>
            <div className="flex items-start justify-between mb-6">
              <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest">Curso de Inducción</p>
              {candidate.pagoInduccion.status === 'PENDIENTE' && (
                <Button size="sm" onClick={() => navigate(`/admision/candidatos/pago-induccion?id=${candidate.id}`)}>
                  Confirmar Pago
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado</p>
                <BadgePill value={candidate.pagoInduccion.status} map={paymentBadgeMap} />
              </div>
              <ReadField label="Referencia" value={candidate.pagoInduccion.referencia ?? 'Sin referencia generada'} mono />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <ReadField label="Monto" value={`$${candidate.pagoInduccion.monto.toFixed(2)}`} />
              <ReadField label="Fecha de Pago" value={candidate.pagoInduccion.fecha ?? '—'} />
              <ReadField label="Método" value={candidate.pagoInduccion.metodo ?? '—'} />
            </div>
          </FormCard>
        </>
      )}

      {/* ── Tab 3: Examen de Admisión ── */}
      {activeTab === 'examen' && (
        <FormCard>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado</p>
              <BadgePill value={candidate.examen ? 'Aplicado' : 'Pendiente'} map={examenBadgeMap} />
            </div>
            <ReadField label="Fecha del Examen" value={candidate.examen?.fecha ?? '—'} />
          </div>
          {candidate.examen ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <ReadField label="Calificación" value={`${candidate.examen.calificacion}/100`} />
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Resultado</p>
                <BadgePill value={getExamResultLabel(candidate.examen.calificacion)} map={examenResultadoBadgeMap} />
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-[#6B7280]">El candidato aún no presenta el examen de admisión.</p>
          )}
        </FormCard>
      )}

      {/* ── Tab 4: Curso de Inducción ── */}
      {activeTab === 'induccion' && (
        <FormCard>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado</p>
              <BadgePill value={candidate.induccionResultado ? 'Completado' : 'Pendiente'} map={induccionBadgeMap} />
            </div>
            <ReadField label="Fecha" value={candidate.induccionResultado?.fecha ?? '—'} />
          </div>
          {candidate.induccionResultado ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <ReadField label="Calificación" value={`${candidate.induccionResultado.calificacion}/100`} />
              <ReadField label="Resultado" value={candidate.induccionResultado.resultado} />
            </div>
          ) : (
            <p className="text-[13px] text-[#6B7280]">El candidato aún no tiene un resultado de inducción registrado.</p>
          )}
        </FormCard>
      )}

      {/* Action zone — no Admitir/Rechazar: that decision belongs to the
          Director de División on Screen 11 (Selección de Candidatos). */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-8">
        <Button variant="secondary" onClick={() => navigate('/admision/candidatos')}>
          Regresar
        </Button>
        {candidate.status !== 'ACCEPTED' && candidate.status !== 'REJECTED' && candidate.status !== 'ENROLLED' && (
          <Button variant="secondary" onClick={() => setShowCambiarPrograma(true)}>
            <ArrowLeftRight size={14} />Cambiar Programa
          </Button>
        )}
      </div>
    </PageContainer>
  )
}
