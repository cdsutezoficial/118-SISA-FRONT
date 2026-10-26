import { Tag } from 'lucide-react'

/**
 * Desglose de un descuento aplicado a la ficha: "Costo − Descuento (motivo)".
 *
 * Lo usan el estado pendiente y el pagado de la ficha. El monto final ya viene
 * en `FolioMontoClave`; aquí solo se explica por qué es menor que el costo,
 * con el motivo que capturó el personal al registrar el descuento.
 *
 * No se dibuja si no hay descuento: una fila "Descuento: $0" se leería como
 * algo que se perdió.
 */
export interface DescuentoFicha {
  /** Costo del concepto sin descuento. */
  original: number
  /** Monto descontado. */
  monto: number
  /** Motivo con el que se registró el descuento. */
  motivo?: string | null
}

const money = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

export function DescuentoAplicado({ descuento }: { descuento?: DescuentoFicha | null }) {
  if (!descuento || !(descuento.monto > 0)) return null
  return (
    <div className="border-t border-[#E5E7EB] bg-[#e6f5f1] px-6 py-4">
      <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-[#007a5e]">
        <Tag size={13} />
        Descuento aplicado
      </p>
      <p className="text-[13px] leading-relaxed text-[#333333]">
        Costo {money(descuento.original)} − descuento {money(descuento.monto)}
      </p>
      {descuento.motivo && (
        <p className="mt-1 text-[13px] leading-relaxed text-[#6B7280]">
          <span className="font-semibold text-[#333333]">Motivo:</span> {descuento.motivo}
        </p>
      )}
    </div>
  )
}
