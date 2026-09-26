import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { GraduationCap, Download, Loader2 } from 'lucide-react'
import { Toast } from '@app/core/components/ui'
import { FormPage, Button } from '@app/core/components/form'
import { Breadcrumb } from '@app/core/components/list'
import { formatDate } from '@app/core/infra/utils'
import { apiDownload, apiGet, saveBlobDownload } from '@app/core/infra/apiClient'
import { mockCandidates } from '../data/mockData'
import { useFichaPayment } from '../hooks/useFichaPayment'
import { FichaPagoConfirmado } from '../components/FichaPagoConfirmado'
import { FichaPagoPendiente } from '../components/FichaPagoPendiente'
import type { Candidate, CandidateFichaBackend, FichaRouteState } from '../data/types'

/**
 * Screen 13 — Ficha de Admisión: confirmación post-registro (flujo real).
 *
 * Dual-mounted per `specs/admision-screens/spec.md` — "Ficha de Admisión
 * Confirmación (Screen 13)": identical content/behavior for both mounts,
 * `origin` drives ONLY chrome + the staff-only "back to listing" link.
 * - Staff: `/admision/candidatos/ficha` (AppLayout, sidebar/breadcrumb present).
 * - Público: `/portal/registro/ficha` (AuthLayout, no sidebar/navbar — terminal
 *   confirmation for the anonymous self-registration flow started at Screen 4).
 *
 * REAL-BACKEND FLOW (wired to `118-SISA-BACK`):
 * - Resolved via route state handoff from `CandidatoRegistro.tsx` (Screen 4):
 *   `{ candidate, metodoPago, pagoFicha }`, where `pagoFicha` carries the real
 *   ticket the `POST /candidates` response generated (`referenceNumber`,
 *   `amount`, `deadline`). A direct mount / hard refresh drops route state, so
 *   the route is also navigated with `?id=<candidateId>` (same convention as
 *   `CandidatoDetalle.tsx`/`ConfirmarPagoFicha.tsx`) and this screen falls back
 *   to `GET /candidates/{id}` to rebuild the display from the backend.
 * - "Pagar en línea" (Fase 6, EVO Hosted Checkout embebido): delegates to the
 *   shared `useFichaPayment` hook, which POSTs
 *   `POST /candidates/{id}/payments/checkout`, holds the returned `orderId` in
 *   `sessionStorage` and mounts the official `checkout.min.js` SDK
 *   (`checkoutJsUrl`) into a container in this very view, so the payer never
 *   leaves SISA. The payment outcome can arrive via the SDK's
 *   `data-complete`/`data-error`/`data-timeout` globals, via the return URL
 *   after a 3DS challenge, or via the SDK-iframe watcher — all of them funnel
 *   into `POST /candidates/{id}/payments/confirm {orderId}`, which the backend
 *   only approves after EVO reports `SUCCESS` + matching amount. The hook owns
 *   that whole handshake; this view only renders the panel and reacts to the
 *   result.
 * - "Descargar copia de mi ficha en PDF" → `GET /candidates/{id}/ficha.pdf`
 *   (real PDF blob, stamped as a non-official copy by the backend).
 * - The payment is online-only: there is no counter/ventanilla option and no
 *   "send instructions by email" action (the endpoint was removed).
 * - Only real candidates (UUID ids, i.e. backend-created) call the backend;
 *   the mock-candidate fallback (direct mock navigation) keeps the toast-only
 *   simulation.
 */

// Mirrors `CandidatoRegistro.tsx`'s page-local `ScreenOrigin` union — kept local
// (not imported) so this page doesn't couple to Screen 4's module.
export type ScreenOrigin = 'staff' | 'public'

interface FichaConfirmacionProps {
  origin: ScreenOrigin
}

// Matches the "periodo activo" convention used across the Admisión screens
// (see `CandidatosList.tsx`/`AdmisionDashboard.tsx`).
const PERIODO_ACTIVO = 'Enero – Abril 2026'

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

