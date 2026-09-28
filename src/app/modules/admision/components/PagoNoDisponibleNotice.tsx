import { Info } from 'lucide-react'

/**
 * Aviso de que el pago en línea no se puede iniciar, y que se queda en pantalla.
 *
 * POR QUÉ NO ES UN TOAST
 * El rechazo por cupo o por ventana de pago cerrada se enteraba hasta ahora por un
 * toast, que se va solo. Si el Aspirante estaba mirando el botón —que es donde
 * está cuando pulsa— puede no haberlo visto, y entonces se queda creyendo que
 * registró su ficha y esperando una confirmación que no va a llegar. El aviso no
 * se cierra solo: es un hecho sobre la ficha, no una notificación pasajera.
 *
 * POR QUÉ ES NEUTRO Y NO UNA ALARMA
 * Agotar el cupo es la regla funcionando, no una falla. Un cartel rojo con
 * "atención" convertiría en alarma la consecuencia normal de que muchas personas
 * se registren y solo algunas puedan pagar. Por eso va en pizarra con icono de
 * información, no en ámbar ni en rojo: `#009574` ya significa "pago confirmado" en
 * `FichaPagoConfirmado`, y el ámbar ya significa "pendiente" en
 * `FichaPagoPendiente`; un color libre era la única forma de que este aviso no se
 * confundiera con ninguno de los dos estados de la ficha.
 *
 * LO QUE EL TEXTO NO DICE
 * El mensaje es el del backend, textual, y no se le añade nada. La versión
 * anterior de este aviso le prometía al Aspirante que "un lugar se libera si quien
 * lo tomó deja vencer su ventana de pago", lo cual describe una cola de espera que
 * el sistema no tiene: el cupo es un tope, no un turno. Tampoco se dice "tu
 * registro sigue vigente", porque sugeriría que estaba en riesgo cuando el
 * registro nunca se limitó. Si el backend se equivoca en el texto, el arreglo es
 * en el backend, no aquí.
 */
export function PagoNoDisponibleNotice({ message }: { message: string }) {
  return (
    <div className="flex w-full items-start gap-3 rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-4 py-3 text-left">
      <Info size={15} className="mt-0.5 flex-shrink-0 text-[#6B7280]" />
      <div className="min-w-0">
        <p className="text-[12px] font-bold uppercase tracking-widest text-[#333333]">Pago en línea no disponible</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#6B7280]">{message}</p>
      </div>
    </div>
  )
}
