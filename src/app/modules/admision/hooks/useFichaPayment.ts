import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ADMISSION_ERROR_CODES, apiPost } from '@app/core/infra/apiClient'
import type { ApiError } from '@app/core/infra/apiClient'
import type { CheckoutInitiationBackend, PaymentConfirmationBackend } from '../data/types'

/**
 * The EVO Hosted Checkout flow for paying a ficha, shared by the two screens
 * that offer it: `FichaConfirmacion` (right after registering) and
 * `PortalInduccionPago` ("vuelve a pagar mi ficha", reached with folio + the
 * last 3 CURP characters).
 *
 * Extracted rather than duplicated on purpose: the embedded SDK handshake, the
 * 3DS return handling, the iframe watcher and the single-fire confirm are the
 * most delicate code in the payment path, and two hand-kept copies would drift
 * into exactly the bug that costs someone their money.
 *
 * HOW IT WORKS
 * 1. `startCheckout()` POSTs `/candidates/{id}/payments/checkout`, stashes the
 *    returned `orderId` in `sessionStorage` (a 3DS challenge can round-trip
 *    through the gateway, so the order id must survive a reload), and hands the
 *    SDK url + session id back so the view can render a container.
 * 2. The returned `evoCheckout` triggers an effect that injects
 *    `checkout.min.js`, calls `Checkout.configure({session:{id}})` and
 *    `Checkout.showEmbeddedPage('#<containerId>')`, so the payer never leaves
 *    SISA.
 * 3. The payment outcome can arrive four ways — the SDK's `data-complete` /
 *    `data-error` / `data-timeout` globals, the return URL params after a 3DS
 *    challenge, or the iframe watcher noticing the frame turned same-origin.
 *    All of them funnel into `confirmAfterReturn(orderId)`, which fires at most
 *    once and always POSTs the *server*-verified confirmation.
 * 4. The SDK callback alone is NOT proof of payment: the backend re-checks the
 *    order against EVO (SUCCESS status + amount) before marking the ficha
 *    `PAID`.
 */

/** Id of the container the SDK injects its payment form into. */
export const EVO_CHECKOUT_CONTAINER_ID = 'sisa-evo-checkout'

/**
 * `sessionStorage` key for the payment-access payload, keyed by candidate id.
 *
 * A bank 3D Secure challenge round-trips through the gateway, so the payment
 * screen is RELOADED at `?id=<uuid>&orderId=…` and React Router's route state
 * is gone. `PortalInduccion` therefore mirrors the access payload here before
 * navigating, and `PortalInduccionPago` reads it back on mount. Keep both sides
 * on this helper: a key that drifts breaks the post-3DS screen silently.
 */
export function fichaAccessStorageKey(candidateId: string): string {
  return `sisa.acceso.${candidateId}`
}

/** Id of the single cross-origin iframe the SDK creates (its comms/payment layer). */
const EVO_SDK_IFRAME_ID = 'hc-comms-layer-iframe'

/**
 * Drops the nodes `checkout.min.js` appended to `document.body` on its own.
 *
 * `Checkout.showEmbeddedPage` mounts the payment form into OUR container, but the
 * SDK keeps its comms iframe as a sibling outside the React tree. Clearing
 * `evoCheckout` therefore unmounts the container and leaves that frame behind: a
 * stale layer sitting over a page the payer already finished with. React never
 * owned it, so React cannot clean it up.
 *
 * The `<script>` tag and `window.Checkout` are deliberately left in place — they
 * are cached for the whole page session and `loadEvoCheckoutScript` reuses them
 * on the next attempt. Only called on the close/cancel paths, never mid-payment.
 */
function teardownEvoDom(): void {
  document.getElementById(EVO_SDK_IFRAME_ID)?.remove()
}

/**
 * Global function names the SDK resolves from the injected `<script>`'s
 * `data-*` attributes — `callbackTypes` in `checkout.min.js` are
 * `complete|error|cancel|afterRedirect|beforeRedirect|timeout` and each is read
 * as `getAttribute('data-' + type)` → `window[value]`, ONCE, when the script
 * evaluates. So the functions must exist before the tag is injected.
 * (`data-cancel` is deliberately absent: per the guide the cancel callback only
 * works with the hosted payment page, not the embedded one.)
 */
const EVO_SDK_CALLBACKS = {
  complete: 'sisaEvoComplete',
  error: 'sisaEvoError',
  timeout: 'sisaEvoTimeout',
} as const

