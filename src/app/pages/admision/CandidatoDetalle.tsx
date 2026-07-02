import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  ChevronRight,
  UserCheck,
  CreditCard,
  ClipboardCheck,
  GraduationCap,
  ArrowLeftRight,
} from 'lucide-react'
import { Toast, SearchSelect } from '../../shared/ui'
import { usePendingToast } from '../../shared/hooks'
import { mockCandidates } from '../../shared/admision/mockData'
import {
  STATUS_META,
  getExamResultLabel,
  type Candidate,
  type PaymentRecord,
} from '../../shared/admision/types'

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

// ─── Read-only field ────────────────────────────────────────────────────────

function ReadField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-[13px] text-[#333333] ${mono ? 'font-mono' : 'font-medium'}`}>{value || '—'}</p>
    </div>
  )
}

// ─── Cambiar Programa — inline modal, mirrors `CandidatosList.tsx`'s
// `CambiarProgramaModal` (page-local there too, not exported as shared). ───

function CambiarProgramaModal({ candidate, programas, onSave, onCancel }: {
  candidate: Candidate
  programas: string[]
  onSave: (nuevoPrograma: string) => void
  onCancel: () => void
}) {
  const opciones = programas.filter(p => p !== candidate.programa)
  const [nuevoPrograma, setNuevoPrograma] = useState(opciones[0] ?? '')

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-md mx-4 p-6">
        <h3 className="text-[15px] font-semibold text-[#333333] mb-1">Cambiar Programa</h3>
        <p className="text-[13px] text-[#6B7280] mb-4">
          Candidato: <strong className="text-[#333333]">{candidate.nombre}</strong> · Programa actual:{' '}
          <strong className="text-[#333333]">{candidate.programa}</strong>
        </p>

        <div className="mb-4">
          <label className="block text-[12px] font-semibold text-[#333333] mb-1">Nuevo Programa</label>
          <SearchSelect
            options={opciones}
            value={nuevoPrograma}
            onChange={setNuevoPrograma}
            placeholder="Selecciona un programa"
          />
        </div>

        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5 mb-6 text-[12px] text-amber-700">
          Verifica que el nuevo programa cuente con cupo disponible en el periodo activo antes de confirmar el cambio.
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => nuevoPrograma && onSave(nuevoPrograma)}
            disabled={!nuevoPrograma}
            className="px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cambiar Programa
          </button>
        </div>
      </div>
    </div>
  )
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
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {showCambiarPrograma && (
        <CambiarProgramaModal
          candidate={candidate}
          programas={programas}
          onSave={handleCambiarPrograma}
          onCancel={() => setShowCambiarPrograma(false)}
        />
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/admision')} className="hover:text-[#009574] transition-colors">
          Inicio
        </button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Admisión</span>
        <ChevronRight size={13} />
        <button onClick={() => navigate('/admision/candidatos')} className="hover:text-[#009574] transition-colors">
          Candidatos
        </button>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Detalle</span>
      </nav>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">{candidate.nombre}</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">Expediente completo del candidato en el proceso de admisión.</p>
      </div>

      {/* Summary card */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg px-6 py-5 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <ReadField label="Folio" value={candidate.folio} mono />
          <ReadField label="Programa Solicitado" value={candidate.programa} />
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado Actual</p>
            <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_META[candidate.status].badgeClass}`}>
              {STATUS_META[candidate.status].label}
            </span>
          </div>
          <ReadField label="Fecha de Registro" value={candidate.fechaRegistro} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#E5E7EB] mb-6 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-[#009574] text-[#009574]'
                : 'border-transparent text-[#6B7280] hover:text-[#333333] hover:border-[#E5E7EB]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Información General ── */}
      {activeTab === 'info' && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">
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
        </div>
      )}

      {/* ── Tab 2: Pagos (corrected — Ficha de Admisión + Curso de Inducción) ── */}
      {activeTab === 'pagos' && (
        <div className="space-y-6">
          {/* Sección Ficha de Admisión */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-6">Ficha de Admisión</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado</p>
                <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${PAYMENT_STATUS_META[candidate.pagoFicha.status].badgeClass}`}>
                  {PAYMENT_STATUS_META[candidate.pagoFicha.status].label}
                </span>
              </div>
              <ReadField label="Referencia" value={candidate.pagoFicha.referencia ?? 'Sin referencia generada'} mono />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <ReadField label="Monto" value={`$${candidate.pagoFicha.monto.toFixed(2)}`} />
              <ReadField label="Fecha de Pago" value={candidate.pagoFicha.fecha ?? '—'} />
              <ReadField label="Método" value={candidate.pagoFicha.metodo ?? '—'} />
            </div>
          </div>

          {/* Sección Curso de Inducción */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">
            <div className="flex items-start justify-between mb-6">
              <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest">Curso de Inducción</p>
              {candidate.pagoInduccion.status === 'PENDIENTE' && (
                <button
                  onClick={() => navigate(`/admision/candidatos/pago-induccion?id=${candidate.id}`)}
                  className="px-3 py-1.5 text-[12px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors"
                >
                  Confirmar Pago
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado</p>
                <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${PAYMENT_STATUS_META[candidate.pagoInduccion.status].badgeClass}`}>
                  {PAYMENT_STATUS_META[candidate.pagoInduccion.status].label}
                </span>
              </div>
              <ReadField label="Referencia" value={candidate.pagoInduccion.referencia ?? 'Sin referencia generada'} mono />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <ReadField label="Monto" value={`$${candidate.pagoInduccion.monto.toFixed(2)}`} />
              <ReadField label="Fecha de Pago" value={candidate.pagoInduccion.fecha ?? '—'} />
              <ReadField label="Método" value={candidate.pagoInduccion.metodo ?? '—'} />
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: Examen de Admisión ── */}
      {activeTab === 'examen' && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado</p>
              <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                candidate.examen ? STATUS_META.EXAM_TAKEN.badgeClass : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}>
                {candidate.examen ? 'Aplicado' : 'Pendiente'}
              </span>
            </div>
            <ReadField label="Fecha del Examen" value={candidate.examen?.fecha ?? '—'} />
          </div>
          {candidate.examen ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <ReadField label="Calificación" value={`${candidate.examen.calificacion}/100`} />
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Resultado</p>
                {(() => {
                  const resultado = getExamResultLabel(candidate.examen.calificacion)
                  return (
                    <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                      resultado === 'Aprobado'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {resultado}
                    </span>
                  )
                })()}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-[#6B7280]">El candidato aún no presenta el examen de admisión.</p>
          )}
        </div>
      )}

      {/* ── Tab 4: Curso de Inducción ── */}
      {activeTab === 'induccion' && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Estado</p>
              <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                candidate.induccionResultado ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}>
                {candidate.induccionResultado ? 'Completado' : 'Pendiente'}
              </span>
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
        </div>
      )}

      {/* Action zone — no Admitir/Rechazar: that decision belongs to the
          Director de División on Screen 11 (Selección de Candidatos). */}
      <div className="flex items-center justify-end gap-3 mt-8">
        <button
          onClick={() => navigate('/admision/candidatos')}
          className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
        >
          Regresar
        </button>
        {candidate.status !== 'ACCEPTED' && candidate.status !== 'REJECTED' && candidate.status !== 'ENROLLED' && (
          <button
            onClick={() => setShowCambiarPrograma(true)}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
          >
            <ArrowLeftRight size={14} />Cambiar Programa
          </button>
        )}
      </div>
    </div>
  )
}
