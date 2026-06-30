import { useState } from 'react'
import { ArrowLeft, AlertCircle, GraduationCap, Loader2, Mail } from 'lucide-react'
import type { NavigateFn } from '../shared/types'

interface Props { navigate: NavigateFn }

// ─── Left panel — same institutional branding as Login ────────────────────────

function UniversityIllustration() {
  return (
    <svg viewBox="0 0 320 220" fill="none" className="w-full max-w-xs opacity-20" aria-hidden="true">
      <rect x="20" y="190" width="280" height="4" rx="2" fill="white" />
      <rect x="90" y="100" width="140" height="90" rx="2" fill="white" />
      <polygon points="75,100 160,55 245,100" fill="white" />
      {[110, 135, 160, 185, 210].map(x => (
        <rect key={x} x={x} y="110" width="8" height="80" rx="1" fill="white" opacity="0.4" />
      ))}
      <rect x="143" y="148" width="34" height="42" rx="3" fill="white" opacity="0.5" />
      <rect x="108" y="118" width="22" height="18" rx="2" fill="white" opacity="0.3" />
      <rect x="190" y="118" width="22" height="18" rx="2" fill="white" opacity="0.3" />
      <line x1="160" y1="55" x2="160" y2="20" stroke="white" strokeWidth="2" />
      <rect x="160" y="20" width="22" height="14" rx="1" fill="white" opacity="0.6" />
      <rect x="30" y="135" width="60" height="55" rx="2" fill="white" opacity="0.5" />
      <rect x="230" y="135" width="60" height="55" rx="2" fill="white" opacity="0.5" />
      <circle cx="50" cy="175" r="12" fill="white" opacity="0.25" />
      <rect x="48" y="185" width="4" height="8" fill="white" opacity="0.25" />
      <circle cx="270" cy="175" r="12" fill="white" opacity="0.25" />
      <rect x="268" y="185" width="4" height="8" fill="white" opacity="0.25" />
    </svg>
  )
}

// ─── Success illustration — simple envelope ───────────────────────────────────

