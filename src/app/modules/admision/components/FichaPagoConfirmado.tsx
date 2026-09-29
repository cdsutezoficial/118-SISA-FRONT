import { CalendarCheck, CheckCircle2, Download, FileText, Mail } from 'lucide-react'
import { Button } from '@app/core/components/form'
import { ReadField } from '@app/core/components/ui'
import { formatDate } from '@app/core/infra/utils'
import { FolioMontoClave } from './FolioMontoClave'

/**
 * Bloque de "pago de ficha confirmado" — la pantalla más importante del flujo,
 * porque es el momento en que el Aspirante debe entender que su registro quedó
 * completo y conservar su folio.
 *
 * Compartido por los DOS puntos de entrada que aceptan el pago, a propósito:
 * `FichaConfirmacion.tsx` (recién registrado) y `PortalFichaPago.tsx` (recuperado
 * con folio + últimos 3 de la CURP). Antes cada uno tenía su propia versión y ya
 * se veían distintas: la de post-registro escondía el comprobante detrás de un
 * bloque verde chico y dejaba el PDF al final de la página, mientras la de
 * consulta lo tenía al frente. Dos copias mantenidas a mano divergen justo donde
 * no puede — el mismo instante que el Aspirante necesita leer bien.
 *
 * ORDEN DE LECTURA, de arriba hacia abajo, en el orden en que el Aspirante
 * necesita la información: ¿ya se pagó? → ¿con qué folio? → ¿cuánto? → ¿qué
 * recibo respalda esto? → ¿qué hago ahora? El folio y el monto son los dos datos
 * que realmente se conservan, así que van en grande, no como una línea más de un
 * formulario.
 *
 * La banda usa el verde institucional (#009574) y no `emerald`: el encabezado de
 * las pantallas públicas ya es de ese color y mantener un segundo verde para
 * "éxito" hacía que el estado de pago se leyera como una tarjeta más en vez de
 * como el cierre del proceso.
 */
export function FichaPagoConfirmado({
  folio,
  monto,
  referencia,
  recibo,
  fechaPago,
  email,
  subtitulo = 'Tu registro de Aspirante quedó completado. Guarda esta pantalla o descarga tu comprobante.',
  onDescargarPdf,
  busyPdf = false,
  puedeDescargar = true,
}: {
  folio: string
  monto: number
  referencia?: string
  /** `REC-…`. Ausente si el backend aún no lo emite, o en una ficha pagada antes de este deploy. */
  recibo?: string | null
  /** ISO date; se formatea a dd/mm/aaaa. */
  fechaPago?: string | null
  /**
   * Aviso de que el correo de confirmación salió.
   *
   * La dirección es opcional a propósito, el aviso no. El post-registro la
   * conoce (el registro es propio), pero la recuperación entra con folio + 3 de
   * la CURP, que es identidad débil a propósito: ahí se dice "al correo con el
   * que te registraste" sin imprimir la dirección.
   *
   * El plan original pedía silenciar la línea entera cuando no había dirección.
   * El efecto era peor: una pantalla confirmando el pago y otra sin mencionarlo
   * se lee como un bug, no como una decisión.
   */
  email?: { direccion?: string | null } | null
  subtitulo?: string
  onDescargarPdf: () => void
  busyPdf?: boolean
  puedeDescargar?: boolean
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-[#009574]/30 bg-white shadow-sm">
      {/* 1 — ¿ya se pagó? */}
      <div className="bg-[#009574] px-6 py-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/15">
          <CheckCircle2 size={34} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white">¡Pago de ficha confirmado!</h2>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-white/85">{subtitulo}</p>
      </div>

      {/* 2 + 3 — folio y monto: los dos datos que se conservan. Bloque compartido
          con el estado pendiente, para que el folio se vea igual antes y después
          de pagar: no cambia, y reconocerlo rápido es el punto. */}
      <FolioMontoClave folio={folio} monto={monto} etiquetaMonto="Monto pagado" />

      {/* 4 — qué lo respalda */}
      <div className="border-t border-[#E5E7EB] bg-[#F8F9FA] px-6 py-5">
        <p className="mb-3 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-[#009574]">
          <FileText size={13} />
          Comprobante
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ReadField label="Folio de comprobante" value={recibo || '—'} mono />
          <ReadField label="Fecha de pago" value={fechaPago ? formatDate(new Date(fechaPago)) : '—'} />
          <ReadField label="Referencia de pago" value={referencia || '—'} mono />
        </div>

        {/* Descargar es la acción que el Aspirante necesita de verdad, así que vive
            dentro del bloque de éxito y no al final de la página. */}
        <div className="mt-5 flex flex-col items-center gap-2">
          <Button
            onClick={onDescargarPdf}
            loading={busyPdf}
            disabled={!puedeDescargar || busyPdf}
            className="w-full sm:w-auto"
          >
            <span className="inline-flex items-center gap-2">
              <Download size={14} />
              Descargar mi comprobante (PDF)
            </span>
          </Button>
          <p className="text-center text-[11px] text-[#9CA3AF]">
            El PDF es una copia sin validez oficial; la ficha oficial es la que expide la Universidad.
          </p>
        </div>
      </div>

      {/* 5 — qué sigue */}
      <div className="border-t border-[#E5E7EB] px-6 py-5">
        <p className="mb-3 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-[#333333]">
          <CalendarCheck size={13} className="text-[#009574]" />
          Qué sigue
        </p>
        <ol className="space-y-2.5 text-[13px] leading-relaxed text-[#6B7280]">
          {email && (
            <li className="flex gap-2.5">
              <Mail size={14} className="mt-0.5 flex-shrink-0 text-[#009574]" />
              <span>
                {email.direccion ? (
                  <>
                    Te enviamos la confirmación a{' '}
                    <span className="text-[#333333]">{email.direccion}</span>. Revisa también la carpeta de
                    spam.
                  </>
                ) : (
                  <>Te enviamos la confirmación al correo con el que te registraste. Revisa también la carpeta
                    de spam.</>
                )}
              </span>
            </li>
          )}
          <li className="flex gap-2.5">
            <span className="flex-shrink-0 font-bold text-[#009574]">1.</span>
            <span>
              Guarda tu folio <span className="font-mono text-[#333333]">{folio}</span>: lo necesitarás en los
              siguientes pasos del proceso de admisión.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex-shrink-0 font-bold text-[#009574]">2.</span>
            <span>Presenta este comprobante al ingresar al curso de inducción.</span>
          </li>
        </ol>
      </div>
    </section>
  )
}
