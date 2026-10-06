/**
 * Centralized HTTP client for real backend integration. Owns the URL,
 * auth-header, and error-parsing plumbing that every `fetch()` call to
 * `118-SISA-BACK` needs — extracted so screens stop hand-rolling their own
 * copy of this logic (see `sdd/real-login-integration/api-client-refactor`).
 *
 * This module is intentionally the LOWER-LEVEL layer: `auth.ts` imports from
 * here, never the other way around, to avoid a circular import (auth.ts
 * needs `apiPost`; the request helpers here need the token/session-mode
 * readers that used to live in auth.ts).
 */

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080'

// ─── Session read accessors ─────────────────────────────────────────────────
// Read-only accessors needed to build requests (auth header, authenticated-only
// gating). The WRITE side (`persistSession`, `clearSession`,
// `persistMustChangePasswordCleared`, `getStoredMustChangePassword`) stays in
// `auth.ts` — those are session-domain concerns, not HTTP concerns.

const ACCESS_TOKEN_KEY = 'sisa.accessToken'

export function getAccessToken(): string | null {
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return null
  }
}

/**
 * Whether the current tab holds a session. The presence of an access token IS
 * the signal — there is no separate mode flag, so this can never disagree with
 * what the request builder actually attaches.
 */
export function hasSession(): boolean {
  return getAccessToken() !== null
}

// ─── Errors ─────────────────────────────────────────────────────────────────

export interface ApiError {
  status: number
  message: string
  /**
   * Stable machine-readable discriminator sent by the backend as `code` (e.g.
   * `ADMISSION_QUOTA_REACHED`). Prefer branching on this over `message`: several
   * distinct failures share one status, and the messages are applicant-facing
   * copy that gets reworded. `undefined` for handlers that do not send one, in
   * which case `message` is the only signal available.
   */
  code?: string
  /**
   * The `message` field of the backend's `ErrorResponse`, kept separate from
   * {@link ApiError.message} because that one degrades into non-user-facing text
   * (the `error` status label, or `Error <status>`) when the body carries no
   * message. `undefined` means "the backend did not describe this failure", so
   * a caller can tell "render what the backend said" apart from "render
   * something generic". Use {@link getApiErrorMessage} to read it.
   */
  backendMessage?: string
}

/** Error codes the admission flow branches on. Mirrors the backend's
 *  `GlobalExceptionHandler` constants — a rename on either side is breaking. */
export const ADMISSION_ERROR_CODES = {
  /**
   * The career sold all its places. Not a fault: the cap is the rule working, so
   * this must never be answered with a "try again later" — there is no queue to
   * wait in. Show the backend's message and leave it there.
   */
  quotaReached: 'ADMISSION_QUOTA_REACHED',
  /** The sales window closed. → tell them when it reopens; retrying is pointless. */
  salesWindowClosed: 'ADMISSION_SALES_WINDOW_CLOSED',
  /** Their CURP is already registered. → send them to the existing ficha. */
  candidateAlreadyExists: 'ADMISSION_CANDIDATE_ALREADY_EXISTS',
  /** The tuition concept's payment window closed. Also not retryable. */
  paymentWindowClosed: 'ADMISSION_PAYMENT_WINDOW_CLOSED',
  /**
   * A concurrent registration got there first — almost always two applicants
   * claiming the same folio number, which is derived from `count + 1` and so has
   * no lock. Nothing about her data is wrong and nothing was stored.
   *
   * Unlike `candidateAlreadyExists` this one IS retryable, and always resolves:
   * the winner is committed by the time the collision surfaces, so pressing
   * "Finalizar registro" again reads an advanced count and succeeds. The wizard
   * never navigated away (no folio was assigned), so her four steps are intact.
   */
  registrationConflict: 'ADMISSION_REGISTRATION_CONFLICT',
} as const

