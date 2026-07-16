# HubSpot → FI OS mapping specification (v1)

Milestone: **FI-HUBSPOT-IMPORT-1A**  
Mapping version: **v1**  
Code: `src/lib/integrations/hubspot/import/hubspotImportMappingV1.ts`

## Principles

1. HubSpot IDs are never FI OS primary keys.
2. Tenant isolation is fail-closed.
3. Fuzzy / probabilistic / cross-tenant matching is forbidden.
4. Verified HubSpot backup staging is the authoritative source (not arbitrary live API dumps).
5. Layer E (apply) is out of scope for 1A.

## Divergence from Stage-1 CSV import

The existing Import Centre Stage-1 path (`src/lib/crm/hubspotImport/`) creates `fi_persons` → `fi_patients` → `fi_crm_leads`.

**IMPORT-1 v1 does not create patients from HubSpot contacts.** Patient creation remains a clinical/onboarding workflow. Contacts map to leads (create/link) or deterministic patient *links* only when Tier 1–3 external evidence exists.

## External identity model

### Reuse (current production)

| Table | Role |
|-------|------|
| `fi_external_record_mappings` | Integration-scoped external → FI UUID |
| `fi_person_source_ids` | HubSpot contact → person |
| `fi_patient_source_ids` | HubSpot contact → patient (when present) |
| `fi_crm_lead_source_ids` | HubSpot deal → lead |
| `fi_staff_source_ids` | HubSpot owner → staff |

Unique source identity (logical):

`tenant_id + source_system + integration_id + source_object_type + source_record_id`

### Proposed additive (not applied in 1A)

Optional `fi_migration_external_identities` (or equivalent) adding: `identity_status`, `confidence_type`, `import_batch_id`, `first_seen_at` / `last_seen_at`, richer metadata. Existing tables cover the unique key for contacts/owners/deals sufficiently for the owner and lead pilots.

## Identity resolution precedence

| Tier | Signal | Decision |
|------|--------|----------|
| 1 | External mapping / source ids | `LINK_EXISTING` |
| 2 | Explicit HubSpot ref on FI entity | `LINK_EXISTING` |
| 3 | Prior verified FI relationship | `LINK_EXISTING` |
| 4 | Exact tenant-scoped email → lead only | `LINK_EXISTING` lead / quarantine for patient-only |
| 5 | Ambiguous / insufficient | `QUARANTINE_*` |

Forbidden: fuzzy name, approximate email/phone, AI matching, cross-tenant.

Phone-only matches quarantine in v1 (recycled / shared numbers).

## Lead vs patient

| Action | Allowed in v1 |
|--------|----------------|
| Create lead from HubSpot contact | Yes (apply gate) |
| Create patient from HubSpot contact | **No** |
| Link patient via email/phone alone | **No** |
| Link patient via existing source id | Yes |
| Overwrite demographics / clinical / consent | **No** |

## Owner → staff

1. Existing `fi_staff_source_ids` (`source_system = hubspot`)
2. Exact staff/user email within tenant
3. Else quarantine — retain HubSpot owner id as provenance; do not assign

Do not auto-create staff. Do not assign inactive staff.

## Sales Pipeline → FI CRM stages

Source: FI-HUBSPOT-BACKUP-1 manifest (11 stages).

| HubSpot stage | FI slug | Class |
|---------------|---------|-------|
| Contacted | `contacted` | exact |
| Appointment Scheduled | `consult_scheduled` | exact |
| Consulted | `consult_completed` | closest |
| Surgery Unqualified | — | history-only |
| Surgery Qualified | `treatment_planning` | closest |
| Booked Non-Surgical | `deposit_or_booked` | closest (high-risk) |
| Booked Surgical | `deposit_or_booked` | closest (high-risk) |
| Deposit Paid | `deposit_or_booked` | closest |
| Completed Session | `won_closed` | closest |
| Post Operative Treatment | `in_treatment` | closest |
| Lost | `lost` | exact |

Existing FI stage remains authoritative for already-imported leads. Import must not regress stage or create appointments/surgeries/payments.

## Forms / submissions

- Identity: Conversion ID / `hubspot_submission_id`
- Target: acquisition / enquiry evidence (not clinical fields)
- Contact association: optional CSV enrichment (3,107 rows) — deferred; no email substitute

## Timeline (notes, messages, calls, meetings, tasks)

Unique: `tenant + integration + source_object_type + canonical_source_id`  
No notifications, no reopen, no auto-tasks, no appointment mutation.

## Deals

CRM evidence + stage history first. Do not create appointments, surgeries, quotes, or payments in the first write gate.

## Files

Metadata-only (`content_backed_up = 0`). Never create FI uploads that imply retrievable content.

## Batch / decision model

See runbook `docs/runbooks/hubspot-to-fi-os-import.md`. Modes: `dry_run` (1A), future `apply` / `replay` / `rollback_preview`.
