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
// Read-only accessors needed to build requests (auth header, mock-vs-real
// gating). The WRITE side (`persistSession`, `clearSession`,
// `persistMustChangePasswordCleared`, `getStoredMustChangePassword`) stays in
// `auth.ts` — those are session-domain concerns, not HTTP concerns.

const ACCESS_TOKEN_KEY = 'sisa.accessToken'
const AUTH_MODE_KEY = 'sisa.authMode'

export function getAccessToken(): string | null {
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return null
  }
}

export function getStoredAuthMode(): 'mock' | 'real' {
  try {
    return sessionStorage.getItem(AUTH_MODE_KEY) === 'real' ? 'real' : 'mock'
  } catch {
    return 'mock'
  }
}

// ─── Errors ─────────────────────────────────────────────────────────────────

export interface ApiError {
  status: number
  message: string
}

async function parseApiError(res: Response): Promise<ApiError> {
  let message = `Error ${res.status}`
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object') {
      const candidate = body as { message?: unknown; error?: unknown }
      if (typeof candidate.message === 'string') message = candidate.message
      else if (typeof candidate.error === 'string') message = candidate.error
    }
  } catch {
    // Non-JSON or empty error body — fall back to the generic status message.
  }
  return { status: res.status, message }
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
