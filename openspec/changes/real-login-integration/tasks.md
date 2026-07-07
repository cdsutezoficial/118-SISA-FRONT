# Tasks: Real Login Integration (118-SISA-FRONT)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~330-400 (9 files: 2 new tiny env files, 2 new logic files ~90+45 lines, 5 modified files) |
| 400-line budget risk | Medium (close to, likely under, budget) |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | pending (not needed — fits single PR) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full login/session integration (all phases below) | PR 1 (single) | Narrow, single-flow change; splitting would fragment one cohesive session model across reviews with no independent value per slice. |

## Phase 1: Foundation (env + auth helper)

- [x] 1.1 Create `.env.development` with `VITE_API_URL=http://localhost:8080`
- [x] 1.2 Create `.env.example` mirroring 1.1 (committed template)
- [x] 1.3 Create `src/app/shared/auth.ts`: `API_URL`, `ROLE_MAP`, `mapRole()`, `decodeJwtPayload()` (base64url), storage key helpers (`sisa.accessToken`/`refreshToken`/`authMode`/`mustChangePassword`), `apiLogin()`, `apiChangePassword()`, types `LoginResponse`/`JwtClaims`/`ApiError`

## Phase 2: Session State — RoleContext (depends: Phase 1)

- [x] 2.1 Modify `src/app/shared/RoleContext.tsx`: add `authMode`/`mustChangePassword`/session fields; keep `role`/`setRole`/`availableRoles`/`user` unchanged — *useRole Hook and Provider (MOD)*
- [x] 2.2 Add `login(res)`: persist tokens, decode JWT, `mapRole()` → `role`, set `authMode='real'` + `mustChangePassword` — *Login Establishes Or Rejects A Real Session; JWT-derived role scenario*
- [x] 2.3 Add `logout()`: clear tokens/claims/`mustChangePassword`, keep `authMode='real'` — *Logout Clears Session State*
- [x] 2.4 Add `completePasswordChange()`: clear `mustChangePassword` — *Mandatory Password Change (completion)*
- [x] 2.5 Add rehydration effect on mount: restore session from storage if present — *session persists across reload scenario*

## Phase 3: Route Gate (depends: Phase 2)

- [x] 3.1 Create `src/app/shared/RequireAuth.tsx`: mock mode passthrough; real mode redirects `/login` on missing/expired token (calls `logout()`), redirects `/usuarios/cambiar-password` while `mustChangePassword` pending — *Authenticated Routes Gated By Session State; Mandatory Password Change (nav blocked); Logout (no stale access)*
- [x] 3.2 Modify `src/app/router.tsx`: wrap shell group `element: <RequireAuth><AppLayout/></RequireAuth>`

## Phase 4: Screens & Navbar (depends: Phase 2; parallelizable — disjoint files)

- [x] 4.1 Modify `src/app/pages/Login.tsx`: replace `setTimeout` with `apiLogin()`; map 401/423/network → inline banners; on success call `login(res)`, navigate per `mustChangePassword` — *Login Establishes Or Rejects A Real Session (all scenarios)*
- [x] 4.2 Modify `src/app/pages/CambiarPassword.tsx`: call `apiChangePassword()` with Bearer; inline error banner (401/403 → `logout()`+redirect); hide Cancelar/breadcrumb nav-away while pending; on 200 → `completePasswordChange()` → `/dashboard` — *Mandatory Password Change (completion)* (dual-mode judgment call: mock-mode submissions keep the legacy simulated flow instead of hitting the real API — see apply-progress deviations)
- [x] 4.3 Modify `src/app/layouts/AppLayout.tsx`: "Cerrar sesión" → `logout()` + navigate `/login`; hide/disable role-switcher when `authMode==='real'`, unchanged in mock mode — *Navbar Role Dropdown (MOD, both scenarios)*

## Phase 5: Manual Verification (depends: Phases 1-4; no test runner in repo)

Run `pnpm typecheck` first (only automated gate). Then, backend on `:8080` seeded with an ADMIN user, `pnpm dev` running:

`pnpm typecheck` and `pnpm build` both PASS (exit code 0). Backend contract (POST /auth/login 200/401, POST /auth/change-password 204) verified live via curl against a running `118-SISA-BACK` instance seeded with an ADMIN user, and the real JWT it returned was decoded correctly by the exact `decodeJwtPayload`/`mapRole` logic in `auth.ts` (confirmed with a standalone Node script — `roles:['ADMIN']` → `ADMINISTRADOR`). Every changed module was also confirmed to transform cleanly through the Vite dev server (200 on each file). No browser-automation tool was available in this session to click through the actual UI, so the scenarios below are NOT checked off — they were reasoned through against the implemented code paths, not visually confirmed in a live browser. Recommend a manual pass in an actual browser before merge.

- [ ] 5.1 Mock mode unaffected: fresh tab, switcher changes role live for all consumers, no reload
- [ ] 5.2 Valid ADMIN login → tokens stored, role derived `ADMINISTRADOR`, redirected to `/dashboard`
- [ ] 5.3 Invalid credentials → 401 inline banner, no session stored
- [ ] 5.4 Locked account → 423 locked-account message, no session stored
- [ ] 5.5 Full reload after login → session rehydrates without re-login
- [ ] 5.6 Login with `mustChangePassword:true` → forced to `CambiarPassword`; direct URL/link/back-forward to any other route bounces back
- [ ] 5.7 Successful password change → flag clears, redirected `/dashboard`, other routes reachable
- [ ] 5.8 Logout → tokens cleared, redirected `/login`; browser back afterward → redirected `/login` again
- [ ] 5.9 Unauthenticated direct access to any authenticated route → redirected `/login`
- [ ] 5.10 Navbar role dropdown hidden/disabled once authenticated; unaffected in mock mode
