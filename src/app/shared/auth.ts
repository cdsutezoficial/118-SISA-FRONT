import type { Role } from './RoleContext'

/**
 * Real backend integration for login/session only (see
 * `openspec/changes/real-login-integration/design.md`). Plain `fetch`, no
 * HTTP client library, no `jwt-decode` — a minimal manual base64url decoder
 * is enough because this change only ever reads `sub`/`roles`/`exp` off the
 * access token, never verifies its signature (verification is the backend's
 * job).
 */
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080'

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

export interface ApiError {
  status: number
  message: string
}

// ─── Storage ────────────────────────────────────────────────────────────────
// `sisa.` prefix mirrors the existing `sisa.mockRole` key (untouched by this
// change). sessionStorage: tab-scoped, survives reload, cleared on tab close.

const ACCESS_TOKEN_KEY = 'sisa.accessToken'
const REFRESH_TOKEN_KEY = 'sisa.refreshToken'
const AUTH_MODE_KEY = 'sisa.authMode'
const MUST_CHANGE_PASSWORD_KEY = 'sisa.mustChangePassword'

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

export async function apiLogin(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw await parseApiError(res)
  return (await res.json()) as LoginResponse
}

export async function apiChangePassword(
  currentPassword: string,
  newPassword: string,
  accessToken: string
): Promise<void> {
  const res = await fetch(`${API_URL}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  if (!res.ok) throw await parseApiError(res)
}
