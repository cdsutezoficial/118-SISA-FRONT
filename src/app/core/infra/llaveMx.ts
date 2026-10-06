/**
 * Client for the `118-SISA-BACK` Llave Morelos OAuth surface (PKCE, backend-owned).
 *
 * The frontend never sees the client secret, the authorization code, or the
 * code verifier: it only asks the backend to start a flow, then leaves the tab.
 * The backend redirects back to us with the outcome.
 *
 * Where the outcome lands matters, and it is not the same for each flow:
 *
 *   staff      → `/login#llave=<access>&refresh=<refresh>`
 *                 Fragment, not query. A fragment is never part of the HTTP
 *                 request, so the tokens stay out of proxy logs and out of the
 *                 `Referer` on the next navigation.
 *   candidate  → `/portal/registro?llave=verified`
 *                 A marker only, no identity data in the URL. The actual proof
 *                 is the HttpOnly `sisa.llave.verified` ticket cookie, which
 *                 `POST /candidates` re-validates server-side. A query marker
 *                 is safe here precisely because it carries no secret — a
 *                 forged `?llave=verified` in the address bar buys nothing.
 *   linked     → `/usuarios/detalle?id=<uuid>#llaveLinked=ok`
 *                 Same reasoning as the candidate marker: nothing in it is a
 *                 credential, and the badge it refreshes is re-read from
 *                 `GET /users/{id}` anyway. Failures arrive as `#error=` on the
 *                 same landing.
 *
 * Reads `window.location` directly (no react-router) because this module runs
 * from a `useEffect` and from click handlers, both of which sit outside the
 * router's render cycle for the fragment we are about to rewrite.
 */

import { apiGet, apiPost } from './apiClient'

/** Mirrors the backend's `Flavor` enum. */
export type LlaveMxFlavor = 'staff' | 'candidate'

interface LlaveMxAvailabilityResponse {
  configured: boolean
  // Unused by the UI today; kept so a future "why is it missing" hint can
  // branch on the cause instead of guessing.
  reason?: string | null
}

interface LlaveMxStartResponse {
  // The provider URL. Absolute, because the browser is leaving the origin.
  authorizationUrl: string
}

export type LlaveMxCallbackOutcome =
  | { kind: 'staff'; accessToken: string; refreshToken: string; mustChangePassword: boolean }
  | { kind: 'candidate-verified' }
  | { kind: 'linked' }
  | { kind: 'error'; message: string }
  | { kind: 'none' }

/**
 * Whether the backend has a client id + secret + redirect URI + entity URL.
 *
 * The button is hidden rather than shown-and-failing: an operator who has not
 * filled in the env vars yet should see the local login they already know works,
 * not a dead OAuth affordance. A 404 (older backend without the endpoint) is
 * read as "not configured" for the same reason.
 */
export async function fetchLlaveMxAvailability(): Promise<boolean> {
  try {
    const res = await apiGet<LlaveMxAvailabilityResponse>('/auth/llave-mx/status')
    return res.configured === true
  } catch {
    return false
  }
}

/**
 * Starts the flow and navigates the whole tab to the provider. Returns nothing:
 * the tab is leaving, so there is no continuation to hand back to the caller.
 *
 * `flavor` rides as a request param and the body stays empty, because the
 * backend's `/start` takes no payload — the verifier never leaves its cookie.
 */
export async function startLlaveMxFlow(flavor: LlaveMxFlavor): Promise<void> {
  const res = await apiPost<LlaveMxStartResponse>('/auth/llave-mx/start', undefined, { flavor })
  window.location.assign(res.authorizationUrl)
}

/**
 * Starts a *linking* round instead of a login (RF-AUTH-002 "vinculacion
 * posterior desde el perfil").
 *
 * Unlike `startLlaveMxFlow` this endpoint is authenticated and ADMIN-only: the
 * backend resolves the account to bind from its own caller context plus this
 * `userId`, never from anything the browser sends on the callback. The tab
 * still leaves — there is no session to hand back, and the answer arrives as a
 * `#llaveLinked=ok` marker on the profile it came from.
 */
export async function startLlaveMxLink(userId: string): Promise<void> {
  const res = await apiPost<LlaveMxStartResponse>('/auth/llave-mx/link', undefined, { userId })
  window.location.assign(res.authorizationUrl)
}

/**
 * Reads the callback's landing parameters and scrubs them from the URL.
 *
 * The scrub is not cosmetic. Without it the tokens sit in the address bar for
 * the rest of the session — visible in a screenshot, in a shared link, and in
 * the browser's own history — and, worse, they survive a reload and let the
 * handoff replay. `replaceState` (not `pushState`) so the entry is replaced
 * rather than shadowed, and the query variant is cleared for the candidate
 * mount.
 */
export function consumeLlaveMxCallback(): LlaveMxCallbackOutcome {
  const url = new URL(window.location.href)
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
  const hashParams = new URLSearchParams(hash)
  const searchParams = url.searchParams

  const accessToken = hashParams.get('llave')
  const refreshToken = hashParams.get('refresh')
  const mustChangePassword = hashParams.get('mustChangePassword')
  const error = hashParams.get('error')
  const linkedMarker = hashParams.get('llaveLinked')
  const candidateMarker = searchParams.get('llave')

  const hasOutcome =
    accessToken !== null ||
    error !== null ||
    linkedMarker !== null ||
    candidateMarker !== null
  if (!hasOutcome) return { kind: 'none' }

  // Scrub first, then decide — the value is captured in locals above, so the
  // rewrite can never race the read.
  url.hash = ''
  url.searchParams.delete('llave')
  window.history.replaceState(null, '', url.pathname + url.search)

  if (error !== null) {
    return { kind: 'error', message: error }
  }

  if (accessToken !== null) {
    // A partial pair is not a session. Treat it as the failure it is rather than
    // half-establishing one: `persistSession` would write a refresh token that
    // does not exist and strand the tab at a silent 401 later.
    if (!refreshToken) {
      return {
        kind: 'error',
        message: 'La respuesta de Llave Morelos vino incompleta. Intenta de nuevo.',
      }
    }
    // Anything other than the literal "true" reads as false. The value is only a
    // redirect hint, never an authorization decision — the backend's own
    // password-change gate re-checks it on the endpoint that matters.
    return {
      kind: 'staff',
      accessToken,
      refreshToken,
      mustChangePassword: mustChangePassword === 'true',
    }
  }

  // Reached only when there were no tokens: a link round never mints a
  // session, it only reports that the binding was written. Returning the
  // candidate marker here would leave the profile page claiming a verification
  // that had nothing to do with it.
  if (linkedMarker !== null) {
    return { kind: 'linked' }
  }

  return { kind: 'candidate-verified' }
}
