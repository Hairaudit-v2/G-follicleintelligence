# HubSpot → FI OS import (controlled migration)

Programme: **FI-HUBSPOT-IMPORT-1**  
Current gate: **1E** (controlled contact→lead expansion; E1–E10 GREEN; E11 pending approval)  
Related: `docs/runbooks/hubspot-incremental-backup.md` (must remain unchanged)  
Mapping: `docs/migrations/hubspot-to-fi-os-mapping-v1.md`

## Hard rules

- Do **not** apply Layer E production entity writes until an explicit 1B pilot gate.
- Do **not** alter backup watermarks, cron schedules, or HubSpot staging rows.
- Do **not** create patients from HubSpot contacts in v1.
- Do **not** use fuzzy identity matching.
- Ordinary staff must not receive import write controls (no Configuration surface).

## Prerequisites

1. FI-HUBSPOT-BACKUP-1 closed GREEN.
2. Staging tables populated for the dataset under review.
3. `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` available locally.
4. On Windows TLS interception networks, wrap with `node scripts/run-with-system-ca.mjs …`.

## Dry-run command

Preferred (baked flags; avoids Windows npm flag stripping):

```bash
npm run hubspot:import:dry-run:contacts
npm run hubspot:import:dry-run:owners
```

Or:

```bash
node scripts/run-with-system-ca.mjs node --use-system-ca \
  -r ./scripts/patch-server-only-for-scripts.cjs \
  ./node_modules/tsx/dist/cli.mjs scripts/hubspot-import-dry-run.ts \
  --dataset contacts \
  --mapping-version v1 \
  --limit 100 \
  --strict \
  --output-json docs/audits/.tmp-import-1a-dry-run-contacts.json
```

Flags:

| Flag | Purpose |
|------|---------|
| `--tenant-id` | Defaults to Evolved recovery tenant |
| `--integration-id` | Defaults to HubSpot integration |
| `--dataset` | `contacts` \| `owners` (1A executable) |
| `--limit` | Cohort size (default 100) |
| `--source-id` | Single HubSpot id |
| `--strict` | Fail if mutation guard trips |
| `--output-json` | Write privacy-safe JSON |

Dry-run guarantees:

- Zero FI entity inserts/updates/deletes
- Zero notifications / automations
- Zero watermark changes

## Roles (future apply gates)

| Role | Capability |
|------|------------|
| Operator | Prepare dry-run, attach evidence |
| Approver (owner / platform admin) | Approve batch |
| System | Execute apply |
| Verifier | Independent reconciliation |
| Ordinary staff | None |

## Rollback model (future apply)

- Every created entity references `import_batch_id`.
- External identities reference source + batch.
- Rollback archives/suppresses batch-created rows only; never hard-deletes native entities with later activity.
- Linked existing entities: remove imported links/evidence only.
- Rollback is tenant-scoped and previewable (`rollback_preview` mode).

## Owner→staff mapping pilot (1B) — COMPLETE GREEN

Batch: `c73c5fb8-4df2-42b4-93ac-ddefe25d4574`  
Evidence: `docs/audits/evidence-fi-hubspot-import-1b-owner-staff-mapping.md`

### Commands

```bash
# Preview (max 2 by default; creates fi_import_batches dry_run_passed)
node scripts/run-with-system-ca.mjs node -r ./scripts/patch-server-only-for-scripts.cjs \
  ./node_modules/tsx/dist/cli.mjs scripts/hubspot-owner-mapping.ts --preview --max-records 2

# Apply (confirm env must equal batch id)
FI_HUBSPOT_OWNER_MAP_CONFIRM=<batchId> node scripts/run-with-system-ca.mjs node -r ./scripts/patch-server-only-for-scripts.cjs \
  ./node_modules/tsx/dist/cli.mjs scripts/hubspot-owner-mapping.ts \
  --apply --approved-batch-id <batchId>

# Idempotent replay: same apply command again → already_applied

# Rollback preview (production-safe)
node scripts/run-with-system-ca.mjs node -r ./scripts/patch-server-only-for-scripts.cjs \
  ./node_modules/tsx/dist/cli.mjs scripts/hubspot-owner-mapping.ts \
  --rollback-preview --batch-id <batchId>

# Rollback apply (only if mappings incorrect)
FI_HUBSPOT_OWNER_MAP_ROLLBACK_CONFIRM=<batchId> node scripts/run-with-system-ca.mjs node -r ./scripts/patch-server-only-for-scripts.cjs \
  ./node_modules/tsx/dist/cli.mjs scripts/hubspot-owner-mapping.ts \
  --rollback-apply --batch-id <batchId> --reason "<text>"
```

### Allowlisted mutations

- `fi_import_batches` insert/update
- `fi_staff_source_ids` insert/delete (batch-scoped metadata only)

Never mutates `fi_staff` / `fi_users`. Expansion beyond 2 requires `--expand` (max 25) and still only deterministic matches.

### Next gate (after 1B)

`FI-HUBSPOT-IMPORT-1C — Owner-resolution workspace and controlled mapping coverage expansion`

## Owner-resolution workspace (1C)

UI: `/fi-admin/[tenantId]/settings/integrations/hubspot?tab=owner-resolution`  
Access: Configuration hub roles only (clinic admin / owner / platform admin with tenant scope).  
Decisions table: `fi_hubspot_owner_resolution_decisions` (review persists without apply).

### Commands

```bash
npm run hubspot:owner-resolution:summary
npm run hubspot:owner-resolution:classify
npm run hubspot:owner-resolution:preview

# Apply only after explicit preview approval (max 10 mappings / batch; ≤25 new in 1C)
FI_HUBSPOT_OWNER_MAP_CONFIRM=<batchId> node scripts/run-with-system-ca.mjs node -r ./scripts/patch-server-only-for-scripts.cjs \
  ./node_modules/tsx/dist/cli.mjs scripts/hubspot-owner-resolution-review.ts \
  --apply --approved-batch-id <batchId> --checksum <checksum>
```

