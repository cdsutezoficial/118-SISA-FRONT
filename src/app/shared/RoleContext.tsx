import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  mapRole,
  decodeJwtPayload,
  getAccessToken,
  getStoredAuthMode,
  getStoredMustChangePassword,
  persistSession,
  clearSession,
  persistMustChangePasswordCleared,
} from './auth'
import type { LoginResponse, JwtClaims } from './auth'

/**
 * Persists the mock role across full page reloads (sessionStorage — scoped to
 * the browser tab, cleared on close, closest mock equivalent to a real auth
 * session). Without this, typing a URL directly in the address bar triggers a
 * full reload, `RoleProvider`'s `useState` remounts at its hardcoded default,
 * and `RequireRole` correctly-but-confusingly blocks a role the user had
 * already switched to moments earlier via the Navbar dropdown.
 */
const ROLE_STORAGE_KEY = 'sisa.mockRole'

function readStoredRole(): Role | null {
  try {
    const raw = sessionStorage.getItem(ROLE_STORAGE_KEY)
    if (raw === 'null') return null
    if (raw && (ALL_ROLES as string[]).includes(raw)) return raw as Role
  } catch {
    // sessionStorage unavailable (e.g. private browsing) — fall through to default.
  }
  return 'SERVICIOS_ESCOLARES'
}

function writeStoredRole(role: Role | null) {
  try {
    sessionStorage.setItem(ROLE_STORAGE_KEY, role === null ? 'null' : role)
  } catch {
    // sessionStorage unavailable — role just won't survive a reload, no crash.
  }
}

/**
 * Mock role system for the Admisión module prototype.
 *
 * Three identity tiers:
 * 1. Staff roles (`ADMINISTRADOR`, `GESTOR_ACADEMICO`, `SERVICIOS_ESCOLARES`,
 *    `FINANZAS`, `DIRECTOR_DIVISION`) — authenticated shell, `/admision/*`.
 * 2. `CANDIDATO` — post-registration portal access, set after a simulated
 *    folio+CURP "login" on `/portal/induccion`. Not part of `availableRoles`.
 * 3. `null` (anonymous visitor) — pre-registration public flow
 *    (`/portal/registro*`). No login at all.
 *
 * Dual-mode session (real login integration, see
 * `openspec/changes/real-login-integration/design.md`): **mock mode**
 * (`authMode === 'mock'`, the default on a fresh tab) keeps every behavior
 * above exactly as it was — local `useState`, manual switcher. **Real mode**
 * (`authMode === 'real'`, entered via `login()` after `POST /auth/login`
 * succeeds) derives `role` from the session's decoded JWT `roles` claim
 * instead, and the switcher stops applying. Only `ADMIN` has a seeded backend
 * user today, so mock mode stays available for every other in-progress
 * module's staff roles.
 */
export type Role =
  | 'ADMINISTRADOR'
  | 'GESTOR_ACADEMICO'
  | 'SERVICIOS_ESCOLARES'
  | 'FINANZAS'
  | 'DIRECTOR_DIVISION'
  | 'CANDIDATO'

export interface RoleUser {
  name: string
  email: string
}

export interface RoleContextValue {
  /** `null` = anonymous visitor (pre-registration public flow). */
  role: Role | null
  /** No-op in real mode — the switcher never overrides a JWT-derived role. */
  setRole: (role: Role | null) => void
  /** Staff dropdown source — never contains `null` or `CANDIDATO`. */
  availableRoles: Role[]
  /** `null` when anonymous (`role === null`). */
  user: RoleUser | null
  /** `'mock'` (manual switcher, default) or `'real'` (JWT-derived, entered via `login()`). */
  authMode: 'mock' | 'real'
  /** `true` right after a login response with `mustChangePassword: true`, until `completePasswordChange()`. */
  mustChangePassword: boolean
  /** Establishes a real session from a successful `/auth/login` response. */
  login: (res: LoginResponse) => void
  /** Clears the real session; `authMode` stays `'real'` so re-access routes to `/login`, not back to mock mode. */
  logout: () => void
  /** Clears the pending mandatory-password-change flag after `/auth/change-password` succeeds. */
  completePasswordChange: () => void
}

const MOCK_USER: RoleUser = { name: 'María González', email: 'admin@utez.edu.mx' }

// CANDIDATO is a real role (set after portal login, not chosen by staff) and
// `null` is the anonymous tier — neither belongs in the switchable staff list.
const AVAILABLE_ROLES: Role[] = [
  'ADMINISTRADOR',
  'GESTOR_ACADEMICO',
  'SERVICIOS_ESCOLARES',
  'FINANZAS',
  'DIRECTOR_DIVISION',
]

/** Every valid `Role` value, including `CANDIDATO` — used only to validate a stored value before trusting it. */
const ALL_ROLES: Role[] = [...AVAILABLE_ROLES, 'CANDIDATO']

const RoleContext = createContext<RoleContextValue | undefined>(undefined)

export function RoleProvider({ children }: { children: ReactNode }) {
  const [mockRole, setMockRoleState] = useState<Role | null>(readStoredRole)
  const [authMode, setAuthModeState] = useState<'mock' | 'real'>(getStoredAuthMode)
  const [mustChangePassword, setMustChangePasswordState] = useState<boolean>(getStoredMustChangePassword)
  const [claims, setClaims] = useState<JwtClaims | null>(null)

  // Rehydrate a real session from storage after a full reload. Runs once on
  // mount only — `login()`/`logout()` update `claims` directly afterwards.
  useEffect(() => {
    if (getStoredAuthMode() !== 'real') return
    const token = getAccessToken()
    if (!token) return
    setClaims(decodeJwtPayload(token))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setRole(next: Role | null) {
    writeStoredRole(next)
    setMockRoleState(next)
  }

  function login(res: LoginResponse) {
    persistSession(res)
    setClaims(decodeJwtPayload(res.accessToken))
    setAuthModeState('real')
    setMustChangePasswordState(res.mustChangePassword)
  }

  function logout() {
    clearSession()
    setClaims(null)
    setMustChangePasswordState(false)
    setAuthModeState('real') // stays 'real' — re-access must route to /login, not fall back to mock mode
  }

  function completePasswordChange() {
    persistMustChangePasswordCleared()
    setMustChangePasswordState(false)
  }

  const role = authMode === 'real' ? mapRole(claims?.roles ?? []) : mockRole

  const value: RoleContextValue = {
    role,
    setRole,
    availableRoles: AVAILABLE_ROLES,
    user: role === null ? null : MOCK_USER,
    authMode,
    mustChangePassword,
    login,
    logout,
    completePasswordChange,
  }

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

/** Only sanctioned way to read the active mock role — never reach into the provider directly. */
export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext)
  if (!ctx) {
    throw new Error('useRole must be used within a RoleProvider')
  }
  return ctx
}
