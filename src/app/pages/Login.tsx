import { useState } from 'react'
import { Eye, EyeOff, AlertCircle, Loader2, GraduationCap } from 'lucide-react'
import type { NavigateFn } from '../shared/types'

interface Props { navigate: NavigateFn }

// ─── LlaveMX logo mark ────────────────────────────────────────────────────────

function LlaveMXIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
      <path d="M12 8h8M17 8v3M19.5 8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// ─── Ilustración izquierda ────────────────────────────────────────────────────

function UniversityIllustration() {
  return (
    <svg viewBox="0 0 320 220" fill="none" className="w-full max-w-xs opacity-20" aria-hidden="true">
      {/* Base / ground */}
      <rect x="20" y="190" width="280" height="4" rx="2" fill="white" />
      {/* Main building */}
      <rect x="90" y="100" width="140" height="90" rx="2" fill="white" />
      {/* Roof / pediment */}
      <polygon points="75,100 160,55 245,100" fill="white" />
      {/* Columns */}
      {[110, 135, 160, 185, 210].map(x => (
        <rect key={x} x={x} y="110" width="8" height="80" rx="1" fill="white" opacity="0.4" />
      ))}
      {/* Door */}
      <rect x="143" y="148" width="34" height="42" rx="3" fill="white" opacity="0.5" />
      {/* Windows */}
      <rect x="108" y="118" width="22" height="18" rx="2" fill="white" opacity="0.3" />
      <rect x="190" y="118" width="22" height="18" rx="2" fill="white" opacity="0.3" />
      {/* Flag pole */}
      <line x1="160" y1="55" x2="160" y2="20" stroke="white" strokeWidth="2" />
      <rect x="160" y="20" width="22" height="14" rx="1" fill="white" opacity="0.6" />
      {/* Side wings */}
      <rect x="30" y="135" width="60" height="55" rx="2" fill="white" opacity="0.5" />
      <rect x="230" y="135" width="60" height="55" rx="2" fill="white" opacity="0.5" />
      {/* Trees */}
      <circle cx="50" cy="175" r="12" fill="white" opacity="0.25" />
      <rect x="48" y="185" width="4" height="8" fill="white" opacity="0.25" />
      <circle cx="270" cy="175" r="12" fill="white" opacity="0.25" />
      <rect x="268" y="185" width="4" height="8" fill="white" opacity="0.25" />
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Login({ navigate }: Props) {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!usuario.trim() || !password.trim()) {
      setStatus('error')
      setErrorMsg('Ingresa tu usuario y contraseña para continuar.')
      return
    }
    setStatus('loading')
    setErrorMsg('')
    // Simulate async auth — accept any non-empty credentials after 1.2s
    setTimeout(() => {
      if (password === 'error') {
        setStatus('error')
        setErrorMsg('Credenciales incorrectas. Verifica tu usuario y contraseña.')
      } else if (password === 'primer') {
        // Primer acceso — mustChangePassword
        navigate({ page: 'cambiar-password', mode: 'view' })
      } else {
        navigate({ page: 'dashboard' })
      }
    }, 1200)
  }

  const isLoading = status === 'loading'

  return (
    <div className="min-h-screen flex font-['Inter',sans-serif]">
      {/* ── Left panel ───────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#009574] flex-col items-center justify-center px-12 py-16 relative overflow-hidden">
        {/* Subtle radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_40%,rgba(255,255,255,0.08),transparent_70%)] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center gap-6 max-w-sm">
          {/* Institution mark */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
              <GraduationCap size={28} className="text-white" />
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-[17px] leading-tight tracking-tight">UTEZ</p>
              <p className="text-white/70 text-[11px] font-medium leading-tight">Universidad Tecnológica<br />Emiliano Zapata</p>
            </div>
          </div>

          {/* System name */}
          <div>
            <h1 className="text-white font-bold text-[26px] leading-tight tracking-tight">
              Sistema Integral de<br />Servicios Académicos
            </h1>
            <p className="text-white/60 text-[13px] font-medium mt-1 tracking-wider uppercase">SISA v2</p>
          </div>

          {/* Illustration */}
          <UniversityIllustration />

          {/* Tagline */}
          <p className="text-white/50 text-[12px] leading-relaxed max-w-[240px]">
            Administra el ciclo de vida completo del estudiante, desde candidato hasta egresado.
          </p>
        </div>
      </div>

      {/* ── Right panel ──────────────────────────────────────────────────── */}
      <div className="flex-1 bg-white flex flex-col items-center justify-center px-8 py-12">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-[#009574] flex items-center justify-center">
            <GraduationCap size={20} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-[14px] text-[#333333]">UTEZ — SISA v2</p>
          </div>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-[26px] font-bold text-[#333333] leading-tight">Iniciar Sesión</h2>
            <p className="text-[14px] text-[#6B7280] mt-1">
              Ingresa tus credenciales institucionales para continuar.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Usuario */}
            <div>
              <label htmlFor="usuario" className="block text-[13px] font-medium text-[#333333] mb-1.5">
                Usuario institucional
              </label>
              <input
                id="usuario"
                type="email"
                autoComplete="username"
                placeholder="Ej. 202630001@utez.edu.mx"
                value={usuario}
                onChange={e => { setUsuario(e.target.value); if (status === 'error') setStatus('idle') }}
                disabled={isLoading}
                className={`w-full px-3.5 py-2.5 text-[14px] rounded-lg border transition focus:outline-none focus:ring-2 ${
                  status === 'error' && !usuario
                    ? 'border-red-400 focus:ring-red-300/40'
                    : 'border-[#E5E7EB] focus:ring-[#009574]/25 focus:border-[#009574] hover:border-[#009574]/50'
                } ${isLoading ? 'bg-[#F8F9FA] cursor-not-allowed text-[#6B7280]' : 'bg-white text-[#333333]'} placeholder-[#9CA3AF]`}
              />
            </div>

            {/* Contraseña */}
            <div>
              <label htmlFor="password" className="block text-[13px] font-medium text-[#333333] mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (status === 'error') setStatus('idle') }}
                  disabled={isLoading}
                  className={`w-full pl-3.5 pr-11 py-2.5 text-[14px] rounded-lg border transition focus:outline-none focus:ring-2 ${
                    status === 'error' && !password
                      ? 'border-red-400 focus:ring-red-300/40'
                      : 'border-[#E5E7EB] focus:ring-[#009574]/25 focus:border-[#009574] hover:border-[#009574]/50'
                  } ${isLoading ? 'bg-[#F8F9FA] cursor-not-allowed text-[#6B7280]' : 'bg-white text-[#333333]'} placeholder-[#9CA3AF]`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors disabled:opacity-40"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Forgot password */}
              <div className="flex justify-end mt-1.5">
                <button type="button" onClick={() => navigate({ page: 'reset-password' })} className="text-[12px] text-[#009574] hover:text-[#007a5e] font-medium transition-colors">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </div>

            {/* Error message */}
            {status === 'error' && errorMsg && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                {errorMsg}
              </div>
            )}

            {/* Primary button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[14px] font-semibold transition-all ${
                isLoading
                  ? 'bg-[#009574]/70 text-white cursor-not-allowed'
                  : 'bg-[#009574] hover:bg-[#007a5e] active:scale-[0.99] text-white shadow-sm shadow-[#009574]/20'
              }`}
            >
              {isLoading && <Loader2 size={16} className="animate-spin" />}
              {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#E5E7EB]" />
              <span className="text-[12px] text-[#9CA3AF] font-medium">o</span>
              <div className="flex-1 h-px bg-[#E5E7EB]" />
            </div>

            {/* LlaveMX button */}
            <button
              type="button"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[14px] font-semibold border-2 border-[#009574] text-[#009574] hover:bg-[#e6f5f1] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LlaveMXIcon />
              Iniciar sesión con LlaveMX
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-[12px] text-[#9CA3AF] mt-8 leading-relaxed">
            ¿Problemas para acceder?{' '}
            <button className="text-[#009574] hover:text-[#007a5e] font-medium transition-colors">
              Contacta a soporte técnico
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
