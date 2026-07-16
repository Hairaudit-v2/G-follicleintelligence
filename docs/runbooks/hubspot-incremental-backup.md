# HubSpot incremental backup — operator runbook

**Milestone:** FI-HUBSPOT-INCREMENTAL-BACKUP-1 / Stage P3 scheduled operations  
**Dataset (v1):** `notes` only  
**Related evidence:**  
- `docs/audits/evidence-fi-hubspot-incremental-backup-implementation.md`  
- `docs/audits/evidence-fi-hubspot-stage-p2-incremental-notes-proof.md`  
- `docs/audits/evidence-fi-hubspot-stage-p3-scheduled-operations.md`

## Prerequisites

- Migration `202610189001_hubspot_incremental_backup_watermarks.sql` applied
- Migration `202610189002_hubspot_incremental_backup_admin_alerts.sql` applied (admin alert source)
- Encrypted HubSpot connector credential for the tenant
- `FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID` set (CLI + Vercel Cron)
- `FI_HUBSPOT_INCREMENTAL_BACKUP_ENABLED=true` to allow scheduled runs (kill switch)
- Explicit UTC cutoffs for manual runs (never local-time strings)
- Search single-sort fix (`d213ad51`) deployed before enabling the schedule

## Scheduler

**Selected:** Vercel Cron (existing production infrastructure in `vercel.json`).

| Field | Value |
|-------|-------|
| Path | `/api/cron/hubspot/incremental-notes-backup` |
| Permanent cadence | `0 16 * * *` (16:00 UTC daily) |
| Local time | **02:00 Australia/Brisbane** (no DST) |
| Auth | Bearer `CRON_SECRET` or `FI_HUBSPOT_INCREMENTAL_BACKUP_CRON_SECRET`, or header `x-fi-hubspot-incremental-backup-secret` |
| Kill switch | `FI_HUBSPOT_INCREMENTAL_BACKUP_ENABLED=true` required |
| Tenant/integration | `FI_HUBSPOT_INCREMENTAL_BACKUP_TENANT_ID` / `FI_HUBSPOT_INCREMENTAL_BACKUP_INTEGRATION_ID` (defaults: Evolved) |

Why Vercel Cron: production-managed, independent of developer laptops/TLS, uses deployment env secrets, already used for LeadFlow/reminders/Financial OS.

### Scheduled cutoff contract

- `cutoff-from` = current verified notes watermark
- `cutoff-to` = frozen scheduler invocation timestamp (immutable for the run)
- Lower inclusive / upper exclusive
- Refuses to run without a watermark (no full-history fallback)
- Empty successful range advances watermark and is GREEN

## Incremental command (manual fixed range)

```bash
npm run hubspot:backup:incremental -- \
  --dataset notes \
  --cutoff-from 2026-07-16T00:00:00.000Z \
  --cutoff-to 2026-07-16T01:00:00.000Z \
  --tenant-id <uuid> \
  --integration-id <uuid>
```

## Scheduled path (same contract as cron)

```bash
# Requires FI_HUBSPOT_INCREMENTAL_BACKUP_ENABLED=true
npm run hubspot:backup:scheduled -- --dataset notes
```

Privacy-safe notification test (no backup / no watermark change):

```bash
npm run hubspot:backup:scheduled -- --notification-test
```

## Cutoff semantics

- Lower bound **inclusive**: `updatedAt >= cutoff_from`
- Upper bound **exclusive**: `updatedAt < cutoff_to`
- Timestamps must include `Z` or a numeric offset; bare local datetimes are rejected
- Values are normalized to UTC ISO-8601
- Equal timestamps are ordered by HubSpot note ID locally (Search allows only one sort: `hs_lastmodifieddate ASC`)

## Resume

```bash
npm run hubspot:backup:resume -- --run-id <uuid>
```

Resume reloads the **immutable** `cutoff_from` / `cutoff_to` from the run row. It never replaces `cutoff_to` with wall-clock time.

## Stuck-run recovery (operator path — not automatic)

**Stale threshold:** 30 minutes (`last_checkpoint_at` / `started_at`).

**Who may recover:** platform operators with `FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID` / recovery CLI access.

**Identify stuck:** `status=started`, age ≥ 30 minutes, no recent checkpoint progress, no overlapping healthy process.

