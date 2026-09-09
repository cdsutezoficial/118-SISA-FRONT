# Delta for Mock Role Context

## MODIFIED Requirements

### Requirement: `useRole` Hook and Provider

The system MUST provide a `RoleProvider` (React Context) exposing: the current active role, a setter/switcher function, and the list of selectable roles. `useRole()` MUST be the only way pages/routes read the active role — no component MAY read role state by other means. When a real authenticated session exists, the selectable roles MUST come from the session's decoded JWT `roles` claim via a fixed backend-to-frontend lookup table (`ADMIN`→`ADMINISTRADOR`, `PERSONAL_FINANZAS`→`FINANZAS`, other names 1:1), the ACTIVE role MUST be one of those (chosen at login for multi-role accounts and switchable thereafter, persisted across reloads), and the switcher MUST NOT be able to escalate to a role the account does not have. When no real session exists, the active role MUST continue to come from the manual switcher exactly as before.
(Previously: the active role always came from the manual switcher/seed — there was no concept of a session or a JWT-derived role. Before this delta: real mode picked the FIRST mapped JWT role and disabled the switcher.)

#### Scenario: Hook returns current role (no session)
- GIVEN `RoleProvider` wraps the app with no real session and default role "Servicios Escolares"
- WHEN any page calls `useRole()`
- THEN it receives the current mock role and a function to change it

#### Scenario: Switching role updates every consumer (no session)
- GIVEN no real authenticated session exists and the Navbar dropdown switches role to "Director de División"
- WHEN any mounted component reads `useRole()`
- THEN it reflects "Director de División" without a page reload

#### Scenario: Authenticated role comes from the JWT-role set, switchable within it
- GIVEN a user authenticates and the JWT `roles` claim includes `ADMIN`
- WHEN the session is established
- THEN `useRole()` returns `ADMINISTRADOR`, AND the user can access exactly the routes an `ADMINISTRADOR` mock role could access, with no changes to `RequireRole` logic

#### Scenario: Multi-role account activates each of its own roles only
- GIVEN a user authenticates with JWT `roles` = `[ADMIN, SERVICIOS_ESCOLARES]`
- WHEN they pick "Servicios Escolares" at the post-login role-selection step and later switch to "Administrador" via the shell switcher
- THEN the active role reflects each selection in turn, both selections keep working across reloads, AND attempting to switch to a role NOT on the JWT (e.g. `FINANZAS`) is ignored
- AND the FIRST mapped role is NOT forced — the account may act under any of its mapped roles

## ADDED Requirements

### Requirement: Login Establishes Or Rejects A Real Session

The system MUST authenticate against `POST /auth/login` and establish session state (tokens, user id, role) derived from the response and JWT on success, MUST reject invalid or locked credentials without establishing any session state, and MUST rehydrate an established session from storage after a full page reload.

#### Scenario: Valid credentials establish a session
- GIVEN a user on `/login` with valid username/password
- WHEN they submit the form
- THEN the system stores the returned tokens, derives role from the JWT, and redirects to `/dashboard`

#### Scenario: Multi-role account is asked which role to enter with
- GIVEN a user on `/login` with valid credentials whose JWT maps to 2+ frontend roles
- WHEN they submit the form and authentication succeeds
- THEN a role-selection step is shown listing those roles, AND on choosing one the session starts under it and navigates to the (password-change or dashboard) target — AND later, mid-session, the shell role switcher lists the SAME roles and can move the active role between them

#### Scenario: Invalid credentials are rejected
- GIVEN a user submits incorrect credentials
- WHEN `POST /auth/login` returns 401
- THEN an inline error banner is shown, AND no tokens or session state are stored

#### Scenario: Locked account is rejected
- GIVEN a user submits credentials for a locked account
- WHEN `POST /auth/login` returns 423
- THEN a locked-account message is shown, AND no session state is stored

#### Scenario: Session persists across a full reload
- GIVEN a user has an established session with a stored token
- WHEN the page is fully reloaded
- THEN the session is rehydrated from storage without requiring re-login

### Requirement: Mandatory Password Change Blocks Other Navigation

When `mustChangePassword` is `true` in the login response, the system MUST route the user to `CambiarPassword.tsx` and MUST block client-side navigation to any other authenticated route until `POST /auth/change-password` succeeds, at which point the block MUST clear and the user MUST be able to reach `/dashboard`.

#### Scenario: First login requires password change
- GIVEN a login response with `mustChangePassword: true`
- WHEN authentication completes
- THEN the user is redirected to `CambiarPassword.tsx` instead of `/dashboard`

#### Scenario: Navigation away is blocked while pending
- GIVEN an authenticated session with `mustChangePassword` still pending
- WHEN the user attempts to navigate (link, direct URL, or back/forward) to any other authenticated route
- THEN the system redirects back to `CambiarPassword.tsx`

#### Scenario: Completing the change restores navigation
- GIVEN a user on `CambiarPassword.tsx` with a pending flag
- WHEN they submit a valid password change and the backend accepts it
- THEN the pending flag clears, AND the user is redirected to `/dashboard`, AND other authenticated routes become reachable

### Requirement: Authenticated Routes Are Gated By Session State

The system MUST redirect any request for an authenticated route to `/login` when no valid session exists. No equivalent check exists today — `RequireRole` only checks role match, never session existence.

#### Scenario: Unauthenticated direct access redirects to login
- GIVEN no valid session exists (no token, expired, or cleared)
- WHEN the user navigates directly to any authenticated route
- THEN they are redirected to `/login`

### Requirement: Logout Clears Session State

The system MUST clear all session state and stored tokens on logout and MUST prevent subsequent access to authenticated routes, including via back-navigation, without a new login.

#### Scenario: Logout clears session and redirects
- GIVEN an authenticated session
- WHEN the user logs out
- THEN stored tokens and session state are cleared, AND the user is redirected to `/login`

#### Scenario: No stale access after logout
- GIVEN a user has just logged out
- WHEN they navigate back (browser back button) to a previously visited authenticated route
- THEN they are redirected to `/login` again, with no residual access
