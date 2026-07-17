# HubSpot → FI OS import (controlled migration)

Programme: **FI-HUBSPOT-IMPORT-1**  
Current gate: **1E-FINAL GREEN** (4,752 contacts reconciled; contact-and-lead migration closed; next gate 1F)
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

### E11 production position (2026-07-16)

- Batch `fe956ad8-1728-4648-bb6c-85b499286a08`: 472 links, 0 creates, patients 829→829
- Mappings 4124→4596; replay already_applied ×472; rollback preview 472 mappings
- Eleven consecutive reconciled batches (E1–E11); ready-to-link population exhausted
- E10 audit commit `43ed89e3` was on origin/main before E11 apply
- Apply-time watermark unchanged at `2026-07-16T16:00:34.53+00:00`
- Checkpoint exception: watermark advanced from E10 baseline `2026-07-16T03:45:02.366+00:00` before E11 selection

### 1E-W watermark provenance (2026-07-16)

- Owning run `916c3102-548d-4758-9339-7f1e24d4d1d0` — Vercel Cron notes `empty_success`
- Recommendation: `retain_current_watermark`
- Migration did not own the advance
- Live HubSpot interval scan: 1 created / 21 modified; 2 contacts absent from staging
- Evidence: `docs/audits/evidence-fi-hubspot-import-1e-watermark-provenance.md`

### 1E-R contact staging refresh (2026-07-17)

- Portal match: configured/live `21009770`
- Fixed contact cutoff: `2026-07-16T16:00:34.530Z`
- Refresh run `bad4e6d0-8ff3-4e72-bff8-4709f6799b93`: 21 staged, 19 refreshed, 2 added
- Idempotency run `74bde1bd-9ac3-4e98-9668-ac3421419a7c`: 21 existing, 0 added
- Missing IDs `229761370222` and `235542182239`: explained post-snapshot creates; both classify `create_new_lead`; neither processed
- All 11 interval mappings retained their unique target; wrong-tenant 0; patient warnings 0
- Corrected archived-state classification: 10 excluded
- Coverage: 4,596 mapped + 42 create + 4 patient review + 100 quarantined + 10 excluded = 4,752; unexplained 0
- Inventory checksum `3d380a980ad1a0a2ba246742c9ccee5ba7f37a39c3f29e15e572fb175365079c`
- FI leads 4,706→4,706; patients 829→829; contact mappings 4,596→4,596
- Notes watermark unchanged; contact watermark absent before/after
- Evidence: `docs/audits/evidence-fi-hubspot-import-1e-contact-staging-refresh.md`

### 1E-C controlled new-lead review (2026-07-17)

- Fixed inventory checksum: `3d380a980ad1a0a2ba246742c9ccee5ba7f37a39c3f29e15e572fb175365079c`
- Candidate checksum: `8b0b22f9d30deff76672ba58e963976c579fb2fb7f835fe111f85d519ce63abd`
- All 42 persisted: 10 approved creates, 31 deferred manual review, 1 duplicate-risk quarantine
- First batch `32d02f20-9852-4be2-b237-45c115f43c2b`, max 10, preview checksum `6ee2b1f4408bd9f66f3a7f346dc57bb9ac6fe85e19db28125048ce82b6814d2c`
- Apply: leads +10, persons +10, person source IDs +10, mappings +10
- Patients 829→829; staff/users/tasks/messages/notifications/bookings/watermarks unchanged
- Reconcile unexplained 0; replay already-applied ×10 with zero delta
- Rollback preview: 10 mappings and 10 batch-owned leads, 0 blocked; not executed
- Remaining: 31 deferred + 1 duplicate-risk; four patient-review records remain out of scope
- Evidence: `docs/audits/evidence-fi-hubspot-import-1e-controlled-new-leads.md`

### 1E-Q quarantine/exclusion classification (2026-07-17)

- Frozen cohort (110): 100 quarantined + 10 excluded from 1E-R IDs
- Base inventory checksum (1E-R): `3d380a980ad1a0a2ba246742c9ccee5ba7f37a39c3f29e15e572fb175365079c`
- Fixed 1E-Q inventory checksum: `fcf3aaddd2c6f6b2107640798980d3429e08c450a81d66d430da8964e0805de6`
- Review checksum: `d81b2249d4386b7df46cd7bb4d4ca73597932ba3eb13434de8d66c37f97c634c`
- Final: retained 67 + excluded 9 + reclassified 34 + deferred 0 = 110
- Reclassified unapplied: 26 existing-lead links + 8 patient review + 0 creates
- Reconciliation: 4606 + 31 + 1 + 4 + 76 + 34 = 4752; unexplained 0; wrong tenant 0
- Patients 829→829; mappings/watermarks/side effects unchanged; apply blocked
- Workspace: `?tab=quarantine-review`
- Evidence: `docs/audits/evidence-fi-hubspot-import-1e-q-quarantine-review.md`

