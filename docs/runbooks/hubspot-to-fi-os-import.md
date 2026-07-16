# HubSpot → FI OS import (controlled migration)

Programme: **FI-HUBSPOT-IMPORT-1**  
Current gate: **1A** (architecture + dry-run only)  
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

## Recommended first pilot (1B)

**Option A — Owner-to-staff mapping pilot** (≤ 25 owners)

- Write only `fi_staff_source_ids` (and optional `fi_external_record_mappings`) for deterministic exact matches.
- Do not create staff.
- Do not assign leads in the same batch.

Next gate title:

`FI-HUBSPOT-IMPORT-1B — Owner-to-staff mapping pilot`

## Safety checklist before any apply

- [ ] Dry-run JSON reviewed
- [ ] Wrong-tenant count = 0
- [ ] Conflict count = 0
- [ ] Pilot ≤ 25 records
- [ ] Approver recorded
- [ ] Backup watermark unchanged after dry-run
- [ ] Rollback preview prepared
