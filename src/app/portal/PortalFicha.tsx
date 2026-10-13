import { useState } from 'react'
import { useNavigate } from 'react-router'
import { GraduationCap, Loader2, Lock } from 'lucide-react'
import { Button, TextField } from '@app/core/components/form'
import { LlaveMxButton } from '@app/core/components/LlaveMxButton'
import { ErrorBanner } from '@app/core/components/list'
import { useRole } from '@app/core/infra/RoleContext'
import { apiPost } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'
import { fichaAccessStorageKey } from '@app/modules/admision/hooks/useFichaPayment'
import type { FichaPaymentAccessBackend } from '@app/modules/admision/data/types'

/**
 * Portal — "Vuelve a pagar mi ficha" access (the ficha-payment flow, sibling of
 * `PortalInduccion.tsx`, which is the induction-course flow).
 *
 * Public, chrome-less (`AuthLayout`, no Sidebar/Navbar). The applicant's way
 * back into a ficha she registered but never paid: she identifies with her
 * {@code folio} plus the last 3 characters of her {@code CURP} and, on success,
 * lands on {@code /portal/ficha/pago} — a dedicated payment screen, NOT the
 * full ficha, because that lookup is a weak proof of identity.
 *
 * TWO ACCESS PATHS, as the original design had (and the spec asks for):
 * 1. LlaveMX — the official Digital Morelos button, shown with its "Nuevo"
 *    badge. Still NO OAuth, so it deliberately does not navigate: it would have
 *    nowhere real to go, and the payment screen needs a backend payload this
 *    screen cannot mint without an identity provider. It is the visible
 *    placeholder for that future path. `PortalInduccion.tsx` shows the same
 *    button, but there the whole flow is mock, so it can afford to fake a
 *    navigation — do not copy that asymmetry backwards.
 * 2. Folio + CURP suffix — fully wired to {@code POST /candidates/payment-access}.
 *    This path used to compare the input against `mockCandidates` in the
 *    browser, which meant it "worked" without any backend and never validated
 *    anything.
 *
 * IDENTITY — why only folio + CURP suffix, and why it is a risk. Until LlaveMX
 * is a real OAuth tier there is no strong identity here. A folio is sequential
 * and a 3-character CURP tail is a small space, so the endpoint is
 * brute-forceable by design; three things bound that: the response is
 * payment-only (no address, health profile, income or grades), a wrong folio and
 * a wrong CURP return the SAME message so it cannot be used to enumerate folios,
 * and the backend throttles per IP (429 after 10 tries in 10 minutes by
 * default).
 */

/** Must match the backend's `FichaPaymentRequest` pattern — kept loose enough
 *  to accept the real shape, and the server re-validates anyway. */
const FOLIO_PATTERN = /^ADM-\d{4}-\d+$/i

