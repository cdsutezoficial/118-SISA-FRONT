import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { TrendingUp } from 'lucide-react'

// ─── InitialAvatar ─────────────────────────────────────────────────────────────
// Círculo con las iniciales de un nombre (hasta 2, en mayúsculas). Tolerante a
// espacios extra y nombres vacíos: normaliza con trim/\\s+ y descarta piezas
// vacías para no renderizar iniciales undefined.
export function InitialAvatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).map(part => part[0] ?? '').join('').slice(0, 2).toUpperCase()
  return (
    <div className="w-6 h-6 rounded-full bg-[#e6f5f1] text-[#009574] flex items-center justify-center text-[10px] font-bold flex-shrink-0">
      {initials}
    </div>
  )
}

// ─── KpiCards ─────────────────────────────────────────────────────────────────
// Grid de tarjetas KPI del Dashboard: icono con color, valor, etiqueta y sub-texto.
// Por defecto muestra una flecha de tendencia; pasa `trend: false` para omitirla
// o `badge`/`badgeClass` para pintar un pill en su lugar.
export interface KpiCardData {
  label: string
  value: string
  /** Texto secundario (11px, muted) bajo la etiqueta. */
  sub: string
  /** Clases de color del contenedor del icono (p.ej. 'bg-blue-50 text-blue-600'). */
  color: string
  icon: ReactNode
  /** Badge opcional que reemplaza a la flecha de tendencia. */
  badge?: string
  /** Clases del pill del badge (por defecto emerald). */
  badgeClass?: string
  /** false → omite la flecha de tendencia cuando no hay badge. Por defecto true. */
  trend?: boolean
}

export function KpiCards({ cards }: { cards: KpiCardData[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map(card => (
        <div key={card.label} className="bg-white border border-[#E5E7EB] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-lg ${card.color}`}>{card.icon}</div>
            {card.badge ? (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${card.badgeClass ?? 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                {card.badge}
              </span>
            ) : card.trend !== false ? (
              <TrendingUp size={14} className="text-emerald-400" />
            ) : null}
          </div>
          <p className="text-2xl font-bold text-[#333333]">{card.value}</p>
          <p className="text-[12px] font-medium text-[#333333] mt-0.5">{card.label}</p>
          <p className="text-[11px] text-[#6B7280] mt-1">{card.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ─── QuickAccess ───────────────────────────────────────────────────────────────
// Launchez de accesos rápidos del Dashboard. `variant="grid"` (default) pinta
// botones verticales en grid 2/4 columnas; `variant="inline"` pinta botones
// horizontales (icono + texto) apilados con wrap, patrón de las dashboards de módulo.
export interface QuickAccessItem {
  label: string
  icon: ReactNode
  url: string
}

export function QuickAccess({ items, title = 'Acceso rápido', variant = 'grid' }: {
  items: QuickAccessItem[]
  title?: string
  variant?: 'grid' | 'inline'
}) {
  const navigate = useNavigate()
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
      <h2 className="text-[14px] font-semibold text-[#333333] mb-4">{title}</h2>
      {variant === 'inline' ? (
        <div className="flex flex-wrap gap-3">
          {items.map(item => (
            <button
              key={item.label}
              onClick={() => navigate(item.url)}
              className="flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] rounded-lg hover:border-[#009574] hover:bg-[#e6f5f1] transition-colors group"
            >
              <span className="text-[#6B7280] group-hover:text-[#009574] transition-colors">{item.icon}</span>
              <span className="text-[13px] font-medium text-[#333333]">{item.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {items.map(item => (
            <button
              key={item.label}
              onClick={() => navigate(item.url)}
              className="flex flex-col items-center gap-2 p-4 border border-[#E5E7EB] rounded-lg hover:border-[#009574] hover:bg-[#e6f5f1] transition-colors group"
            >
              <div className="text-[#6B7280] group-hover:text-[#009574] transition-colors">{item.icon}</div>
              <span className="text-[12px] font-medium text-[#333333] text-center">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}