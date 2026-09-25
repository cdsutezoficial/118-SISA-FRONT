import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  CheckCircle2,
  GraduationCap,
  Download,
  Mail,
  CreditCard,
  Building2,
  Loader2,
  FileText,
} from 'lucide-react'
import { Toast, Tabs, ReadField } from '@app/core/components/ui'
import { FormPage, Button } from '@app/core/components/form'
import { Breadcrumb } from '@app/core/components/list'
import { formatDate } from '@app/core/infra/utils'
import {
  apiDownload,
  apiGet,
  apiPost,
  saveBlobDownload,
  type ApiError,
} from '@app/core/infra/apiClient'
import { mockCandidates } from '../data/mockData'
import type {
  Candidate,
  CandidateFichaBackend,
  CheckoutInitiationBackend,
  FichaRouteState,
  PaymentConfirmationBackend,
} from '../data/types'

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
 * - "Pagar en línea" (Fase 6, real EVO Hosted Checkout): calls
 *   `POST /candidates/{id}/payments/checkout`, stores the returned `orderId` in
 *   `sessionStorage` and opens the gateway payment page embedded in this very
 *   view — an in-page iframe fed by a form POST to the EVO payment page
 *   (`.../api/page/version/{version}/pay`, fields `merchant` + `session`), so
 *   the payer never leaves SISA. When EVO finishes it points the iframe back at
 *   the configured `returnUrl`; the iframe's `onLoad` detects the same-origin
 *   return and the page then posts
 *   `POST /candidates/{id}/payments/confirm {orderId}`, which the backend only
 *   approves after EVO reports `SUCCESS` + matching amount (Fase 5); on success
 *   the header flips to "¡Registro exitoso!" with the backend receipt (`REC-...`)
 *   and the confirmation email is sent server-side. A repeat right after
 *   success returns 409 (already paid) — treated as already-paid. A return
 *   without `resultIndicator` (canceled/error) leaves the ficha `PENDING` with
 *   a "Pago cancelado" toast; a backend failure shows the REAL `err.message`.
 * - "Descargar ficha en PDF" → `GET /candidates/{id}/ficha.pdf` (real PDF blob).
 * - "Enviar instrucciones a mi correo" → `POST /candidates/{id}/send-instructions`.
 * - Only real candidates (UUID ids, i.e. backend-created) call the backend;
 *   the mock-candidate fallback (direct mock navigation) keeps the toast-only
 *   simulation.
 */

// Mirrors `CandidatoRegistro.tsx`'s page-local `ScreenOrigin`/`MetodoPago`
// unions — kept local (not imported) so this page doesn't couple to Screen
// 4's module, same as how `MetodoPago` itself isn't shared there either.
export type ScreenOrigin = 'staff' | 'public'
type MetodoPago = 'ONLINE' | 'VENTANILLA'

interface FichaConfirmacionProps {
  origin: ScreenOrigin
}

// Matches the "periodo activo" convention used across the Admisión screens
// (see `CandidatosList.tsx`/`AdmisionDashboard.tsx`).
const PERIODO_ACTIVO = 'Enero – Abril 2026'
const BANCO = 'BBVA'
const BENEFICIARIO = 'Universidad Tecnológica Emiliano Zapata del Estado de Morelos'

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
}

