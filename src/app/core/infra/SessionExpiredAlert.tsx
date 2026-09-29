import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Clock } from 'lucide-react'
import { useRole } from './RoleContext'

const REDIRECT_DELAY_MS = 5000

/**
 * Centered expiry alert rendered by `RequireAuth` over the CURRENT view when a
 * real session ends involuntarily (401 from any API call, or the JWT `exp`
 * passing while the app is open). Mirrors the app's `ConfirmModal` design —
 * a dimmed backdrop with a centered brand-styled card — and floats for 5
 * seconds before the session is actually cleared and the tab lands on `/login`.
 *
 * Cleanup happens HERE (not at the trigger): `logout()` right before
 * redirecting. Because the trigger only flags the expiry without clearing,
 * the route tree underneath keeps its hydrated role and never redirect-loops.
 */
export function SessionExpiredAlert() {
  const navigate = useNavigate()
  const { logout } = useRole()

  useEffect(() => {
    const timer = setTimeout(() => {
      logout()
      navigate('/login', { replace: true })
    }, REDIRECT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [logout, navigate])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-xl shadow-2xl border border-[#E5E7EB] w-full max-w-sm mx-4 p-6 text-center animate-in fade-in zoom-in-95">
        <div className="w-12 h-12 rounded-full bg-[#e6f5f1] flex items-center justify-center mx-auto mb-4">
          <Clock size={24} className="text-[#009574]" />
        </div>
        <h2 className="text-[18px] font-bold text-[#333333]">Tu sesión ha expirado</h2>
        <p className="text-[13px] text-[#6B7280] mt-1.5 leading-relaxed">
          Por razones de seguridad tu sesión terminó.
          <br />
          Serás redirigido al inicio de sesión…
        </p>
      </div>
    </div>
  )
}