# Design: Real Login Integration (118-SISA-FRONT)

## Technical Approach

Make ONLY the login/session flow real (Approach 1 from exploration: plain `fetch`, manual
JWT decode, `sessionStorage`, no new deps). All non-auth module screens keep their mocks.
The linchpin is a dual-mode session in `RoleContext`: legacy **mock mode** (default role,
switcher over the full staff catalog — preserves every in-progress module that has no backend
user) and **real mode** entered after a successful `/auth/login`. Real mode derives the
account's ACTUAL roles from the decoded JWT `roles` claim: a multi-role account picks its
entry role in a post-login modal, and the shell role switcher keeps working to change role
mid-session (narrowed to the user's own roles). `RequireRole` stays untouched because `role`
remains `Role | null`, with `ADMIN`→`ADMINISTRADOR` mapping.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|---|---|---|---|
| Gate mechanism | `<RequireAuth>` **component** wrapping `<AppLayout/>` | React Router `loader` | `RoleProvider` is ABOVE `RouterProvider` in `main.tsx`; loaders run outside the React tree and cannot call `useRole()`. A component reuses context, avoids duplicating session logic. |
| Mock vs real coexistence | Persisted `authMode: 'mock' \| 'real'` | Force real login always | Only ADMIN has a backend user; forcing real login would lock devs out of mocked Inscripciones/etc. Mock stays the default on a fresh tab. |
| "Authenticated" test | In real mode: access token present AND `exp` (decoded) in the future | Reactive 401-only | Login is the only real call this change ships; proactively checking `exp` at the gate avoids rendering protected chrome behind a dead token. Reactive logout still fires on the one authenticated call (change-password) returning 401/403. |
| Role resolution | Lookup table `RoleType→Role` maps ALL JWT roles; the ACTIVE role is a user choice (entry modal + shell switcher) over real-mode `availableRoles`, persisted in `sisa.activeRole` | Rename `Role` union / first-mapped-wins only | Rename would touch `router.tsx`, `AppLayout` NAV_ITEMS/ROLE_LABELS, every `allowedRoles` — out of scope, high risk. First-wins was too lossy now that multi-role accounts exist: the account may legitimately act under any of its roles. |
| Token storage | `sessionStorage`, `sisa.` prefix | localStorage / in-memory | Mirrors existing `sisa.mockRole`; tab-scoped, survives reload. XSS tradeoff accepted per prototype framing. |
| Error UX | Reuse Login's existing inline red banner (`status:'error'`+`AlertCircle`) | New toast system | Convention already in `Login.tsx`; add the same banner shape to `CambiarPassword.tsx`. |
| Env base URL | `import.meta.env.VITE_API_URL ?? 'http://localhost:8080'` | Vite dev proxy | First env-var precedent; works toward prod build; backend CORS already allows `:5173`. |

## Data Flow

    Login.handleSubmit ─fetch POST /auth/login─▶ 200 {tokens, mustChangePassword}
         │                                             │
         │◀── 401/423/network → map → inline banner    ▼
         │                                    RoleContext.login()  ── writes sisa.accessToken/
         ▼                                    (authMode='real', decode JWT → claims → roles)    refreshToken/authMode/activeRole
    roles = mapRoles(claims.roles)  (real-mode availableRoles = user's OWN roles)
         │
         ├─ roles.length > 1 ──▶ role-selection modal "Elige cómo entrar"
         │                        user picks r → setRole(r) (persists) ─┐
         └─ else/single ────────────────────────────────────────────────┤
                                                                        ▼
    navigate(mustChangePassword ? /usuarios/cambiar-password : /dashboard)
         │
         ▼
    RequireAuth (wraps AppLayout): authMode==='real' ? (valid token? : →/login) (mCP? →cambiar-password) : pass(mock)

    Mid-session: Navbar/Sidebar switcher lists availableRoles (real: user's roles; mock: full
    staff catalog) and calls setRole(r) → active role + navigation update everywhere.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/shared/auth.ts` | Create | `API_URL`, `ROLE_MAP`, `mapRole()`, `decodeJwtPayload()` (base64url), storage keys/helpers, `apiLogin()`, `apiChangePassword()`, types `LoginResponse`/`JwtClaims`/`ApiError`. |
| `src/app/shared/RequireAuth.tsx` | Create | Session gate component (see below). |
| `.env.development` | Create | `VITE_API_URL=http://localhost:8080`. |
| `.env.example` | Create | `VITE_API_URL=http://localhost:8080` (committed template). |
| `src/app/core/infra/RoleContext.tsx` | Modify | Add session state (tokens, claims, authMode, mustChangePassword), `login()`/`logout()`/`completePasswordChange()`, rehydration, real-vs-mock `role`; real mode: `availableRoles` = the account's JWT-mapped roles, `setRole` switches among them and persists `sisa.activeRole`. Public API is a backward-compatible superset. |
| `src/app/core/pages/Login.tsx` | Modify | Replace `setTimeout` with `apiLogin()`; body `{username: usuario, password}`; map errors to banner; call `login()`; if the account has 2+ mapped roles show the "Elige cómo entrar" modal before navigating; navigate. |
| `src/app/core/layout/AppLayout.tsx` | Modify | "Cerrar sesión" calls `logout()` then `/login`; Navbar role dropdown ALWAYS enabled — mock lists the staff catalog, real lists the session's own roles. |
| `src/app/core/pages/CambiarPassword.tsx` | Modify | `apiChangePassword()` with Bearer; add inline error banner; when `mustChangePassword` pending, hide Cancelar + breadcrumb nav-away; on 200 call `completePasswordChange()` → `/dashboard`. |
| `src/app/router.tsx` | Modify | Wrap shell group: `element: <RequireAuth><AppLayout/></RequireAuth>`. |
| `vite.config.ts` | No change | Vite auto-loads `.env*`; `VITE_`-prefixed vars exposed automatically. |
| `src/app/shared/types.ts` | No change | `Role` lives in `RoleContext.tsx`, not here. |

Flag (not in scope): Sidebar's hardcoded "María González / MG" card diverges from real `user`.

## Interfaces / Contracts

```ts
// auth.ts
export const ROLE_MAP: Record<string, Role> = {
  ADMIN: 'ADMINISTRADOR', PERSONAL_FINANZAS: 'FINANZAS',
  SERVICIOS_ESCOLARES: 'SERVICIOS_ESCOLARES', GESTOR_ACADEMICO: 'GESTOR_ACADEMICO',
  DIRECTOR_DIVISION: 'DIRECTOR_DIVISION',
  // JEFATURA_ESTADIAS/ASISTENTE_ESTADIAS/COORDINACION_ESTADIAS_DIVISION/
  // DOCENTE/ESTUDIANTE/EGRESADO: no frontend Role → unmapped (skipped)
}
export function mapRole(roles: string[]): Role | null   // first roles[] entry present in ROLE_MAP
export function mapRoles(roles: string[]): Role[]        // ALL mapped, JWT order, de-duplicated
export function decodeJwtPayload(token: string): JwtClaims | null // base64url payload only, sub+roles+exp
interface LoginResponse { accessToken: string; refreshToken: string; tokenType: string; expiresIn: number; mustChangePassword: boolean }
interface JwtClaims { sub: string; roles: string[]; exp: number }

// RoleContext useRole() — additive superset (existing keys unchanged)
interface RoleContextValue {
  role: Role | null; setRole: (r: Role | null) => void; availableRoles: Role[]; user: RoleUser | null // existing
  authMode: 'mock' | 'real'; mustChangePassword: boolean                                              // new
  login(res: LoginResponse): void; logout(): void; completePasswordChange(): void                     // new
}
// Real mode: availableRoles = mapRoles(claims.roles); role = the ACTIVE one of those
// (persisted in sisa.activeRole); setRole(r) only accepts r ∈ availableRoles, persists + applies.
```

`RequireAuth`: `authMode==='mock'` → render children. `authMode==='real'` → if no token or
`claims.exp*1000 < Date.now()` → `logout()` + `<Navigate to="/login" replace>`; else if
`mustChangePassword && pathname !== '/usuarios/cambiar-password'` →
`<Navigate to="/usuarios/cambiar-password" replace>`; else children.

Storage keys: `sisa.accessToken`, `sisa.refreshToken`, `sisa.authMode`, `sisa.mustChangePassword`,
`sisa.activeRole` (real-mode chosen role; existing `sisa.mockRole` untouched). Logout clears
tokens/claims/activeRole/mustChangePassword but keeps `sisa.authMode='real'` so re-access still
routes to `/login` (satisfies "re-access → /login"); mock mode returns only in a fresh tab /
cleared session.

## mustChangePassword Sequence

1. `/auth/login` 200 with `mustChangePassword:true` → `login(res)` sets real session + flag.
2. Login navigates `/usuarios/cambiar-password`.
3. `RequireAuth` blocks any other authenticated path back to that page while flag is set.
4. `CambiarPassword` hides Cancelar/breadcrumb-away; submit → `apiChangePassword({currentPassword:actual,newPassword:nueva})` + Bearer.
5. 200 → `completePasswordChange()` clears flag → success screen → `navigate('/dashboard')` (now unblocked). Non-2xx → inline banner; 401/403 → `logout()` → `/login`.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Static | Types/compile | `pnpm typecheck` (tsc --noEmit) — the repo's ONLY verification step; no test runner exists. |
| Manual | Full login → forced change-password → dashboard; 401/423 banners; logout→/login; reload rehydration; mock-mode switcher intact | Backend on `:8080` with `SISA_ADMIN_USERNAME/PASSWORD` seeded (H2 resets each restart → redo change-password), frontend `pnpm dev`. |

No automated unit/integration/E2E — none configured in this repo (per CLAUDE.md).

## Migration / Rollout

No data migration. Additive single-repo change; revert restores mock behavior and deletes
`.env*` + new files. Deferred (explicit): silent `/auth/refresh`, user-provisioning UI.

## Open Questions

- [ ] Confirm backend `username` == institutional email string (Login input is `type="email"`); if not, adjust UI copy. Request sends the field value as `username` regardless.
