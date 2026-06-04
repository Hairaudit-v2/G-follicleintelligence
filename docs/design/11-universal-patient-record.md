# Universal Patient Record (Stage 1H)

## Purpose

The Universal Patient Record screen in FI Admin gives operators a **single read-only view** of one person/patient across:

- HLI and HairAudit (and other) **source systems**, via `fi_patient_source_ids` and `v_fi_patient_resolution`
- **Foundation** identifiers (`fi_patients`, `fi_persons`)
- **Legacy global** stubs (`fi_global_patients`) when no foundation row exists yet
- **Cases** (`v_fi_case_foundation`), including global case linkage when present
- **Clinical timeline** (`fi_timeline_events`)
- **Media** (`v_fi_media_unified` and direct `fi_media_assets` for operator transparency)

It does **not** replace tenant-specific CRM or clinic workflows; it is an internal cross-system read model.

## Read-only status

- **No writes**: ingest, dual-write, and patient mutation paths are unchanged.
- Data is loaded server-side using the same service-role trust model as other `/fi-admin` tenant APIs and foundation helpers.

## Supported identifiers

| Input | Resolution |
|--------|--------------|
| Route `patientId` | Try `fi_patients.id` for the tenant first; if missing, try `fi_global_patients.id` and map through `v_fi_patient_resolution`. |
| `foundationPatientId` (loader) | Direct `fi_patients` row for the tenant. |
| `globalPatientId` (loader) | `fi_global_patients` row; foundation ids come from `v_fi_patient_resolution` when mapped. |
| `personId` (loader) | All `fi_patients` with that `person_id`; cases, media, and timeline are **merged** across those patient rows, with a warning if more than one patient row exists. |

## What data is shown

1. **Header**: display name, email, phone (from patient metadata, person metadata, or resolution view), source systems, foundation patient id, person id, linked global patient ids, anchor mode.
2. **Clinical timeline**: `fi_timeline_events` for resolved patient ids and/or case ids in scope, newest first; source system when present in JSON `detail`.
3. **Cases**: from `v_fi_case_foundation`, plus `external_id` from `fi_cases`, and clinic / organisation display names.
4. **Media**: unified view (legacy uploads + foundation assets) and a second table for raw `fi_media_assets` in scope.
5. **Warnings**: automated checks (e.g. missing `person_id`, unresolved global rows, cases without `foundation_patient_id`, media without `case_id`, multiple patients per person).

## Known gaps

- Timeline query is capped (e.g. 2000 rows) for performance; very large histories may be truncated.
- `fi_timeline_events` has no first-class `source_system` column; the UI infers it from `detail` when dual-write stored it there.
- Unresolved **global-only** patients show cases only when `fi_global_cases` links a `fi_case_id`; cases that exist only under legacy intakes without global linkage may not appear.
- The compatibility view `v_fi_case_foundation` does not expose every `fi_cases` column; extra fields are loaded separately where needed (e.g. `external_id`).

## Future: editable CRM

A later phase may add tenant-configurable CRM (pipelines, consent, pricing, templates) per organisation/clinic. That layer must remain **configurable per tenant**, not hard-coded to any single clinic brand. The Universal Patient Record would then gain controlled edits and audit, while this Stage 1H screen remains the read-only aggregate baseline.

## Related code

- Loader: `src/lib/fi/foundation/patientRecord.ts` — `loadUniversalPatientRecord`
- UI: `src/components/fi/UniversalPatientRecord.tsx`
- Route: `/fi-admin/[tenantId]/patients/[patientId]`

See also: [12-universal-case-record.md](./12-universal-case-record.md) for the parallel case aggregate screen.