export default function PortalFicha() {
  const navigate = useNavigate()
  const { setRole } = useRole()

  const [folio, setFolio] = useState('')
  const [curpSuffix, setCurpSuffix] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function handleAcceder(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const folioLimpio = folio.trim()
    const sufijoLimpio = curpSuffix.trim()

    if (!FOLIO_PATTERN.test(folioLimpio)) {
      setError('Folio inválido. Verifica el formato, ej. ADM-2026-000101.')
      return
    }
    if (sufijoLimpio.length !== 3) {
      setError('Ingresa los últimos 3 caracteres de tu CURP.')
      return
    }

    setLoading(true)
    try {
      const acceso = await apiPost<FichaPaymentAccessBackend>('/candidates/payment-access', {
        folio: folioLimpio,
        curpSuffix: sufijoLimpio,
      })
      // Mirror the payload into sessionStorage keyed by candidate id: a bank
      // 3D Secure challenge round-trips through the gateway, so this page can be
      // RELOADED at `?id=…&orderId=…` with the route state gone. Without this the
      // applicant would come back to a blank screen after paying.
      try {
        sessionStorage.setItem(fichaAccessStorageKey(acceso.candidateId), JSON.stringify(acceso))
      } catch {
        // sessionStorage unavailable — the common (no-3DS) path still works
      }
      setRole('CANDIDATO')
      navigate('/portal/ficha/pago', { state: { acceso } })
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 429) {
        setError(
          apiErr.message ?? 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.'
        )
      } else if (apiErr.status === 400) {
        setError('Los datos no tienen el formato esperado. Revisa tu folio y tu CURP.')
      } else {
        // 404 and anything else: the backend already returns ONE generic message
        // for "no such folio" and "wrong CURP" so the form cannot be used to
        // probe which folios exist — surface it verbatim.
        setError(apiErr.message ?? 'No encontramos una ficha de admisión con esos datos. Verifica e inténtalo de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-[#009574] px-6 py-4 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <GraduationCap size={18} className="text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-[14px] leading-tight">UTEZ — SISA v2</p>
          <p className="text-white/70 text-[11px] leading-tight">Admisión</p>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left panel — 40%, soft primary background */}
        <div className="lg:w-[40%] bg-[#e6f5f1] flex flex-col items-center justify-center px-10 py-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#009574]/15 flex items-center justify-center mb-5">
            <GraduationCap size={28} className="text-[#009574]" />
          </div>
          <h1 className="text-[22px] font-bold text-[#333333] leading-snug max-w-xs">
            Paga tu ficha de admisión
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-3 max-w-xs">
            ¿Registraste tu ficha y no alcanzaste a pagarla? Ingresa tu folio y los últimos 3
            caracteres de tu CURP para continuar con el pago en línea.
          </p>
        </div>

        {/* Right panel — 60% */}
        <div className="lg:w-[60%] flex flex-col items-center justify-center px-6 py-14">
          <div className="w-full max-w-sm">
            <h2 className="text-[18px] font-bold text-[#333333] mb-5">Elige cómo acceder</h2>

            {/* Opción A — LlaveMX. Solo visual: sin OAuth real el botón no hace nada. */}
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
              <LlaveMxButton className="w-full max-w-none" />
            </div>

            {/* Separador */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-[#E5E7EB]" />
              <span className="text-[12px] text-[#9CA3AF] font-medium">o ingresa tus datos manualmente</span>
              <div className="flex-1 h-px bg-[#E5E7EB]" />
            </div>

            {/* Folio + CURP, against the real backend. */}
            <form onSubmit={handleAcceder} noValidate>
              <p className="text-[13px] font-semibold text-[#333333] mb-3">Acceso con datos de ficha</p>

              <div className="mb-3">
                <TextField
                  label="Folio de candidato"
                  value={folio}
                  onChange={v => {
                    setFolio(v)
                    if (error) setError('')
                  }}
                  placeholder="ADM-2026-000101"
                  mono
                />
              </div>

              <div className="mb-4">
                <TextField
                  label="Últimos 3 caracteres de tu CURP"
                  value={curpSuffix}
                  onChange={v => {
                    setCurpSuffix(v.slice(0, 3).toUpperCase())
                    if (error) setError('')
                  }}
                  maxLength={3}
                  placeholder="ej. N08"
                  mono
                />
              </div>

              {error && <ErrorBanner message={error} />}

              <Button variant="outline" type="submit" className="w-full py-2.5" loading={loading} disabled={loading}>
                {loading ? 'Buscando tu ficha...' : 'Continuar al pago'}
              </Button>
            </form>

            <p className="text-[12px] text-[#9CA3AF] mt-6 leading-relaxed flex items-start gap-1.5">
              <Lock size={12} className="mt-0.5 flex-shrink-0" />
              <span>
                Tu folio y CURP se usan solo para localizar tu pago, que se realiza de forma segura en esta
                misma página.
              </span>
            </p>

            {loading && (
              <div className="flex items-center justify-center gap-2 mt-4 text-[12px] text-[#6B7280]">
                <Loader2 size={14} className="animate-spin text-[#009574]" />
                Consultando tu ficha...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
