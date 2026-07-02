import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Building2, CheckCircle2, CreditCard, GraduationCap, Loader2 } from 'lucide-react'
import { useRole } from '../../shared/RoleContext'
import { mockCandidates } from '../../shared/admision/mockData'
import type { Candidate } from '../../shared/admision/types'

/**
 * Screen 17 — Portal Candidato: Pago del Curso de Inducción.
 *
 * Public, chrome-less (`AuthLayout`) — reached from Screen 16
 * (`PortalInduccion.tsx`) after a successful simulated LlaveMX or
 * folio+CURP access, via `navigate('/portal/induccion/pago', { state:
 * { candidate } })`. Mirrors `FichaConfirmacion.tsx`'s payment-tabs pattern
 * (same tab mechanic, banner styles, simulated "Pagar en línea" overlay) but
 * targets `candidate.pagoInduccion` instead of `pagoFicha`, and adds the
 * "ya pagado" alternate state per `specs/admision-screens/spec.md` —
 * "Portal Candidato Pago Inducción (Screen 17, RF-ADM-010)".
 *
 * "Cerrar sesión" resets the mock `RoleContext` role to `null` (back to the
 * anonymous tier) and returns to Screen 16.
 */

interface PortalInduccionPagoLocationState {
  candidate: Candidate
}

const PERIODO_ACTIVO = 'Enero – Abril 2026'
const BANCO = 'BBVA'
const BENEFICIARIO = 'Universidad Tecnológica Emiliano Zapata del Estado de Morelos'

type MetodoPago = 'ONLINE' | 'VENTANILLA'

/** Placeholder bank reference for the "pendiente" pay-at-window tab — mirrors `FichaConfirmacion.tsx`'s `buildReferencia`, prefixed `REF-IND-` to distinguish from the ficha reference. */
function buildReferencia(folio: string): string {
  const suffix = folio.split('-').pop() ?? '000000'
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return `REF-IND-${yyyy}${mm}${dd}-${suffix}`
}

/** Read-only summary field — mirrors the page-local `ReadField` pattern already used in `FichaConfirmacion.tsx`/`CandidatoDetalle.tsx`. */
function ReadField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-[13px] text-[#333333] ${mono ? 'font-mono' : 'font-medium'}`}>{value || '—'}</p>
    </div>
  )
}

