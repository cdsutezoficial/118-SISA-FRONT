# Shared FileUpload Specification

## Purpose

A generic, reusable file-upload primitive in `src/app/shared/`, consumed first by Screens 6 and 10 (payment receipts), designed independent of any Admisión-specific data or copy. No real upload/storage backend — selection is simulated/local only.

## Requirements

### Requirement: Configurable Accept Type and Requiredness

The component MUST accept configuration for allowed file types (e.g., PDF/image) and whether selection is required or optional, without hardcoding Admisión copy or field names.

#### Scenario: Optional upload allows submit without a file
- GIVEN the component is configured as optional
- WHEN no file is selected
- THEN the consuming form MUST be allowed to submit without it

#### Scenario: Required upload blocks submit until a file is chosen
- GIVEN the component is configured as required
- WHEN no file has been selected
- THEN the consuming form's submit MUST remain blocked

### Requirement: File Type/Size Validation

The component MUST reject files outside the configured accepted types and MUST show an inline error without throwing, leaving the previous valid selection (if any) untouched.

#### Scenario: Invalid type rejected
- GIVEN the component only accepts PDF/image
- WHEN the user selects a `.exe` file
- THEN an inline error MUST display and no file MUST be accepted

### Requirement: Preview and Remove

Once a valid file is selected, the component MUST show its filename (and a thumbnail for images, if feasible) plus a control to remove the selection and choose again.

#### Scenario: Remove clears the selection
- GIVEN a valid file is selected and previewed
- WHEN the user clicks remove
- THEN the selection clears and the upload control returns to its empty state

### Requirement: No Real Upload Side Effect

Selecting a file MUST only update local component/form state; the component MUST NOT perform any network call or persist the file anywhere.

#### Scenario: No network call on selection
- GIVEN a file is selected
- WHEN the selection completes
- THEN no request MUST be issued — only local state changes
