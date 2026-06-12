# FI OS — Cron jobs production audit

**Scope:** `app/api/cron/**`, scheduled HR sync implementation, reminder processor (2026-06-12).  
**Vercel:** Repo has **no `vercel.json`** — schedules must be configured in **Vercel Dashboard → Cron Jobs** or external scheduler (see [`docs/FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md`](../FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md)).

---

## Summary table

| Endpoint | Methods | Schedule (expected) | Secret | Feature / module | Idempotency | Safe to run twice? | Failure behaviour | Logging / retries |
|----------|---------|------------------------|--------|-------------------|-------------|--------------------|-------------------|-------------------|
| `/api/cron/fi-reminder-jobs` | `POST`, `GET` | Every **1–5 minutes** (ops recommendation in platform doc) | `FI_REMINDER_CRON_SECRET` (Bearer or `x-fi-reminder-secret`) | ReminderOS — `processReminderJobsOnce` | **Yes** — job claim uses `pending` → `processing` conditional update | **Yes** — duplicate cron may claim different jobs; same job not double-sent if claim fails | Returns **503** if secret missing/short; **401** bad secret; **500** processor error JSON `{ ok:false, error }` | Processor: **1 retry** on failure (`attempt_count`); ineligible → `cancelled`; see `reminderProcessor.server.ts` |
| `/api/cron/iiohr-hr-perth-staff-sync` | `POST` only (`GET` → 405) | **Daily** early AM (Brisbane) per runbook | `CRON_SECRET` (Bearer) | HR → FI staff sync (Evolved Perth) | **Partial** — each run creates `fi_staff_sync_runs`; POST to staff-sync is **commit** | **Mostly** — second run starts new sync; may race if overlapping (wall timeout **55s**) | **503** missing `CRON_SECRET`, `EVOLVED_PERTH_TENANT_ID`, etc.; **401** bad secret; **200/400/504** per `runScheduled` outcome | Timeout → **504**; `maybeStaffSyncAlertAfterCronRun` for alert intent; no email send yet |
| `/api/tenants/[tenantId]/tick-jobs` | `POST` | **Not a Vercel cron route** — on-demand / external if wired | `FI_ADMIN_API_KEY` **or** CRM session (`assertCrmTenantWriteAllowed`) | LeadFlow pipeline / `runPipeline` | **Yes** — locking in job runner (`getQueuedJobs` + pipeline) | **Yes** with same limits | `mapCrmRouteError` → structured JSON | Per-job results in response array |

---

## `/api/cron/fi-reminder-jobs`

| Item | Detail |
|------|--------|
| File | `app/api/cron/fi-reminder-jobs/route.ts` |
| Dynamic | `force-dynamic` |
| Vercel cron | **Compatible** — supports `GET` (Vercel often issues GET) |
| Secret min length | **16** characters |
| Downstream env | Resend/Twilio keys for live send; `FI_REMINDERS_LIVE_DELIVERY` gates actual provider calls |
| Double-run | Concurrent crons compete for `pending` rows — acceptable |

---

## `/api/cron/iiohr-hr-perth-staff-sync`

| Item | Detail |
|------|--------|
| File | `app/api/cron/iiohr-hr-perth-staff-sync/route.ts` |
| Handler core | `src/lib/hr/iiohrHrPerthStaffSyncCron.ts` |
| Required env | `CRON_SECRET`, `EVOLVED_PERTH_TENANT_ID` (UUID), plus outbound chain per [`docs/iiohr-hr-perth-staff-sync-cron.md`](../iiohr-hr-perth-staff-sync-cron.md): `FI_BASE_URL`, `IIOHR_HR_SYNC_SECRET`, `IIOHR_HR_PERTH_STAFF_FEED_URL`, optional `IIOHR_HR_PERTH_STAFF_FEED_KEY`, `ALLOW_EMPTY_HR_SYNC` |
| Vercel cron | **Compatible** — `POST` only: Vercel Cron must use **POST** (supported on Vercel; confirm project setting) **or** use external scheduler |
| Overlap | `Promise.race` with 55s timeout — overlapping invocations possible under misconfiguration |

---

## Other scheduled-ish surfaces (not `/api/cron`)

| Surface | Notes |
|---------|------|
| Supabase Edge Functions | `supabase/functions/fi-reminder-processor/README.md` documents delegating to Next cron — align **single active processor** to avoid duplicate sends |
| In-app “tick” | `tick-jobs` is authenticated pipeline drain, not a cron secret route |

---

## Vercel compatibility checklist

- [ ] Create **two** cron jobs if both processors enabled — different secrets (`FI_REMINDER_CRON_SECRET` vs `CRON_SECRET`)
- [ ] Reminder job: `GET` or `POST` with `Authorization: Bearer ...`
- [ ] HR job: **`POST`** required
- [ ] Set env vars on the **same** Vercel environment that receives cron traffic
- [ ] Ensure route **does not** require geo blocking that breaks Vercel’s cron egress IPs

---

## Risks

| Level | Topic |
|-------|-------|
| **High** | Reminder cron **without** rotation / monitoring — duplicate or stolen `FI_REMINDER_CRON_SECRET` allows mass send |
| **Medium** | HR cron depends on **self-HTTP** to `FI_BASE_URL` — DNS / TLS misconfig causes silent failures |
| **Low** | `tick-jobs` mistaken for cron — exposes pipeline if `FI_ADMIN_API_KEY` leaks |
