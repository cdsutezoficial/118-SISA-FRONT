import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AlertCircle, GraduationCap, Loader2 } from 'lucide-react'
import { useRole } from '../../shared/RoleContext'
import { mockCandidates } from '../../shared/admision/mockData'
import type { Candidate } from '../../shared/admision/types'

/**
 * Screen 16 — Portal Candidato: Acceso al pago del Curso de Inducción.
 *
 * Public, chrome-less (`AuthLayout`, no Sidebar/Navbar) — anonymous entry
 * point for the CANDIDATO identity tier. Per `specs/admision-screens/spec.md`
 * — "Portal Candidato Acceso (Screen 16, RF-ADM-010)": two access paths,
 * simulated LlaveMX (no real OAuth) and folio + last-3-CURP-characters
 * (client-side format validation + local mock matching only, no backend call).
 *
 * On success (either path): `setRole('CANDIDATO')` via `useRole()` and
 * navigate to Screen 17 (`/portal/induccion/pago`) with the matched
 * candidate via route state. On failed folio+CURP match: inline error,
 * stays on this screen (no navigation).
 *
 * Deviation note (documented, not silent): the UX prompt labels the second
 * field "Últimos 3 dígitos de tu CURP", and the spec's format-validation note
 * says "exactly 3 digits". However every CURP in `mockCandidates` ends in a
 * letter+2-digit homoclave (e.g. "...RRN08", "...RRS03") — the real Mexican
 * CURP format's last 3 characters are NOT purely numeric. Enforcing a
 * digits-only check would make local mock matching impossible for 100% of
 * the seed data. This screen validates "exactly 3 characters" (any
 * alphanumeric) instead, matching real CURP shape and keeping the "local
 * mock matching" scenario actually functional.
 *
 * CORRECTION (2026-07-02, orchestrator review): folio+CURP login now also
 * requires `induccionHabilitada === true`. Without this gate, any candidate
 * with a matching folio+CURP could reach the payment screen regardless of
 * Screen 15's habilitación step — defeating the purpose of that screen. The
 * LlaveMX path already only ever mocks a habilitado candidate, so it needed
 * no change.
 */

// Mirrors `Login.tsx`'s page-local `LlaveMXIcon` — kept local (not shared/exported)
// since Login.tsx doesn't export it either.
function LlaveMXIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
      <path d="M12 8h8M17 8v3M19.5 8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

const FOLIO_PATTERN = /^ADM-\d{4}-\d+$/i

