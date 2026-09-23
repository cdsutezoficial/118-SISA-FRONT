import type { CSSProperties, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { LlaveMxLogoSvg } from './LlaveMxLogo'

// Botón oficial de Digital Morelos / LlaveMX, replicado en Tailwind desde
// `llave-morelos/digital-morelos-ui-buttons/{buttons.html,style.css}` (2026-09-22).
// Tokens oficiales: --dm-dark #2d3b2a · --dm-light #f4f5f0 · --dm-sage #6f7857.
// Layout idéntico al material: texto "Conecta tu cuenta de" + wordmark SVG.

interface LlaveMxButtonProps {
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'light' | 'dark'
  disabled?: boolean
  loading?: boolean
  /** Texto antes del wordmark. Default: "Conecta tu cuenta de" (material oficial). */
  label?: ReactNode
  className?: string
  style?: CSSProperties
}

const VARIANTS = {
  light: 'bg-[#f4f5f0] text-[#6f7857] border-[#f4f5f0] hover:bg-[#2d3b2a] hover:text-white',
  dark: 'bg-[#2d3b2a] text-white border-[#f4f5f0] hover:bg-[#f4f5f0] hover:text-[#2d3b2a]',
} as const

export function LlaveMxButton({
  onClick,
  type = 'button',
  variant = 'light',
  disabled,
  loading,
  label = 'Conecta tu cuenta de',
  className,
  style,
}: LlaveMxButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={style}
      className={`inline-flex items-center justify-center gap-2.5 rounded-lg border px-5 py-3 text-[14px] font-medium max-w-[380px] transition-colors disabled:opacity-60 disabled:pointer-events-none ${VARIANTS[variant]} ${className ?? ''}`}
    >
      {loading && <Loader2 size={16} className="animate-spin text-current" />}
      {label}
      <LlaveMxLogoSvg width={120} height={16} className="flex-shrink-0" />
    </button>
  )
}