# Shared Wizard/Stepper Specification

## Purpose

A generic, reusable multi-step Stepper/Wizard primitive in `src/app/shared/`, consumed first by Screen 4 (3 steps) but designed independent of any Admisión-specific data or copy.

## Requirements

### Requirement: Configurable Step Sequence

The component MUST accept an ordered list of steps (label + content + optional per-step validation function) and MUST render a horizontal stepper indicating current/completed/upcoming steps, independent of how many steps are configured or what domain they belong to.

#### Scenario: Renders arbitrary step count
- GIVEN a consumer configures 5 steps
- WHEN the Wizard mounts
- THEN it MUST render 5 stepper segments and show step 1's content first

### Requirement: Per-Step Validation Gates "Next"

If a step declares a validation function, the "Siguiente"/Next action MUST remain disabled until that function reports the step valid; steps without a validation function MUST allow advancing freely.

#### Scenario: Next blocked by failing validation
- GIVEN the current step's validation function returns false
- WHEN the user has not satisfied the step's requirements
- THEN the Next action MUST stay disabled

#### Scenario: Next allowed once valid
- GIVEN the current step's validation function returns true
- WHEN the user clicks Next
- THEN the Wizard advances to the following step

### Requirement: Backward Navigation Preserves State

Navigating to a previous step MUST NOT clear data already entered in later steps; returning forward MUST restore that data.

#### Scenario: Data survives back-and-forth navigation
- GIVEN the user filled step 2 and advanced to step 3
- WHEN they click "Anterior" then "Siguiente" again
- THEN step 2's previously entered values MUST still be present

### Requirement: Domain-Agnostic API

The Wizard's public props/API MUST NOT reference Admisión-specific concepts (candidate, folio, CURP, etc.); all step content MUST be supplied by the consuming page as children/render props.

#### Scenario: Wizard reused by an unrelated flow
- GIVEN a future page configures the Wizard with unrelated steps (e.g., a different module's onboarding)
- WHEN it renders
- THEN no Admisión-specific naming or logic MUST be required from the Wizard itself
