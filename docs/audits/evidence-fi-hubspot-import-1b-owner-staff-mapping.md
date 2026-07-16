# FI-HUBSPOT-IMPORT-1B — Owner-to-staff mapping pilot

**Verdict: GREEN**

| Field | Value |
|-------|-------|
| Closed | 2026-07-16 |
| Batch | `c73c5fb8-4df2-42b4-93ac-ddefe25d4574` |
| Production staff/user mutations | **None** |
| Notes watermark | Unchanged `2026-07-16T03:45:02.366Z` (v3) |
| Contacts/leads/deals/timeline imported | **No** |

Companion JSON: `evidence-fi-hubspot-import-1b-owner-staff-mapping.json`

---

## Scope executed

Phase 1 only: the **2** deterministic active owner→staff matches from 1A.

No expansion (`--expand` not used). Unresolved owners remain quarantined.

## Exact mappings applied

| HubSpot owner ID | FI staff ID | Match method | Mapping row |
|------------------|---------------|--------------|-------------|
| `120371232` | `f9e0bfdf-535a-4f0c-ab2f-3930b5ffc6c1` | exact_staff_email_within_tenant | `4adc41a0-bbdd-4311-9551-7e453632d9df` |
| `121916721` | `be01f2b8-5bd0-4e09-9c4d-5454f9cbc162` | exact_staff_email_within_tenant | `1fd3863e-ed9a-4aca-97ed-58c121c2fbec` |

Staff roles verified post-apply (unchanged): Manager / CFO; both `is_active = true`.

## Counts

| Metric | Value |
|--------|------:|
| Owners evaluated | 31 |
| Proposed apply | 2 |
| Applied | 2 |
| Already-applied on replay | 2 |
| Quarantined / skipped | 29 |
| Conflicts | 0 |
| Wrong-tenant | 0 |
| `fi_staff_source_ids` hubspot before→after | 0 → 2 |

## Production mutation summary

Allowlisted only:

1. `fi_import_batches` insert (preview) + status updates (apply/replay)
2. `fi_staff_source_ids` insert × 2 (apply)

Not mutated: `fi_staff`, `fi_users`, leads, patients, appointments, timeline, notifications, HubSpot staging, watermarks.

## Idempotent replay

Re-apply of the same approved batch:

- decisions: `already_applied` × 2  
- inserts: 0  
- source-id delta: 0  

## Rollback readiness

- Rollback **preview** lists exactly the 2 batch-scoped mapping row IDs for delete.
- Production rollback **not** executed (mappings correct).
- Safe-env isolation test: only rows with `metadata.import_batch_id` + milestone and without `confirmed_outside_batch` are removable.

## Controls proven

- Max-record guard (default 2)
- Exact tenant guard
- Deterministic email match only (name-only rejected)
- Conflict detection (source/target)
- Inactive staff quarantine
- Mutation allowlist
- Batch-scoped audit via `fi_import_batches` + mapping metadata

## Commands

```bash
# Preview (creates approved batch)
node scripts/run-with-system-ca.mjs node -r ./scripts/patch-server-only-for-scripts.cjs \
  ./node_modules/tsx/dist/cli.mjs scripts/hubspot-owner-mapping.ts --preview --max-records 2

# Apply (requires confirm = batch id)
FI_HUBSPOT_OWNER_MAP_CONFIRM=<batchId> node scripts/run-with-system-ca.mjs node -r ./scripts/patch-server-only-for-scripts.cjs \
  ./node_modules/tsx/dist/cli.mjs scripts/hubspot-owner-mapping.ts \
  --apply --approved-batch-id <batchId>

# Rollback preview only
node scripts/run-with-system-ca.mjs node -r ./scripts/patch-server-only-for-scripts.cjs \
  ./node_modules/tsx/dist/cli.mjs scripts/hubspot-owner-mapping.ts \
  --rollback-preview --batch-id <batchId>
```

## Remaining risks

- 29 owners still unresolved (workspace/coverage expansion = 1C)
- Unique index allows only one HubSpot owner per staff (`tenant_id, staff_id, source_system`)
- Email-only matches assume staff email hygiene within tenant

## Exact next gate

**FI-HUBSPOT-IMPORT-1C — Owner-resolution workspace and controlled mapping coverage expansion**

Do not begin contact, lead, deal, pipeline-history, or timeline migration in 1C unless that gate explicitly authorises it.
