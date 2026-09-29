/**
 * Folio y monto en grande — el bloque que comparten los DOS estados de pago.
 *
 * Existe como componente y no como markup duplicado por el mismo motivo que
 * empujó a extraer `FichaPagoConfirmado`: cuando el folio vive en dos archivos
 * mantenidos a mano, los dos se ven bien por un tiempo y después divergen justo
 * donde no puede — el dato que el Aspirante necesita leer de un vistazo. La
 * pendiente ya lo tenía enterrado como un `ReadField` más entre siete campos,
 * mientras la confirmada lo levantaba en 24px. Mismo dato, dos jerarquías.
 *
 * El folio se muestra igual antes y después de pagar, y a propósito: no cambia,
 * y reconocerlo rápido es la razón de tenerlo arriba. Lo que cambia es la
 * etiqueta del monto ("a pagar" → "pagado"), no su tamaño.
 *
 * El `tercero` es opcional porque solo el estado pendiente tiene una fecha límite
 * queenciar; después de pagar la fecha límite ya no dice nada.
 */
export function FolioMontoClave({
  folio,
  monto,
  etiquetaMonto = 'Monto a pagar',
  notaMonto,
  tercero,
}: {
  folio: string
  monto: number
  etiquetaMonto?: string
  notaMonto?: string
  tercero?: { etiqueta: string; valor: string; nota?: string; destacado?: boolean }
}) {
  const columnas = tercero ? 'sm:grid-cols-3' : 'sm:grid-cols-2'

  return (
    <div className={`grid grid-cols-1 divide-y divide-[#E5E7EB] sm:divide-x sm:divide-y-0 ${columnas}`}>
      <div className="px-6 py-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Tu folio</p>
        <p className="mt-1.5 font-mono text-[24px] font-bold text-[#333333]">{folio || '—'}</p>
      </div>

      <div className="px-6 py-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">{etiquetaMonto}</p>
        <p className="mt-1.5 text-[30px] font-bold leading-tight text-[#009574]">${monto.toFixed(2)}</p>
        {notaMonto && <p className="mt-1 text-[11px] leading-snug text-[#9CA3AF]">{notaMonto}</p>}
      </div>

      {tercero && (
        <div className="px-6 py-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">{tercero.etiqueta}</p>
          <p
            className={`mt-1.5 text-[24px] font-bold leading-tight ${
              tercero.destacado ? 'text-amber-700' : 'text-[#333333]'
            }`}
          >
            {tercero.valor || '—'}
          </p>
          {tercero.nota && <p className="mt-1 text-[11px] leading-snug text-[#9CA3AF]">{tercero.nota}</p>}
        </div>
      )}
    </div>
  )
}
