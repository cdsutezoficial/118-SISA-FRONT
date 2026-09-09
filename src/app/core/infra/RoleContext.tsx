import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  mapRoles,
  decodeJwtPayload,
  getStoredMustChangePassword,
  persistSession,
  clearSession,
  persistMustChangePasswordCleared,
} from './auth'
import type { LoginResponse, JwtClaims } from './auth'
import { getAccessToken, getStoredAuthMode, setUnauthorizedHandler } from './apiClient'

/**
 * Persists the mock role across full page reloads (sessionStorage — scoped to
 * the browser tab, cleared on close, closest mock equivalent to a real auth
 * session). Without this, typing a URL directly in the address bar triggers a
 * full reload, `RoleProvider`'s `useState` remounts at its hardcoded default,
 * and `RequireRole` correctly-but-confusingly blocks a role the user had
 * already switched to moments earlier via the Navbar dropdown.
 */
const ROLE_STORAGE_KEY = 'sisa.mockRole'
const ACTIVE_ROLE_KEY = 'sisa.activeRole'

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

/**
 * Picks the persisted active role for a real session — only valid if it is
 * one of the user's actual JWT-mapped roles (a stale choice from an edited
 * role set falls back to the first candidate). `null` when the user has no
 * mapped role at all.
 */
function readStoredActiveRole(candidates: Role[]): Role | null {
  if (candidates.length === 0) return null
  try {
    const raw = sessionStorage.getItem(ACTIVE_ROLE_KEY)
    if (raw && (candidates as string[]).includes(raw)) return raw as Role
  } catch {
    // sessionStorage unavailable — fall through to first candidate.
  }
  return candidates[0]
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
 * above exactly as it was — local `useState`, manual switcher over the full
 * staff catalog. **Real mode** (`authMode === 'real'`, entered via `login()`
 * after `POST /auth/login` succeeds) derives the user's ACTUAL roles from the
 * session's decoded JWT `roles` claim: `availableRoles` narrows to those, a
 * multi-role account picks its entry role right after login, and the shell
 * switcher keeps working to change role mid-session. The chosen role persists
 * in `sisa.activeRole` so a reload restores it. Only `ADMIN` has a seeded
 * backend user today, so mock mode stays available for every other
 * in-progress module's staff roles.
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
  /**
   * Switches the active role. Mock mode: any of `availableRoles`/`null`.
   * Real mode: only the session's own JWT-mapped roles (escalation/null are
   * ignored); the selection persists in sessionStorage for reloads.
   */
  setRole: (role: Role | null) => void
  /**
   * Switchable roles. Mock mode: the full staff catalog. Real mode: exactly
   * the current account's JWT-mapped roles. Never contains `null`/`CANDIDATO`.
   */
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
  // Lazy initializer (not a `useEffect`) so a real session's `claims` — and
  // therefore `role` — is correct on the VERY FIRST render after a full
  // reload/direct URL navigation. An effect-based rehydration leaves `claims`
  // `null` for one render before running, which `RequireRole` reads
  // synchronously — a route wrapped in `RequireRole` would bounce an already
  // -authenticated real-mode user away on every hard reload, since `role`
  // resolves to `null` before the effect ever fires.
  const [claims, setClaims] = useState<JwtClaims | null>(() => {
    if (getStoredAuthMode() !== 'real') return null
    const token = getAccessToken()
    return token ? decodeJwtPayload(token) : null
  })

  // Every real role the current session may activate (JWT-mapped). Re-derives
  // from `claims` — set at login and lazily hydrated on reload alike — so it
  // is never stale independently of them.
  const realRoles: Role[] = claims ? mapRoles(claims.roles) : []

  // The role actually in effect during a real session. Lazy initializer keeps
  // a reload on a route gated per-role from flashing the wrong role first.
  const [activeRole, setActiveRoleState] = useState<Role | null>(() => {
    if (getStoredAuthMode() !== 'real') return null
    const token = getAccessToken()
    const decoded = token ? decodeJwtPayload(token) : null
    return readStoredActiveRole(decoded ? mapRoles(decoded.roles) : [])
  })

  function setRole(next: Role | null) {
    if (authMode === 'real') {
      // A real session may activate ONLY roles the account actually has —
      // `null`/escalation attempts are ignored, never silently applied.
      if (next !== null && realRoles.includes(next)) {
        setActiveRoleState(next)
        try {
          sessionStorage.setItem(ACTIVE_ROLE_KEY, next)
        } catch {
          // sessionStorage unavailable — role just won't survive a reload.
        }
      }
      return
    }
    writeStoredRole(next)
    setMockRoleState(next)
  }

  function login(res: LoginResponse) {
    persistSession(res)
    const decoded = decodeJwtPayload(res.accessToken)
    setClaims(decoded)
    setActiveRoleState(readStoredActiveRole(decoded ? mapRoles(decoded.roles) : []))
    setAuthModeState('real')
    setMustChangePasswordState(res.mustChangePassword)
  }

  function logout() {
    clearSession()
    setClaims(null)
    setActiveRoleState(null)
    setMustChangePasswordState(false)
    setAuthModeState('real') // stays 'real' — re-access must route to /login, not fall back to mock mode
  }

  function completePasswordChange() {
    persistMustChangePasswordCleared()
    setMustChangePasswordState(false)
  }

  // Registers the global 401 reaction once — any `apiGet`/`apiPost` call
  // (from anywhere in the app) that gets a 401 back triggers `logout()`
  // through this handler, on top of whatever local error handling the
  // calling screen already does (e.g. a red banner). `apiClient.ts` can't
  // import this module directly (RoleContext already depends on `auth.ts`,
  // which depends on `apiClient.ts` — importing back would cycle), hence the
  // callback-registration indirection.
  useEffect(() => {
    setUnauthorizedHandler(logout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const role = authMode === 'real' ? activeRole : mockRole

  const value: RoleContextValue = {
    role,
    setRole,
    // Real mode: the account's actual JWT roles (single-role accounts get one
    // entry; multi-role get the full list the switcher can move between).
    // Mock mode: the full switchable staff catalog.
    availableRoles: authMode === 'real' ? realRoles : AVAILABLE_ROLES,
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
