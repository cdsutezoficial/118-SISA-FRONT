# Delta for App Shell

## MODIFIED Requirements

### Requirement: Navbar Role Dropdown

The Navbar's role dropdown MUST be functional: it MUST list the 4 roles relevant to Admisión, MUST update the active role via `useRole` on selection, and MUST close after selection. When a real authenticated session exists, the dropdown MUST be hidden or disabled so the active role cannot be self-escalated via manual selection; it MUST remain available and behave exactly as before when no real authenticated session exists, so in-progress mock-only work on other modules (e.g. Docente, Estudiante) is not broken.
(Previously: the dropdown was always visible and functional regardless of authentication state, because no authentication state existed.)

#### Scenario: Selecting a role persists for the session (no real session)
- GIVEN no real authenticated session exists and the dropdown is open
- WHEN the user selects "Director de División"
- THEN the active role becomes "Director de División" for the remainder of the mock session (until changed again)

#### Scenario: Dropdown hidden for a real authenticated session
- GIVEN a real authenticated session exists
- WHEN the user views the Navbar
- THEN the role dropdown is hidden or disabled, preventing self-escalation via mock role selection
