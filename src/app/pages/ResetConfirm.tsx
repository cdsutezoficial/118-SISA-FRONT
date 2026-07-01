import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Eye, EyeOff, AlertCircle, CheckCircle2, GraduationCap, XCircle } from 'lucide-react'

// ─── Left panel ───────────────────────────────────────────────────────────────

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

// ─── Password strength ────────────────────────────────────────────────────────

type Strength = 'empty' | 'weak' | 'medium' | 'strong'

function calcStrength(pw: string): Strength {
  if (!pw) return 'empty'
  let score = 0
  if (pw.length >= 8)           score++
  if (/[A-Z]/.test(pw))         score++
  if (/[0-9]/.test(pw))         score++
  if (/[^A-Za-z0-9]/.test(pw))  score++
  if (score <= 1) return 'weak'
  if (score === 2) return 'medium'
  return 'strong'
}

const strengthLabel: Record<Strength, string>  = { empty: '', weak: 'Débil', medium: 'Media', strong: 'Fuerte' }
const strengthColor: Record<Strength, string>  = { empty: 'bg-[#E5E7EB]', weak: 'bg-red-400', medium: 'bg-amber-400', strong: 'bg-emerald-500' }
const strengthText: Record<Strength, string>   = { empty: '', weak: 'text-red-600', medium: 'text-amber-600', strong: 'text-emerald-600' }
const strengthWidth: Record<Strength, string>  = { empty: 'w-0', weak: 'w-1/3', medium: 'w-2/3', strong: 'w-full' }

// ─── PasswordInput ────────────────────────────────────────────────────────────

function PasswordInput({ id, value, onChange, placeholder, hasError }: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string; hasError?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? '••••••••'}
        autoComplete="new-password"
        className={`w-full pl-3.5 pr-11 py-2.5 text-[14px] rounded-lg border transition focus:outline-none focus:ring-2 ${
          hasError
            ? 'border-red-400 focus:ring-red-300/40'
            : 'border-[#E5E7EB] focus:ring-[#009574]/25 focus:border-[#009574] hover:border-[#009574]/50'
        } bg-white text-[#333333] placeholder-[#9CA3AF]`}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
        aria-label={show ? 'Ocultar' : 'Mostrar'}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResetConfirm() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const tokenExpired = params.get('expired') === 'true'
  // Allow toggling expired state for prototype purposes
  const [expired, setExpired] = useState(tokenExpired)
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const strength    = calcStrength(nueva)
  const noCoincide  = !!confirmar && nueva !== confirmar
  const errNueva    = submitted && !nueva.trim()
  const errConfirmar = submitted && (!confirmar.trim() || noCoincide)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!nueva.trim() || !confirmar.trim() || nueva !== confirmar) return
    setLoading(true)
    setTimeout(() => { setLoading(false); setDone(true) }, 1200)
  }

  return (
    <div className="min-h-screen flex font-['Inter',sans-serif]">
      {/* ── Left panel ─────────────────────────────────────────────── */}
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

      {/* ── Right panel ────────────────────────────────────────────── */}
      <div className="flex-1 bg-white flex flex-col items-center justify-center px-8 py-12">
        <div className="w-full max-w-sm">

          {/* ── State: Token expired ── */}
          {expired && (
            <div className="flex flex-col items-center text-center gap-5">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                <XCircle size={32} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-[20px] font-bold text-[#333333] mb-2 leading-tight">
                  El enlace ha expirado<br />o ya fue utilizado
                </h2>
                <p className="text-[14px] text-[#6B7280] leading-relaxed">
                  Los enlaces de restablecimiento son válidos por{' '}
                  <strong className="text-[#333333]">30 minutos</strong> y de un solo uso.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/reset-password')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[14px] font-semibold border border-[#E5E7EB] bg-white text-[#333333] hover:bg-[#F8F9FA] transition-colors"
              >
                Solicitar un nuevo enlace
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-[12px] text-[#009574] hover:text-[#007a5e] font-medium transition-colors"
              >
                Regresar al Login
              </button>
            </div>
          )}

          {/* ── State: Success ── */}
          {!expired && done && (
            <div className="flex flex-col items-center text-center gap-5">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>
              <div>
                <h2 className="text-[20px] font-bold text-[#333333] mb-2">
                  Contraseña restablecida correctamente
                </h2>
                <p className="text-[14px] text-[#6B7280]">
                  Ya puedes iniciar sesión con tu nueva contraseña.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[14px] font-semibold bg-[#009574] hover:bg-[#007a5e] text-white transition-colors shadow-sm shadow-[#009574]/20"
              >
                Iniciar Sesión
              </button>
            </div>
          )}

          {/* ── State: Form (token valid) ── */}
          {!expired && !done && (
            <>
              <div className="mb-8">
                <h2 className="text-[26px] font-bold text-[#333333] leading-tight">Nueva Contraseña</h2>
                <p className="text-[14px] text-[#6B7280] mt-2">
                  Ingresa y confirma tu nueva contraseña de acceso al sistema.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                {/* Nueva contraseña */}
                <div>
                  <label htmlFor="nueva" className="block text-[13px] font-medium text-[#333333] mb-1.5">
                    Nueva Contraseña <span className="text-red-500">*</span>
                  </label>
                  <PasswordInput id="nueva" value={nueva} onChange={setNueva} hasError={errNueva} />

                  {/* Strength bar */}
                  {nueva && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-300 ${strengthColor[strength]} ${strengthWidth[strength]}`} />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className={`text-[11px] font-semibold ${strengthText[strength]}`}>{strengthLabel[strength]}</p>
                        <div className="flex gap-1">
                          {(['weak', 'medium', 'strong'] as Strength[]).map(s => (
                            <div key={s} className={`w-1.5 h-1.5 rounded-full transition-colors ${
                              (strength === 'weak' && s === 'weak') ||
                              (strength === 'medium' && (s === 'weak' || s === 'medium')) ||
                              strength === 'strong'
                                ? strengthColor[strength] : 'bg-[#E5E7EB]'
                            }`} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {errNueva
                    ? <p className="mt-1 flex items-center gap-1 text-[12px] text-red-600"><AlertCircle size={12} />Este campo es obligatorio.</p>
                    : <p className="mt-1.5 text-[12px] text-[#6B7280]">Mínimo 8 caracteres, una mayúscula y un número.</p>
                  }
                </div>

                {/* Confirmar contraseña */}
                <div>
                  <label htmlFor="confirmar" className="block text-[13px] font-medium text-[#333333] mb-1.5">
                    Confirmar Nueva Contraseña <span className="text-red-500">*</span>
                  </label>
                  <PasswordInput id="confirmar" value={confirmar} onChange={setConfirmar} hasError={errConfirmar || noCoincide} />
                  {(noCoincide || errConfirmar) && (
                    <p className="mt-1 flex items-center gap-1 text-[12px] text-red-600"><AlertCircle size={12} />Las contraseñas no coinciden.</p>
                  )}
                  {confirmar && nueva === confirmar && (
                    <p className="mt-1 flex items-center gap-1 text-[12px] text-emerald-600"><CheckCircle2 size={12} />Las contraseñas coinciden.</p>
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
                  {loading && (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  {loading ? 'Restableciendo...' : 'Restablecer Contraseña'}
                </button>
              </form>

              {/* Prototype state toggle */}
              <div className="mt-8 pt-4 border-t border-[#E5E7EB] flex justify-center">
                <button
                  type="button"
                  onClick={() => setExpired(true)}
                  className="text-[11px] text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
                >
                  Simular token expirado →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