type EvoSdkOutcomeHandlers = {
  complete?: () => void
  error?: () => void
  timeout?: () => void
}

// Module-level bridge: the SDK holds these globals for the whole page session,
// so they forward to whatever the mounted view registered.
const evoSdkHandlers: EvoSdkOutcomeHandlers = {}

function installEvoSdkGlobals(): void {
  const target = window as unknown as Record<string, () => void>
  target[EVO_SDK_CALLBACKS.complete] = () => evoSdkHandlers.complete?.()
  target[EVO_SDK_CALLBACKS.error] = () => evoSdkHandlers.error?.()
  target[EVO_SDK_CALLBACKS.timeout] = () => evoSdkHandlers.timeout?.()
}

installEvoSdkGlobals()

/**
 * Outcomes where the applicant is not looking at a malfunction, so "intenta de
 * nuevo más tarde" is the wrong thing to say.
 *
 * - Quota reached: the career sold all its places. The cap is doing its job.
 * - Payment window closed: the period ended. It will not reopen on its own.
 *
 * Both are permanent facts about this ficha rather than transient faults, and both
 * arrive with a message from the backend worth showing verbatim.
 */
function isNoRetryOutcome(code: string | undefined): boolean {
  return code === ADMISSION_ERROR_CODES.quotaReached || code === ADMISSION_ERROR_CODES.paymentWindowClosed
}

/** Global surface installed by EVO's `checkout.min.js` (no official typings). */
interface EvoCheckoutSdk {
  configure(options: { session: { id: string } }): void
  showEmbeddedPage(target: string): void
}

declare global {
  interface Window {
    Checkout?: EvoCheckoutSdk
  }
}

// Cached per page session: the SDK must not be evaluated twice, and a failed
// load is retried on the next attempt instead of being cached as rejected.
let evoSdkPromise: Promise<void> | null = null