export default function PortalInduccion() {
  const navigate = useNavigate()
  const { setRole } = useRole()

  const [folio, setFolio] = useState('')
  const [curpSuffix, setCurpSuffix] = useState('')
  const [error, setError] = useState('')
  const [llaveLoading, setLlaveLoading] = useState(false)

  function accederConCandidato(candidate: Candidate) {
    setRole('CANDIDATO')
    navigate('/portal/induccion/pago', { state: { candidate } })
  }

  function handleLlaveMX() {
    setError('')
    setLlaveLoading(true)
    // Simulated LlaveMX OAuth — no real redirect/identity provider, per spec
    // ("simulated LlaveMX (no real OAuth)").
    setTimeout(() => {
      setLlaveLoading(false)
      const candidate = mockCandidates.find(c => c.induccionHabilitada) ?? mockCandidates[0]
      accederConCandidato(candidate)
    }, 1200)
  }

  function handleAccederManual(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!FOLIO_PATTERN.test(folio.trim())) {
      setError('Folio inválido. Verifica el formato, ej. ADM-2026-000101.')
      return
    }
    if (curpSuffix.trim().length !== 3) {
      setError('Ingresa los últimos 3 dígitos de tu CURP.')
      return
    }

    const match = mockCandidates.find(
      c =>
        c.folio.toLowerCase() === folio.trim().toLowerCase() &&
        c.curp.slice(-3).toLowerCase() === curpSuffix.trim().toLowerCase()
    )

    if (!match) {
      setError('No encontramos un candidato con ese folio y CURP. Verifica tus datos.')
      return
    }
    if (!match.induccionHabilitada) {
      setError('Tu ficha aún no ha sido habilitada para el pago del Curso de Inducción. Contacta a Servicios Escolares.')
      return
    }

    accederConCandidato(match)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-[#009574] px-6 py-4 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <GraduationCap size={18} className="text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-[14px] leading-tight">UTEZ — SISA v2</p>
          <p className="text-white/70 text-[11px] leading-tight">Curso de Inducción</p>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left panel — 40%, soft primary background */}
        <div className="lg:w-[40%] bg-[#e6f5f1] flex flex-col items-center justify-center px-10 py-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#009574]/15 flex items-center justify-center mb-5">
            <GraduationCap size={28} className="text-[#009574]" />
          </div>
          <h1 className="text-[22px] font-bold text-[#333333] leading-snug max-w-xs">
            Acceso al pago del Curso de Inducción
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-3 max-w-xs">
            Si fuiste habilitado por Servicios Escolares, aquí puedes consultar y pagar tu curso de inducción.
          </p>
        </div>

        {/* Right panel — 60% */}
        <div className="lg:w-[60%] flex flex-col items-center justify-center px-6 py-14">
          <div className="w-full max-w-sm">
            <h2 className="text-[18px] font-bold text-[#333333] mb-5">Elige cómo acceder</h2>

            {/* Opción A — LlaveMX (destacada) */}
            <div className="border-2 border-[#009574] rounded-lg p-5 mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[13px] font-semibold text-[#333333]">LlaveMX</span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded uppercase tracking-wide">
                  Nuevo
                </span>
              </div>
              <p className="text-[12px] text-[#6B7280] mb-4">
                Accede de forma segura con tu identidad digital LlaveMX.
              </p>
              <button
                type="button"
                onClick={handleLlaveMX}
                disabled={llaveLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[14px] font-semibold bg-[#009574] hover:bg-[#007a5e] active:scale-[0.99] text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {llaveLoading ? <Loader2 size={16} className="animate-spin" /> : <LlaveMXIcon />}
                Acceder con LlaveMX
              </button>
            </div>

            {/* Separador */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-[#E5E7EB]" />
              <span className="text-[12px] text-[#9CA3AF] font-medium">o ingresa tus datos manualmente</span>
              <div className="flex-1 h-px bg-[#E5E7EB]" />
            </div>

            {/* Opción B — Folio + CURP (estado visible por defecto) */}
            <form onSubmit={handleAccederManual} noValidate>
              <p className="text-[13px] font-semibold text-[#333333] mb-3">Acceso con datos de ficha</p>

              <div className="mb-3">
                <label htmlFor="folio" className="block text-[12px] font-medium text-[#333333] mb-1.5">
                  Folio de candidato
                </label>
                <input
                  id="folio"
                  value={folio}
                  onChange={e => {
                    setFolio(e.target.value)
                    if (error) setError('')
                  }}
                  placeholder="ADM-2026-XXXX"
                  className="w-full px-3.5 py-2.5 text-[14px] rounded-lg border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#009574]/25 focus:border-[#009574] hover:border-[#009574]/50 transition bg-white text-[#333333] placeholder-[#9CA3AF]"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="curpSuffix" className="block text-[12px] font-medium text-[#333333] mb-1.5">
                  Últimos 3 dígitos de tu CURP
                </label>
                <input
                  id="curpSuffix"
                  value={curpSuffix}
                  onChange={e => {
                    setCurpSuffix(e.target.value.slice(0, 3))
                    if (error) setError('')
                  }}
                  maxLength={3}
                  placeholder="ej. 007"
                  className="w-full px-3.5 py-2.5 text-[14px] rounded-lg border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#009574]/25 focus:border-[#009574] hover:border-[#009574]/50 transition bg-white text-[#333333] placeholder-[#9CA3AF]"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mb-4">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[14px] font-semibold border-2 border-[#009574] text-[#009574] hover:bg-[#e6f5f1] active:scale-[0.99] transition-all"
              >
                Acceder
              </button>
            </form>

            <p className="text-center text-[12px] text-[#9CA3AF] mt-6 leading-relaxed">
              ¿Problemas para acceder? Acude a la ventanilla de Servicios Escolares.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
