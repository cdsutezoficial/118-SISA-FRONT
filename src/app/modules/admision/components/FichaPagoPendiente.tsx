import type { ReactNode } from 'react'
import { Clock, FileText } from 'lucide-react'
import { ReadField } from '@app/core/components/ui'
import { FolioMontoClave } from './FolioMontoClave'

/**
 * Estado PENDIENTE de la ficha — la contraparte de `FichaPagoConfirmado`.
 *
 * Comparte con ella el bloque `FolioMontoClave` porque el folio se ve igual antes
 * y después de pagar: es el mismo dato y reconocerlo rápido es la razón de
 * tenerlo arriba. Lo que cambia entre los dos estados es el resto — aquí la
 * prioridad es la acción de pago y la fecha límite, no el comprobante.
 *
 * POR QUÉ ESTE COMPONENTE EXISTE
 * El estado pendiente de `FichaConfirmacion.tsx` y el de `PortalFichaPago.tsx` se
 * habían escrito por separado, igual que sus confirmaciones, y divergieron igual:
 * el folio era un `ReadField` más entre seis campos, mientras la pantalla de pago
 * confirmado lo ponía en 24px. Quien paga y quien todavía no paga veían el mismo
 * dato con dos jerarquías, y se leía como si el folio importara solo después de
 * pagar.
 *
 * ORDEN DE LECTURA
 * ¿ya pagué? → ¿con qué folio? → ¿cuánto y hasta cuándo? → ¿de quién es? →
 * ¿qué hago? El botón de pago vive DENTRO de la tarjeta, no en una caja aparte
 * debajo: es la razón por la que el Aspirante está aquí, y la confirmación ya
 * hace lo mismo con el botón de descarga. Por simetría también baja la descarga
 * del PDF a acción secundaria, cuando estaba por encima del pago.
 *
 * La banda de estado es ámbar y no verde. El verde institucional (#009574) ya
 * significa "pago confirmado" en `FichaPagoConfirmado`; reutilizarlo aquí haría
 * que una ficha sin pagar se leyera como una ficha pagada. No se afirma que la
 * fecha límite haga expirar el pago: el backend la guarda y la proyecta, pero
 * ningún caso de uso la compara contra el reloj, así que la fecha se muestra sin
 * consecuencia inventada.
 */
export function FichaPagoPendiente({
  folio,
  monto,
  fechaLimite,
  referencia,
  nombre,
  curp,
  carrera,
  periodo,
  children,
}: {
  folio: string
  monto: number
  /** dd/mm/aaaa ya formateado, o null si el backend no la devolvió. */
  fechaLimite?: string | null
  referencia?: string | null
  nombre?: string | null
  curp?: string | null
  carrera?: string | null
  periodo?: string | null
  /** Ranura de acción: botón de pago, o el aviso de retorno 3DS degradado. */
  children?: ReactNode
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
      {/* 1 — ¿ya pagué? */}
      <div className="flex items-start gap-4 border-b border-amber-200 bg-amber-50 px-6 py-6">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
          <Clock size={24} className="text-amber-700" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-[#333333]">Tu ficha está lista, falta el pago</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[#6B7280]">
            {periodo
              ? `Ficha de Admisión — ${periodo}. Completa tu pago en línea para continuar con el proceso de admisión.`
              : 'Completa tu pago en línea para continuar con el proceso de admisión.'}
          </p>
        </div>
      </div>

      {/* 2 — folio, monto y fecha límite: lo que hay que retener y lo que urge */}
      <FolioMontoClave
        folio={folio}
        monto={monto}
        etiquetaMonto="Monto a pagar"
        tercero={
          fechaLimite
            ? { etiqueta: 'Fecha límite de pago', valor: fechaLimite, destacado: true }
            : undefined
        }
      />

      {/* 3 — de quién es la ficha */}
      {(nombre || curp || carrera || referencia) && (
        <div className="border-t border-[#E5E7EB] bg-[#F8F9FA] px-6 py-5">
          <p className="mb-3 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-[#333333]">
            <FileText size={13} className="text-amber-700" />
            Datos de tu ficha
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {nombre && <ReadField label="Nombre" value={nombre} />}
            {curp && <ReadField label="CURP" value={curp} mono />}
            {carrera && <ReadField label="Carrera solicitada" value={carrera} />}
            {referencia && <ReadField label="Referencia de pago" value={referencia} mono />}
          </div>
        </div>
      )}

      {/* 4 — la acción, dentro de la tarjeta y no en una caja aparte */}
      {children && <div className="border-t border-[#E5E7EB] px-6 py-5">{children}</div>}
    </section>
  )
}
