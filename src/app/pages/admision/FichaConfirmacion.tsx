import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  CheckCircle2,
  GraduationCap,
  Download,
  Mail,
  CreditCard,
  Building2,
  Loader2,
  ChevronRight,
} from 'lucide-react'
import { Toast } from '../../shared/ui'
import { formatDate } from '../../shared/utils'
import { mockCandidates } from '../../shared/admision/mockData'
import type { Candidate } from '../../shared/admision/types'

/**
 * Screen 13 — Ficha de Admisión: Confirmación post-registro.
 *
 * Dual-mounted per `specs/admision-screens/spec.md` — "Ficha de Admisión
 * Confirmación (Screen 13)": identical content/behavior for both mounts,
 * `origin` drives ONLY chrome + the staff-only "back to listing" link.
 * - Staff: `/admision/candidatos/ficha` (AppLayout, sidebar/breadcrumb present).
 * - Público: `/portal/registro/ficha` (AuthLayout, no sidebar/navbar — terminal
 *   confirmation for the anonymous self-registration flow started at Screen 4).
 *
 * Reached via `navigate(route, { state: { candidate, metodoPago } })` from
 * `CandidatoRegistro.tsx` (Screen 4)'s `handleComplete`. `metodoPago` only
 * pre-selects the active tab — the candidate can still switch tabs here.
 */

// Mirrors `CandidatoRegistro.tsx`'s page-local `ScreenOrigin`/`MetodoPago`
// unions — kept local (not imported) so this page doesn't couple to Screen
// 4's module, same as how `MetodoPago` itself isn't shared there either.
export type ScreenOrigin = 'staff' | 'public'
type MetodoPago = 'ONLINE' | 'VENTANILLA'

interface FichaConfirmacionProps {
  origin: ScreenOrigin
}

interface FichaConfirmacionLocationState {
  candidate: Candidate
  metodoPago: MetodoPago
}

// Matches the "periodo activo" convention used across the Admisión screens
// (see `CandidatosList.tsx`/`AdmisionDashboard.tsx`).
const PERIODO_ACTIVO = 'Enero – Abril 2026'
const BANCO = 'BBVA'
const BENEFICIARIO = 'Universidad Tecnológica Emiliano Zapata del Estado de Morelos'

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

/** Placeholder bank reference — generated the same deterministic way Screen 4 generates its folio (no backend). */
function buildReferencia(folio: string): string {
  const suffix = folio.split('-').pop() ?? '000000'
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return `REF-${yyyy}${mm}${dd}-${suffix}`
}

/** Read-only summary field — mirrors the page-local `ReadField` pattern already used in `CandidatoDetalle.tsx`/`CandidatoRegistro.tsx`. */
function ReadField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-[13px] text-[#333333] ${mono ? 'font-mono' : 'font-medium'}`}>{value || '—'}</p>
    </div>
  )
}