1E-Q classification is complete. Do not apply reclassified lead/patient/create
candidates, the remaining 31 deferred creates, the duplicate-risk create, or the
1E-P patient-review cohort without a separate future bounded apply approval.

### 1E-P patient-link interim review (2026-07-17)

- Frozen cohort (4): `229708595090`, `233738855995`, `234062240678`, `234339716176`
- Base inventory checksum (1E-R): `3d380a980ad1a0a2ba246742c9ccee5ba7f37a39c3f29e15e572fb175365079c`
- Post-1E-C live inventory checksum: `93823b3d3a322ca23abd85bea8439a0188ac71fdc1c5f8420965a34e16b10451`
- Review checksum: `9328b13004682436b9575c7fd2f5f514b12f4d4b932a4fe329ea3871ec74518f`
- All 4 classified `deferred_clinical_identity_review` (email-only never approves)
- Proposed production links: 0 (batch max 2)
- Patients 829→829; mappings/watermarks/side effects unchanged
- Apply blocked until explicit approval
- Workspace: `?tab=patient-review`
- Evidence: `docs/audits/evidence-fi-hubspot-import-1e-p-patient-link-review.md`

### 1E-D checksum drift reconciliation (2026-07-17)

- Historical expected v1 checksum: `fcf3aaddd2c6f6b2107640798980d3429e08c450a81d66d430da8964e0805de6`
- Historical live v1 checksum: `b12aacbc38ce43f524e9867bdbb1efae0e8a555f1e05836f9e95319dae2a696a`
- Frozen v2 checksum: `1bf1b16f4db0ce750bfd90556554b4c65205d1abc07bfb0e348c112008b5602b`
- Contract: `fi-hubspot-contact-inventory-v2`
- Root cause: unordered implicit single-page v1 decision loading
- Affected contact `22136828309`: reason-code-only delta; classification, target and patient review unchanged
- Snapshot A equals Snapshot B under v2
- Evidence: `docs/audits/evidence-fi-hubspot-import-1e-d-checksum-freeze.md`

### 1E-FINAL closeout (2026-07-17)

- Primary equation: 4,596 existing-lead mappings + 10 created-and-mapped + 31 deferred creates + 1 duplicate risk + 4 original patient review + 67 retained quarantine + 9 retained exclusion + 34 reclassified unapplied = 4,752
- Secondary patient-review view: 4 original + 8 within reclassified = 12; not double-counted
- Contact mappings: 4,606 unique sources and 4,606 unique FI lead targets
- FI leads: 4,706→4,716; FI patients remain 829
- Unexplained, wrong tenant, duplicate mappings, duplicate leads, patient mutations and prohibited side effects: 0
- All deferred cohorts remain unapproved and unapplied
- Evidence: `docs/audits/evidence-fi-hubspot-import-1e-final.md`

### Next gate

`FI-HUBSPOT-IMPORT-1F — Deal and pipeline-history migration pilot`

Begin with a bounded deal cohort. Preserve existing FI lead stages, import
pipeline history additively, prevent stage regression, suppress CRM automation,
preserve historical owner identity, retain patient-protection boundaries, and
reconcile plus replay before expansion.

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
- [x] 1E E11: patient count unchanged; 472 final link-only contacts; reconcile unexplained=0; ready-to-link exhausted
- [x] 1E-W: owning cron run attributed; retain notes watermark; contact staging freshness follow-up documented; create candidates still paused
- [x] 1E-R: 21 interval contacts refreshed/revalidated; staging 4,752; unexplained=0; no FI/mapping/watermark mutations; gate open for 1E-C review only
- [x] 1E-C: all 42 classified; first 10 create-only records applied; patients/watermarks/side effects unchanged; replay delta 0; stopped before second batch
- [x] 1E-P: four patient-review contacts deferred; 0 proposed links; apply blocked pending explicit approval; next gate 1E-Q
- [x] 1E-Q: 110 quarantine/exclusion classified; 34 reclassified read-only unapplied; replay delta 0; apply blocked; next gate 1E-FINAL
- [x] 1E-D: v1 drift explained; v2 contract frozen; Snapshot A equals Snapshot B; official checksum reproduced
- [x] 1E-FINAL: 4,752 contacts mutually exclusive; unexplained/wrong tenant 0; 4,606 mappings unique; patients 829; deferred cohorts preserved; next gate 1F
