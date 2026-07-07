import type { Role } from './RoleContext'
import { apiPost } from './apiClient'

/**
 * Real backend integration for login/session only (see
 * `openspec/changes/real-login-integration/design.md`). No `jwt-decode` — a
 * minimal manual base64url decoder is enough because this change only ever
 * reads `sub`/`roles`/`exp` off the access token, never verifies its
 * signature (verification is the backend's job).
 *
 * HTTP plumbing (`API_URL`, request/error handling, token/session-mode read
 * accessors) lives in `apiClient.ts` — this module is a CONSUMER of it, not
 * the other way around (see `sdd/real-login-integration/api-client-refactor`
 * for why the boundary is drawn there). This module keeps the WRITE-side
 * session functions below, which are session-domain concerns, not HTTP ones.
 */

/**
 * Backend `RoleType` → frontend `Role` lookup. Only roles with an existing
 * frontend concept are mapped; anything else (estadías roles, `DOCENTE`,
 * `ESTUDIANTE`, `EGRESADO`) has no frontend `Role` yet and is intentionally
 * left out — `mapRole` skips over unmapped entries.
 */
export const ROLE_MAP: Record<string, Role> = {
  ADMIN: 'ADMINISTRADOR',
  PERSONAL_FINANZAS: 'FINANZAS',
  SERVICIOS_ESCOLARES: 'SERVICIOS_ESCOLARES',
  GESTOR_ACADEMICO: 'GESTOR_ACADEMICO',
  DIRECTOR_DIVISION: 'DIRECTOR_DIVISION',
}

/** First entry in `roles` that has a frontend `Role` mapping wins; `null` if none do. */
export function mapRole(roles: string[]): Role | null {
  for (const backendRole of roles) {
    const mapped = ROLE_MAP[backendRole]
    if (mapped) return mapped
  }
  return null
}

export interface JwtClaims {
  sub: string
  roles: string[]
  exp: number
}

/**
 * Decodes the payload segment of a JWT — base64url, NOT signature-verified
 * (verification already happened server-side; the frontend only needs the
 * claims to derive role/expiry for UI purposes). Returns `null` for any
 * malformed token so callers can treat it the same as "no session".
 */
export function decodeJwtPayload(token: string): JwtClaims | null {
  try {
    const segments = token.split('.')
    if (segments.length !== 3) return null
    const payload = segments[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const binary = atob(padded)
    const json = decodeURIComponent(
      Array.prototype.map
        .call(binary, (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    const claims = JSON.parse(json) as Partial<JwtClaims>
    if (typeof claims.sub !== 'string' || !Array.isArray(claims.roles) || typeof claims.exp !== 'number') {
      return null
    }
    return { sub: claims.sub, roles: claims.roles, exp: claims.exp }
  } catch {
    return null
  }
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  mustChangePassword: boolean
}

// ─── Storage ────────────────────────────────────────────────────────────────
// `sisa.` prefix mirrors the existing `sisa.mockRole` key (untouched by this
// change). sessionStorage: tab-scoped, survives reload, cleared on tab close.
// Read accessors for the access/auth-mode keys live in `apiClient.ts` (needed
// there to build requests); this module keeps the WRITE side only.

const ACCESS_TOKEN_KEY = 'sisa.accessToken'
const REFRESH_TOKEN_KEY = 'sisa.refreshToken'
const AUTH_MODE_KEY = 'sisa.authMode'
const MUST_CHANGE_PASSWORD_KEY = 'sisa.mustChangePassword'

export function getStoredMustChangePassword(): boolean {
  try {
    return sessionStorage.getItem(MUST_CHANGE_PASSWORD_KEY) === 'true'
  } catch {
    return false
  }
}

/** Persists a successful login response and switches storage into real mode. */
export function persistSession(res: LoginResponse): void {
  try {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, res.accessToken)
    sessionStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken)
    sessionStorage.setItem(AUTH_MODE_KEY, 'real')
    sessionStorage.setItem(MUST_CHANGE_PASSWORD_KEY, String(res.mustChangePassword))
  } catch {
    // sessionStorage unavailable (e.g. private browsing) — session just won't survive a reload.
  }
}

/**
 * Clears tokens/claims/pending-password-change on logout, but keeps
 * `authMode` at `'real'` — a subsequent visit (or back-navigation) must still
 * be routed to `/login`, not silently fall back to mock mode.
 */
export function clearSession(): void {
  try {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    sessionStorage.setItem(MUST_CHANGE_PASSWORD_KEY, 'false')
    sessionStorage.setItem(AUTH_MODE_KEY, 'real')
  } catch {
    // sessionStorage unavailable — nothing to clear.
  }
}

export function persistMustChangePasswordCleared(): void {
  try {
    sessionStorage.setItem(MUST_CHANGE_PASSWORD_KEY, 'false')
  } catch {
    // sessionStorage unavailable — flag just won't survive a reload.
  }
}

// ─── API calls ──────────────────────────────────────────────────────────────
// Both go through `apiPost` (apiClient.ts) — it auto-attaches
// `Authorization: Bearer <token>` when one exists in storage and parses
// errors uniformly.
//
// `apiLogin` doesn't need an auth header (unauthenticated `/auth/login`
// call), but letting `apiPost` attach one unconditionally is harmless: there
// is normally no token yet at login time, and even a stale one from a prior
// session wouldn't be checked by this endpoint. No opt-out is added.

export async function apiLogin(username: string, password: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/auth/login', { username, password })
}

/**
 * Reads the access token implicitly via `apiPost`'s automatic Bearer
 * attachment rather than taking it as a parameter — at every call site
 * (`CambiarPassword.tsx`), `authMode` is already `'real'`, meaning `login()`
 * already ran and `persistSession()` already stored the token, so it's
 * always present in storage by the time this is called.
 */
export async function apiChangePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiPost<void>('/auth/change-password', { currentPassword, newPassword })
}
