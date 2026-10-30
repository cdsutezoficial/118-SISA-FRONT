import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, Clock, FileText } from 'lucide-react'
import { ReadField } from '@app/core/components/ui'
import { FolioMontoClave } from './FolioMontoClave'
import { DescuentoAplicado, type DescuentoFicha } from './DescuentoAplicado'

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
 * que una ficha sin pagar se leyera como una ficha pagada.
 *
 * LAS DOS FECHAS
 * Se muestran las dos y se nombran distinto, porque contestan preguntas distintas.
 * "Fecha límite de inscripción" es el cierre de la venta —el snapshot con el que
 * se emitió la ficha— y "Fecha límite de pago" es el plazo visible de la ficha. La
 * que gobierna el cobro va destacada en el bloque de folio, y la de inscripción va
 * como dato de contexto en el bloque de abajo: no compiten.
 *
 * SIN PÁRRAFO "¿POR QUÉ ESTA FECHA?" (2026-10-23)
 * Se quitó a pedido del PO: la fecha límite de pago ya va destacada y la de
 * inscripción como dato de contexto; la explicación sobraba.
 *
 * DESCUENTO
 * Si la ficha tiene un descuento, `DescuentoAplicado` muestra el costo, el monto
 * descontado y el motivo. El monto a pagar ya es el final (tarifa vigente −
 * descuento vigente), calculado por el backend.
 *
 * POR QUÉ HAY UN AVISO EXPLÍCITO
 * Una fecha sin consecuencia visible se lee como decorativa, que es como esta
 * pantalla empezó a mentir. El backend sí compara esa fecha contra el reloj al
 * iniciar el pago, así que la consecuencia existe y conviene decirla en la propia
 * pantalla, no solo en el toast que alguien pudo no leer. El texto no promete
 * expiry ni "quedan X días" — eso sería calcular una fecha que puede cambiar.
 *
 * PLEGADA (2026-10-29)
 * Con el panel de pago abierto la ficha completa empujaba el formulario de EVO
 * hacia abajo y había que bajar a buscarlo. `plegada` la reduce a una barra con
 * folio, monto y fecha límite —lo que hace falta mientras se paga— y deja los
 * datos detrás de "Ver ficha". Se pliega con CSS y no se desmonta: la ranura de
 * acción (donde vive el iframe de EVO) no se toca.
 */
export function FichaPagoPendiente({
  folio,
  monto,
  fechaLimiteInscripcion,
  fechaLimitePago,
  referencia,
  nombre,
  curp,
  carrera,
  periodo,
  descuento,
  titulo,
  subtitulo,
  plegada = false,
  concepto,
  children,
}: {
  folio: string
  monto: number
  /** dd/mm/aaaa ya formateado, o null si el backend no la devolvió. */
  fechaLimitePago?: string | null
  /** dd/mm/aaaa ya formateado, o null si el backend no la devolvió. */
  fechaLimiteInscripcion?: string | null
  referencia?: string | null
  nombre?: string | null
  curp?: string | null
  carrera?: string | null
  periodo?: string | null
  /** Descuento aplicado a la ficha (costo, monto y motivo), si lo hay. */
  descuento?: DescuentoFicha | null
  /** Encabezado propio (p. ej. la diferencia por cambio de carrera); por defecto, el de la ficha. */
  titulo?: string
  subtitulo?: string
  /** True con el panel de pago abierto: la ficha se reduce a una barra con folio, monto y fecha. */
  plegada?: boolean
  /** Qué se está pagando, en la barra plegada. Por defecto, la ficha de admisión. */
  concepto?: string
  /** Ranura de acción: botón de pago, o el aviso de retorno 3DS degradado. */
  children?: ReactNode
}) {
  // "Ver ficha" en la barra plegada; al cerrar el panel la ficha vuelve completa.
  const [verDatos, setVerDatos] = useState(false)
  useEffect(() => {
    if (!plegada) setVerDatos(false)
  }, [plegada])
  const completa = !plegada || verDatos

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
      {plegada && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
              <FileText size={16} className="text-amber-700" />
            </div>
            <div className="min-w-0">
              <p className="flex flex-wrap items-baseline gap-x-2 text-[14px] font-bold text-[#333333]">
                <span className="font-mono">{folio || '—'}</span>
                <span className="text-[#D1D5DB]">·</span>
                <span className="text-[#009574]">${monto.toFixed(2)}</span>
                {fechaLimitePago && (
                  <>
                    <span className="text-[#D1D5DB]">·</span>
                    <span className="text-[13px] font-semibold text-amber-700">vence {fechaLimitePago}</span>
                  </>
                )}
              </p>
              <p className="text-[12px] text-[#6B7280]">{concepto ?? 'Ficha de admisión'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setVerDatos(v => !v)}
            aria-expanded={verDatos}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-amber-800 hover:bg-amber-100"
          >
            {verDatos ? 'Ocultar ficha' : 'Ver ficha'}
            <ChevronDown size={14} className={`transition-transform duration-200 ${verDatos ? 'rotate-180' : ''}`} />
          </button>
        </div>
      )}

      {/* La ficha completa: se pliega con el panel de pago abierto, sin desmontarse. */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${completa ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        aria-hidden={!completa}
      >
        <div className="min-h-0 overflow-hidden">
      {/* 1 — ¿ya pagué? */}
      <div className="flex items-start gap-4 border-b border-amber-200 bg-amber-50 px-6 py-6">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
          <Clock size={24} className="text-amber-700" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-[#333333]">{titulo ?? 'Tu ficha está lista, falta el pago'}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[#6B7280]">
            {subtitulo ??
              (periodo
                ? `Ficha de Admisión — ${periodo}. Completa tu pago en línea para continuar con el proceso de admisión.`
                : 'Completa tu pago en línea para continuar con el proceso de admisión.')}
          </p>
        </div>
      </div>

      {/* 2 — folio, monto y fecha límite: lo que hay que retener y lo que urge */}
      <FolioMontoClave
        folio={folio}
        monto={monto}
        etiquetaMonto="Monto a pagar"
        tercero={
          fechaLimitePago
            ? { etiqueta: 'Fecha límite de pago', valor: fechaLimitePago, destacado: true }
            : undefined
        }
      />

      <DescuentoAplicado descuento={descuento} />

      {/* 3 — de quién es la ficha */}
      {(nombre || curp || carrera || referencia || fechaLimiteInscripcion) && (
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
            {fechaLimiteInscripcion && (
              <ReadField label="Fecha límite de inscripción" value={fechaLimiteInscripcion} />
            )}
          </div>
        </div>
      )}
        </div>
      </div>

      {/* 4 — la acción, dentro de la tarjeta y no en una caja aparte */}
      {children && <div className={`${completa ? 'border-t border-[#E5E7EB]' : ''} px-6 py-5`}>{children}</div>}
    </section>
  )
}