// Backend candidate ids are UUIDs; mock candidates use ids like "cand-01".
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function FichaConfirmacion({ origin }: FichaConfirmacionProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const state = location.state as FichaRouteState | null

  const routeCandidate: Candidate = state?.candidate ?? mockCandidates[0]
  const idFromUrl = searchParams.get('id') ?? ''
  // Prefer the querystring id (survives refresh); route state supplies instant display data.
  const candidateId: string = UUID_RE.test(idFromUrl) ? idFromUrl : routeCandidate.id
  const esCandidatoReal: boolean = UUID_RE.test(candidateId)
  const metodoPagoInicial: MetodoPago = state?.metodoPago ?? 'ONLINE'

  // Ensures the EVO return handling (redirect → confirmed checkout) runs once per mount:
  // dev StrictMode double-invokes effects, and the confirm is idempotent but must not re-fire
  // after `resultIndicator` was already consumed and the query cleaned up.
  const returnHandledRef = useRef(false)

  function checkoutStorageKey(): string {
    return `sisa.checkout.${candidateId}`
  }

  function getStoredOrderId(): string | null {
    try {
      return sessionStorage.getItem(checkoutStorageKey())
    } catch {
      return null
    }
  }

  function clearStoredOrderId(): void {
    try {
      sessionStorage.removeItem(checkoutStorageKey())
    } catch {
      // sessionStorage unavailable — nothing to clean
    }
  }

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
    }
  }

  const [ficha, setFicha] = useState<FichaDisplay>(buildInitial)
  const [activeTab, setActiveTab] = useState<MetodoPago>(metodoPagoInicial)
  const [toast, setToast] = useState('')
  const [confirmData, setConfirmData] = useState<PaymentConfirmationBackend | null>(null)
  const [alreadyPaid, setAlreadyPaid] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [evoOpen, setEvoOpen] = useState(false)
  const [busyPdf, setBusyPdf] = useState(false)
  const [busyMail, setBusyMail] = useState(false)

  const evoFrameRef = useRef<HTMLIFrameElement>(null)

  const pagado = ficha.estado === 'PAID'

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
        }))
      })
      .catch(() => {
        // Silent — route state / mock display is already rendering.
      })
  }, [candidateId, esCandidatoReal])

  // Pay online → start a real EVO Hosted Checkout session. The gateway payment
  // page opens embedded (see `handleEvoFrameLoad`); this branch handles the
  // edge case of a full-page return landing directly on this route.
  const orderId = getStoredOrderId()

  // EVO return cases (params appended by the gateway to the returnUrl per
  // evo.txt — `resultIndicator` set on SUCCESS only). Used both by the embedded
  // panel (iframe query) and this direct-load path (parent search params):
  // - success   → `resultIndicator` present → confirm now.
  // - cancelled → `resultIndicator` absent, no `error` param → PENDING + cancel toast.
  // - error     → `error` param present → PENDING + gateway error toast.
  function onReturnFromGateway() {
    if (returnHandledRef.current || !esCandidatoReal || !orderId) return
    returnHandledRef.current = true
    const errorParam = searchParams.get('error')
    if (searchParams.has('resultIndicator')) {
      // Payment succeeded on the gateway — confirm from the persisted order id.
      void confirmAfterReturn(orderId)
    } else if (errorParam) {
      clearStoredOrderId()
      setToast('No se pudo completar el pago en Evo Payments. Tu ficha sigue pendiente.')
      setSearchParams({ id: candidateId }, { replace: true })
    } else {
      // Payer cancelled on the EVO payment page before paying.
      clearStoredOrderId()
      setToast('Pago cancelado. Tu ficha sigue pendiente.')
      setSearchParams({ id: candidateId }, { replace: true })
    }
  }

  // POST the verified confirmation → `POST /candidates/{id}/payments/confirm`.
  async function confirmAfterReturn(orderId: string) {
    setProcessing(true)
    try {
      const res = await apiPost<PaymentConfirmationBackend>(`/candidates/${candidateId}/payments/confirm`, {
        orderId,
      })
      clearStoredOrderId()
      setConfirmData(res)
      setFicha(prev => ({
        ...prev,
        estado: 'PAID',
        referencia: res.referenceNumber,
        monto: Number(res.amount),
        folio: res.folio,
      }))
      setToast(`Pago confirmado. Tu recibo es ${res.receiptNumber}.`)
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      clearStoredOrderId()
      if (apiErr.status === 409) {
        // Already paid (idempotent re-confirm or Finanzas confirmed meanwhile).
        setAlreadyPaid(true)
        setFicha(prev => ({ ...prev, estado: 'PAID' }))
        setToast('La ficha ya figura como pagada.')
      } else if (apiErr.status === 404) {
        setToast('No se encontró el candidato. Vuelve a intentar.')
      } else {
        // 400 = EVO verification failed (no SUCCESS / amount mismatch); 502 = gateway down.
        setToast(apiErr.message ?? 'No se pudo confirmar el pago. Tu ficha sigue pendiente.')
      }
    } finally {
      setProcessing(false)
    }
  }

  useEffect(() => {
    onReturnFromGateway()
  })

  // Pay online → start a real EVO Hosted Checkout (or keep the mock simulation).
  async function handlePagarEnLinea() {
    if (!esCandidatoReal) {
      // Mock simulation (same as pre-integration) so the staff mock demo still behaves.
      setProcessing(true)
      setTimeout(() => {
        setProcessing(false)
        setFicha(prev => ({ ...prev, estado: 'PAID' }))
        setToast('Pago simulado confirmado.')
      }, 1200)
      return
    }
    setProcessing(true)
    try {
      // Fase 4/6: create the EVO session and hold the order id for the return call.
      const res = await apiPost<CheckoutInitiationBackend>(`/candidates/${candidateId}/payments/checkout`)
      try {
        sessionStorage.setItem(checkoutStorageKey(), res.orderId)
      } catch {
        // sessionStorage unavailable — the return call will just miss the cross-check.
      }
      // The payer stays inside SISA: open the EVO hosted payment page in an
      // embedded panel (fixed section of this view). The page is frame-loadable
      // only via a form POST (`merchant` + `session`) to the payment page URL
      // returned by the backend (`/api/page/version/{version}/pay`).
      setProcessing(false)
      setEvoOpen(true)
      setToast('Completa tu pago seguro en el panel de abajo.')
      postToEvoFrame(res.checkoutUrl, res.merchant, res.sessionId)
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      setProcessing(false)
      setToast(apiErr.message ?? 'No se pudo iniciar el pago en línea. Intenta de nuevo más tarde.')
    }
  }

  // Build a hidden form targeting the embedded iframe and submit it — EVO's
  // hosted payment page rejects plain GET navigation.
  function postToEvoFrame(action: string, merchant: string, sessionId: string): void {
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = action
    form.target = 'sisa-evo-panel'
    form.style.display = 'none'
    const addHidden = (name: string, value: string) => {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }
    addHidden('merchant', merchant)
    addHidden('session', sessionId)
    document.body.appendChild(form)
    form.submit()
    form.remove()
  }

  // EVO's page is cross-origin, so reads on its location throw a SecurityError
  // → blend in. Once EVO finishes, it points the iframe back at the SISA
  // `returnUrl`/`cancelUrl` (same origin) → we can read the appended outcome
  // params (`resultIndicator` on SUCCESS only) and close the panel.
  function handleEvoFrameLoad() {
    const frame = evoFrameRef.current
    if (!frame || !evoOpen) return
    let url: string | null = null
    try {
      url = frame.contentWindow?.location.toString() ?? null
    } catch {
      // Cross-origin — still on the EVO hosted payment page. Nothing to do.
      return
    }
    if (!url || url === 'about:blank') return
    setEvoOpen(false)
    const query = new URLSearchParams(url.split('?')[1] ?? '')
    const orderId = getStoredOrderId()
    if (!orderId) {
      setToast('Tu ficha sigue pendiente. Vuelve a intentar el pago.')
      return
    }
    if (query.has('resultIndicator')) {
      // Payment succeeded on the gateway — confirm from the persisted order id.
      void confirmAfterReturn(orderId)
    } else if (query.get('error')) {
      clearStoredOrderId()
      setToast('No se pudo completar el pago en Evo Payments. Tu ficha sigue pendiente.')
    } else {
      // Payer cancelled on the EVO payment page before paying.
      clearStoredOrderId()
      setToast('Pago cancelado. Tu ficha sigue pendiente.')
    }
  }

  // Manual close — the gateway session expires server-side; treat it as a cancel.
  function cerrarPanelPago() {
    setEvoOpen(false)
    clearStoredOrderId()
    setToast('Pago cancelado. Tu ficha sigue pendiente.')
  }

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
      setToast('Ficha descargada en PDF.')
    } catch {
      setToast('No se pudo generar el PDF de la ficha.')
    } finally {
      setBusyPdf(false)
    }
  }

  // Send payment instructions email → `POST /candidates/{id}/send-instructions` (204).
  async function handleEnviarCorreo() {
    if (!esCandidatoReal) {
      setToast(`Instrucciones enviadas (simulado) a ${ficha.email || 'tu correo registrado'}.`)
      return
    }
    setBusyMail(true)
    try {
      await apiPost(`/candidates/${candidateId}/send-instructions`)
      setToast(`Instrucciones enviadas a ${ficha.email}.`)
    } catch {
      setToast('No se pudo enviar el correo. Intenta de nuevo más tarde.')
    } finally {
      setBusyMail(false)
    }
  }

  const header = pagado ? (
    <div className="flex flex-col items-center text-center mb-8">
      <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
        <CheckCircle2 size={32} className="text-emerald-500" />
      </div>
      <h1 className="text-2xl font-bold text-[#333333]">¡Registro exitoso!</h1>
      <p className="text-[14px] text-[#6B7280] mt-1 max-w-md">
        Tu pago de ficha fue confirmado con la referencia{' '}
        <span className="font-mono text-[#333333]">{ficha.referencia}</span>. Revisa tu correo con la confirmación
        para continuar con el proceso.
      </p>
    </div>
  ) : (
    <div className="flex flex-col items-center text-center mb-8">
      <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
        <FileText size={32} className="text-[#009574]" />
      </div>
      <h1 className="text-2xl font-bold text-[#333333]">Ficha de Admisión</h1>
      <p className="text-[14px] text-[#6B7280] mt-1 max-w-md">
        Tu ficha fue generada correctamente. Completa tu pago para continuar con el proceso de admisión.
      </p>
    </div>
  )

  const fichaCard = (
    <div className="bg-white border-2 border-[#009574] rounded-lg overflow-hidden mb-6">
      <div className="bg-[#e6f5f1] px-6 py-3 border-b border-[#009574]/30">
        <p className="text-[12px] font-bold text-[#009574] uppercase tracking-widest">
          Ficha de Admisión — {PERIODO_ACTIVO}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
        <div className="space-y-4">
          <ReadField label="Folio" value={ficha.folio} mono />
          <ReadField label="Nombre" value={ficha.nombre} />
          <ReadField label="CURP" value={ficha.curp} mono />
          <ReadField label="Carrera Solicitada" value={ficha.programa} />
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Monto a Pagar</p>
            <p className="text-[28px] font-bold text-[#009574]">${ficha.monto.toFixed(2)}</p>
          </div>
          <ReadField label="Referencia de Pago" value={ficha.referencia} mono />
          <ReadField label="Fecha Límite de Pago" value={ficha.fechaLimite} />
        </div>
      </div>
    </div>
  )

  const paymentDone = pagado && (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 mb-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center">
          <CheckCircle2 size={18} className="text-white" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-emerald-800">Pago de ficha confirmado</p>
          <p className="text-[13px] text-emerald-700 mt-1">
            {confirmData
              ? `Recibo ${confirmData.receiptNumber} del ${formatDate(new Date(confirmData.paidAt))}. Ya puedes continuar con el proceso de admisión.`
              : alreadyPaid
                ? 'Tu ficha ya aparece como pagada en el sistema. Si tienes dudas contacta a Finanzas.'
                : 'Ya puedes continuar con el proceso de admisión.'}
          </p>
        </div>
      </div>
    </div>
  )

  const tabsSection = !pagado && (
    <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 mb-6">
      <p className="text-[13px] font-semibold text-[#333333] mb-4">Instrucciones de pago</p>
      <Tabs
        tabs={[
          { key: 'ONLINE', label: 'Pago en línea', icon: <CreditCard size={14} /> },
          { key: 'VENTANILLA', label: 'Pago en ventanilla', icon: <Building2 size={14} /> },
        ]}
        active={activeTab}
        onSelect={k => setActiveTab(k as MetodoPago)}
      />

      {activeTab === 'ONLINE' ? (
        <div>
          <div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-3 mb-4 text-[13px] text-blue-700">
            Haz clic en el botón de abajo y completa tu pago con tarjeta o transferencia en el panel de Evo Payments
            que se abre en esta misma página.
          </div>
          <Button onClick={handlePagarEnLinea} loading={processing} className="w-full sm:w-auto">
            Pagar en línea — ${ficha.monto.toFixed(2)}
          </Button>
          <p className="text-[12px] text-[#6B7280] mt-3">
            Una vez confirmado el pago recibirás un correo de confirmación y podrás continuar con el proceso.
          </p>
        </div>
      ) : (
        <div>
          <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-4 text-[13px] text-amber-700">
            Presenta esta referencia en la ventanilla de Finanzas de la universidad.
          </div>
          <div className="border border-[#E5E7EB] rounded-md p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ReadField label="Banco" value={BANCO} />
            <ReadField label="Referencia" value={ficha.referencia} mono />
            <ReadField label="Monto Exacto" value={`$${ficha.monto.toFixed(2)}`} />
            <ReadField label="Beneficiario" value={BENEFICIARIO} />
          </div>
          <p className="text-[12px] text-[#6B7280] mt-3">
            Guarda tu comprobante — te lo solicitarán para activar tu candidatura.
          </p>
        </div>
      )}
    </div>
  )

  const actionsRow = (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <Button variant="secondary" onClick={handleDescargarPdf} disabled={busyPdf} className={busyPdf ? 'opacity-60 pointer-events-none' : ''}>
        {busyPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}Descargar ficha en PDF
      </Button>
      <Button variant="secondary" onClick={handleEnviarCorreo} disabled={busyMail} className={busyMail ? 'opacity-60 pointer-events-none' : ''}>
        {busyMail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}Enviar instrucciones a mi correo
      </Button>
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
      {header}
      {fichaCard}
      {paymentDone}
      {tabsSection}
      {evoOpen && !pagado && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold text-[#333333]">Pago seguro — Evo Payments</p>
            <Button variant="ghost" size="sm" onClick={cerrarPanelPago}>
              Cancelar y volver
            </Button>
          </div>
          <iframe
            ref={evoFrameRef}
            name="sisa-evo-panel"
            title="Pago seguro Evo Payments"
            src="about:blank"
            className="w-full min-h-[520px] rounded-md border border-[#E5E7EB] bg-white"
            onLoad={handleEvoFrameLoad}
          />
        </div>
      )}
      {actionsRow}
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