Hard rules for 1C:

- Never auto-map from name-only or weak signals
- Classifications (archived / historical / no match / excluded / conflict) do not create staff mappings
- One HubSpot owner per FI staff retained; conflicts stay quarantined
- No staff/user/lead/patient/workflow side effects; watermark unchanged
- Success ≠ mapping all 29 remaining owners

### Next gate (after 1C GREEN)

`FI-HUBSPOT-IMPORT-1D — Contact and lead migration pilot with patient-protection gate`

## Contact→lead pilot (1D)

UI: `/fi-admin/[tenantId]/settings/integrations/hubspot?tab=lead-pilot`  
Decisions: `fi_hubspot_contact_lead_pilot_decisions`  
Max: **25** contacts per batch. Patient creation remains forbidden.

### Commands

```bash
npm run hubspot:lead-pilot:cohort
npm run hubspot:lead-pilot:preview

FI_HUBSPOT_CONTACT_LEAD_CONFIRM=<batchId> node scripts/run-with-system-ca.mjs node -r ./scripts/patch-server-only-for-scripts.cjs \
  ./node_modules/tsx/dist/cli.mjs scripts/hubspot-contact-lead-pilot.ts \
  --apply --approved-batch-id <batchId> --checksum <checksum>
```

Hard rules for 1D:

- Never create `fi_patients` or auto-link patients via email alone
- Prefer additive `fi_external_record_mappings` for existing-lead links
- New leads only when deterministic policy allows (none in first production pilot)
- No notifications, reminders, appointments, or watermark changes
- Replay must be idempotent; rollback preview batch-scoped

### Next gate (after 1D GREEN)

`FI-HUBSPOT-IMPORT-1E — Controlled contact and lead migration expansion`

## Contact→lead expansion (1E)

UI: `/fi-admin/[tenantId]/settings/integrations/hubspot?tab=contact-migration`  
Kind: `hubspot_contact_lead_expansion_1e`  
Batch policy: E1 max **100**, then **250** (500 only after ≥3 reconciled batches + explicit flag).  
Prior batch must reconcile (unexplained=0) before the next apply.

### Commands

```bash
npm run hubspot:contact-migration:inventory
npm run hubspot:contact-migration:preview
npm run hubspot:contact-migration:gate

FI_HUBSPOT_CONTACT_LEAD_EXPANSION_CONFIRM=<batchId> node scripts/run-with-system-ca.mjs node -r ./scripts/patch-server-only-for-scripts.cjs \
  ./node_modules/tsx/dist/cli.mjs scripts/hubspot-contact-lead-expansion.ts \
  --apply --approved-batch-id <batchId> --checksum <checksum>

node scripts/run-with-system-ca.mjs node -r ./scripts/patch-server-only-for-scripts.cjs \
  ./node_modules/tsx/dist/cli.mjs scripts/hubspot-contact-lead-expansion.ts \
  --reconcile --batch-id <batchId>
```

Hard rules for 1E (inherits 1D):

- Never create `fi_patients` or auto-link patients via email alone
- Prefer additive `fi_external_record_mappings` for existing-lead links
- No notifications, reminders, appointments, or watermark changes
- Replay must be idempotent; rollback preview batch-scoped
- Unreconciled prior expansion batch blocks the next apply

### E10 production position (2026-07-16)

- Batch `8cf33768-ffb3-46a4-a481-4aadbb1cfd43`: 500 links, 0 creates, patients 829→829
- Mappings 3624→4124; replay already_applied ×500; rollback preview 500 mappings
- Ten consecutive reconciled batches (E1–E10); gate open for E11 (≤472 remaining ready-to-link)
- E9 audit commit `74638e0e` was on origin/main before E10 apply

### Next gate (after full 1E GREEN)

`FI-HUBSPOT-IMPORT-1F — Deal and pipeline-history migration pilot`

## Safety checklist before any apply

- [x] Preview JSON reviewed (1B)
- [x] Wrong-tenant count = 0
- [x] Conflict count = 0
- [x] Pilot ≤ 2 records (Phase 1)
- [x] Confirm token = batch id
- [x] Backup watermark unchanged
- [x] Rollback preview prepared (not executed — mappings correct)
- [x] 1C: preview checksum + batch id confirmed; mappings ≤ 10; operator-approved only
- [x] 1D: patient count unchanged; ≤25 contacts; confirm token = batch id
- [x] 1E E1: patient count unchanged; ≤100 contacts; reconcile unexplained=0; gate open for E2
- [x] 1E E2: patient count unchanged; ≤250 link-only contacts; reconcile unexplained=0; gate open for E3
- [x] 1E E3: patient count unchanged; ≤250 link-only contacts; reconcile unexplained=0; gate open for E4
- [x] 1E E4: patient count unchanged; ≤500 link-only contacts; reconcile unexplained=0; gate open for E5
- [x] 1E E5: patient count unchanged; ≤500 link-only contacts; reconcile unexplained=0; gate open for E6
- [x] 1E E6: patient count unchanged; ≤500 link-only contacts; reconcile unexplained=0; gate open for E7
- [x] 1E E7: patient count unchanged; ≤500 link-only contacts; reconcile unexplained=0; gate open for E8
- [x] 1E E8: patient count unchanged; ≤500 link-only contacts; reconcile unexplained=0; gate open for E9
- [x] 1E E9: patient count unchanged; ≤500 link-only contacts; reconcile unexplained=0; gate open for E10
- [x] 1E E10: patient count unchanged; ≤500 link-only contacts; reconcile unexplained=0; gate open for E11
