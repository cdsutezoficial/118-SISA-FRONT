import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { CreditCard, Download, FileText, GraduationCap, Loader2, X } from 'lucide-react'
import { Button } from '@app/core/components/form'
import { Toast } from '@app/core/components/ui'
import { useRole } from '@app/core/infra/RoleContext'
import { apiDownload, saveBlobDownload } from '@app/core/infra/apiClient'
import { formatDate } from '@app/core/infra/utils'
import { useFichaPayment, fichaAccessStorageKey } from '@app/modules/admision/hooks/useFichaPayment'
import { FichaPagoConfirmado } from '@app/modules/admision/components/FichaPagoConfirmado'
import { FichaPagoPendiente } from '@app/modules/admision/components/FichaPagoPendiente'
import type {
  FichaPaymentAccessBackend,
  PaymentConfirmationBackend,
} from '@app/modules/admision/data/types'

/**
 * Portal — Pago de la ficha de admisión (the ficha-payment flow, sibling of
 * `PortalInduccionPago.tsx`, which is the induction-course flow). Reached from
 * {@code /portal/ficha} with folio + the last 3 CURP characters.
 *
 * It is deliberately NOT the full ficha screen, even though the access lookup
 * returns a `candidateId` the backend could use to serve one. That lookup is a
 * weak identity proof (sequential folio + 3 CURP chars), so this view shows
 * payment data only: name, program, folio, amount, status, and once paid the
 * receipt plus the non-official PDF copy. No address, no health or income
 * profile, no grades.
 *
 * TWO ENTRY POINTS, both supported:
 * 1. Fresh navigation from {@code /portal/ficha} → the access payload
 *    arrives in route state.
 * 2. Return from a bank 3D Secure challenge → the page RELOADS at
 *    {@code ?id=<uuid>&orderId=…&resultIndicator=…} and route state is gone.
 *    The access payload is therefore mirrored into `sessionStorage` (keyed by
 *    candidate id, which the gateway's return URL always carries) so the
 *    confirmation can still be rendered after the round-trip.
 *
 * The EVO handshake, the return handling and the single-fire confirm live in
 * the shared `useFichaPayment` hook — the same one the post-registration
 * screen uses.
 */

interface PortalFichaPagoLocationState {
  acceso: FichaPaymentAccessBackend
}

/** Route the gateway must return to for THIS flow (must be backend-allowlisted). */
const RETURN_PATH = '/portal/ficha/pago'

