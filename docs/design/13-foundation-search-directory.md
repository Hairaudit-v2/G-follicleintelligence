# Foundation Search & Directory (Stage 1J)

## Purpose

The **Directory** screen provides a **tenant-scoped, read-only search layer** over FI foundation data so operators can quickly find patients, cases, clinics, and organisations without writing SQL.

It complements the Universal Patient Record and Universal Case Record screens by offering cross-entity discovery and shallow browse (recent rows when no query is supplied).

## Read-only status

- **No writes**: ingest, dual-write, and database schemas are unchanged.
- Search runs on the server with the same **service-role / internal admin** access pattern as other FI Admin foundation loaders.

## Supported search fields

Searches are implemented with `ilike` substring matching (plus UUID equality when the query looks like a UUID). Grouped behaviour:

| Group | Primary sources | Matched fields (non-exhaustive) |
|-------|-------------------|----------------------------------|
| **Patients** | `v_fi_patient_resolution` | `display_name`, `email`, `phone`, `source_system`, `source_patient_id`, `global_patient_id`, `foundation_patient_id`, `person_id` (uuid mode) |
| **Cases** | `v_fi_case_foundation` | `case_type`, `status`, `source_system`, `source_case_id`, ids (`case_id`, `global_case_id`, `foundation_patient_id`, `global_patient_id`, `person_id`, `clinic_id`, `organisation_id` in uuid mode); also cases whose **organisation** or **clinic** name matches the query (via id `in` boost) |
| **Clinics** | `fi_clinics` | `display_name`, `id` (uuid mode) |
| **Organisations** | `fi_organisations` | `name`, `organisation_type`, `id` (uuid mode) |

`v_fi_media_unified` is listed for future media-aware search; **Stage 1J does not yet return a separate media group** (only the four groups above).

Direct `fi_persons` / `fi_patients` / `fi_cases` text search beyond what the compatibility views expose is **not** fully duplicated here; person and case identity search relies on the views plus uuid matching.

## Multi-tenant behaviour

- Every query is constrained with **`tenant_id`** on the tenant passed in the route.
- Copy and UI strings are **tenant-neutral** (no default clinic or vendor names).
- Each tenant’s directory is isolated; there is no cross-tenant search.

## Route & UI

- **Route:** `/fi-admin/[tenantId]/directory`
- **Query string:** `q` (optional search text), `type` (`all` \| `patients` \| `cases` \| `clinics` \| `organisations`), optional `limit` (capped server-side).
- **Links:** patient and case hits link to the universal record routes; clinic and organisation hits use in-page anchors (`#clinic-{id}`, `#organisation-{id}`) on the same directory page for read-only cards.

## Warnings

Patient hits may include a **warning** when the resolution view shows an unresolved global stub (`global_patient_id` without `foundation_patient_id`) or missing `person_id` on a foundation-linked row. Case hits warn when **`foundation_patient_id`** is missing on the case.

## Known gaps

- No dedicated **media** result group yet (`v_fi_media_unified` reserved for a later iteration).
- **Person-only** rows not appearing in `v_fi_patient_resolution` are not searched via a separate `fi_persons` metadata query (PostgREST JSON filters vary by deployment).
- **Pagination** is not implemented; each group is limited (default 25, max 50 per group).

## Future: CRM directory / editing

A future tenant-configurable CRM may add saved views, editable directory fields, role-based redaction, and richer facets (tags, pipelines, consent). That layer should remain **per-tenant** (branding, workflows, templates). Stage 1J remains the read-only discovery baseline.

## Related code

- Loader: `src/lib/fi/foundation/search.ts` — `searchFoundationRecords`
- UI: `src/components/fi/FoundationSearchDirectory.tsx`
- Page: `app/(fi-admin)/fi-admin/[tenantId]/directory/page.tsx`

See also: [11-universal-patient-record.md](./11-universal-patient-record.md), [12-universal-case-record.md](./12-universal-case-record.md).
