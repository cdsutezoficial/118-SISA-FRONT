import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronRight, AlertTriangle, XCircle, Megaphone } from 'lucide-react'
import { ConfirmModal, Toast, Switch } from '../../shared/ui'
import { mockCandidates } from '../../shared/admision/mockData'

/**
 * Screen 9 — Publicar Resultados de Admisión, per `03-admision.md`
 * ("Pantalla 9 — Publicar Resultados de Admisión") AND its authoritative
 * correction ("Corrección — Pantalla 9: Publicar Resultados (orden correcto:
 * después de generar matrículas)"), plus `specs/admision-screens/spec.md`'s
 * "Publicar Resultados (Screen 9)" requirement and the "Candidate Status
 * State Machine" requirement's "Publish blocked until matrículas complete" /
 * "Dashboard publish shortcut gated by matrícula completion" scenarios. Role:
 * Servicios Escolares. Route: `/admision/publicar`.
 *
 * Per the correction (authoritative over the original prompt): this screen
 * runs AFTER all matrículas have been generated (Screen 12), has NO "Fecha
 * de inicio de clases" field (removed), and does NOT itself transition any
 * `Candidate.status` — per the state-machine requirement, publishing only
 * notifies/locks the list. Entry flow comes one-directionally from Screen
 * 12; no navigation button back to it is added here.
 *
 * MOCK-ONLY LIMITATION (persistence): same limitation as every other
 * Admisión write-action screen (Screens 6, 8, 10, 11, 12) — this screen
 * reads a fresh snapshot of `mockCandidates` on every render, no shared
 * mutation store exists across pages. Because Screen 12's matrícula
 * generation does not persist back into the shared `mockCandidates` array
 * either, the seed data still contains 2 `ACCEPTED` candidates without a
 * matrícula (ids 6, 9) — so a fresh app load always demonstrates the
 * *blocked* state described by the "Publish blocked until matrículas
 * complete" scenario. Confirming publish here is therefore also mock-only:
 * it does not mutate `mockCandidates`, only shows the success toast and
 * navigates back to the Dashboard, exactly like `GenerarMatriculas.tsx`
 * (Screen 12) and other write-action screens in this module.
 */

const PERIODO_ACTIVO = 'Enero – Abril 2026'

function SummaryField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-[13px] font-medium ${highlight ? 'text-emerald-600' : 'text-[#333333]'}`}>{value}</p>
    </div>
  )
}

export default function PublicarResultados() {
  const navigate = useNavigate()
  const [notificarEmail, setNotificarEmail] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [toast, setToast] = useState('')

  const totalProcesados = mockCandidates.filter(
    c => c.status === 'ACCEPTED' || c.status === 'REJECTED' || c.status === 'ENROLLED',
  ).length
  const admitidos = mockCandidates.filter(c => c.status === 'ACCEPTED' || c.status === 'ENROLLED').length
  const rechazados = mockCandidates.filter(c => c.status === 'REJECTED').length
  const matriculasGeneradas = mockCandidates.filter(c => c.status === 'ENROLLED').length
  const pendientesSinMatricula = mockCandidates.filter(c => c.status === 'ACCEPTED').length

  const canPublicar = pendientesSinMatricula === 0
  const matriculasCompletas = admitidos > 0 && matriculasGeneradas === admitidos

  function handleConfirmar() {
    setConfirming(false)
    setToast('Resultados publicados. Los candidatos pueden consultar su matrícula asignada.')
  }

  return (
    <div className="max-w-[900px] mx-auto px-8 py-8">
      {toast && <Toast message={toast} onClose={() => { setToast(''); navigate('/admision') }} />}

      {confirming && (
        <ConfirmModal
          title="¿Confirmas la publicación de resultados?"
          message={`Se publicará la lista con los ${admitidos} candidatos admitidos y sus matrículas asignadas. Los candidatos recibirán notificación con su folio y matrícula. Esta acción no puede deshacerse.`}
          confirmLabel="Confirmar y Publicar"
          onConfirm={handleConfirmar}
          onCancel={() => setConfirming(false)}
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
        <span className="text-[#333333] font-medium">Publicar Resultados</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">Publicar Resultados de Admisión</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">
          Publica la lista oficial de admitidos con el folio y la matrícula asignada. Este paso se ejecuta después de
          que todas las matrículas han sido generadas.
        </p>
      </div>

      {/* Warning alert */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3.5 mb-6">
        <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-[13px] text-amber-700">
          Esta acción es irreversible. Una vez publicados los resultados, no podrán modificarse las calificaciones ni
          el estado de los candidatos.
        </p>
      </div>

      {/* Summary card */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg px-6 py-5 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
          <SummaryField label="Periodo" value={PERIODO_ACTIVO} />
          <SummaryField label="Total Procesados" value={String(totalProcesados)} />
          <SummaryField label="Admitidos" value={String(admitidos)} />
          <SummaryField label="Rechazados" value={String(rechazados)} />
          <SummaryField label="Matrículas Generadas" value={String(matriculasGeneradas)} highlight={matriculasCompletas} />
        </div>
      </div>

      {/* Blocking error alert — pending ACCEPTED candidates without a matrícula */}
      {!canPublicar && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3.5 mb-6">
          <XCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-[13px] text-red-700">
            Existen {pendientesSinMatricula} candidatos admitidos sin matrícula generada. Genera todas las matrículas
            antes de publicar.
          </p>
        </div>
      )}

      {/* Configuración de la Publicación */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
        <h2 className="text-[14px] font-semibold text-[#333333] mb-4">Configuración de la Publicación</h2>
        <div className="flex items-center justify-between max-w-sm">
          <span className="text-[13px] font-medium text-[#333333]">¿Notificar por correo electrónico?</span>
          <Switch checked={notificarEmail} onChange={setNotificarEmail} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => navigate('/admision')}
          className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={() => setConfirming(true)}
          disabled={!canPublicar}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold bg-[#009574] hover:bg-[#007a5e] disabled:bg-[#9CA3AF] disabled:cursor-not-allowed text-white rounded-md transition-colors"
        >
          <Megaphone size={14} />
          Publicar Resultados
        </button>
      </div>
    </div>
  )
}
