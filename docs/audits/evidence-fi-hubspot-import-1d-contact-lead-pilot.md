# FI-HUBSPOT-IMPORT-1D — Contact and lead migration pilot evidence

**Verdict:** GREEN

**Date:** 2026-07-16  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Integration:** `ade8a7d0-ad45-4fd7-8d53-61d4806b95f6`

## Closeout summary

Bounded production pilot applied with patient-protection gate held. Additive contact→lead mappings only. No new leads required. No patients created or linked.

## Production outcome

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