function EnvelopeIllustration() {
  return (
    <svg width="80" height="64" viewBox="0 0 80 64" fill="none" aria-hidden="true">
      {/* Envelope body */}
      <rect x="4" y="12" width="72" height="48" rx="5" fill="#e6f5f1" stroke="#009574" strokeWidth="2" />
      {/* Envelope flap */}
      <path d="M4 17 L40 40 L76 17" stroke="#009574" strokeWidth="2" strokeLinejoin="round" fill="none" />
      {/* Seal dot */}
      <circle cx="40" cy="40" r="4" fill="#009574" opacity="0.3" />
      {/* Top fold lines */}
      <path d="M4 12 L40 36 L76 12" stroke="#009574" strokeWidth="2" strokeLinejoin="round" fill="none" opacity="0.4" />
      {/* Stars / sparkles */}
      <circle cx="68" cy="8" r="2.5" fill="#009574" opacity="0.5" />
      <circle cx="12" cy="6" r="1.5" fill="#009574" opacity="0.35" />
      <circle cx="72" cy="20" r="1.5" fill="#009574" opacity="0.35" />
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResetPassword({ navigate }: Props) {
  const [correo, setCorreo] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!correo.trim()) { setError('Ingresa tu correo institucional.'); return }
    if (!correo.includes('@')) { setError('Ingresa un correo válido.'); return }
    setError('')
    setLoading(true)
    setTimeout(() => { setLoading(false); setSent(true) }, 1200)
  }

  return (
    <div className="min-h-screen flex font-['Inter',sans-serif]">
      {/* ── Left panel ────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#009574] flex-col items-center justify-center px-12 py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_40%,rgba(255,255,255,0.08),transparent_70%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center text-center gap-6 max-w-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
              <GraduationCap size={28} className="text-white" />
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-[17px] leading-tight tracking-tight">UTEZ</p>
              <p className="text-white/70 text-[11px] font-medium leading-tight">Universidad Tecnológica<br />Emiliano Zapata</p>
            </div>
          </div>
          <div>
            <h1 className="text-white font-bold text-[26px] leading-tight tracking-tight">
              Sistema Integral de<br />Servicios Académicos
            </h1>
            <p className="text-white/60 text-[13px] font-medium mt-1 tracking-wider uppercase">SISA v2</p>
          </div>
          <UniversityIllustration />
          <p className="text-white/50 text-[12px] leading-relaxed max-w-[240px]">
            Administra el ciclo de vida completo del estudiante, desde candidato hasta egresado.
          </p>
        </div>
      </div>

      {/* ── Right panel ───────────────────────────────────────────────── */}
      <div className="flex-1 bg-white flex flex-col px-8 py-8">
        {/* Back to login */}
        <div>
          <button
            type="button"
            onClick={() => navigate({ page: 'login' })}
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#6B7280] hover:text-[#009574] transition-colors"
          >
            <ArrowLeft size={15} />Regresar al Login
          </button>
        </div>

        {/* Centered form area */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm">
            {!sent ? (
              <>
                {/* Heading */}
                <div className="mb-8">
                  <h2 className="text-[26px] font-bold text-[#333333] leading-tight">Restablecer Contraseña</h2>
                  <p className="text-[14px] text-[#6B7280] mt-2 leading-relaxed">
                    Ingresa tu correo institucional y te enviaremos un enlace para restablecer tu contraseña.
                  </p>
                </div>

                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                  {/* Correo */}
                  <div>
                    <label htmlFor="correo" className="block text-[13px] font-medium text-[#333333] mb-1.5">
                      Correo Institucional <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="correo"
                      type="email"
                      autoComplete="email"
                      placeholder="usuario@utez.edu.mx"
                      value={correo}
                      onChange={e => { setCorreo(e.target.value); if (error) setError('') }}
                      disabled={loading}
                      className={`w-full px-3.5 py-2.5 text-[14px] rounded-lg border transition focus:outline-none focus:ring-2 ${
                        error
                          ? 'border-red-400 focus:ring-red-300/40'
                          : 'border-[#E5E7EB] focus:ring-[#009574]/25 focus:border-[#009574] hover:border-[#009574]/50'
                      } ${loading ? 'bg-[#F8F9FA] cursor-not-allowed text-[#6B7280]' : 'bg-white text-[#333333]'} placeholder-[#9CA3AF]`}
                    />
                    {error && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-red-600">
                        <AlertCircle size={12} />{error}
                      </p>
                    )}
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[14px] font-semibold transition-all ${
                      loading
                        ? 'bg-[#009574]/70 text-white cursor-not-allowed'
                        : 'bg-[#009574] hover:bg-[#007a5e] active:scale-[0.99] text-white shadow-sm shadow-[#009574]/20'
                    }`}
                  >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    {loading ? 'Enviando...' : 'Enviar Enlace de Restablecimiento'}
                  </button>
                </form>
              </>
            ) : (
              /* ── Success state ── */
              <div className="flex flex-col items-center text-center gap-5">
                <div className="p-5 rounded-2xl bg-[#e6f5f1]">
                  <EnvelopeIllustration />
                </div>

                <div>
                  <h2 className="text-[22px] font-bold text-[#333333] mb-2">Revisa tu correo</h2>
                  <p className="text-[14px] text-[#6B7280] leading-relaxed max-w-xs">
                    Si el correo ingresado corresponde a una cuenta activa, recibirás un enlace válido por{' '}
                    <strong className="text-[#333333]">30 minutos</strong>.
                  </p>
                  <p className="text-[12px] text-[#9CA3AF] mt-3 font-mono">{correo}</p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate({ page: 'login' })}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-semibold border border-[#E5E7EB] bg-white text-[#333333] hover:bg-[#F8F9FA] transition-colors"
                >
                  <Mail size={15} className="text-[#6B7280]" />
                  Regresar al Login
                </button>

                <p className="text-[12px] text-[#9CA3AF] leading-relaxed max-w-[260px]">
                  ¿No recibiste el correo? Revisa tu carpeta de spam o{' '}
                  <button
                    type="button"
                    onClick={() => { setSent(false); setSubmitted(false) }}
                    className="text-[#009574] hover:underline font-medium"
                  >
                    intenta de nuevo
                  </button>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
