# Runbook: IIOHR HR → Follicle Intelligence staff sync

Operational guide for the Evolved Perth HR feed → FI staff pipeline (manual outbound, scheduled cron, and the FI `staff-sync` API). For **production go-live**, use **`docs/runbooks/iiohr-hr-staff-sync-production-activation.md`**.

## Scope

- **HR remains the system of record** for contracts, letters, payroll, and full training history.
- FI stores **operational staff** (`fi_staff`, `fi_users`, `fi_staff_source_ids` with `iiohr_hr`) plus a **bounded** `metadata_snapshot` on source ids.
- **Audit:** `fi_staff_sync_runs` records each API/cron execution (counts, status, optional `metadata.trigger` for cron).

## Required environment variables

| Variable | Used by |
|----------|---------|
| `EVOLVED_PERTH_TENANT_ID` | Cron, health endpoint, outbound push target, admin automation hints. |
| `IIOHR_HR_PERTH_STAFF_FEED_URL` | Outbound mapper feed (GET JSON). Optional `IIOHR_HR_PERTH_STAFF_FEED_KEY` (Bearer). |
| `FI_BASE_URL` | Outbound POST base for the FI deployment. |
| `IIOHR_HR_SYNC_SECRET` | Authenticates `POST /api/tenants/[tenantId]/integrations/iiohr-hr/staff-sync` (`x-iiohr-sync-secret`). |
| `CRON_SECRET` | Bearer auth for `POST /api/cron/iiohr-hr-perth-staff-sync` (min 16 chars). |

Optional:

| Variable | Purpose |
|----------|---------|
| `ALLOW_EMPTY_HR_SYNC` | When `true`, cron may no-op if the HR feed returns zero rows (no empty POST to FI). |
| `STAFF_SYNC_STALE_WARNING_HOURS` | Staleness threshold for cron health + admin banner (default `48`). |
| `STAFF_SYNC_ALERT_EMAIL` | If set, cron posts log **alert intent** to stdout (placeholder until email is wired; value is never logged). |

See also: `docs/iiohr-hr-perth-staff-sync-cron.md`.

## Health check

- **GET** `/api/health/iiohr-hr-staff-sync`
- Returns JSON: `ok`, `last_success_at`, `last_cron_run_at`, `stale`, `stale_warning_hours`, `last_error`, `recent_failure_count` (derived from `fi_staff_sync_runs` for `EVOLVED_PERTH_TENANT_ID`).
- Intended for monitors; response contains **no secrets**.

## Manual sync (FI Admin)

1. Open **`/fi-admin/[tenantId]/hr/staff-import`** (tenant must match `EVOLVED_PERTH_TENANT_ID` for cron-focused banners).
2. Use **Preview FI staff sync** then **Push FI staff sync** (commit uses `confirm: true` server-side).
3. Review **Automation status** and the **cron health** banner (success / warning / danger).

## Manual cron trigger

```bash
curl -sS -X POST "https://<your-fi-host>/api/cron/iiohr-hr-perth-staff-sync" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
```

Expect JSON with `ok`, `rowsSent`, `runId`, rollup counts, and `warnings`. HTTP **400** if the feed is empty and `ALLOW_EMPTY_HR_SYNC` is not enabled.

## Reading sync runs

- **Admin UI:** Staff import page → **Recent IIOHR HR API sync runs** table (last five for the tenant).
- **Database:** `SELECT * FROM fi_staff_sync_runs WHERE tenant_id = '<uuid>' AND source_system = 'iiohr_hr' ORDER BY started_at DESC LIMIT 20;`
- Cron-tagged rows: `metadata->>'trigger' = 'cron'`.

## Common errors

| Symptom | Likely cause |
|---------|----------------|
| `401` on cron | Wrong or missing `Authorization: Bearer` vs `CRON_SECRET`. |
| `503` on cron | `CRON_SECRET` / `EVOLVED_PERTH_TENANT_ID` missing or invalid. |
| `400` “refusing sync” | Empty HR feed and `ALLOW_EMPTY_HR_SYNC` not `true`. |
| `FI_BASE_URL` / sync secret errors | Outbound env missing or mismatch with FI `IIOHR_HR_SYNC_SECRET`. |
| Feed fetch errors | `IIOHR_HR_PERTH_STAFF_FEED_URL` down, TLS, or `IIOHR_HR_PERTH_STAFF_FEED_KEY` wrong. |
| FI `ok: false` in JSON | Validation/planner failure; see `fi_staff_sync_runs.error_message` for that run. |

## Rollback

1. **Stop writes:** disable the external scheduler calling the cron URL (or revoke `CRON_SECRET` and rotate).
2. **Disable outbound:** unset `IIOHR_HR_PERTH_STAFF_FEED_URL` or `FI_BASE_URL` on the host that runs outbound/cron so jobs fail fast without partial pushes.
3. **Data:** FI does not automatically roll back staff rows from a bad sync. Use tenant admin tools / SQL (with care) to correct `fi_staff`, `fi_users`, and `fi_staff_source_ids` for affected people; keep an audit trail.

## Disable cron safely

1. Remove or pause the schedule in Vercel / k8s / pg_cron so **POST** is no longer sent.
2. Optionally unset `CRON_SECRET` so accidental calls return **503**.
3. Leave `IIOHR_HR_SYNC_SECRET` and the staff-sync API enabled if other producers (IIOHR HR API) must still push.

## Alert placeholder

When `STAFF_SYNC_ALERT_EMAIL` is set, failed cron runs or post-success **stale/degraded** health may emit `console.info` lines tagged `[staff_sync_alert_intent]`. Wire to Resend (or similar) in a follow-up change; do not log the email address or API secrets.