```bash
npm run hubspot:backup:recover-stuck -- \
  --run-id <uuid> \
  --reason "process terminated without finalize" \
  --to failed
```

Then resume if needed:

```bash
npm run hubspot:backup:resume -- --run-id <uuid>
```

- Does **not** advance the watermark
- Does **not** delete checkpoints
- Refuses completed/verified runs
- Prefer **alert → operator review → explicit recovery** (no automatic stuck recovery by default)

## Status meanings

| Status | Watermark |
|--------|-----------|
| `started` | No |
| `completed` + verification `passed` | Advances to `cutoff_to` |
| `partial` / `failed` | No |
| Empty successful range | Advances (treated as verified success) |
| Overlap blocked | No |

## Retry policy (scheduled)

- Transient HubSpot 429/5xx / network: up to **3** attempts with exponential backoff
- Deterministic 4xx / validation / tenant errors: **no** automatic retry loop
- Cutoffs never change across retries
- Partial runs may resume the **same run ID** with immutable cutoffs
- Failed verification does **not** advance the watermark

## Failure notifications

Channel: `fi_admin_notifications` with `source=hubspot_incremental_backup` (FI Admin).

Also: structured logs + `fi_external_connector_verification_events` (`scheduled_invocation`).

Triggered for: partial, failed, verification failure, stuck, overlap, missing credentials, missing watermark, tenant ambiguity, repeated API failure.

Content is privacy-safe (run ID, dataset, tenant, status, cutoffs, counts, error category, timestamp, runbook). **No note bodies.**

## Operator checklist

1. **Inspect notes watermark**

```sql
select tenant_id, dataset, watermark_timestamp, last_verified_run_id, version, updated_at
from fi_external_hubspot_backup_watermarks
where source_system = 'hubspot' and dataset = 'notes';
```

2. **Inspect latest run**

```sql
select id, status, incremental_verification_state, incremental_cutoff_from, incremental_cutoff_to,
       started_at, completed_at, engagement_counters->'notes_incremental' as counters
from fi_external_hubspot_sync_runs
where backup_run_type = 'incremental' and incremental_dataset = 'notes'
order by started_at desc nulls last
limit 5;
```

3. **Manual incremental range** — see Incremental command above  
4. **Resume** — see Resume  
5. **Recover stuck** — see Stuck-run recovery  
6. **Verification events**

```sql
select occurred_at, outcome, detail->>'event' as event, detail
from fi_external_connector_verification_events
where detail->>'verification_mode' = 'incremental_backup'
order by occurred_at desc
limit 50;
```

7. **Confirm no active overlap**

```sql
select count(*) from fi_external_hubspot_sync_runs
where backup_run_type = 'incremental' and incremental_dataset = 'notes' and status = 'started';
```

8. **Disable scheduler** — set Vercel env `FI_HUBSPOT_INCREMENTAL_BACKUP_ENABLED=false` (or remove cron path from `vercel.json` and redeploy)  
9. **Re-enable scheduler** — set `FI_HUBSPOT_INCREMENTAL_BACKUP_ENABLED=true` after health checks  
10. **Validate one canonical note ID**

```sql
select count(*) from fi_external_hubspot_note_staging
where tenant_id = '<tenant>' and integration_id = '<integration>' and hubspot_record_id = '<id>';
```

## Safe same-range rerun

Re-run the identical `--cutoff-from` / `--cutoff-to` after the prior run has left `started`. Upserts use `(tenant_id, integration_id, hubspot_record_id)`. Expect `unchanged`/`updated`, not a second row.

## Concurrency

One active (`status=started`) incremental run per `tenant_id + integration_id + dataset` (`uq_hubspot_incremental_active_run`). Overlap fails closed. Scheduler does not replace the DB constraint.

## Privacy

- Do not log note bodies
- Evidence and CLI JSON omit patient/contact content
- Staging still stores `raw_payload` under existing restricted staging rules (`promotion_enabled: false`)

## Rollback / disable

1. Set `FI_HUBSPOT_INCREMENTAL_BACKUP_ENABLED=false` in Vercel production env  
2. Optionally remove the cron entry from `vercel.json` and redeploy  
3. Do not manually rewind watermarks  
4. Do not delete staging rows or verification history  

Application rollback: redeploy prior SHA without the scheduled route if required.
