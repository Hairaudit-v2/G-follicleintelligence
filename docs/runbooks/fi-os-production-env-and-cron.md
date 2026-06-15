# FI OS — production environment variables and cron jobs

This runbook covers **Vercel-hosted Next.js (App Router)** for Follicle Intelligence OS: which environment variables belong where, how cron routes authenticate, and what is **not** implemented yet.

**Security:** Never expose service keys to the browser. Only variables prefixed with `NEXT_PUBLIC_` are shipped to clients. Cron and webhook secrets are **server-only**.

**Shared auth helper:** `src/lib/server/cronAuth.ts` — `assertCronAuthorized` (Bearer + optional `x-fi-reminder-secret` for reminders) and `getRequiredEnv`.

---

## Cron routes that exist today

| Path | Methods | Auth (server) | Purpose |
|------|---------|---------------|---------|
| `/api/cron/fi-reminder-jobs` | `GET`, `POST` | Bearer matches **`FI_REMINDER_CRON_SECRET`** or **`CRON_SECRET`**; or **`x-fi-reminder-secret`** (same values, timing-safe) | Drain `fi_reminder_jobs` via `processReminderJobsOnce` |
| `/api/cron/iiohr-hr-perth-staff-sync` | `GET`, `POST` | Bearer matches **`CRON_SECRET`** or **`FI_HR_SYNC_CRON_SECRET`** | Evolved Perth HR → FI staff sync (see `docs/iiohr-hr-perth-staff-sync-cron.md`) |

**Vercel Cron behaviour:** Schedules in root `vercel.json` trigger **HTTP GET** with `Authorization: Bearer <CRON_SECRET>` when the **`CRON_SECRET`** environment variable is set in the Vercel project. Both cron handlers therefore accept **`CRON_SECRET`** as an alternate valid Bearer for the reminder route, so one Vercel secret can authorize scheduled calls if you choose. You may instead set **`FI_REMINDER_CRON_SECRET`** equal to **`CRON_SECRET`** in the dashboard for clarity.

**Not implemented (no `app/api/cron/...` route):** `/api/cron/timely-sync`, `/api/cron/hubspot-sync`, `/api/cron/analytics-rebuild`, `/api/cron/system-cleanup`, `/api/cron/hr-sync` (HR uses **`iiohr-hr-perth-staff-sync`**). HubSpot import remains **CLI/scripts** (`package.json` `hubspot:*`). Timely ingestion is **webhook-driven** under `/api/tenants/[tenantId]/integrations/timely/*`.

---

## `vercel.json` (repository)

Production crons declared at repo root:

- `/api/cron/fi-reminder-jobs` — `*/5 * * * *` (every 5 minutes, UTC)
- `/api/cron/iiohr-hr-perth-staff-sync` — `0 * * * *` (hourly, UTC)

Change schedules in `vercel.json` and redeploy. For HR, many operators prefer **daily** early morning (tenant timezone) instead of hourly — adjust the cron expression accordingly.

---

## Required Vercel env vars (typical production)

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** — never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | Optional; canonical site URL for links / auth redirects |
| `CRON_SECRET` | **Recommended** for Vercel Cron — min **16** chars; sent as Bearer on cron GETs |
| `FI_REMINDER_CRON_SECRET` | Optional if you reuse `CRON_SECRET` for reminders; min **16** chars when set |
| `FI_HR_SYNC_CRON_SECRET` | Optional alternate Bearer for HR cron only; min **16** chars when set |
| `FI_BASE_URL` | **Site root** `https://your-deployment.example` (no `/fi-admin`); used for HR self-POST and smoke scripts |
| `EVOLVED_PERTH_TENANT_ID` | UUID — HR cron tenant target |
| `IIOHR_HR_SYNC_SECRET` | Staff-sync API secret (`x-iiohr-sync-secret`); must match inbound route config |
| `IIOHR_HR_PERTH_STAFF_FEED_URL` | HR JSON feed URL for scheduled sync |
| `IIOHR_HR_PERTH_STAFF_FEED_KEY` | Optional Bearer for feed fetch |
| `FI_ADMIN_API_KEY` | **Server-only** — operator bypass for selected tenant APIs and admin actions |
| `FI_TIMELY_WEBHOOK_SECRET` | Timely/Zapier webhooks — min **16** chars when webhooks used |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `RESEND_REPLY_TO` | When live reminder email is enabled (`FI_REMINDERS_LIVE_DELIVERY`) **or** when using in-app Resend features (pathology patient email, pharmacy email). See **`docs/runbooks/resend-and-transactional-email.md`**. |
| `OPENAI_API_KEY`, `OPENAI_CLINICAL_NOTE_MODEL` | DoctorOS / clinical note flows when used |
| `FI_HUBSPOT_IMPORT_TENANT_ID`, `FI_HUBSPOT_IMPORT_CONFIRM` | **Scripts / CI** for HubSpot import batches (not a cron route today) |