export default function FichaConfirmacion({ origin }: FichaConfirmacionProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as FichaConfirmacionLocationState | null

  // Defensive fallback — mirrors `CandidatoDetalle.tsx`'s `?id=` lookup
  // fallback: if someone lands here directly without going through the
  // Wizard (Screen 4), there is no route state; fall back to a mock
  // candidate so the route never crashes.
  const candidate: Candidate = state?.candidate ?? mockCandidates[0]
  const metodoPagoInicial: MetodoPago = state?.metodoPago ?? 'ONLINE'

  const [activeTab, setActiveTab] = useState<MetodoPago>(metodoPagoInicial)
  const [toast, setToast] = useState('')
  const [payingOverlay, setPayingOverlay] = useState(false)

  const [referencia] = useState(() => candidate.pagoFicha.referencia ?? buildReferencia(candidate.folio))
  const [fechaLimite] = useState(() => formatDate(addDays(new Date(), 10)))

  function handlePagarEnLinea() {
    setPayingOverlay(true)
    // Simulated redirect — no real navigation, per spec scenario "Pay online shows simulated overlay".
    setTimeout(() => setPayingOverlay(false), 1800)
  }

  // No real PDF generation / email delivery exists in this prototype — both
  // actions are toast-only stubs, per the task instructions and the spec's
  // "toast-only 'Enviar instrucciones a mi correo'" wording.
  function handleDescargarPdf() {
    setToast('Descarga simulada: esta versión de prototipo no genera un PDF real.')
  }

  function handleEnviarCorreo() {
    setToast(`Instrucciones enviadas (simulado) a ${candidate.email || 'tu correo registrado'}.`)
  }

  const header = (
    <div className="flex flex-col items-center text-center mb-8">
      <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
        <CheckCircle2 size={32} className="text-emerald-500" />
      </div>
      <h1 className="text-2xl font-bold text-[#333333]">¡Registro exitoso!</h1>
      <p className="text-[14px] text-[#6B7280] mt-1 max-w-md">
        Tu ficha de admisión ha sido generada. Completa tu pago para continuar con el proceso.
      </p>
    </div>
  )

  const fichaCard = (
    <div className="bg-white border-2 border-[#009574] rounded-lg overflow-hidden mb-6">
      <div className="bg-[#e6f5f1] px-6 py-3 border-b border-[#009574]/30">
        <p className="text-[12px] font-bold text-[#009574] uppercase tracking-widest">
          Ficha de Admisión — {PERIODO_ACTIVO}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
        <div className="space-y-4">
          <ReadField label="Folio" value={candidate.folio} mono />
          <ReadField label="Nombre" value={candidate.nombre} />
          <ReadField label="CURP" value={candidate.curp} mono />
          <ReadField label="Programa Solicitado" value={candidate.programa} />
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Monto a Pagar</p>
            <p className="text-[28px] font-bold text-[#009574]">${candidate.pagoFicha.monto.toFixed(2)}</p>
          </div>
          <ReadField label="Referencia de Pago" value={referencia} mono />
          <ReadField label="Fecha Límite de Pago" value={fechaLimite} />
        </div>
      </div>
    </div>
  )

  const tabsSection = (
    <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
      <p className="text-[13px] font-semibold text-[#333333] mb-4">Instrucciones de pago</p>
      <div className="flex items-center gap-1 border-b border-[#E5E7EB] mb-5">
        <button
          type="button"
          onClick={() => setActiveTab('ONLINE')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'ONLINE' ? 'border-[#009574] text-[#009574]' : 'border-transparent text-[#6B7280] hover:text-[#333333]'
          }`}
        >
          <CreditCard size={14} />Pago en línea
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('VENTANILLA')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'VENTANILLA' ? 'border-[#009574] text-[#009574]' : 'border-transparent text-[#6B7280] hover:text-[#333333]'
          }`}
        >
          <Building2 size={14} />Pago en ventanilla
        </button>
      </div>

      {activeTab === 'ONLINE' ? (
        <div>
          <div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-3 mb-4 text-[13px] text-blue-700">
            Haz clic en el botón de abajo para pagar de forma segura con tarjeta o transferencia. Serás redirigido a Evo Payments.
          </div>
          <button
            type="button"
            onClick={handlePagarEnLinea}
            disabled={payingOverlay}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 text-[14px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {payingOverlay && <Loader2 size={16} className="animate-spin" />}
            Pagar en línea — ${candidate.pagoFicha.monto.toFixed(2)}
          </button>
          <p className="text-[12px] text-[#6B7280] mt-3">
            Una vez confirmado el pago recibirás un correo de confirmación y podrás continuar con el proceso.
          </p>
        </div>
      ) : (
        <div>
          <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-4 text-[13px] text-amber-700">
            Presenta esta referencia en la ventanilla de Finanzas de la universidad.
          </div>
          <div className="border border-[#E5E7EB] rounded-md p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ReadField label="Banco" value={BANCO} />
            <ReadField label="Referencia" value={referencia} mono />
            <ReadField label="Monto Exacto" value={`$${candidate.pagoFicha.monto.toFixed(2)}`} />
            <ReadField label="Beneficiario" value={BENEFICIARIO} />
          </div>
          <p className="text-[12px] text-[#6B7280] mt-3">
            Guarda tu comprobante — te lo solicitarán para activar tu candidatura.
          </p>
        </div>
      )}
    </div>
  )

  const actionsRow = (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <button
        type="button"
        onClick={handleDescargarPdf}
        className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
      >
        <Download size={14} />Descargar ficha en PDF
      </button>
      <button
        type="button"
        onClick={handleEnviarCorreo}
        className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors"
      >
        <Mail size={14} />Enviar instrucciones a mi correo
      </button>
    </div>
  )

  const overlay = payingOverlay && (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg px-8 py-6 flex flex-col items-center gap-3 shadow-2xl">
        <Loader2 size={28} className="animate-spin text-[#009574]" />
        <p className="text-[13px] font-medium text-[#333333]">Redirigiendo a Evo Payments...</p>
      </div>
    </div>
  )

  const content = (
    <div className="max-w-[820px] mx-auto">
      {header}
      {fichaCard}
      {tabsSection}
      {actionsRow}
      {/* Staff-only per spec scenario "Público mount hides the staff 'back to
          listing' link" — an anonymous candidate has no candidate listing to
          return to. */}
      {origin === 'staff' && (
        <button
          type="button"
          onClick={() => navigate('/admision/candidatos')}
          className="text-[12px] text-[#6B7280] hover:text-[#009574] transition-colors"
        >
          ← Volver al listado de candidatos
        </button>
      )}
    </div>
  )

  // ── Staff mount — AppLayout shell, sidebar/breadcrumb present ──
  if (origin === 'staff') {
    return (
      <div className="max-w-[960px] mx-auto px-8 py-8">
        {toast && <Toast message={toast} onClose={() => setToast('')} />}
        {overlay}

        <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
          <button onClick={() => navigate('/admision')} className="hover:text-[#009574] transition-colors">Inicio</button>
          <ChevronRight size={13} />
          <span className="text-[#6B7280]">Admisión</span>
          <ChevronRight size={13} />
          <button onClick={() => navigate('/admision/candidatos')} className="hover:text-[#009574] transition-colors">Candidatos</button>
          <ChevronRight size={13} />
          <span className="text-[#333333] font-medium">Ficha de Admisión</span>
        </nav>

        {content}
      </div>
    )
  }

  // ── Público mount — bare AuthLayout, no sidebar/navbar (anonymous self-registration terminal state) ──
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {overlay}

      <header className="bg-[#009574] px-6 py-4 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <GraduationCap size={18} className="text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-[14px] leading-tight">UTEZ — SISA v2</p>
          <p className="text-white/70 text-[11px] leading-tight">Ficha de Admisión</p>
        </div>
      </header>

      <div className="max-w-[960px] mx-auto px-8 py-8">
        {content}
      </div>
    </div>
  )
}
