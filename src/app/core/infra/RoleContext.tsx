import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  apiMeProfile,
  decodeCapabilities,
  decodeJwtPayload,
  getStoredMustChangePassword,
  getStoredUserProfile,
  mapAccountRoles,
  mapFrontendRoleKey,
  mapRoles,
  markSignedOut,
  persistSession,
  persistUserProfile,
  clearSession,
  persistMustChangePasswordCleared,
} from './auth'
import type { LoginResponse, JwtClaims, CapabilityResponse, MeProfile, AccountRoleOption } from './auth'
import { apiGet, getAccessToken, setUnauthorizedHandler } from './apiClient'
import type { ApiError } from './apiClient'

/**
 * The selected role persists across full page reloads (sessionStorage — scoped
 * to the browser tab). Without this, typing a URL directly in the address bar
 * triggers a full reload, `RoleProvider`'s `useState` remounts at `null`, and
 * `RequireRole` blocks a role the user had legitimately switched to moments
 * earlier via the Navbar dropdown.
 *
 * Only ever a role the account actually holds: `readStoredActiveRole` narrows
 * a stale stored value to one of the JWT-mapped roles or ignores it.
 */
const ACTIVE_ROLE_KEY = 'sisa.activeRole'

/**
 * Picks the persisted active role — only valid if it is one of the account's
 * actual JWT-mapped roles (a stale choice from an edited role set falls back to
 * the first candidate). `null` when the session has no mapped role at all.
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

/**
 * Role model. There is no mock tier anymore — a session either exists (an
 * access token is in `sessionStorage`) or it doesn't.
 *
 * Two kinds of role exist:
 * 1. Staff roles (`ADMINISTRADOR`, `GESTOR_ACADEMICO`, `SERVICIOS_ESCOLARES`,
 *    `FINANZAS`, `DIRECTOR_DIVISION`) — derived from the session's decoded JWT
 *    `roles` claim and switchable among themselves while the session lasts.
 * 2. `CANDIDATO` — set by the public portal after a folio+CURP lookup, never
 *    chosen by the staff switcher and never granted by a JWT staff claim.
 *
 * `null` (anonymous) is the pre-registration public flow (`/portal/registro*`),
 * which needs no login at all.
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
   * Switches the active role. Only roles the session's JWT actually grants are
   * honored — `null`/escalation attempts are ignored, never silently applied.
   * The selection persists in sessionStorage for reloads.
   */
  setRole: (role: Role | null) => void
  /**
   * Every role the current session may activate (JWT-mapped). Single-role
   * accounts get one entry; multi-role accounts get the list the shell switcher
   * moves between. Never contains `null`/`CANDIDATO`.
   */
  availableRoles: Role[]
  /**
   * The account's COMPLETE role list from the JWT, including roles the frontend
   * has no module for yet (`role: null`). `availableRoles` is the activatable
   * subset of this. The role selectors render the disabled entries too, so an
   * account never loses sight of a role it actually holds.
   */
  accountRoles: AccountRoleOption[]
  /** `null` when anonymous (`role === null`) or while the profile loads. */
  user: RoleUser | null
  /** `true` right after a login response with `mustChangePassword: true`, until `completePasswordChange()`. */
  mustChangePassword: boolean
  /** Backend role key currently active in the shell, if the frontend role maps to one. */
  activeRoleKey: string | null
  /** Permission keys granted to the current session (union across the account's JWT roles). */
  activePermissionKeys: string[]
  /**
   * Permission resolution state. Starts `'pending'` whenever a session exists
   * so guards NEVER treat "not loaded yet" as "no permission" — that is the
   * reload false-positive race. Without a session it starts `'idle'` with no
   * keys, since there is nothing to resolve.
   */
  permissionsStatus: 'pending' | 'loading' | 'idle' | 'error'
  /** Human-readable permission loading error, if any. */
  permissionsError: string
  /** True when the session has the given permission key. */
  hasPermission: (permissionKey: string) => boolean
  /** True when the session has any of the given permission keys. */
  hasAnyPermission: (permissionKeys: string[]) => boolean
  /** Re-fetches the session's capability envelope from the backend. */
  refreshCapabilities: () => Promise<void>
  /** Establishes a session from a successful `/auth/login` response. */
  login: (res: LoginResponse) => void
  /**
   * Session ended involuntarily (`true` when a 401 or the JWT `exp` crossed).
   * Flags so `RequireAuth` keeps the current view mounted and shows the
   * floating expiry alert OVER it for 5 seconds; the actual cleanup happens
   * right before that alert redirects (clearing earlier would gut the
   * role-hydrated tree underneath and trigger redirect loops).
   */
  sessionExpired: boolean
  /**
   * Marks the session as expired WITHOUT clearing anything. Called by the 401
   * handler and the expiry timer; `RequireAuth` turns it into the floating
   * alert, and the alert itself performs the real `logout()` + redirect.
   */
  triggerSessionExpired: () => void
  /** Clears the session; the tab stays flagged signed-out so re-entry routes to `/login`. */
  logout: () => void
  /** Clears the pending mandatory-password-change flag after `/auth/change-password` succeeds. */
  completePasswordChange: () => void
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined)

