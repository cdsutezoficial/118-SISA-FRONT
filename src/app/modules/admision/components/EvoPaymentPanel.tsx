import { FileText, Loader2, X } from 'lucide-react'

/**
 * Panel de pago de EVO, con la misma maqueta en las dos pantallas que lo ofrecen.
 *
 * POR QUÉ ESTE COMPONENTE EXISTE
 * El panel estaba escrito dos veces —en `FichaConfirmacion` y en
 * `PortalFichaPago`— y las dos copias ya divergían antes de que ninguna hubiera
 * cambiado: una lo metía en una tarjeta aparte titled "Pago seguro" y la otra lo
 * anidaba en la ficha de pago; una cargaba con un overlay sobre el iframe y la otra
 * con un texto arriba; una envolvía el panel en otra caja y la otra no; y el botón
 * de cierre decía una cosa en cada pantalla. Dos copias de la parte donde el
 * Aspirante mete su tarjeta son dos maquetas que se contradicen, y la que se
 * rectify después depende de cuál pantalla se abra primero.
 *
 * Ahora las dos pantallas lo montan DENTRO de `FichaPagoPendiente`, que es donde
 * vive la acción de pago: el panel es la continuación del botón que lo abre, no
 * una tarjeta hermana de la ficha.
 *
 * LO QUE SE UNIFICÓ Y CÓMO
 * - Posición: dentro de la ficha, en ambas. La que lo tenía aparte era la que
 *   separaba la acción de su propio resultado.
 * - Carga: overlay sobre el iframe. Un texto arriba empuja el panel hacia abajo
 *   cuando el SDK termina de montar y el iframe cambia de alto; el overlay
 *   reserva el espacio con `min-h` y no mueve nada.
 * - Cierre: "Cerrar" con icono, en la misma fila del título.
 *
 * `containerId` lo recibe `useFichaPayment` y es el id que el SDK de EVO monta
 * con `showEmbeddedPage('#<id>')`; no se puede calcular aquí porque el hook
 * también lo usa para encontrar el nodo y tirar el iframe de la capa de
 * comunicación.
 */
export function EvoPaymentPanel({
  containerId,
  loading,
  onClose,
}: {
  /** Id del contenedor donde el SDK inyecta el formulario de pago. */
  containerId: string
  /** True mientras se descarga y monta el SDK de EVO. */
  loading: boolean
  /** Cierra el panel. El pago queda pendiente y el lugar se libera. */
  onClose: () => void
}) {
  return (
    <div className="w-full border-t border-[#E5E7EB] pt-5 text-left">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#333333]">
          <FileText size={13} className="text-amber-700" />
          Panel de pago seguro
        </p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 text-[12px] text-[#6B7280] hover:text-[#333333]"
        >
          <X size={12} />
          Cerrar
        </button>
      </div>

      <div className="relative w-full min-h-[520px] rounded-md border border-[#E5E7EB] bg-white">
        <div id={containerId} className="w-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90">
            <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
              <Loader2 size={16} className="animate-spin text-[#009574]" />
              Cargando el panel de pago seguro…
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
