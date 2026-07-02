# Follicle Intelligence — Foundation Resolution Helpers (Stage 1E)

**Status:** Server-side library only — **not** wired into event ingest handlers or UI yet.  
**Code:** `src/lib/fi/foundation/`  
**Depends on:** [06-foundation-layer-architecture](./06-foundation-layer-architecture.md), [07-foundation-migration-specification](./07-foundation-migration-specification.md), Stage 1C tables, Stage 1D views (views are optional for these helpers).

---

## Purpose

Provide **find-or-create** operations for canonical foundation rows (`fi_organisations`, `fi_clinics`, `fi_persons`, `fi_patients`, `fi_cases` extensions, `fi_timeline_events`, `fi_media_assets`) using the **Supabase service role** client pattern already used elsewhere (`supabaseAdmin()` from `lib/supabaseAdmin.ts`).

Callers must run these only from **trusted server code** (API routes, server actions, background jobs). Do not import from client components.

---

## Helpers

| Function | Role |
|----------|------|
| `resolveOrCreateOrganisation` | Map optional `source_organisation_id` → `fi_organisation_source_ids`; else single exact normalised name per tenant; else insert organisation. |
| `resolveOrCreateClinic` | Map `source_clinic_id` → `fi_clinic_source_ids`; else single display_name match under tenant + optional `organisation_id`; else insert clinic. |
| `resolveOrCreatePerson` | Map `source_person_id` → `fi_person_source_ids`; else resolve via `source_patient_id` → patient → person; else **exactly one** `metadata.email_normalized` match; else insert `fi_persons`. |
| `resolveOrCreatePatient` | Map `source_patient_id` or global patient row → `fi_patient_source_ids`; else one `fi_patients` row per `(tenant_id, person_id)`; insert mapping; **never** updates `fi_global_patients`. |
| `resolveOrCreateCaseFoundation` | Patch existing `fi_cases` foundation columns when only null; else resolve via `fi_global_cases` or `external_id` (`source_system:source_case_id`); else insert case (requires `source_case_id` when not patching). |
| `createTimelineEvent` | Insert `fi_timeline_events`; optional dedupe when `fi_event_id` + `case_id` + `event_kind` already exist. |
| `createMediaAsset` | Insert `fi_media_assets`; idempotent by `(tenant_id, storage_path)` or `(tenant_id, source_system, source_asset_id)`. |

Pure normalisation for tests and conservative matching: `normalizeWhitespaceName`, `normalizeEmail`, `isPlaceholderEmail` in `normalize.ts`.

---

## Idempotency rules

- **Source mapping tables** (`fi_organisation_source_ids`, `fi_clinic_source_ids`, `fi_person_source_ids`, `fi_patient_source_ids`) use database uniqueness; inserts race → catch `23505` and re-select.
- **Organisations / clinics:** name-based match only when **exactly one** row matches normalised name in tenant (and optional org scope for clinics). If zero or **multiple** matches, a **new** row is created (no fuzzy merge).
- **Persons:** no merge on **display name alone**. Email match requires normalised email and **exactly one** person with `metadata.email_normalized`; placeholder emails (`@local.invalid`, etc.) are ignored for matching.
- **Patients:** at most one `fi_patients` row per `(tenant_id, person_id)` (schema unique).
- **Cases:** `external_id` uniqueness matches existing ingest (`buildCaseExternalId` in `lib/fi/events/mapping.ts`).
- **Timeline:** optional dedupe only when `fi_event_id` is set (application-level select before insert).
- **Media:** dedupe by storage path and by source asset id when both `source_system` and `source_asset_id` are present.

---

## Matching order (summary)

1. **Organisation:** source id → single name → create (+ mapping if source id provided).  
2. **Clinic:** source id → single name under tenant/org → create (+ mapping).  
3. **Person:** source person id → patient id path → single email → create (+ person source mapping when id provided).  
4. **Patient:** source patient id → global patient’s `(source_system, source_patient_id)` mapping → existing `(tenant, person)` patient → create (+ patient source mapping).  
5. **Case:** existing id patch → `fi_global_cases` → `external_id` → create.

---

## What is intentionally not merged

- **Weak display names** alone (no email, no source id) → always **new person** on `resolveOrCreatePerson` create path.  
- **Multiple name/email collisions** → **new row** instead of picking arbitrarily.  
- **Global patient rows** are never deleted or updated by `resolveOrCreatePatient`.

---

## How this prepares for dual-write

Handlers can later:

1. Call these helpers **after** existing `fi_global_*` / `fi_cases` writes (or in the same transaction when transactions are available).  
2. Populate `foundation_patient_id`, `clinic_id`, `organisation_id` on `fi_cases` without changing idempotency keys used today.  
3. Use `createMediaAsset` / `createTimelineEvent` for second-stream writes to foundation tables while `fi_uploads` / `fi_events` stay authoritative for legacy paths.

---

## Schema additions (Stage 1E)

`fi_organisation_source_ids` was added in migration `20260606100001_fi_organisation_source_ids.sql` because Stage 1C did not include an organisation source mapping table (see §7 / implementation gap).

---

## Related documents

| Doc | Role |
|-----|------|
| [07-foundation-migration-specification](./07-foundation-migration-specification.md) | Table shapes, RLS, views |
| [06-foundation-layer-architecture](./06-foundation-layer-architecture.md) | Canonical entity model |