export function RoleProvider({ children }: { children: ReactNode }) {
  const [mustChangePassword, setMustChangePasswordState] = useState<boolean>(getStoredMustChangePassword)
  const [sessionExpired, setSessionExpired] = useState(false)
  // Lazy initializer (not a `useEffect`) so a session's `claims` — and
  // therefore `role` — is correct on the VERY FIRST render after a full
  // reload/direct URL navigation. An effect-based rehydration leaves `claims`
  // `null` for one render before running, which `RequireRole` reads
  // synchronously — a route wrapped in `RequireRole` would bounce an already
  // -authenticated user away on every hard reload, since `role` resolves to
  // `null` before the effect ever fires.
  const [claims, setClaims] = useState<JwtClaims | null>(() => {
    const token = getAccessToken()
    return token ? decodeJwtPayload(token) : null
  })

  // The shell user (Navbar/Sidebar footer): hydrated from `GET /auth/me` and
  // cached in sessionStorage. Lazy initializer (same rationale as `claims`) so
  // the name/email is right on the very first render of a hard reload. `null` =
  // not fetched yet or fetch failed — the shell's `'Usuario'` placeholder shows
  // meanwhile, never a wrong name.
  const [userProfile, setUserProfile] = useState<RoleUser | null>(() => getStoredUserProfile())

  // Every role the current session may activate (JWT-mapped). Re-derives from
  // `claims` — set at login and lazily hydrated on reload alike — so it is never
  // stale independently of them.
  const realRoles: Role[] = claims ? mapRoles(claims.roles) : []

  // The account's COMPLETE role list (including roles the frontend can't
  // activate yet); drives the role selectors. `realRoles` above is just its
  // activatable subset.
  const accountRoles: AccountRoleOption[] = claims ? mapAccountRoles(claims.roles) : []

  // The role actually in effect during the session. Lazy initializer keeps a
  // reload on a route gated per-role from flashing the wrong role first.
  const [activeRole, setActiveRoleState] = useState<Role | null>(() => {
    const token = getAccessToken()
    const decoded = token ? decodeJwtPayload(token) : null
    return readStoredActiveRole(decoded ? mapRoles(decoded.roles) : [])
  })
  // Permission resolution starts `'pending'` while a session exists — NOT
  // `'idle'` — so guards wait for the capability envelope instead of treating
  // the first, still-empty render as "no permission" (the reload
  // false-positive race). With no session there is nothing to wait for.
  const [activePermissionKeys, setActivePermissionKeys] = useState<string[]>([])
  const [permissionsStatus, setPermissionsStatus] = useState<'pending' | 'loading' | 'idle' | 'error'>(
    () => (getAccessToken() ? 'pending' : 'idle')
  )
  const [permissionsError, setPermissionsError] = useState('')

  const activeRoleKey = mapFrontendRoleKey(activeRole)

  function setRole(next: Role | null) {
    // A session may activate ONLY roles the account actually has —
    // `null`/escalation attempts are ignored, never silently applied.
    if (next !== null && realRoles.includes(next)) {
      setActiveRoleState(next)
      try {
        sessionStorage.setItem(ACTIVE_ROLE_KEY, next)
      } catch {
        // sessionStorage unavailable — role just won't survive a reload.
      }
    }
  }

  function login(res: LoginResponse) {
    persistSession(res)
    const decoded = decodeJwtPayload(res.accessToken)
    setClaims(decoded)
    setActiveRoleState(readStoredActiveRole(decoded ? mapRoles(decoded.roles) : []))
    // Drop any cached profile from a previous session so a different account
    // never flashes the old owner's name while the fresh `/auth/me` loads.
    setUserProfile(null)
    // Re-enter `pending` so guards never treat the previous session's keys as
    // this one's permissions during the login transition.
    setActivePermissionKeys([])
    setPermissionsStatus('pending')
    setPermissionsError('')
    setMustChangePasswordState(res.mustChangePassword)
    setSessionExpired(false) // a fresh login clears the expiry flag so a future expiry can alert again
    // Real-profile fetch rides on the login event itself, not on a state-guard:
    // on re-login a `[claims]` effect would not reliably re-fire.
    // `persistSession` already wrote the token, so `refreshProfile`'s token
    // guard passes here.
    void refreshProfile()
  }

  async function refreshCapabilities(): Promise<void> {
    if (!activeRoleKey) {
      setActivePermissionKeys([])
      setPermissionsStatus('idle')
      setPermissionsError('')
      return
    }

    setPermissionsStatus('loading')
    setPermissionsError('')

    try {
      // Self-service endpoint: the caller's OWN permission keys (union across
      // its JWT roles) arrive obfuscated as a base64url envelope — never as
      // plaintext keys in the response, never inside the access token.
      const res = await apiGet<CapabilityResponse>('/auth/me/capabilities')
      setActivePermissionKeys(decodeCapabilities(res.capabilities))
      setPermissionsStatus('idle')
    } catch (err) {
      const apiErr = err as Partial<ApiError>
      setActivePermissionKeys([])
      setPermissionsStatus('error')
      setPermissionsError(apiErr.message ?? 'No se pudieron cargar los permisos del rol activo.')
    }
  }

  /**
   * Loads and caches the caller's own profile from `GET /auth/me`. Deliberately
   * decoupled from `refreshCapabilities`: a failure here must never fail the
   * permission refresh (they only share the same 401 reaction), and vice-versa.
   * On error the last stored profile (if any) is kept; with none, the shell's
   * `'Usuario'` placeholder shows.
   */
  async function refreshProfile(): Promise<void> {
    // Storage-backed, not state-backed: by the time `login()` calls this the
    // state update hasn't rendered yet, but `persistSession` has already
    // written the token.
    //
    // The token check is what keeps a signed-out `/login` visit quiet:
    // `clearSession` deliberately leaves `sisa.signedOut` behind so re-entry
    // routes to `/login` instead of re-hydrating, which alone would satisfy
    // the check above and fire a guaranteed-401 `/auth/me` on every visit
    // after a logout.
    if (!getAccessToken()) return
    try {
      const profile: MeProfile = await apiMeProfile()
      const user = { name: profile.fullName, email: profile.email }
      setUserProfile(user)
      persistUserProfile(user)
    } catch {
      // Keep whatever profile is already stored; a failed lookup never wipes a working shell.
    }
  }

  /**
   * Deliberate sign-out (Navbar's "Cerrar sesión", cancelar selección de rol).
   * Marks the tab as intentionally signed out so `RequireAuth` redirects
   * instantly — that tab must never show the 3-second "sesión expirada" gate.
   */
  const logout = useCallback(() => {
    clearSession()
    markSignedOut()
    setClaims(null)
    setActiveRoleState(null)
    // No previous-session name may linger in the shell during the sign-out
    // transition (`clearSession` already wiped the cached key).
    setUserProfile(null)
    setMustChangePasswordState(false)
    setActivePermissionKeys([])
    setPermissionsStatus('idle')
  }, [])

  /**
   * Involuntary session end (401 / token expiry). Only FLAGS it — it must NOT
   * clear storage/state here: `RequireAuth` keeps the current view mounted and
   * floats the 5-second alert over it. If we cleared first, `role` would flip
   * to `null` under the still-mounted route tree, `RequireRole` would kick the
   * redirect-to-fallback chain and the alert would chase a moving view (or
   * loop). The alert performs the real `logout()` + redirect at its countdown.
   */
  const triggerSessionExpired = useCallback(() => {
    setSessionExpired(true)
  }, [])

  function completePasswordChange() {
    persistMustChangePasswordCleared()
    setMustChangePasswordState(false)
  }

  // Registers the global 401 reaction once — any `apiGet`/`apiPost` call
  // (from anywhere in the app) that gets a 401 back triggers
  // `triggerSessionExpired()` through this handler, on top of whatever local
  // error handling the calling screen already does (e.g. a red banner).
  // `RequireAuth` then floats the expiry alert over the current view, keeping
  // it mounted until the alert's countdown redirects. `apiClient.ts` can't
  // import this module directly (RoleContext already depends on `auth.ts`,
  // which depends on `apiClient.ts` — importing back would cycle), hence the
  // callback-registration indirection.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      // Only authenticated requests attach an access token, so a 401 here means
      // the session is really gone.
      if (getAccessToken()) triggerSessionExpired()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Proactively flags the expiry the moment the access token's `exp` passes —
  // not just on the next navigation/request — so the alert also shows to an
  // idle user. Re-armed whenever the session changes (`claims` flips on
  // login/logout), so a re-login gets a fresh timer for its new token.
  useEffect(() => {
    const token = getAccessToken()
    const decoded = token ? decodeJwtPayload(token) : null
    if (!decoded) return
    const msLeft = decoded.exp * 1000 - Date.now()
    if (msLeft <= 0) {
      triggerSessionExpired()
      return
    }
    const timer = setTimeout(triggerSessionExpired, msLeft)
    return () => clearTimeout(timer)
  }, [claims, triggerSessionExpired])

  // Keeps the active role inside the session's role set — e.g. if the JWT's
  // roles changed underneath (re-login as a different account in the same tab).
  useEffect(() => {
    if (realRoles.length === 0) return
    if (activeRole !== null && realRoles.includes(activeRole)) return
    setActiveRoleState(readStoredActiveRole(realRoles))
  }, [activeRole, realRoles])

  useEffect(() => {
    void refreshCapabilities()
  }, [activeRoleKey])

  // Profile fetch rides on mount (hard reload restores the shell without a
  // `login()` event). On fresh logins `login()` fires the fetch itself, so a
  // `[claims]` effect would double-request — the mount-only effect avoids that
  // entirely.
  useEffect(() => {
    void refreshProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value: RoleContextValue = {
    role: activeRole,
    setRole,
    // The account's actual JWT roles (single-role accounts get one entry;
    // multi-role get the full list the switcher can move between).
    availableRoles: realRoles,
    // Every role the account holds, activatable or not (disabled in the UI).
    accountRoles,
    // The account's real profile from `GET /auth/me` (null until
    // fetched/failed → 'Usuario' placeholder).
    user: activeRole === null ? null : userProfile,
    mustChangePassword,
    activeRoleKey,
    activePermissionKeys,
    permissionsStatus,
    permissionsError,
    hasPermission: permissionKey => activePermissionKeys.includes(permissionKey),
    hasAnyPermission: permissionKeys => permissionKeys.some(permissionKey => activePermissionKeys.includes(permissionKey)),
    refreshCapabilities,
    sessionExpired,
    login,
    logout,
    triggerSessionExpired,
    completePasswordChange,
  }

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

/** Only sanctioned way to read the active role — never reach into the provider directly. */
export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext)
  if (!ctx) {
    throw new Error('useRole must be used within a RoleProvider')
  }
  return ctx
}