function loadEvoCheckoutScript(src: string): Promise<void> {
  if (window.Checkout) return Promise.resolve()
  if (evoSdkPromise) return evoSdkPromise
  evoSdkPromise = new Promise<void>((resolve, reject) => {
    const fail = () => reject(new Error('No se pudo cargar tu panel de pago seguro.'))
    const existing = document.querySelector<HTMLScriptElement>('script[data-sisa-evo-checkout]')
    if (existing) {
      existing.addEventListener('load', () => (window.Checkout ? resolve() : fail()))
      existing.addEventListener('error', fail)
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.sisaEvoCheckout = 'true'
    script.dataset.complete = EVO_SDK_CALLBACKS.complete
    script.dataset.error = EVO_SDK_CALLBACKS.error
    script.dataset.timeout = EVO_SDK_CALLBACKS.timeout
    script.addEventListener('load', () => (window.Checkout ? resolve() : fail()))
    script.addEventListener('error', fail)
    document.head.appendChild(script)
  }).catch(err => {
    evoSdkPromise = null
    throw err
  })
  return evoSdkPromise
}

export interface UseFichaPaymentOptions {
  /** Backend candidate UUID. Empty string disables the flow (mock/demo mode). */
  candidateId: string

  /**
   * In-app path the gateway should return the payer to (e.g.
   * `/portal/ficha/pago`, or `/portal/registro/ficha` right after
   * registration). Must be on the backend allowlist
   * (`sisa.evo.allowed-return-paths`) or it is ignored server-side.
   * Omit to use the configured default return URL.
   */
  returnPath?: string

  /** Surfaces a user-facing message. Defaults to `console`; views pass their toast. */
  notify?: (message: string) => void

  /** Called after a confirmed payment so the view can update its own display. */
  onConfirmed?: (data: PaymentConfirmationBackend) => void

  /** Called when the backend reports the ficha was already paid (409). */
  onAlreadyPaid?: () => void

  /**
   * Query params to preserve when cleaning the outcome params off the URL
   * after a return. The post-registration screen keeps `?id=<uuid>` so a
   * reload still works.
   */
  preserveQuery?: Record<string, string>
}

/**
 * A permanent fact about this ficha: the online payment cannot be started, and
 * retrying will not change that. Set from the backend's own wording so there is a
 * single place that decides what a full career says.
 */
export interface PagoNoDisponible {
  /** `ADMISSION_QUOTA_REACHED` / `ADMISSION_PAYMENT_WINDOW_CLOSED`, when sent. */
  code?: string
  /** The backend's message, shown verbatim by the persistent notice. */
  message: string
}

export interface UseFichaPaymentResult {
  /** Opens the EVO panel. Call from the "Pagar en línea" button. */
  startCheckout: () => Promise<void>

  /** Treats the open panel as a user-cancelled payment. */
  cancelCheckout: () => void

  /** Render this as the `id` of the element the SDK panel mounts into. */
  containerId: string

  /** Non-null while the panel should be rendered. */
  evoCheckout: { checkoutJsUrl: string; sessionId: string } | null

  /** True while the SDK is being fetched/mounted. */
  evoLoading: boolean

  /** True while starting or confirming a payment. */
  processing: boolean

  /** Set once the backend has confirmed the payment. */
  confirmData: PaymentConfirmationBackend | null

  /** True when the ficha was already paid before this attempt. */
  alreadyPaid: boolean

  /**
   * Non-null when the payment cannot be started for a permanent reason, so the
   * view can show it as a notice that stays instead of a toast that leaves. It
   * records a fact about the ficha, so only a checkout that actually starts clears
   * it — a network error on the next attempt does not make a full career open up,
   * and forgetting the notice there would claim it did.
   */
  pagoNoDisponible: PagoNoDisponible | null

  /** Exposed for the mock demo path, which skips the backend entirely. */
  notify: (message: string) => void
}

export function useFichaPayment({
  candidateId,
  returnPath,
  notify = message => console.info(message),
  onConfirmed,
  onAlreadyPaid,
  preserveQuery,
}: UseFichaPaymentOptions): UseFichaPaymentResult {
  const [searchParams, setSearchParams] = useSearchParams()
  const esCandidatoReal = candidateId.length > 0

  // Ensures the EVO return handling runs once per mount: dev StrictMode
  // double-invokes effects, and the confirm is idempotent but must not re-fire
  // after the outcome params were already consumed and the query cleaned up.
  const returnHandledRef = useRef(false)

  // Session id whose SDK panel is already mounted — `showEmbeddedPage` must run
  // once per session, not on every re-render/remount.
  const evoMountedRef = useRef<string | null>(null)

  // A single outcome can reach the confirm from more than one path (SDK
  // callbacks + the iframe watcher + the return URL), so the POST is fired at
  // most once.
  const confirmingRef = useRef(false)

  const [evoCheckout, setEvoCheckout] = useState<{ checkoutJsUrl: string; sessionId: string } | null>(null)
  const [evoLoading, setEvoLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [confirmData, setConfirmData] = useState<PaymentConfirmationBackend | null>(null)
  const [alreadyPaid, setAlreadyPaid] = useState(false)
  const [pagoNoDisponible, setPagoNoDisponible] = useState<PagoNoDisponible | null>(null)

  // Callbacks read inside effects; keeping them in refs avoids re-running the
  // SDK mount effect on every parent re-render.
  const onConfirmedRef = useRef(onConfirmed)
  const onAlreadyPaidRef = useRef(onAlreadyPaid)
  const notifyRef = useRef(notify)
  onConfirmedRef.current = onConfirmed
  onAlreadyPaidRef.current = onAlreadyPaid
  notifyRef.current = notify

  const storageKey = `sisa.checkout.${candidateId}`

  function getStoredOrderId(): string | null {
    try {
      return sessionStorage.getItem(storageKey)
    } catch {
      return null
    }
  }

  function clearStoredOrderId(): void {
    try {
      sessionStorage.removeItem(storageKey)
    } catch {
      // sessionStorage unavailable — nothing to clean
    }
  }

  function cleanOutcomeParams(): void {
    setSearchParams(preserveQuery ?? {}, { replace: true })
  }

  /**
   * POST the verified confirmation → `POST /candidates/{id}/payments/confirm`.
   * The backend re-checks the order against EVO, so this is the only place a
   * ficha legitimately becomes `PAID`.
   */
  const confirmAfterReturn = useCallback(
    async (orderId: string) => {
      if (confirmingRef.current) return
      confirmingRef.current = true
      setProcessing(true)
      try {
        const res = await apiPost<PaymentConfirmationBackend>(`/candidates/${candidateId}/payments/confirm`, {
          orderId,
        })
        clearStoredOrderId()
        setConfirmData(res)
        onConfirmedRef.current?.(res)
        notifyRef.current(`Pago confirmado. Tu recibo es ${res.receiptNumber}.`)
      } catch (err) {
        const apiErr = err as Partial<ApiError>
        clearStoredOrderId()
        if (apiErr.status === 409) {
          // Already paid (idempotent re-confirm, or Finanzas confirmed meanwhile).
          setAlreadyPaid(true)
          onAlreadyPaidRef.current?.()
          notifyRef.current('La ficha ya figura como pagada.')
        } else if (apiErr.status === 404) {
          notifyRef.current('No se encontró el candidato. Vuelve a intentar.')
        } else {
          // 400 = EVO verification failed (no SUCCESS / amount mismatch); 502 = gateway down.
          notifyRef.current(apiErr.message ?? 'No se pudo confirmar el pago. Tu ficha sigue pendiente.')
        }
      } finally {
        confirmingRef.current = false
        setProcessing(false)
      }
    },
    [candidateId, storageKey]
  )

  const closeEvoPanel = useCallback(() => {
    evoMountedRef.current = null
    teardownEvoDom()
    setEvoCheckout(null)
    setEvoLoading(false)
  }, [])

  const onEvoSuccess = useCallback(() => {
    const orderId = getStoredOrderId()
    closeEvoPanel()
    if (!orderId) {
      notifyRef.current('Tu ficha sigue pendiente. Vuelve a intentar el pago.')
      return
    }
    void confirmAfterReturn(orderId)
  }, [closeEvoPanel, confirmAfterReturn, storageKey])

  const onEvoError = useCallback(() => {
    clearStoredOrderId()
    closeEvoPanel()
    notifyRef.current('No se pudo completar tu pago. Tu ficha sigue pendiente.')
  }, [closeEvoPanel, storageKey])

  const onEvoTimeout = useCallback(() => {
    clearStoredOrderId()
    closeEvoPanel()
    notifyRef.current('La sesión de pago expiró. Vuelve a intentar el pago.')
  }, [closeEvoPanel, storageKey])

  // Mount the official EVO Hosted Checkout SDK into the panel container that the
  // view already rendered. `configure` only takes the session id: the gateway
  // resolves merchant/order/amount server-side from that session.
  useEffect(() => {
    if (!evoCheckout) return
    const { checkoutJsUrl, sessionId } = evoCheckout
    if (evoMountedRef.current === sessionId) return
    evoMountedRef.current = sessionId
    let disposed = false
    setEvoLoading(true)

    evoSdkHandlers.complete = onEvoSuccess
    evoSdkHandlers.error = onEvoError
    evoSdkHandlers.timeout = onEvoTimeout

    loadEvoCheckoutScript(checkoutJsUrl)
      .then(() => {
        if (disposed) return
        const checkout = window.Checkout
        const container = document.getElementById(EVO_CHECKOUT_CONTAINER_ID)
        if (!checkout || !container) throw new Error('El panel de pago seguro no está disponible.')
        checkout.configure({ session: { id: sessionId } })
        checkout.showEmbeddedPage(`#${EVO_CHECKOUT_CONTAINER_ID}`)
        setEvoLoading(false)
      })
      .catch((err: unknown) => {
        if (disposed) return
        evoMountedRef.current = null
        teardownEvoDom()
        clearStoredOrderId()
        setEvoCheckout(null)
        setEvoLoading(false)
        notifyRef.current(err instanceof Error ? err.message : 'No se pudo cargar el panel de pago seguro.')
      })

    return () => {
      disposed = true
      evoSdkHandlers.complete = undefined
      evoSdkHandlers.error = undefined
      evoSdkHandlers.timeout = undefined
    }
  }, [evoCheckout, onEvoSuccess, onEvoError, onEvoTimeout, storageKey])

  // Safety net for the outcome paths that never reach the SDK callbacks nor the
  // top-level return: while a session is open, poll the SDK's own iframe and,
  // the moment it becomes same-origin on our return URL carrying the outcome
  // params (`resultIndicator` on success, `error` on failure), close the panel
  // and run the same confirmation. Reading `contentWindow.location` throws a
  // SecurityError while the frame is still cross-origin, which is exactly the
  // "still paying" case.
  useEffect(() => {
    if (!evoCheckout) return
    let handled = false
    const timer = window.setInterval(() => {
      if (handled) return
      const frame = document.getElementById(EVO_SDK_IFRAME_ID) as HTMLIFrameElement | null
      if (!frame?.contentWindow) return
      let href: string
      try {
        href = frame.contentWindow.location.href
      } catch {
        return
      }
      if (!href || href === 'about:blank') return
      const outcome = href.includes('?') ? href.slice(href.indexOf('?')) : ''
      const params = new URLSearchParams(outcome)
      if (!params.has('resultIndicator') && !params.has('error')) return
      handled = true
      if (params.has('resultIndicator')) {
        onEvoSuccess()
      } else {
        onEvoError()
      }
    }, 1000)

    return () => {
      handled = true
      window.clearInterval(timer)
    }
  }, [evoCheckout, onEvoSuccess, onEvoError])

  // EVO return cases after an external challenge (3DS): the return URL now
  // carries `?id=<candidateId>&orderId=<orderId>` plus `resultIndicator` on
  // SUCCESS or `error` on failure. A plain mount with NEITHER param is NOT a
  // cancel and must leave the ficha untouched.
  useEffect(() => {
    if (returnHandledRef.current || !esCandidatoReal) return
    const returnedOrderId = searchParams.get('orderId') ?? getStoredOrderId()
    const errorParam = searchParams.get('error')
    const isSuccess = searchParams.has('resultIndicator')
    if (!isSuccess && !errorParam) return
    returnHandledRef.current = true
    if (!returnedOrderId) {
      clearStoredOrderId()
      notifyRef.current('No encontramos tu pago. Vuelve a intentar el pago en línea.')
      cleanOutcomeParams()
      return
    }
    if (isSuccess) {
      void confirmAfterReturn(returnedOrderId)
      cleanOutcomeParams()
    } else {
      clearStoredOrderId()
      notifyRef.current('No se pudo completar tu pago. Tu ficha sigue pendiente.')
      cleanOutcomeParams()
    }
  })

  // Pay online → start a real EVO Hosted Checkout.
  const startCheckout = useCallback(async () => {
    if (!esCandidatoReal) {
      notifyRef.current('El pago en línea requiere una ficha registrada.')
      return
    }
    setProcessing(true)
    try {
      const res = await apiPost<CheckoutInitiationBackend>(`/candidates/${candidateId}/payments/checkout`, {
        returnPath,
      })
      try {
        sessionStorage.setItem(storageKey, res.orderId)
      } catch {
        // sessionStorage unavailable — the return call will just miss the cross-check.
      }
      // The payer stays inside SISA: the panel mounts the SDK and renders the
      // hosted payment form inline (mounted by the `evoCheckout` effect).
      setEvoCheckout({ checkoutJsUrl: res.checkoutJsUrl, sessionId: res.sessionId })
      // A checkout that starts is proof the ficha is payable, which is the only
      // thing that retires a previous refusal.
      setPagoNoDisponible(null)
      notifyRef.current('Completa tu pago seguro en el panel de abajo.')
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      // Show the backend's wording verbatim for the outcomes that are not
      // transient faults. The quota refusal used to be dressed up here as
      // recoverable — "vuelve a intentar, se liberará un lugar" — which invented a
      // waiting queue that does not exist and made a normal state of affairs look
      // like a loss. A cap on fichas sold is not a race: many people register, the
      // cap decides who pays, and running out of places is the rule working. What
      // matters is keeping the generic fallback off these two, since "intenta de
      // nuevo más tarde" is wrong for a closed window and for a full career alike.
      //
      // These two also set the persistent notice. A toast was the only channel, and
      // it leaves on its own: an Aspirante who pressed the button and looked away
      // kept a registered ficha and no idea why nothing happened. Every other error
      // deliberately does NOT clear the notice — a career that is full stays full
      // across a retry, and a dropped connection is not evidence it opened up.
      if (isNoRetryOutcome(apiErr.code)) {
        const message = apiErr.message ?? 'El pago en línea de esta carrera no está disponible.'
        setPagoNoDisponible({ code: apiErr.code, message })
        notifyRef.current(message)
        return
      }
      notifyRef.current(apiErr.message ?? 'No se pudo iniciar el pago en línea. Intenta de nuevo más tarde.')
    } finally {
      // The view renders this as `fixed inset-0 z-[200]`, so a leaked `true`
      // would cover the page with no way out. Every exit path clears it.
      setProcessing(false)
    }
  }, [candidateId, esCandidatoReal, returnPath, storageKey])

  // Manual close — the gateway session expires server-side; treat it as a cancel.
  const cancelCheckout = useCallback(() => {
    evoMountedRef.current = null
    teardownEvoDom()
    setEvoCheckout(null)
    clearStoredOrderId()
    notifyRef.current('Pago cancelado. Tu ficha sigue pendiente.')
  }, [storageKey])

  return {
    startCheckout,
    cancelCheckout,
    containerId: EVO_CHECKOUT_CONTAINER_ID,
    evoCheckout,
    evoLoading,
    processing,
    confirmData,
    alreadyPaid,
    pagoNoDisponible,
    notify,
  }
}