**Preview deployments:** Mirror production secrets only where safe; use separate Supabase projects or restricted keys for preview when possible.

---

## Required Supabase (database + Edge)

| Concern | Notes |
|---------|--------|
| Migrations | Apply via Supabase CLI / CI per repo `supabase/migrations` |
| `SUPABASE_SERVICE_ROLE_KEY` | Lives on Vercel **server** env for Next API routes and cron handlers that use the service role |
| Edge functions | If `supabase/functions/fi-reminder-processor` delegates to Next cron, ensure **one** active sender path to avoid duplicate reminder delivery |

---

## Resend (reminders)

See **`docs/runbooks/resend-and-transactional-email.md`** for application Resend vs Supabase Auth invite mail, verified domains, and failure logging.

| Variable | When required |
|----------|----------------|
| `RESEND_API_KEY` | Live email send via this app’s Resend integration (see runbook). **Production gate:** required when `FI_REMINDERS_LIVE_DELIVERY` is truthy (`validateFiServerEnv` in `src/lib/env/fiEnv.server.ts`). |
| `RESEND_FROM_EMAIL` | Verified sender domain on Resend |
| `RESEND_FROM_NAME` | Display name (optional) |
| `RESEND_REPLY_TO` | Optional `Reply-To` for Resend sends from this app |

---

## OpenAI

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Server-only API access |
| `OPENAI_CLINICAL_NOTE_MODEL` | Model id for clinical note generation when configured |

---

## Timely (Zapier / integrations)

| Variable | Purpose |
|----------|---------|
| `FI_TIMELY_WEBHOOK_SECRET` | `Authorization: Bearer` on `POST /api/tenants/[tenantId]/integrations/timely/*` |

There is **no** first-party Timely polling cron route in this repo.

---

## IIOHR HR sync

| Variable | Purpose |
|----------|---------|
| `IIOHR_HR_SYNC_SECRET` | Inbound staff-sync POST authentication |
| `IIOHR_HR_PERTH_STAFF_FEED_URL` | Outbound HR feed URL (cron + manual tools) |
| `IIOHR_HR_PERTH_STAFF_FEED_KEY` | Optional feed auth |
| `ALLOW_EMPTY_HR_SYNC` | `true` to allow no-op when feed empty |
| `CRON_SECRET` / `FI_HR_SYNC_CRON_SECRET` | Cron Bearer for `/api/cron/iiohr-hr-perth-staff-sync` |

---

## HubSpot

| Variable | Purpose |
|----------|---------|
| `FI_HUBSPOT_IMPORT_TENANT_ID` | Target tenant UUID for import scripts |
| `FI_HUBSPOT_IMPORT_CONFIRM` | `1` required for commit mode in scripts |

HubSpot CRM surface also uses normal app Supabase + session gates; there is **no** HubSpot sync cron route in this repository.

---

## Local-only vs Vercel

| Typical local-only | Must be on Vercel production/preview when used |
|--------------------|-----------------------------------------------|
| `FI_ENABLE_DEV_ADMIN_ACCESS` (non-production behaviour) | All `NEXT_PUBLIC_*` and server secrets required for the feature on that deploy |
| `FI_ALLOW_ADMIN_KEY_QUERY`, `FI_ALLOW_INSECURE_API` (blocked in prod validation) | `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `FI_ADMIN_API_KEY`, webhook secrets, `FI_BASE_URL` |

`.env.local` is never committed; use **`.env.example`** as the template.

---

## Key rotation and incidents

If any cron, webhook, or admin key was **pasted in chat, logged, or committed**, **rotate it immediately** in Vercel and any upstream systems (HubSpot private apps, HR feed keys, Resend, OpenAI, Supabase service role if exposed).

---

## Manual checklist after deploy

1. Set **`CRON_SECRET`** in Vercel (min 16 characters).
2. Confirm **`FI_BASE_URL`** is the **origin only** (no `/fi-admin`).
3. Open Vercel → Cron → confirm last run status and HTTP **200** (or expected 4xx for misconfiguration).
4. Run `pnpm run smoke:prod` with `FI_BASE_URL` + `FI_SMOKE_TENANT_ID` from a secure workstation.

---

## Related docs

- [`fi-os-cron-production-audit.md`](fi-os-cron-production-audit.md) — route-level audit table
- [`fi-os-env-vars-production-audit.md`](fi-os-env-vars-production-audit.md) — broader env audit
- [`../iiohr-hr-perth-staff-sync-cron.md`](../iiohr-hr-perth-staff-sync-cron.md) — HR cron detail
