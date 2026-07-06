# Proposal: Real Login Integration

## Intent

Today `Login.tsx` fakes auth with a `setTimeout` and password-string branching, and `RoleContext` seeds a mock role (`SERVICIOS_ESCOLARES`) into `sessionStorage` so the app is "logged in" out of the box with zero real check. The Identity module in `118-SISA-BACK` is now built, tested, and merged, exposing a real, CORS-enabled auth contract. This change makes the login/session flow REAL — and only that flow — so the ADMIN account can authenticate end-to-end against the actual backend, including the mandatory first-login password change. Everything else stays mocked; this is explicitly NOT a "replace all mocks with real APIs" change.

## Scope

### In Scope
- `Login.tsx` calls `POST {VITE_API_URL}/auth/login`, maps the backend error envelope to the existing inline error-banner UI (401 invalid credentials, 423 account locked).
- Token persistence in `sessionStorage` (mirrors the existing `sisa.mockRole` convention).
- `RoleContext` rewrite: derive `user` (`sub`) and `role` from the real access-token JWT, replacing `MOCK_USER` and the mock role seed. Rehydrate session from `sessionStorage` on app load.
- Role-name mapping table in `RoleContext.tsx` (backend `RoleType` → frontend `Role`): `ADMIN → ADMINISTRADOR`, `PERSONAL_FINANZAS → FINANZAS`, identity for the 3 matching names. First mapped role from the JWT `roles` array wins.
- `mustChangePassword`: on a login that returns the flag, route to the existing `CambiarPassword.tsx`, wire it to `POST /auth/change-password` (Bearer header), and hard-block navigation away until the flag clears.
- Minimal top-level auth gate: redirect to `/login` when there is no valid session, so shipping "real login" does not leave every route unauthenticated.
- Logout clears tokens + session state (not just `navigate('/login')`).
- `VITE_API_URL` env convention (`.env.development` → `http://localhost:8080`, plus `.env.example`).