export default function PortalFichaPago() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setRole } = useRole()
  const state = location.state as PortalFichaPagoLocationState | null

  const [params] = useState(() => new URLSearchParams(location.search))
  const candidateIdFromUrl = params.get('id') ?? ''

  const [acceso, setAcceso] = useState<FichaPaymentAccessBackend | null>(state?.acceso ?? null)
  const [toast, setToast] = useState('')
  const [busyPdf, setBusyPdf] = useState(false)

  // Case 2 above: a 3DS return reloads the page without route state, so recover
  // the access payload from sessionStorage. Runs once on mount.
  useEffect(() => {
    if (acceso || !candidateIdFromUrl) return
    try {
      const cached = sessionStorage.getItem(fichaAccessStorageKey(candidateIdFromUrl))
      if (cached) setAcceso(JSON.parse(cached) as FichaPaymentAccessBackend)
    } catch {
      // ignore — the guard below sends the applicant back to the lookup form
    }
  }, [acceso, candidateIdFromUrl])

  const candidateId = acceso?.candidateId ?? candidateIdFromUrl

  const { startCheckout, cancelCheckout, containerId, evoCheckout, evoLoading, processing, confirmData, alreadyPaid } =
    useFichaPayment({
      candidateId,
      returnPath: RETURN_PATH,
      notify: setToast,
      preserveQuery: { id: candidateId },
      onConfirmed: (data: PaymentConfirmationBackend) => {
        // Reflect the confirmed payment in the header fields too.
        setAcceso(prev =>
          prev
            ? {
                ...prev,
                paymentStatus: 'PAID',
                receiptNumber: data.receiptNumber,
                paidAt: data.paidAt,
                alreadyPaid: true,
                amount: Number(data.amount),
                referenceNumber: data.referenceNumber,
              }
            : prev
        )
      },
    })

  // Nothing to show without a ficha: a direct visit or a stale link. Send the
  // applicant back to the lookup form rather than rendering an empty screen.
  useEffect(() => {
    if (!acceso && !candidateIdFromUrl) {
      navigate('/portal/ficha', { replace: true })
    }
  }, [acceso, candidateIdFromUrl, navigate])

  function handleCerrarSesion() {
    setRole(null)
    navigate('/portal/ficha')
  }

  async function handleDescargarPdf() {
    if (!candidateId) return
    setBusyPdf(true)
    try {
      const blob = await apiDownload(`/candidates/${candidateId}/ficha.pdf`)
      saveBlobDownload(blob, `ficha-admision-${acceso?.folio ?? ''}.pdf`)
      setToast('Copia de la ficha descargada en PDF.')
    } catch {
      setToast('No se pudo generar el PDF de la ficha.')
    } finally {
      setBusyPdf(false)
    }
  }

  // A 3DS return carries `?id=` but may find no cached payload (private mode /
  // storage disabled). The hook can still CONFIRM from `?id` + `?orderId`, so we
  // render a degraded confirmation from the confirm response instead of
  // stranding the applicant on a spinner — but we never let them START a new
  // payment without the access payload, since that is where the amount lives.
  const retornoEnCurso = !acceso && candidateIdFromUrl !== ''

  if (!acceso && !retornoEnCurso) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="flex items-center gap-2 text-[#6B7280] text-[13px]">
          <Loader2 size={16} className="animate-spin text-[#009574]" />
          Buscando tu ficha...
        </div>
      </div>
    )
  }

  const folio = acceso?.folio ?? confirmData?.folio ?? ''
  const pagado = acceso?.alreadyPaid || confirmData !== null || alreadyPaid
  const fechaConfirmacion = confirmData?.paidAt ?? acceso?.paidAt
  const folioComprobante = confirmData?.receiptNumber ?? acceso?.receiptNumber
  const referencia = acceso?.referenceNumber ?? confirmData?.referenceNumber ?? ''
  const monto = confirmData ? Number(confirmData.amount) : (acceso?.amount ?? 0)

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <header className="bg-[#009574] px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
            <GraduationCap size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-[14px] leading-tight">UTEZ — SISA v2</p>
            <p className="text-white/70 text-[11px] leading-tight">Pago de ficha de admisión</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {folio && (
            <p className="hidden sm:block text-white text-[13px] font-medium">
              {acceso?.nombre ? `${acceso.nombre} — ` : ''}
              {folio}
            </p>
          )}
          <button
            type="button"
            onClick={handleCerrarSesion}
            className="px-3 py-1.5 text-[12px] font-semibold border border-white/40 text-white rounded-md hover:bg-white/10 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="max-w-[820px] mx-auto my-8">
        {pagado ? (
          // Idéntico bloque que la confirmación post-registro. Un Aspirante que
          // vuelve por su comprobante y uno que acaba de registrarse deben ver
          // exactamente la misma pantalla: antes cada vista tenía la suya y ya
          // divergían. También desaparece la tarjeta "Monto a pagar", que una vez
          // pagado ya no era la etiqueta correcta.
          <FichaPagoConfirmado
            folio={folio}
            monto={monto}
            referencia={referencia}
            recibo={folioComprobante}
            fechaPago={fechaConfirmacion}
            // Aviso SIN dirección: `payment-access` no expone el email porque
            // folio + 3 de la CURP es identidad débil. Confirmar que el correo
            // salió no filtra nada; imprimir a quién se lo mandaron, sí.
            email={{}}
            onDescargarPdf={handleDescargarPdf}
            busyPdf={busyPdf}
          />
        ) : (
          <>
            {/* Estado pendiente. Reemplaza a las dos tarjetas que había aquí
                ("Datos del candidato" + ficha con el monto): el folio era un
                `ReadField` más entre tres y ahora usa el mismo bloque destacado
                que la confirmación, así que se lee igual antes y después de pagar.
                Los datos de contacto se quedan dentro del bloque de apoyo:
                esta vista no expone el correo, que `payment-access` no devuelve. */}
            <FichaPagoPendiente
              folio={folio}
              monto={monto}
              fechaLimitePago={acceso?.paymentClosesOn ? formatDate(new Date(`${acceso.paymentClosesOn}T00:00:00`)) : null}
              fechaLimiteInscripcion={
                acceso?.registrationDeadline ? formatDate(new Date(`${acceso.registrationDeadline}T00:00:00`)) : null
              }
              referencia={referencia}
              nombre={acceso?.nombre ?? null}
              carrera={acceso?.programName ?? null}
            >
              {!acceso ? (
                // Degraded 3DS return: we can confirm, but there is no amount to charge
                // and no payment to start. Never render a "Pagar" button here.
                <div className="text-center">
                  <Loader2 size={22} className="animate-spin text-[#009574] mx-auto mb-3" />
                  <p className="text-[13px] font-semibold text-[#333333] mb-1">Confirmando tu pago…</p>
                  <p className="text-[12px] leading-relaxed text-[#6B7280]">
                    Si el pago se completó verás aquí tu comprobante. Si cancelaste, vuelve a buscar tu
                    ficha con tu folio y los últimos 3 caracteres de tu CURP.
                  </p>
                  <Button variant="secondary" onClick={() => navigate('/portal/ficha')} className="mt-4">
                    Volver a buscar mi ficha
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Button onClick={startCheckout} loading={processing} disabled={processing}>
                    <span className="inline-flex items-center gap-2">
                      <CreditCard size={14} />
                      Pagar en línea — ${monto.toFixed(2)}
                    </span>
                  </Button>
                  <p className="text-center text-[12px] leading-relaxed text-[#6B7280]">
                    El pago se realiza en esta misma página. Al confirmarse la operación con tu banco te
                    enviaremos el comprobante al correo con el que te registraste.
                  </p>

                  {/* Descarga del PDF como acción SECUNDARIA, debajo de pagar. Disponible
                      también antes de pagar: la copia sirve para tener la ficha a la
                      mano mientras se resuelve el pago, y el aviso de que no tiene
                      validez oficial acompaña al botón, como en la confirmación. */}
                  <div className="flex flex-col items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleDescargarPdf}
                      disabled={busyPdf}
                      className={busyPdf ? 'opacity-60' : ''}
                    >
                      <span className="inline-flex items-center gap-2">
                        {busyPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        Descargar copia de mi ficha en PDF
                      </span>
                    </Button>
                    <p className="text-center text-[11px] text-[#9CA3AF]">
                      El PDF es una copia sin validez oficial; la ficha oficial es la que expide la Universidad.
                    </p>
                  </div>

                  {evoCheckout && (
                  <div className="mt-2 w-full border-t border-[#E5E7EB] pt-5 text-left">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[12px] font-semibold text-[#333333] flex items-center gap-1.5">
                        <FileText size={13} className="text-amber-700" />
                        Panel de pago seguro
                      </p>
                      <button
                        type="button"
                        onClick={cancelCheckout}
                        className="text-[12px] text-[#6B7280] hover:text-[#333333] inline-flex items-center gap-1"
                      >
                        <X size={12} />
                        Cerrar
                      </button>
                    </div>
                    {evoLoading && (
                      <p className="flex items-center gap-2 text-[12px] text-[#6B7280] mb-2">
                        <Loader2 size={13} className="animate-spin text-[#009574]" />
                        Cargando el panel de pago seguro...
                      </p>
                    )}
                    <div id={containerId} className="w-full" />
                  </div>
                )}
              </div>
              )}
            </FichaPagoPendiente>
          </>
        )}
      </div>
    </div>
  )
}
