# Delta for App Shell

## MODIFIED Requirements

### Requirement: Navbar Role Dropdown

The Navbar's role dropdown MUST be functional: it MUST list the roles available to the session (mock mode: the staff roles relevant to the in-progress modules; real mode: exactly the account's JWT-mapped roles), MUST update the active role via `useRole` on selection, and MUST close after selection. In a real authenticated session the dropdown MUST stay enabled but MUST be scoped to the session's OWN roles — manual selection cannot escalate to a role the account does not have, while legitimately letting the user move between the roles the account DOES have (this is the same set presented right after a multi-role login).
(Previously: the dropdown was always visible and functional regardless of authentication state, because no authentication state existed. Between this change and the original real-login integration, it was hidden/disabled in real mode because only the first JWT role was selectable.)

#### Scenario: Selecting a role persists for the session (no real session)
- GIVEN no real authenticated session exists and the dropdown is open
- WHEN the user selects "Director de División"
- THEN the active role becomes "Director de División" for the remainder of the mock session (until changed again)

#### Scenario: Real session dropdown lists only the account's own roles and switches between them
- GIVEN a real authenticated session whose JWT maps to `ADMINISTRADOR` AND `SERVICIOS_ESCOLARES`
- WHEN the user views the Navbar and opens the dropdown, then selects "Servicios Escolares"
- THEN the dropdown lists exactly those two roles (no `FINANZAS`/`GESTOR_ACADEMICO`/etc.), AND after selecting, the active role is "Servicios Escolares" throughout the shell — and the dropdown is NOT disabled