### Out of Scope
- User-provisioning UI (`POST /users`, role assignment) — only ADMIN is exercisable end-to-end until a future change.
- Any change to Admisión / Inscripciones / other module screens or their mock data.
- Silent refresh-token wiring (`/auth/refresh`) — on 401, force re-login (deferred, see Resolved Decisions #6).
- Backend deployment/persistence (in-memory H2, env-var admin seed) — separate work.
- Renaming the frontend `Role` union (touches `router.tsx`/`AppLayout.tsx` widely).

## Capabilities

### New Capabilities
- `auth-session`: real login against `POST /auth/login`, JWT-derived session/role state, `sessionStorage` token persistence + rehydration, backend→frontend role mapping, mandatory `mustChangePassword` change flow, minimal authenticated-route gate, and logout that clears the session.

### Modified Capabilities
- None (no existing openspec specs in this repo yet).

## Resolved Decisions (from exploration's 8 open questions)

1. **Token storage** → `sessionStorage`. Matches the existing `sisa.mockRole` pattern; tab-scoped, cleared on close. Accepted tradeoff: no `HttpOnly`, so not XSS-hardened — acceptable at this prototype/dev stage, stated explicitly not silently.
2. **JWT decode** → manual base64url decode of the payload, no new dependency. The access token is read client-side only for `sub`/`roles` UI gating; the backend re-validates every call. **Explicit, revisitable tradeoff**: swap for `jwt-decode` if edge cases (padding, malformed tokens) prove fragile.
3. **Auth gate** → YES, add a minimal one. Shipping real login while leaving every route reachable by direct URL would be more inconsistent than today's honest all-mock state. Implemented as a small session-derived guard around the authenticated routes; a natural extension of `RoleContext` state.
4. **`mustChangePassword` routing** → reuse `CambiarPassword.tsx`; hard-block navigation away while the flag is true. Defense in depth: the backend also 403s (`MustChangePasswordException`) any other protected call until the flag clears — the client block is UX, not the sole gate.
5. **Role mapping** → lookup table inside `RoleContext.tsx`, NOT a rename of the `Role` union. Keeps the diff login-focused.
6. **Silent refresh** → deferred. Nothing except login is real yet, so there is no live session to auto-refresh for. On 401 from any future real call, force re-login. Explicit deferred item, not an oversight.
7. **Role-switcher dropdown** → keep the mock switcher available ONLY when not authenticated / in an explicit dev-mock mode; hide/disable it for the authenticated session so a real user cannot self-escalate. Rationale: Docente/Estudiante/etc. have no backend users, so other in-progress module work (Inscripciones, Admisión) still needs the mock switcher — this is a scoped, known prototype convenience a future change removes once all roles are provisionable.
8. **Base URL** → `VITE_API_URL` env var, not a Vite dev proxy. Explicit, doesn't hide the cross-origin call (which is why backend CORS was added), and works toward a future prod build.

## Backend Dependency (already shipped)

This is FRONT's first change that depends on a specific already-merged BACK contract — FRONT did not invent these endpoints. Identity module, `118-SISA-BACK`, base URL `http://localhost:8080`:

| Endpoint | Request | Response / Notes |
|---|---|---|
| `POST /auth/login` | `{username, password}` | `{accessToken, refreshToken, tokenType, expiresIn, mustChangePassword}` |
| `POST /auth/change-password` | `{currentPassword, newPassword}` + `Authorization: Bearer` | resolves caller from token |
| `POST /auth/refresh` | `{refreshToken}` | deferred this change |

- Error envelope: `{timestamp, status, error, message, path}`. `401` invalid credentials, `423` account locked, `403` mustChangePassword pending on other protected calls.
- JWT claims: `sub` = user UUID, `roles` = `Set<RoleType>` (multi-role possible).
- CORS already allows `http://localhost:5173` with `Authorization` + `Content-Type`.
- **Confirm**: backend field is `username`, but the Login UI input is `type="email"` with an email placeholder — confirm whether `username` is the institutional email string or adjust the input copy.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/shared/RoleContext.tsx` | Modified | Real session/token state, JWT decode, role mapping, rehydration |
| `src/app/pages/Login.tsx` | Modified | Real `POST /auth/login`, map errors to existing banner |
| `src/app/pages/CambiarPassword.tsx` | Modified | Wire `POST /auth/change-password`, Bearer header, mandatory target |
| `src/app/layouts/AppLayout.tsx` | Modified | Logout clears session; scope/hide mock role-switcher when authenticated |
| Auth-route gate | New | Session-derived redirect to `/login` for unauthenticated access |
| `.env.development`, `.env.example` | New | `VITE_API_URL` convention (first env var in repo) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Role mismatch silently fails auth (`ADMIN` vs `ADMINISTRADOR`) | High if unmapped | Explicit mapping table + a spec assertion covering it |
| Only ADMIN exercisable end-to-end | Certain | Stated scope boundary; no provisioning UI expected yet |
| H2 resets on backend restart; admin re-seeds with `mustChangePassword=true` | Certain in dev | Document `SISA_ADMIN_USERNAME/PASSWORD` env setup; expect redo of change-password per restart |
| `mustChangePassword` bug blocks the whole flow (only account starts `true`) | Med | Treat change-password path as primary, test first |
| Manual JWT decode edge cases (base64url padding) | Med | Isolated decode util; revisit `jwt-decode` if fragile (Decision #2) |

## Rollback Plan

Single-repo, additive change. Revert the branch/PR: `Login.tsx`, `RoleContext.tsx`, `CambiarPassword.tsx`, `AppLayout.tsx` return to their mocked versions, delete the new auth-gate wrapper and `.env*` files. No backend or data migration to undo; mock role/session behavior returns exactly as before.

## Dependencies

- `118-SISA-BACK` Identity module running on `http://localhost:8080` with `SISA_ADMIN_USERNAME`/`SISA_ADMIN_PASSWORD` set (else login always 401s).
- No new runtime npm dependency (manual fetch + manual JWT decode).

## Success Criteria

- [ ] ADMIN logs in via real `POST /auth/login`; invalid credentials show the existing error banner (401) and locked account shows the locked message (423).
- [ ] `RoleContext` reflects the real `sub`/role from the JWT (`ADMIN → ADMINISTRADOR`); `RequireRole` gates pass for ADMIN with no code change to `RequireRole`.
- [ ] First login (`mustChangePassword=true`) forces `CambiarPassword.tsx`, blocks navigating away, and completing it via `POST /auth/change-password` clears the flag and lands on `/dashboard`.
- [ ] Direct-URL access to an authenticated route with no session redirects to `/login`.
- [ ] Logout clears tokens/session; re-accessing an authenticated route redirects to `/login`.
- [ ] Session survives a full page reload (rehydrated from `sessionStorage`).
- [ ] Admisión/Inscripciones/other module screens and mock data are unchanged; mock role-switcher still works when not authenticated.