export default function PortalInduccionPago() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setRole } = useRole()
  const state = location.state as PortalInduccionPagoLocationState | null

  // Defensive fallback for direct navigation (no route state) — mirrors
  // `FichaConfirmacion.tsx`'s `mockCandidates[0]` fallback pattern, but picks
  // the first candidate flagged `induccionHabilitada` so the fallback is a
  // realistic candidate for this specific screen.
  const candidate: Candidate = state?.candidate ?? mockCandidates.find(c => c.induccionHabilitada) ?? mockCandidates[0]

  const [activeTab, setActiveTab] = useState<MetodoPago>('ONLINE')
  const [payingOverlay, setPayingOverlay] = useState(false)

  const [referencia] = useState(() => candidate.pagoInduccion.referencia ?? buildReferencia(candidate.folio))

  const yaPagado = candidate.pagoInduccion.status === 'CONFIRMADO' || candidate.pagoInduccion.status === 'EXENTO'
  const tieneDescuentoParcial =
    candidate.pagoInduccion.montoOriginal !== undefined &&
    candidate.pagoInduccion.montoOriginal !== candidate.pagoInduccion.monto

  function handleCerrarSesion() {
    setRole(null)
    navigate('/portal/induccion')
  }

  function handlePagarEnLinea() {
    setPayingOverlay(true)
    // Simulated redirect — no real navigation, same pattern as `FichaConfirmacion.tsx`.
    setTimeout(() => setPayingOverlay(false), 1800)
  }

  const overlay = payingOverlay && (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg px-8 py-6 flex flex-col items-center gap-3 shadow-2xl">
        <Loader2 size={28} className="animate-spin text-[#009574]" />
        <p className="text-[13px] font-medium text-[#333333]">Redirigiendo a Evo Payments...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {overlay}

      <header className="bg-[#009574] px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
            <GraduationCap size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-[14px] leading-tight">UTEZ — SISA v2</p>
            <p className="text-white/70 text-[11px] leading-tight">Curso de Inducción</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <p className="hidden sm:block text-white text-[13px] font-medium">
            {candidate.nombre} — {candidate.folio}
          </p>
          <button
            type="button"
            onClick={handleCerrarSesion}
            className="px-3 py-1.5 text-[12px] font-semibold border border-white/40 text-white rounded-md hover:bg-white/10 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="max-w-[640px] mx-auto px-6 py-10">
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
          <p className="text-[12px] font-bold text-[#009574] uppercase tracking-widest mb-4">Datos del candidato</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ReadField label="Nombre" value={candidate.nombre} />
            <ReadField label="Programa" value={candidate.programa} />
            <ReadField label="Folio" value={candidate.folio} mono />
          </div>
        </div>

        <div className="bg-white border-2 border-[#009574] rounded-lg overflow-hidden mb-6">
          <div className="bg-[#e6f5f1] px-6 py-3 border-b border-[#009574]/30">
            <p className="text-[12px] font-bold text-[#009574] uppercase tracking-widest">
              Curso de Inducción — {PERIODO_ACTIVO}
            </p>
          </div>
          <div className="p-6">
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Monto a Pagar</p>
            {tieneDescuentoParcial ? (
              <div className="flex items-baseline gap-3">
                <p className="text-[16px] font-medium text-[#9CA3AF] line-through">
                  ${candidate.pagoInduccion.montoOriginal!.toFixed(2)}
                </p>
                <p className="text-[28px] font-bold text-[#009574]">${candidate.pagoInduccion.monto.toFixed(2)}</p>
              </div>
            ) : (
              <p className="text-[28px] font-bold text-[#009574]">${candidate.pagoInduccion.monto.toFixed(2)}</p>
            )}
          </div>
        </div>

        {yaPagado ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={28} className="text-emerald-600" />
            </div>
            <h2 className="text-[18px] font-bold text-emerald-700 mb-4">¡Pago confirmado!</h2>
            <div className="flex justify-center gap-8 mb-4 text-left">
              <ReadField label="Fecha de confirmación" value={candidate.pagoInduccion.fecha ?? '—'} />
              <ReadField label="Folio de comprobante" value={referencia} mono />
            </div>
            <span className="inline-block px-3 py-1 text-[12px] font-bold bg-emerald-600 text-white rounded-full uppercase tracking-wide mb-3">
              Pagado
            </span>
            <p className="text-[12px] text-emerald-700">
              Presenta este comprobante al ingresar al curso de inducción.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6">
            <p className="text-[13px] font-semibold text-[#333333] mb-4">Instrucciones de pago</p>
            <div className="flex items-center gap-1 border-b border-[#E5E7EB] mb-5">
              <button
                type="button"
                onClick={() => setActiveTab('ONLINE')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'ONLINE' ? 'border-[#009574] text-[#009574]' : 'border-transparent text-[#6B7280] hover:text-[#333333]'
                }`}
              >
                <CreditCard size={14} />Pagar en línea
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('VENTANILLA')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === 'VENTANILLA' ? 'border-[#009574] text-[#009574]' : 'border-transparent text-[#6B7280] hover:text-[#333333]'
                }`}
              >
                <Building2 size={14} />Pagar en ventanilla
              </button>
            </div>

            {activeTab === 'ONLINE' ? (
              <div>
                <button
                  type="button"
                  onClick={handlePagarEnLinea}
                  disabled={payingOverlay}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 text-[14px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white rounded-md transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {payingOverlay && <Loader2 size={16} className="animate-spin" />}
                  Pagar en línea — ${candidate.pagoInduccion.monto.toFixed(2)}
                </button>
                <p className="text-[12px] text-[#6B7280] mt-3">
                  Serás redirigido a Evo Payments para completar tu pago.
                </p>
              </div>
            ) : (
              <div>
                <div className="border border-[#E5E7EB] rounded-md p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ReadField label="Banco" value={BANCO} />
                  <ReadField label="Referencia" value={referencia} mono />
                  <ReadField label="Monto" value={`$${candidate.pagoInduccion.monto.toFixed(2)}`} />
                  <ReadField label="Beneficiario" value={BENEFICIARIO} />
                </div>
                <p className="text-[12px] text-[#6B7280] mt-3">
                  Presenta tu comprobante al personal del curso de inducción.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
