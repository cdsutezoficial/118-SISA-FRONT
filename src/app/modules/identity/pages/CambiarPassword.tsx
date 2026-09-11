import { useState } from 'react'
import { Eye, EyeOff, CheckCircle2, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useRole } from '@app/core/infra/RoleContext'
import { FieldLabel, FieldError, FieldHelp, Toast } from '@app/core/components/ui'
import { FormPage, FormHeader, FormCard, Button } from '@app/core/components/form'
import { Breadcrumb, ErrorBanner } from '@app/core/components/list'
import { apiChangePassword } from '@app/core/infra/auth'
import type { ApiError } from '@app/core/infra/apiClient'

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
  const { authMode, mustChangePassword, completePasswordChange, logout } = useRole()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [apiErrorMsg, setApiErrorMsg] = useState('')

  const strength = calcStrength(nueva)

  const errActual    = submitted && !actual.trim()
  const errNueva     = submitted && !nueva.trim()
  const errCoincide  = submitted && !!confirmar && nueva !== confirmar
  const noCoincide   = !!confirmar && nueva !== confirmar

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    setApiErrorMsg('')
    if (!actual.trim() || !nueva.trim() || nueva !== confirmar) return
    setLoading(true)

    // Mock mode has no real session/token — only ADMIN has a backend user
    // today, so every other role's dev workflow keeps the legacy simulation
    // unchanged (this change scopes real integration to login/session only).
    if (authMode === 'mock') {
      setTimeout(() => {
        setLoading(false)
        setDone(true)
        setTimeout(() => navigate('/dashboard'), 2500)
      }, 1000)
      return
    }

    try {
      // No explicit token param — `apiChangePassword` reads it from storage
      // via `apiPost`'s automatic Bearer attachment. `RequireAuth` already
      // guarantees a valid token before this screen renders in real mode; a
      // 401/403 here (e.g. token invalidated mid-session) is still caught
      // below and routes back to `/login`.
      await apiChangePassword(actual, nueva)
      setLoading(false)
      setDone(true)
      completePasswordChange()
      setTimeout(() => navigate('/dashboard'), 2500)
    } catch (err) {
      setLoading(false)
      const apiErr = err as Partial<ApiError>
      if (apiErr.status === 401 || apiErr.status === 403) {
        logout()
        navigate('/login')
        return
      }
      setApiErrorMsg(apiErr.message ?? 'No se pudo actualizar la contraseña. Intenta de nuevo.')
    }
  }

  return (
    <FormPage>
      {/* Breadcrumb — "Inicio" nav-away is disabled while a password change is
          mandatory (first login / forced change): the user must complete it
          before reaching any other authenticated route. */}
      <Breadcrumb
        items={[
          { label: 'Inicio', to: mustChangePassword ? undefined : '/dashboard' },
          { label: 'Mi Cuenta' },
          { label: 'Cambiar Contraseña' },
        ]}
      />

      <FormHeader
        title="Cambiar Contraseña"
        subtitle="Actualiza tu contraseña de acceso al sistema."
      />

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
            <FormCard>
              <div className="space-y-6">
                {/* Contraseña actual */}
                <div>
                  <FieldLabel required>Contraseña Actual</FieldLabel>
                  <PasswordInput id="actual" value={actual} onChange={setActual} hasError={errActual} />
                  {errActual && <FieldError>Este campo es obligatorio.</FieldError>}
                </div>

                {/* Nueva contraseña */}
                <div>
                  <FieldLabel required>Nueva Contraseña</FieldLabel>
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
                    ? <FieldError>Este campo es obligatorio.</FieldError>
                    : <FieldHelp>Mínimo 8 caracteres, una mayúscula y un número.</FieldHelp>
                  }
                </div>

                {/* Confirmar */}
                <div>
                  <FieldLabel required>Confirmar Nueva Contraseña</FieldLabel>
                  <PasswordInput id="confirmar" value={confirmar} onChange={setConfirmar} hasError={errCoincide || (submitted && !confirmar.trim())} />
                  {(noCoincide || errCoincide) && (
                    <p className="mt-1 flex items-center gap-1 text-[12px] text-red-600"><CheckCircle2 size={12} />Las contraseñas no coinciden.</p>
                  )}
                  {confirmar && nueva === confirmar && (
                    <p className="mt-1 flex items-center gap-1 text-[12px] text-emerald-600"><CheckCircle2 size={12} />Las contraseñas coinciden.</p>
                  )}
                </div>

                {/* API error banner */}
                {apiErrorMsg && <ErrorBanner message={apiErrorMsg} />}
              </div>
            </FormCard>

            {/* Actions — Cancelar is hidden while a password change is
                mandatory; there is nowhere else authenticated to go back to. */}
            <div className="flex items-center justify-end gap-3 mt-6">
              {!mustChangePassword && (
                <Button variant="secondary" onClick={() => navigate('/dashboard')}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" loading={loading}>
                {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
              </Button>
            </div>
          </form>
        )}

        {/* Toast */}
        {done && (
          <Toast message="Tu contraseña se actualizó correctamente." onClose={() => setDone(false)} />
        )}
      </div>
    </FormPage>
  )
}