/** Lens over the mock `Candidate` + route `pagoFicha` + optional `GET /ficha`. */
interface FichaDisplay {
  id: string
  folio: string
  nombre: string
  curp: string
  programa: string
  email: string
  referencia: string
  monto: number
  fechaLimite: string
  estado: 'PENDING' | 'PAID'
  /**
   * Comprobante y fecha de pago, no derivables de `estado`.
   *
   * El backend los expone en `GET /candidates/{id}` y también en
   * `POST /candidates/payment-access`; si esta lente no los guarda, la
   * confirmación los pierde y muestra "—" aunque el recibo exista. Ya pasó: al
   * recargar una ficha pagada el `confirmData` del hook es `null` (solo se llena
   * con un confirm en vivo), y la pantalla afirmaba no tener comprobante.
   */
  recibo: string | null
  fechaPago: string | null
}

// Backend candidate ids are UUIDs; mock candidates use ids like "cand-01".
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function FichaConfirmacion({ origin }: FichaConfirmacionProps) {
  const navigate = useNavigate()
  const location = useLocation()
  // Only read: the shared hook owns the outcome-param cleanup via its own
  // `useSearchParams`, so a 3DS return and this screen cannot fight over the URL.
  const [searchParams] = useSearchParams()
  const state = location.state as FichaRouteState | null

  const routeCandidate: Candidate = state?.candidate ?? mockCandidates[0]
  const idFromUrl = searchParams.get('id') ?? ''
  // Prefer the querystring id (survives refresh); route state supplies instant display data.
  const candidateId: string = UUID_RE.test(idFromUrl) ? idFromUrl : routeCandidate.id
  const esCandidatoReal: boolean = UUID_RE.test(candidateId)

  function buildInitial(): FichaDisplay {
    const pf = state?.pagoFicha
    return {
      id: candidateId,
      folio: routeCandidate.folio,
      nombre: routeCandidate.nombre,
      curp: routeCandidate.curp,
      programa: routeCandidate.programa,
      email: routeCandidate.email,
      referencia: pf?.referencia ?? routeCandidate.pagoFicha.referencia ?? '',
      monto: pf?.monto ?? routeCandidate.pagoFicha.monto,
      fechaLimite: pf?.fechaLimite
        ? formatDate(new Date(`${pf.fechaLimite}T00:00:00`))
        : formatDate(addDays(new Date(), 10)),
      estado: pf?.estado ?? 'PENDING',
      // El route state viene del `POST /candidates`, que recién crea el pago:
      // todavía no hay comprobante que mostrar.
      recibo: null,
      fechaPago: null,
    }
  }

  const [ficha, setFicha] = useState<FichaDisplay>(buildInitial)
  const [toast, setToast] = useState('')
  const [busyPdf, setBusyPdf] = useState(false)

  const pagado = ficha.estado === 'PAID'

  /**
   * EVO Hosted Checkout, 3DS return handling and the single-fire confirm all
   * live in the shared hook — the same one the "vuelve a pagar mi ficha" screen
   * uses, so the two payment flows cannot drift apart.
   */
  const {
    startCheckout,
    cancelCheckout,
    containerId,
    evoCheckout,
    evoLoading,
    processing,
    confirmData,
    alreadyPaid,
  } = useFichaPayment({
    candidateId: esCandidatoReal ? candidateId : '',
    // After a 3DS challenge the gateway must come back HERE. Must be on the
    // backend allowlist (`sisa.evo.allowed-return-paths`) or it is ignored and
    // the gateway falls back to the globally configured return URL.
    returnPath: '/portal/registro/ficha',
    notify: setToast,
    onConfirmed: data =>
      setFicha(prev => ({
        ...prev,
        estado: 'PAID',
        referencia: data.referenceNumber,
        monto: Number(data.amount),
        folio: data.folio,
        recibo: data.receiptNumber,
        fechaPago: data.paidAt,
      })),
    onAlreadyPaid: () => setFicha(prev => ({ ...prev, estado: 'PAID' })),
    preserveQuery: { id: candidateId },
  })

  // Refresh/fallback: direct mount or hard refresh has no `pagoFicha` in route
  // state — sync from `GET /candidates/{id}`, the same projection CandidatoRegistro's
  // POST just created. Route-state data (instant render) silently takes over
  // if the GET fails (e.g. backend down while the mock demo still navigates).
  useEffect(() => {
    if (!esCandidatoReal) return
    apiGet<CandidateFichaBackend>(`/candidates/${candidateId}`)
      .then(f => {
        setFicha(prev => ({
          id: candidateId,
          folio: f.folio,
          nombre: `${f.firstName} ${f.lastName1} ${f.lastName2}`.trim(),
          curp: f.curp,
          programa: f.programName,
          email: f.email,
          referencia: f.referenceNumber,
          monto: Number(f.amount),
          fechaLimite: f.deadline ? formatDate(new Date(`${f.deadline}T00:00:00`)) : prev.fechaLimite,
          estado: f.paymentStatus,
          // La fila pagada trae el comprobante; sin esto, recargar la pantalla
          // lo mostraba como "—".
          recibo: f.receiptNumber,
          fechaPago: f.paidAt,
        }))
      })
      .catch(() => {
        // Silent — route state / mock display is already rendering.
      })
  }, [candidateId, esCandidatoReal])

  // Download the real PDF ficha → `GET /candidates/{id}/ficha.pdf` (OpenPDF blob).
  async function handleDescargarPdf() {
    if (!esCandidatoReal) {
      setToast('Descarga simulada: esta versión de prototipo no genera un PDF real.')
      return
    }
    setBusyPdf(true)
    try {
      const blob = await apiDownload(`/candidates/${candidateId}/ficha.pdf`)
      saveBlobDownload(blob, `ficha-admision-${ficha.folio}.pdf`)
      setToast('Copia de tu ficha descargada en PDF.')
    } catch {
      setToast('No se pudo generar el PDF de la ficha.')
    } finally {
      setBusyPdf(false)
    }
  }

  // El encabezado y la tarjeta de datos que existían aquí para el estado
  // PENDIENTE ya no se dibujan: los absorbió `FichaPagoPendiente`, que sube el
  // folio a 24px y baja los datos de apoyo a una fila secundaria. Se eliminaron
  // porque seguían describiendo la ficha como un formulario plano, que es justo
  // lo que se quería dejar de ver.

  // El subtítulo separa el pago que acabamos de confirmar del que ya figuraba
  // pagado (re-confirmación idempotente, o Finanzas lo confirmó entre medio): el
  // segundo caso no trae comprobante propio y conviene decirlo en vez de
  // prometer un recibo que esta vista no tiene.
  const subtituloConfirmacion = confirmData
    ? `Tu pago fue confirmado con la referencia ${confirmData.referenceNumber}. Tu registro de Aspirante quedó completado.`
    : alreadyPaid
      ? 'Tu ficha ya figuraba como pagada en el sistema. Si tienes dudas sobre este cobro, contacta a Finanzas.'
      : 'Tu registro de Aspirante quedó completado. Guarda esta pantalla o descarga tu comprobante.'

  // Acción de pago del estado pendiente. Va DENTRO de `FichaPagoPendiente`, no en
  // una caja aparte debajo: es la razón por la que el Aspirante está en esta
  // pantalla, y la confirmación ya hace lo mismo con su botón de descarga. Por
  // simetría el PDF baja a acción secundaria — antes estaba por encima del pago,
  // que es el orden invertido respecto a la intención.
  const paymentAction = (
    <div className="flex flex-col items-center gap-3">
      <Button onClick={startCheckout} loading={processing} className="w-full sm:w-auto">
        Pagar en línea — ${ficha.monto.toFixed(2)}
      </Button>
      <p className="text-center text-[12px] leading-relaxed text-[#6B7280]">
        La ficha de admisión se paga únicamente en línea. Una vez confirmado el pago recibirás un correo de
        confirmación y podrás continuar con el proceso.
      </p>
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
    </div>
  )

  const overlay = processing && (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg px-8 py-6 flex flex-col items-center gap-3 shadow-2xl">
        <Loader2 size={28} className="animate-spin text-[#009574]" />
        <p className="text-[13px] font-medium text-[#333333]">Iniciando pago seguro…</p>
      </div>
    </div>
  )

  const content = (
    <div className="max-w-[820px] mx-auto">
      {pagado ? (
        // La confirmación ES la pantalla. Reemplaza por completo a la ficha, al
        // bloque verde chico y a la fila de acciones: recién pagado, nada debe
        // competir con el folio y el comprobante. El detalle completo de la
        // ficha sigue disponible en el PDF.
        <FichaPagoConfirmado
          folio={ficha.folio}
          monto={ficha.monto}
          referencia={ficha.referencia}
          // Misma precedencia que `PortalFichaPago`: el confirm en vivo manda,
          // y la lente cubre el caso de recargar una ficha ya pagada.
          recibo={confirmData?.receiptNumber ?? ficha.recibo}
          fechaPago={confirmData?.paidAt ?? ficha.fechaPago}
          email={{ direccion: ficha.email }}
          subtitulo={subtituloConfirmacion}
          onDescargarPdf={handleDescargarPdf}
          busyPdf={busyPdf}
        />
      ) : (
        <FichaPagoPendiente
          folio={ficha.folio}
          monto={ficha.monto}
          fechaLimite={ficha.fechaLimite}
          referencia={ficha.referencia}
          nombre={ficha.nombre}
          curp={ficha.curp}
          carrera={ficha.programa}
          periodo={PERIODO_ACTIVO}
        >
          {paymentAction}
        </FichaPagoPendiente>
      )}
      {evoCheckout && !pagado && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold text-[#333333]">Pago seguro</p>
            <Button variant="ghost" size="sm" onClick={cancelCheckout}>
              Cancelar y volver
            </Button>
          </div>
          <div className="relative w-full min-h-[520px] rounded-md border border-[#E5E7EB] bg-white">
            <div id={containerId} className="w-full" />
            {evoLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/90">
                <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
                  <Loader2 size={16} className="animate-spin text-[#009574]" />
                  Cargando panel de pago seguro…
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Staff-only per spec scenario "Público mount hides the staff 'back to
          listing' link" — an anonymous candidate has no candidate listing to
          return to. */}
      {origin === 'staff' && (
        <Button variant="ghost" size="sm" onClick={() => navigate('/admision/candidatos')}>
          ← Volver al listado de candidatos
        </Button>
      )}
    </div>
  )

  // ── Staff mount — AppLayout shell, sidebar present; chrome aligned to core ──
  if (origin === 'staff') {
    return (
      <FormPage>
        {toast && <Toast message={toast} onClose={() => setToast('')} />}
        {overlay}

        <Breadcrumb
          items={[
            { label: 'Inicio', to: '/admision' },
            { label: 'Admisión', to: '/admision' },
            { label: 'Candidatos', to: '/admision/candidatos' },
            { label: 'Ficha de Admisión' },
          ]}
        />

        {content}
      </FormPage>
    )
  }

  // ── Público mount — bare AuthLayout, no sidebar/navbar (anonymous self-registration terminal state) ──
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {overlay}

      <header className="bg-[#009574] px-6 py-4 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <GraduationCap size={18} className="text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-[14px] leading-tight">UTEZ — SISA v2</p>
          <p className="text-white/70 text-[11px] leading-tight">Ficha de Admisión</p>
        </div>
      </header>

      <div className="max-w-[960px] mx-auto px-8 py-8">
        {content}
      </div>
    </div>
  )
}
