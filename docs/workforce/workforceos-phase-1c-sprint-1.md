# WorkforceOS Phase 1C Sprint 1 — Identity Reconciliation & HR Sync Audit

## Problem statement

Production IIOHR HR staff sync is operational (`rowsSent=13`) but created duplicate FI OS staff identities because inbound HR feed rows were not reliably matched to existing WorkforceOS / operational staff records.

**Production symptom (pre-Sprint 1):**

```json
{
  "ok": true,
  "rowsSent": 13,
  "created": 18,
  "updated": 10,
  "linked": 0,
  "skipped": 0,
  "warnings": []
}
```

`linked=0` reflected that identity attachment was not counted; `created=18` was inflated by rollup of users + staff + source-id rows.

## Tables added

| Table | Purpose |
|-------|---------|
| `fi_staff_identity_links` | Auditable external id ↔ `fi_staff_members` mapping |
| `fi_staff_duplicate_candidates` | Open duplicate pairs for manual review (no auto-merge) |
| `fi_hr_sync_runs` | WorkforceOS reconciliation-layer sync audit |

### `fi_staff_members` extensions

- `source_external_id`
- `merged_into`, `merged_at`
- `offboarded_at`

(`source_system`, `source_synced_at`, `employment_status` already existed.)

## Reconciliation rules

Matching hierarchy (first hit wins):

1. Existing `fi_staff_identity_links` by `tenant_id + source_system + external_id`
2. Exact normalized email on `fi_staff_members`
3. Exact normalized full name
4. High-confidence fuzzy name (≥0.92 Jaccard) when inbound email is blank
5. Otherwise create (or manual-review when name matches but email conflicts)

Safety:

- Never hard-delete staff
- Never overwrite verified email with blank inbound email
- Prefer existing FI OS role/readiness/compliance over inbound HR feed
- Name + conflicting email → duplicate/manual review, not auto-merge

## Duplicate detection scoring

| Signal | Score |
|--------|-------|
| Email exact | 100 |
| Same external id conflict | +100 |
| Phone exact | 90 |
| Name exact | 75 |
| Fuzzy name | 60 |
| Similar role | +10 |

Threshold: **≥80** creates/updates an open `fi_staff_duplicate_candidates` row. Pairs stored with sorted UUIDs (`staff_a_id < staff_b_id`).

## HR sync audit dashboard

Route: `/fi-admin/[tenantId]/hr/sync-health` (alias: `/fi-admin/[tenantId]/hr-os/sync-health`)

Sections:

- WorkforceOS HR sync audit summary cards
- Identity link health (unlinked active staff, open duplicates)
- Open duplicate candidates table
- Unlinked active staff list
- Recent `fi_hr_sync_runs` table

Workforce Command Centre banner links here: **Open HR sync health dashboard**.

## Cron integration

`/api/cron/iiohr-hr-perth-staff-sync` unchanged entrypoint; pipeline now:

1. `startHrSyncRun` (commit mode)
2. Sync `fi_staff` projections → enrich import snapshots with identity links
3. Operational import (existing planner)
4. `runWorkforceReconciliationForInboundRows` on `fi_staff_members`
5. Post-sync duplicate detection
6. `completeHrSyncRun` with workforce counts (`linked`, `created`, `updated`)

API rollup now prefers `workforceReconciliation` counts over raw import rollup when present.

## Known limitations (Sprint 1)

- No automatic merge of duplicate candidates
- No offboarding workflow
- No payroll changes
- Manual linking UI deferred
- Reconciliation requires `fi_staff_members` projection bridge (`fi_staff_id`) for pre-import injection

## Sprint 2 next steps

- Manual linking UI in WorkforceOS HR reconciliation
- Staff merge utility (soft merge via `merged_into`)
- Offboarding workflow with audit trail
- Feed-driven reconciliation queue on `/workforce-os/hr-reconciliation`