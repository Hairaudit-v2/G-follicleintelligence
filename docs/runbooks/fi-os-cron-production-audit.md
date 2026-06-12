# FI OS — Cron jobs production audit

**Scope:** `app/api/cron/**`, scheduled HR sync implementation, reminder processor (2026-06-12).  
**Vercel:** Root **`vercel.json`** declares production cron paths and UTC schedules. Override or supplement in **Vercel Dashboard → Cron Jobs** if needed. See [`fi-os-production-env-and-cron.md`](fi-os-production-env-and-cron.md).

---

## Summary table

| Endpoint | Methods | Schedule (expected) | Secret | Feature / module | Idempotency | Safe to run twice? | Failure behaviour | Logging / retries |
|----------|---------|------------------------|--------|-------------------|-------------|--------------------|-------------------|-------------------|
| `/api/cron/fi-reminder-jobs` | `POST`, `GET` | Every **1–5 minutes** (ops recommendation in platform doc) | `FI_REMINDER_CRON_SECRET` (Bearer or `x-fi-reminder-secret`) | ReminderOS — `processReminderJobsOnce` | **Yes** — job claim uses `pending` → `processing` conditional update | **Yes** — duplicate cron may claim different jobs; same job not double-sent if claim fails | Returns **503** if secret missing/short (generic body); **401** bad secret; **500** processor error uses generic `Processor unavailable.` (no stack traces) | Processor: **1 retry** on failure (`attempt_count`); ineligible → `cancelled`; see `reminderProcessor.server.ts` |
| `/api/cron/iiohr-hr-perth-staff-sync` | `GET`, `POST` | **Hourly** in `vercel.json` (adjust to daily early AM if preferred) | `CRON_SECRET` or `FI_HR_SYNC_CRON_SECRET` (Bearer) | HR → FI staff sync (Evolved Perth) | **Partial** — each run creates `fi_staff_sync_runs`; POST to staff-sync is **commit** | **Mostly** — second run starts new sync; may race if overlapping (wall timeout **55s**) | **503** no valid-length cron secret configured, or bad `EVOLVED_PERTH_TENANT_ID` (generic where applicable); **401** bad secret; **200/400/504** per `runScheduled` outcome | Timeout → **504**; `maybeStaffSyncAlertAfterCronRun` for alert intent; no email send yet |
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
| Required env | At least one of **`CRON_SECRET`** or **`FI_HR_SYNC_CRON_SECRET`** (≥16 chars), **`EVOLVED_PERTH_TENANT_ID`** (UUID), plus outbound chain per [`docs/iiohr-hr-perth-staff-sync-cron.md`](../iiohr-hr-perth-staff-sync-cron.md): `FI_BASE_URL` (site root), `IIOHR_HR_SYNC_SECRET`, `IIOHR_HR_PERTH_STAFF_FEED_URL`, optional `IIOHR_HR_PERTH_STAFF_FEED_KEY`, `ALLOW_EMPTY_HR_SYNC` |
| Vercel cron | **Compatible** — Vercel invokes **GET**; route accepts **GET** and **POST** with the same Bearer auth |
| Overlap | `Promise.race` with 55s timeout — overlapping invocations possible under misconfiguration |

---

## Other scheduled-ish surfaces (not `/api/cron`)

| Surface | Notes |
|---------|------|
| Supabase Edge Functions | `supabase/functions/fi-reminder-processor/README.md` documents delegating to Next cron — align **single active processor** to avoid duplicate sends |
| In-app “tick” | `tick-jobs` is authenticated pipeline drain, not a cron secret route |

---

## Vercel cron matrix (operational)

| Endpoint | Method | Schedule (typical) | Secret env | Auth header(s) | **200** | **401** | **503** | Notes |
|----------|--------|-------------------|------------|----------------|---------|---------|---------|--------|
| `/api/cron/fi-reminder-jobs` | **GET** or **POST** | Every **5 minutes** (`vercel.json`) | `FI_REMINDER_CRON_SECRET` and/or `CRON_SECRET` (≥16 chars) | `Authorization: Bearer <secret>` **or** `x-fi-reminder-secret: <secret>` | Jobs drained (JSON includes processor fields) | Bearer / header missing or wrong (timing-safe compare) | No valid-length secret in configured list | **Only one** active reminder worker (Next cron **or** Supabase Edge delegator — not both sending duplicate traffic). |
| `/api/cron/iiohr-hr-perth-staff-sync` | **GET** or **POST** | **Hourly** in `vercel.json` (ops may prefer daily) | `CRON_SECRET` and/or `FI_HR_SYNC_CRON_SECRET` | `Authorization: Bearer <secret>` | Scheduled sync finished (see `rowsSent`, `runId`, etc.) | Bearer missing or wrong | No valid-length cron secret, or `EVOLVED_PERTH_TENANT_ID` missing/invalid UUID, or other preflight misconfig | Wall timeout **55s** → **504**; Vercel Cron uses **GET**. |

**Smoke test (no mutations):** `pnpm run smoke:prod` with `FI_BASE_URL` + `FI_SMOKE_TENANT_ID` (see `scripts/fi-production-smoke-test.ts`).

---

## Vercel compatibility checklist

- [ ] Reminder job: `GET` or `POST` with `Authorization: Bearer ...` (or `x-fi-reminder-secret`). For **native Vercel Cron**, include the same **`CRON_SECRET`** value in the accepted list **or** set `FI_REMINDER_CRON_SECRET` equal to `CRON_SECRET` in the dashboard (Vercel only injects **`CRON_SECRET`** into the `Authorization` header).
- [ ] HR job: **`GET` or `POST`** with Bearer `CRON_SECRET` or `FI_HR_SYNC_CRON_SECRET`
- [ ] Set env vars on the **same** Vercel environment that receives cron traffic
- [ ] Ensure route **does not** require geo blocking that breaks Vercel’s cron egress IPs

---

## Risks

| Level | Topic |
|-------|-------|
| **High** | Reminder cron **without** rotation / monitoring — duplicate or stolen `FI_REMINDER_CRON_SECRET` allows mass send |
| **Medium** | HR cron depends on **self-HTTP** to `FI_BASE_URL` — DNS / TLS misconfig causes silent failures |
| **Low** | `tick-jobs` mistaken for cron — exposes pipeline if `FI_ADMIN_API_KEY` leaks |
