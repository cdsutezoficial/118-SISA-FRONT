import { useState } from 'react'
import { ChevronRight, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router'

// ─── Password strength ─────────────────────────────────────────────────────────

type Strength = 'empty' | 'weak' | 'medium' | 'strong'

function calcStrength(pw: string): Strength {
  if (!pw) return 'empty'
  let score = 0
  if (pw.length >= 8)            score++
  if (/[A-Z]/.test(pw))          score++
  if (/[0-9]/.test(pw))          score++
  if (/[^A-Za-z0-9]/.test(pw))   score++
  if (score <= 1) return 'weak'
  if (score === 2) return 'medium'
  return 'strong'
}

const strengthLabel: Record<Strength, string> = {
  empty: '', weak: 'Débil', medium: 'Media', strong: 'Fuerte',
}
const strengthColor: Record<Strength, string> = {
  empty: 'bg-[#E5E7EB]', weak: 'bg-red-400', medium: 'bg-amber-400', strong: 'bg-emerald-500',
}
const strengthText: Record<Strength, string> = {
  empty: 'text-[#6B7280]', weak: 'text-red-600', medium: 'text-amber-600', strong: 'text-emerald-600',
}
const strengthWidth: Record<Strength, string> = {
  empty: 'w-0', weak: 'w-1/3', medium: 'w-2/3', strong: 'w-full',
}

// ─── PasswordInput ─────────────────────────────────────────────────────────────

function PasswordInput({ id, value, onChange, placeholder, hasError, disabled }: {
  id: string; value: string; onChange: (v: string) => void
  placeholder?: string; hasError?: boolean; disabled?: boolean
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
        disabled={disabled}
        autoComplete="off"
        className={`w-full pl-3.5 pr-11 py-2.5 text-[13px] rounded-lg border transition focus:outline-none focus:ring-2 ${
          hasError
            ? 'border-red-400 focus:ring-red-300/40'
            : 'border-[#E5E7EB] focus:ring-[#009574]/25 focus:border-[#009574] hover:border-[#009574]/50'
        } ${disabled ? 'bg-[#F8F9FA] cursor-not-allowed text-[#6B7280]' : 'bg-white text-[#333333]'} placeholder-[#9CA3AF]`}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        disabled={disabled}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors disabled:opacity-40"
        aria-label={show ? 'Ocultar' : 'Mostrar'}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CambiarPassword() {
  const navigate = useNavigate()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const strength = calcStrength(nueva)

  const errActual    = submitted && !actual.trim()
  const errNueva     = submitted && !nueva.trim()
  const errCoincide  = submitted && !!confirmar && nueva !== confirmar
  const noCoincide   = !!confirmar && nueva !== confirmar

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!actual.trim() || !nueva.trim() || nueva !== confirmar) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setDone(true)
      setTimeout(() => navigate('/dashboard'), 2500)
    }, 1000)
  }

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-[#009574] transition-colors">Inicio</button>
        <ChevronRight size={13} />
        <span className="text-[#6B7280]">Mi Cuenta</span>
        <ChevronRight size={13} />
        <span className="text-[#333333] font-medium">Cambiar Contraseña</span>
      </nav>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#333333]">Cambiar Contraseña</h1>
        <p className="text-[14px] text-[#6B7280] mt-1">Actualiza tu contraseña de acceso al sistema.</p>
      </div>

      <hr className="border-[#E5E7EB] mb-8" />

      {/* Centered form */}
      <div className="max-w-[480px]">
        {/* Success state */}
        {done ? (
          <div className="bg-white border border-emerald-200 rounded-xl p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
              <ShieldCheck size={28} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-[#333333] mb-1">Contraseña actualizada</p>
              <p className="text-[13px] text-[#6B7280]">Tu contraseña se actualizó correctamente. Redirigiendo...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-8 space-y-6">

              {/* Contraseña actual */}
              <div>
                <label htmlFor="actual" className="block text-[13px] font-medium text-[#333333] mb-1.5">
                  Contraseña Actual <span className="text-red-500">*</span>
                </label>
                <PasswordInput id="actual" value={actual} onChange={setActual} hasError={errActual} />
                {errActual && (
                  <p className="mt-1 flex items-center gap-1 text-[12px] text-red-600"><AlertCircle size={12} />Este campo es obligatorio.</p>
                )}
              </div>

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
                      <p className={`text-[11px] font-semibold ${strengthText[strength]}`}>
                        {strengthLabel[strength]}
                      </p>
                      <div className="flex gap-1">
                        {(['weak', 'medium', 'strong'] as Strength[]).map(s => (
                          <div key={s} className={`w-1.5 h-1.5 rounded-full transition-colors ${
                            (strength === 'weak' && s === 'weak') ||
                            (strength === 'medium' && (s === 'weak' || s === 'medium')) ||
                            (strength === 'strong')
                              ? strengthColor[strength]
                              : 'bg-[#E5E7EB]'
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

              {/* Confirmar */}
              <div>
                <label htmlFor="confirmar" className="block text-[13px] font-medium text-[#333333] mb-1.5">
                  Confirmar Nueva Contraseña <span className="text-red-500">*</span>
                </label>
                <PasswordInput id="confirmar" value={confirmar} onChange={setConfirmar} hasError={errCoincide || (submitted && !confirmar.trim())} />
                {(noCoincide || errCoincide) && (
                  <p className="mt-1 flex items-center gap-1 text-[12px] text-red-600"><AlertCircle size={12} />Las contraseñas no coinciden.</p>
                )}
                {confirmar && nueva === confirmar && (
                  <p className="mt-1 flex items-center gap-1 text-[12px] text-emerald-600"><CheckCircle2 size={12} />Las contraseñas coinciden.</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button type="button" onClick={() => navigate('/dashboard')}
                className="px-4 py-2 text-[13px] font-medium border border-[#E5E7EB] bg-white text-[#333333] rounded-md hover:bg-[#F8F9FA] transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={loading}
                className={`flex items-center gap-2 px-5 py-2 text-[13px] font-semibold rounded-md transition-all ${
                  loading
                    ? 'bg-[#009574]/70 text-white cursor-not-allowed'
                    : 'bg-[#009574] hover:bg-[#007a5e] text-white'
                }`}>
                {loading && (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Toast */}
      {done && (
        <div className="fixed top-5 right-5 z-[100] flex items-center gap-3 bg-white border border-emerald-200 shadow-lg rounded-lg px-4 py-3">
          <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
          <span className="text-[13px] font-medium text-[#333333]">Tu contraseña se actualizó correctamente.</span>
        </div>
      )}
    </div>
  )
}
