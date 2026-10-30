import { Tag } from 'lucide-react'

/**
 * Desglose de un cobro en tres columnas: lo que cuesta el concepto, el
 * descuento (con su motivo) y el total. Lo usan el detalle del candidato y la
 * pantalla de descuentos, para que el personal lea la misma cuenta que ve el
 * aspirante: "cuesta X − descuento Y = Z".
 *
 * Sin descuento, la columna del medio lo dice en vez de mostrar "$0.00", que
 * se leería como un descuento que se perdió. Un monto desconocido (la ficha no
 * se pudo cotizar) se muestra como "—", nunca como una cifra inventada.
 */
export interface DesgloseCobroProps {
  /** Nombre del concepto del catálogo, si se conoce. */
  concepto?: string | null
  /** Costo del concepto antes del descuento. */
  costo: number | null
  /** Monto descontado; nulo o 0 si no hay descuento. */
  descuento?: number | null
  /** Motivo con el que se registró el descuento. */
  motivo?: string | null
  /** Lo que se cobra (o se cobró) después del descuento. */
  total: number | null
  /** El cargo ya está pagado: el total se rotula "Pagado". */
  pagado?: boolean
}

const money = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

export function DesgloseCobro({ concepto, costo, descuento, motivo, total, pagado = false }: DesgloseCobroProps) {
  const conDescuento = descuento != null && descuento > 0
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-[#E5E7EB] sm:grid-cols-3">
      <div className="px-5 py-4">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Costo del concepto</p>
        <p className="text-[18px] font-semibold text-[#333333]">{money(costo)}</p>
        {concepto && <p className="mt-1 text-[12px] text-[#6B7280]">{concepto}</p>}
      </div>

      <div
        className={`border-t border-[#E5E7EB] px-5 py-4 sm:border-l sm:border-t-0 ${conDescuento ? 'bg-[#e6f5f1]' : ''}`}
      >
        <p
          className={`mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${
            conDescuento ? 'text-[#007a5e]' : 'text-[#6B7280]'
          }`}
        >
          <Tag size={12} />
          Descuento
        </p>
        {conDescuento ? (
          <>
            <p className="text-[18px] font-semibold text-[#007a5e]">− {money(descuento)}</p>
            {motivo && <p className="mt-1 text-[12px] text-[#333333]">{motivo}</p>}
          </>
        ) : (
          <p className="text-[13px] font-medium text-[#6B7280]">Sin descuento</p>
        )}
      </div>

      <div className="border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-4 sm:border-l sm:border-t-0">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
          {pagado ? 'Pagado' : 'Total a pagar'}
        </p>
        <p className="text-[22px] font-bold text-[#333333]">{money(total)}</p>
      </div>
    </div>
  )
}
