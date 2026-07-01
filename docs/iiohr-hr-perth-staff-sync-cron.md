# IIOHR HR Perth → FI scheduled staff sync (cron)

Evolved Hair Restoration Perth staff are read from the IIOHR HR JSON feed and pushed into Follicle Intelligence using the existing `POST /api/tenants/[tenantId]/integrations/iiohr-hr/staff-sync` endpoint (commit). Runs are audited in `fi_staff_sync_runs`; scheduled runs set `metadata.trigger` to `cron`.

## Endpoint

- **URL:** `GET` or `POST /api/cron/iiohr-hr-perth-staff-sync` (Vercel Cron invokes **GET** with `Authorization: Bearer`.)
- **Auth:** `Authorization: Bearer` with `CRON_SECRET` or `FI_HR_SYNC_CRON_SECRET` (minimum **16** characters, trimmed; timing-safe compare).

## Required environment variables

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Bearer token for cron auth when using Vercel Cron or a single shared secret (**minimum 16 characters**). |
| `FI_HR_SYNC_CRON_SECRET` | Optional second accepted Bearer value (e.g. dedicated HR scheduler secret). If unset, only `CRON_SECRET` is used. |
| `EVOLVED_PERTH_TENANT_ID` | UUID of the Evolved Perth FI tenant receiving the sync. |
| `FI_BASE_URL` | Absolute **site root** URL of this FI deployment (no `/fi-admin` suffix). Used by the outbound client to POST to `/api/tenants/.../staff-sync`. |
| `IIOHR_HR_SYNC_SECRET` | Must match the FI staff-sync API secret (`x-iiohr-sync-secret`). |
| `IIOHR_HR_PERTH_STAFF_FEED_URL` | GET URL returning Perth HR staff JSON (`staff`, `rows`, or array). Use `https://www.iiohr.com/api/hr/evolved-perth/staff-feed` — **not** bare `https://iiohr.com/...` (307 redirect strips Bearer). Readiness fields optional per row (see runbook). |

## Optional environment variables

| Variable | Purpose |
|----------|---------|
| `IIOHR_HR_PERTH_STAFF_FEED_KEY` | If set, sent as `Authorization: Bearer` when fetching the HR feed. |
| `ALLOW_EMPTY_HR_SYNC` | When `true`, an empty HR feed returns success with zero rows and **does not** call the staff-sync API (non-empty rows are still required by the API). |
| `STAFF_SYNC_STALE_WARNING_HOURS` | Hours without a successful **cron** staff sync before staleness / admin warnings (default `48`). |
| `STAFF_SYNC_ALERT_EMAIL` | If set, cron logs **alert intent** after failed or degraded runs (placeholder; email not sent yet). See `docs/runbooks/iiohr-hr-staff-sync.md`. |

## Health JSON

- **GET** `/api/health/iiohr-hr-staff-sync` — aggregate cron health from `fi_staff_sync_runs` (no secrets).

## Runbook

- **`docs/runbooks/iiohr-hr-staff-sync.md`** — manual sync, cron curl, reading runs, rollback, disabling cron.

## Safety

- Empty feed: sync is **blocked** unless `ALLOW_EMPTY_HR_SYNC=true` (then no-op success, no POST with empty `rows`).
- Responses do not include stack traces or shared secrets.
- Overall wall timeout for the cron handler is 55 seconds (feed fetch + FI POST).

## Vercel / external scheduler

Configure a scheduled job to `POST` the cron URL with the `Authorization: Bearer` header. Ensure all required env vars are set in the deployment that runs the job.