async function parseApiError(res: Response): Promise<ApiError> {
  let message = `Error ${res.status}`
  let code: string | undefined
  let backendMessage: string | undefined
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object') {
      const candidate = body as { message?: unknown; error?: unknown; code?: unknown }
      if (typeof candidate.message === 'string') message = candidate.message
      else if (typeof candidate.error === 'string') message = candidate.error
      if (typeof candidate.code === 'string' && candidate.code !== '') code = candidate.code
      // Only `message` counts as user-facing copy: `error` is a status label
      // ("No encontrado", "Bad Request") that says nothing about what failed.
      if (typeof candidate.message === 'string' && candidate.message.trim() !== '') {
        backendMessage = candidate.message
      }
    }
  } catch {
    // Non-JSON or empty error body — fall back to the generic status message.
  }
  return { status: res.status, message, code, backendMessage }
}

/** Shown when the request never produced a body-level message: the server is
 *  down, the response was not JSON, or Spring rejected the request before any
 *  handler ran (unmapped URL, wrong method, unsupported media type). */
export const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servidor. Intenta de nuevo más tarde.'

/**
 * The text to show the user for a caught error: the backend's own `message` when
 * it sent one, otherwise `fallback`.
 *
 * <p>The backend owns this copy. Every app-generated error carries a
 * human-readable Spanish `message` (see `ErrorResponse`), so branching on
 * `status` in the UI to pick a string would only duplicate — and eventually
 * contradict — what the server already said. Pass a `fallback` only for the
 * case the backend genuinely cannot describe (no response reached us).
 *
 * <p>Accepts `unknown` so it can be called directly on a `catch` binding.
 */
export function getApiErrorMessage(err: unknown, fallback: string = NETWORK_ERROR_MESSAGE): string {
  if (err && typeof err === 'object') {
    const { backendMessage } = err as Partial<ApiError>
    if (typeof backendMessage === 'string' && backendMessage.trim() !== '') return backendMessage
  }
  return fallback
}

// ─── 401 hook ───────────────────────────────────────────────────────────────
// A simple module-level mutable callback instead of importing RoleContext.tsx
// directly — RoleContext already depends on auth.ts, so importing it here
// would create its own cycle. The app registers a handler once (RoleContext's
// RoleProvider, on mount) so a 401 from ANY apiGet/apiPost call can react
// (force logout) without this module knowing anything about React or routing.

let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(fn: () => void): void {
  unauthorizedHandler = fn
}

// ─── Request helpers ────────────────────────────────────────────────────────

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const url = `${API_URL}${path}`
  if (!params) return url
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value))
  }
  const qs = query.toString()
  return qs ? `${url}?${qs}` : url
}

function buildHeaders(extra?: Record<string, string>): HeadersInit {
  const token = getAccessToken()
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    if (res.status === 401) unauthorizedHandler?.()
    throw await parseApiError(res)
  }
  // No-content responses (e.g. 204 from change-password) have no JSON body.
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const res = await fetch(buildUrl(path, params), {
    headers: buildHeaders(),
  })
  return handleResponse<T>(res)
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'PUT',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'PATCH',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'DELETE',
    headers: buildHeaders(),
  })
  return handleResponse<T>(res)
}

/**
 * Binary download (e.g. the ficha PDF at {@code GET /candidates/{id}/ficha.pdf}).
 * Reads the body as a {@link Blob} instead of JSON — {@code handleResponse}'s
 * JSON parse throws on {@code application/pdf} payloads, so this is a separate
 * helper that shares the same URL/auth/401 plumbing.
 */
export async function apiDownload(path: string): Promise<Blob> {
  const res = await fetch(buildUrl(path), {
    headers: buildHeaders(),
  })
  if (!res.ok) {
    if (res.status === 401) unauthorizedHandler?.()
    throw await parseApiError(res)
  }
  return res.blob()
}

/** Triggers a browser download for the given blob (helper for {@code apiDownload}). */
export function saveBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
