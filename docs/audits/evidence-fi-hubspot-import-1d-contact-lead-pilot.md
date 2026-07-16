# FI-HUBSPOT-IMPORT-1D — Contact and lead migration pilot evidence

**Verdict:** GREEN — COMPLETE

**Date:** 2026-07-16  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Integration:** `ade8a7d0-ad45-4fd7-8d53-61d4806b95f6`

## Closeout

**FI-HUBSPOT-IMPORT-1D: GREEN — COMPLETE**

A bounded 25-contact production pilot was applied with the
patient-protection gate held.

Production outcome:
- 25 contacts evaluated
- 24 existing FI leads linked
- 0 new leads created
- 0 patients created or linked
- 0 patient-link-review cases in the selected cohort
- 1 test/smoke contact quarantined
- 0 conflicts
- 0 wrong-tenant decisions

Production batch:
`46c77f5f-866d-4363-a012-b8f0c960f966`

Identity method:
`person_source_id_single_lead`

Counts:
- FI leads: 4,706 → 4,706
- FI patients: 829 → 829
- contact-to-lead mappings: 0 → 24

Controls verified:
- bounded maximum of 25 contacts
- immutable preview checksum
- additive source mappings only
- automatic patient creation blocked
- no new or duplicate leads
- no unsafe FI field overwrite
- idempotent replay: already_applied ×24, mutation delta 0
- rollback preview isolates all 24 mappings
- no notifications, tasks, appointments or other side effects
- HubSpot backup watermark unchanged

Documented limitations:
- no valid new-lead or patient-review cases existed in this pilot pool
- owner and stage enrichment remain limited because current staging
  contact payloads lack owner and stage properties

Exact next gate:
**FI-HUBSPOT-IMPORT-1E — Controlled contact and lead migration expansion**

## Production outcome (detail)

| Metric | Value |
|--------|------:|
| Contacts evaluated (pool) | ~400 stratified staging sample |
| Pilot size | 25 |
| Existing leads linked | 24 |
| New leads created | 0 |
| Already linked (pre-apply) | 0 |
| Patient-link review | 0 |
| Quarantined (test/smoke) | 1 (`100040617619` / test@gmail.com) |
| Conflicts | 0 |
| Wrong-tenant | 0 |

### Counts

| Entity | Before | After |
|--------|-------:|------:|
| `fi_crm_leads` | 4706 | 4706 |
| `fi_patients` | 829 | 829 |
| contact→lead external mappings | 0 | 24 |

### Batch

- **ID:** `46c77f5f-866d-4363-a012-b8f0c960f966`
- **Checksum:** `2bc68b260f24d8b9a25d0a83d4c12bf81914ca83d3b0ca28998dd49f2e0b7069`
- **Kind:** `hubspot_contact_lead_pilot_1d`

### Watermark

`2026-07-16T03:45:02.366Z` → unchanged

### Replay

- linked 0 / created 0 / already_applied 24 / mapping Δ 0

### Rollback preview

- 24 removable `fi_external_record_mappings` rows (batch-scoped)
- 0 new leads to archive
- 0 blocked
- Not executed (links correct)

## Mutation summary

| Table | Change |
|-------|--------|
| `fi_external_record_mappings` | +24 contact→lead (additive) |
| `fi_hubspot_contact_lead_pilot_decisions` | cohort decisions + already_applied |
| `fi_import_batches` | preview/apply metadata |
| `fi_crm_leads` | **no change** |
| `fi_patients` | **no change** |
| `fi_staff` / `fi_users` | **no change** |
| notifications / tasks / appointments | **none** |

## Match evidence

All 24 applied links used `person_source_id_single_lead` (Tier 2).

## Owner / stage

- Source contact staging still lacks `hubspot_owner_id` properties → owner status mostly `none` (metadata limitation from 1C)
- Per-contact deal stage not joined in this pilot → stage fill not applied; native FI stages preserved

## Field merge

- Matrix v1 enforced: preserve FI primary email; fill-when-blank for name/phone only
- No unsafe overwrites observed (lead rows untouched)

## Workspace

- Tab: `lead-pilot`
- Primary apply label: **Apply approved lead pilot**
- Config-hub gated; max 25 enforced

## Tests

| Suite | Result |
|-------|--------|
| `tsc --noEmit` | pass |
| `test:hubspot-import` | 69 pass |
| `test:hubspot-incremental` | 58 pass |

## Remaining risks

1. Owner/stage enrichment limited until backup payloads include those properties
2. No valid create_new_lead or patient_link_review cases in this pool (reported as zero; gate retained)
3. Human UI smoke/screenshots still recommended post-close
4. Code not yet committed at evidence write time

## Exact next gate

**FI-HUBSPOT-IMPORT-1E — Controlled contact and lead migration expansion**
