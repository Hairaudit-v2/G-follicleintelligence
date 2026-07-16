# HubSpot incremental backup — operator runbook

**Milestone:** FI-HUBSPOT-INCREMENTAL-BACKUP-1  
**Dataset (v1):** `notes` only  
**Related evidence:** `docs/audits/evidence-fi-hubspot-incremental-backup-implementation.md`

## Prerequisites

- Migration `202610189001_hubspot_incremental_backup_watermarks.sql` applied
- Encrypted HubSpot connector credential for the tenant
- `FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID` set for CLI recovery ops
- Explicit UTC cutoffs (never local-time strings)

## Incremental command

```bash
npm run hubspot:backup:incremental -- \
  --dataset notes \
  --cutoff-from 2026-07-16T00:00:00.000Z \
  --cutoff-to 2026-07-16T01:00:00.000Z
```

Optional: `--tenant-id`, `--integration-id`, `--resume-run-id`

## Cutoff semantics

- Lower bound **inclusive**: `updatedAt >= cutoff_from`
- Upper bound **exclusive**: `updatedAt < cutoff_to`
- Timestamps must include `Z` or a numeric offset; bare local datetimes are rejected
- Values are normalized to UTC ISO-8601
- Equal timestamps are ordered by HubSpot note ID (no skips)

## Resume

```bash
npm run hubspot:backup:resume -- --run-id <uuid>
```

Resume reloads the **immutable** `cutoff_from` / `cutoff_to` from the run row. It never replaces `cutoff_to` with wall-clock time.

## Stuck-run recovery (secondary path)

Only for stale `started` runs older than 30 minutes (by `last_checkpoint_at` / `started_at`).

```bash
npm run hubspot:backup:recover-stuck -- \
  --run-id <uuid> \
  --reason "process terminated without finalize" \
  --to failed
```

- Does **not** advance the watermark
- Does **not** delete checkpoints
- Refuses completed/verified runs

## Status meanings

| Status | Watermark |
|--------|-----------|
| `started` | No |
| `completed` + verification `passed` | Advances to `cutoff_to` |
| `partial` / `failed` | No |
| Empty successful range | Advances (treated as verified success) |

## Safe same-range rerun

Re-run the identical `--cutoff-from` / `--cutoff-to` after the prior run has left `started`. Upserts use `(tenant_id, integration_id, hubspot_record_id)`. Expect `unchanged`/`updated`, not a second row.

## Watermark inspection

```sql
select tenant_id, dataset, watermark_timestamp, last_verified_run_id, version, updated_at
from fi_external_hubspot_backup_watermarks
where source_system = 'hubspot' and dataset = 'notes';
```

## Verification inspection

```sql
select occurred_at, outcome, detail->>'event' as event, detail
from fi_external_connector_verification_events
where detail->>'verification_mode' = 'incremental_backup'
order by occurred_at desc
limit 50;
```

Events: `run_created`, `run_started`, `page_checkpointed`, `run_resumed`, `finalisation_completed`, `verification_passed` / `verification_failed`, `watermark_advanced`, `run_failed`, `stuck_run_recovered`.

## Concurrency

One active (`status=started`) incremental run per `tenant_id + integration_id + dataset`. Overlap fails closed (non-zero exit). Different datasets do not share that unique index.

## Privacy

- Do not log note bodies
- Evidence and CLI JSON omit patient/contact content
- Staging still stores `raw_payload` under existing restricted staging rules (`promotion_enabled: false`)

## Production Stage P2 reminder

1. Deploy this implementation
2. Confirm READY + SHA
3. Re-run P1 observation
4. Only then create a labeled TEST note and run the controlled P2 proof

Do not invent cutoffs. Do not fall back to full-history backup when incremental args are malformed.
