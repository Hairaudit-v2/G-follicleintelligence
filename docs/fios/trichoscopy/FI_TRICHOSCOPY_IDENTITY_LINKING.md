# FI Trichoscopy — Identity Linking

## Model

Table: `fi_hli_trichoscopy_links`

A link always includes `tenant_id`. Cross-tenant linking is rejected by server guards and FK/tenant filters.

Fields:

- FiOS: `fios_patient_id`, optional case / consultation / treatment plan / surgery case
- HLI: `hli_tenant_reference`, `hli_patient_reference`, optional intake / episode ids
- Purpose + status lifecycle
- Active evidence pack pointer (never destructive overwrite of packs)

## Rules

- HLI references are not accepted from untrusted browser input without server validation.
- Duplicate active links for the same purpose + patient (+ case) are idempotently resolved.
- Historical links remain auditable after cancellation.
- Patient merges must not silently orphan HLI references (retain link rows).

## Idempotent requests

Idempotency key:

`tenant + patient + case + purpose + workflowReference`

Persisted on `fi_hli_trichoscopy_requests` before success is returned to the UI.
