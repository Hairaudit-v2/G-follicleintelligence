# Universal Case Record (Stage 1I)

## Purpose

The Universal Case Record screen in FI Admin is a **single read-only view** of one `fi_cases` row and its cross-system context:

- **Foundation mapping** via `v_fi_case_foundation` (global case / patient ids, clinic, organisation, source ids)
- **Linked patient / person** (when `foundation_patient_id` is set), including `v_fi_patient_resolution` and `fi_patient_source_ids`
- **Clinical timeline** (`fi_timeline_events` for that case)
- **Media** (`v_fi_media_unified` plus `fi_media_assets`, including supplemental assets not matched in the unified view by asset id)

It is an internal operator read model, tenant-neutral, and does not replace per-tenant workflows or CRM.

## Read-only status

- **No writes**: ingest, dual-write, and database schemas are unchanged by this feature.
- Data loads on the server using the same Supabase service-role pattern as other FI Admin foundation helpers.

## Identifier resolution

| Input | Behaviour |
|--------|------------|
| `tenantId` | Must match an `fi_tenants.id` row (same guard as other FI Admin tenant pages). |
| `caseId` | Must match `v_fi_case_foundation.case_id` for that tenant (i.e. an existing `fi_cases` row in scope of the view). |

There is no ambiguous slug: the route always uses the canonical FI case uuid.

## Fields shown

1. **Case header** — Case id, type, status, source system, source case id, global case id, external id (from `fi_cases`), created/updated.
2. **Linked patient** — Display name, email, phone, foundation patient id, person id, global patient id(s), link to Universal Patient Record when a foundation or global patient id is available.
3. **Clinic / organisation** — Organisation name, clinic display name, city/country from `fi_clinics.metadata` when present (`city` / `locality`, `country` / `country_code`).
4. **Timeline** — All `fi_timeline_events` for the case (newest first, capped at 2000 rows server-side).
5. **Media** — Unified rows for the case; full `fi_media_assets` list plus a short **supplemental** list for asset ids not present in the unified projection.
6. **Resolution warnings** — e.g. missing `foundation_patient_id`, missing `person_id`, missing `source_case_id`, missing `clinic_id`, no timeline rows yet, media without patient linkage.

## Known gaps

- **Timeline source** is not a column on `fi_timeline_events`; the UI reads `detail` when producers stored `source_system` there (same as Stage 1H).
- **City/country** depend on clinic metadata shape; tenants may use different keys until a normalised address model exists.
- **Legacy case workbench** (submit, model run, uploads) previously lived on this route; it was replaced by this read-only screen. APIs under `/api/tenants/.../cases/...` remain for callers that use them directly.

## Future: editable case / CRM

Later phases may add tenant-configurable case boards, tasks, pricing, and documents. That layer must stay **per-tenant / per-organisation** configurable (branding, pipelines, templates), not hard-coded to any single company or producer system. This Stage 1I screen remains the read-only cross-system baseline.

## Related code

- Loader: `src/lib/fi/foundation/caseRecord.ts` — `loadUniversalCaseRecord`
- UI: `src/components/fi/UniversalCaseRecord.tsx`
- Route: `/fi-admin/[tenantId]/cases/[caseId]`

See also: [11-universal-patient-record.md](./11-universal-patient-record.md) for the parallel patient aggregate and shared styling conventions.
