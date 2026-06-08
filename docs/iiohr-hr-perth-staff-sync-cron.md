# IIOHR HR Perth → FI scheduled staff sync (cron)

Evolved Hair Restoration Perth staff are read from the IIOHR HR JSON feed and pushed into Follicle Intelligence using the existing `POST /api/tenants/[tenantId]/integrations/iiohr-hr/staff-sync` endpoint (commit). Runs are audited in `fi_staff_sync_runs`; scheduled runs set `metadata.trigger` to `cron`.

## Endpoint

- **URL:** `POST /api/cron/iiohr-hr-perth-staff-sync`
- **Auth:** `Authorization: Bearer <CRON_SECRET>` (same pattern as other FI cron routes).

## Required environment variables

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Bearer token for cron auth (**minimum 16 characters**, same pattern as `FI_REMINDER_CRON_SECRET`). |
| `EVOLVED_PERTH_TENANT_ID` | UUID of the Evolved Perth FI tenant receiving the sync. |
| `FI_BASE_URL` | Absolute base URL of this FI deployment (used by the outbound client to POST to itself or another FI host). |
| `IIOHR_HR_SYNC_SECRET` | Must match the FI staff-sync API secret (`x-iiohr-sync-secret`). |
| `IIOHR_HR_PERTH_STAFF_FEED_URL` | GET URL returning Perth HR staff JSON (`staff`, `rows`, or array). |

## Optional environment variables

| Variable | Purpose |
|----------|---------|
| `IIOHR_HR_PERTH_STAFF_FEED_KEY` | If set, sent as `Authorization: Bearer` when fetching the HR feed. |
| `ALLOW_EMPTY_HR_SYNC` | When `true`, an empty HR feed returns success with zero rows and **does not** call the staff-sync API (non-empty rows are still required by the API). |
| `STAFF_SYNC_STALE_WARNING_HOURS` | Hours without a successful run before the HR Staff Import page shows a stale warning (default `48`). |

## Safety

- Empty feed: sync is **blocked** unless `ALLOW_EMPTY_HR_SYNC=true` (then no-op success, no POST with empty `rows`).
- Responses do not include stack traces or shared secrets.
- Overall wall timeout for the cron handler is 55 seconds (feed fetch + FI POST).

## Vercel / external scheduler

Configure a scheduled job to `POST` the cron URL with the `Authorization: Bearer` header. Ensure all required env vars are set in the deployment that runs the job.
