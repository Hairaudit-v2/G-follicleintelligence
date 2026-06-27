# Evolved Production Evidence — Cron & Secrets Audit

**Sprint:** FI-PH1 Task 4  
**Blocker:** BLK-SEC-02  
**Audit date:** 2026-06-27  
**Scope:** Vercel cron config, cron route auth, env validation, webhook/cron secret patterns

---

## Executive summary

| Check | Status |
|-------|--------|
| Cron routes implemented with timing-safe auth | **Yes** (code verified) |
| `vercel.json` cron schedules declared | **Yes** (10 jobs) |
| Env validation script passes locally | **Yes** (`pnpm run check:env`) |
| Production env rules unit tests | **Pass** (17/17) |
| Secrets rotation executed | **Not verified** (no rotation log) |
| Production Vercel env values confirmed | **Not verified** (no dashboard access) |
| All documented cron routes scheduled in Vercel | **Partial gap** — see below |

**Verdict:** BLK-SEC-02 **partially validated**. Code posture is strong; **rotation + production cron 200 evidence** still missing.

---

## Safe commands executed

```text
pnpm run check:env                    → PASS
pnpm run check:env:production-rules   → 17/17 PASS
pnpm run typecheck                    → PASS
```

Local `.env.local` passed validation — **does not prove production Vercel env**.

---

## Vercel cron routes (`vercel.json`)

| # | Path | Schedule (UTC) | In repo handler |
|---|------|----------------|-----------------|
| 1 | `/api/cron/fi-reminder-jobs` | `*/5 * * * *` | `app/api/cron/fi-reminder-jobs/route.ts` |
| 2 | `/api/cron/leadflow/process-hubspot-events` | `*/5 * * * *` | `app/api/cron/leadflow/process-hubspot-events/route.ts` |
| 3 | `/api/cron/iiohr-hr-perth-staff-sync` | `0 * * * *` | `app/api/cron/iiohr-hr-perth-staff-sync/route.ts` |
| 4 | `/api/cron/financial-os/automation?job=deposit_overdue` | `0 22 * * *` | `app/api/cron/financial-os/automation/route.ts` |
| 5 | `/api/cron/financial-os/automation?job=balance_due_reminders` | `15 22 * * *` | same |
| 6 | `/api/cron/financial-os/automation?job=failed_payment_recovery` | `30 22 * * *` | same |
| 7 | `/api/cron/financial-os/pathway-task-escalation` | `45 22 * * *` | `app/api/cron/financial-os/pathway-task-escalation/route.ts` |
| 8 | `/api/cron/financial-os/clearance-snapshots?horizonDays=14` | `0 23 * * *` | `app/api/cron/financial-os/clearance-snapshots/route.ts` |
| 9 | `/api/cron/seo-indexnow` | `0 6 * * 1` | `app/api/cron/seo-indexnow/route.ts` |
| 10 | `/api/cron/google-calendar/sync` | `*/15 * * * *` | `app/api/cron/google-calendar/sync/route.ts` |
| 11 | `/api/cron/platform-events/process` | `*/5 * * * *` | `app/api/cron/platform-events/process/route.ts` |

**Evolved-critical:** rows 1–3, 4–8 (FinancialOS automation + clearance for surgery window).

---

## Cron routes NOT in `vercel.json` (gap)

| Endpoint | Documented in | Risk if omitted |
|----------|---------------|-----------------|
| `/api/cron/fi-payments/reminders` | `fi-os-cron-production-audit.md`, Stage 7 runbook | Revenue reminder signals not emitted |
| `/api/cron/fi-photo-protocol-alerts` | `supabase-admin-inventory.md` | Photo protocol alerts not scheduled |

**Note:** FinancialOS automation **is** scheduled; Stage 7F payment reminders are separate and currently **unscheduled** in repo config.

---

## Cron authentication matrix

### Pattern A — `assertCronAuthorized` (503 if no valid secret, 401 if bad token)

Used by: `fi-reminder-jobs`, `iiohr-hr-perth-staff-sync`, `leadflow/process-hubspot-events`, others.

Accepted secrets (examples):

| Route | Env keys (≥16 chars) | Alternate header |
|-------|----------------------|------------------|
| Reminder jobs | `FI_REMINDER_CRON_SECRET`, `CRON_SECRET` | `x-fi-reminder-secret` |
| IIOHR HR sync | `CRON_SECRET`, `FI_HR_SYNC_CRON_SECRET` | — |
| Leadflow HubSpot | `CRON_SECRET`, `FI_LEADFLOW_CRON_SECRET` | `x-fi-leadflow-secret` |

Implementation: `src/lib/server/cronAuth.ts` — timing-safe UTF-8 compare, min length 16.

### Pattern B — `validateCronAuth` (401 only, boolean)

Used by: `financial-os/*`, `fi-payments/reminders`.

Accepted: `CRON_SECRET`, `FINANCIAL_OS_CRON_SECRET`, `FI_PAYMENTS_CRON_SECRET`.

Implementation: `src/lib/security/validateCronAuth.ts`.

**Security note:** When **no** cron secrets are configured, Pattern B returns **401** (not **503**), which slightly differs from Pattern A. Low severity — does not bypass auth.

### Vercel native cron

Vercel injects `Authorization: Bearer <CRON_SECRET>`. Routes must include `CRON_SECRET` in accepted lists — **confirmed** for reminder + HR routes.

---

## Required secrets (production checklist)

From `docs/runbooks/fi-os-production-hardening-master-checklist.md` and `src/lib/env/schema.ts`:

| Secret | Purpose | Validated locally | Rotation verified |
|--------|---------|-------------------|-------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server DB/Storage admin | Present (check:env probe) | **No** |
| `CRON_SECRET` | Vercel cron Bearer | If set, length-validated | **No** |
| `FI_REMINDER_CRON_SECRET` | Reminder processor | Length rule in schema | **No** |
| `FI_HR_SYNC_CRON_SECRET` | HR sync (optional alt) | Length rule | **No** |
| `IIOHR_HR_SYNC_SECRET` | Outbound staff-sync HMAC | Length rule | **No** |
| `FI_LEGACY_FI_API_SECRET` | Legacy machine API (if enabled) | Required only if flag on | N/A if OFF |
| `FI_ADMIN_API_KEY` | Operator API bypass | Min 20 chars if set | **No** |
| `FI_TIMELY_WEBHOOK_SECRET` | Timely webhooks | Min 16 if set | **No** |
| `FI_HUBSPOT_WEBHOOK_SECRET` | HubSpot webhooks | Min 16 if set | **No** |
| `FINANCIAL_OS_CRON_SECRET` | FinancialOS crons | Optional; ≥16 if set | **No** |
| `FI_PAYMENTS_CRON_SECRET` | Payment reminder cron | Optional; ≥16 if set | **No** |
| `FI_GOOGLE_CALENDAR_CRON_SECRET` | GCal sync cron | Min 16 if set | **No** |

**Evolved HR sync dependencies:** `EVOLVED_PERTH_TENANT_ID`, `FI_BASE_URL`, `IIOHR_HR_PERTH_STAFF_FEED_URL`, optional feed key.

---

## Production env guardrails (code)

`validateFiServerEnv` / `assertValidEnv` rejects in production:

- `FI_ALLOW_INSECURE_API`, `FI_ALLOW_ADMIN_KEY_QUERY`, `FI_ENABLE_DEV_ADMIN_ACCESS`, `SKIP_ENV_VALIDATION`
- Short cron/webhook secrets when set
- `FI_LEGACY_FI_API_ENABLED` without ≥16 char `FI_LEGACY_FI_API_SECRET`
- Live reminders without Resend vars

Unit tests: `src/lib/env/fiEnv.server.test.ts` — **all pass**.

---

## Webhook secret validation (spot check)

| Surface | Auth mechanism | Min secret |
|---------|----------------|------------|
| Stripe | `readStripeWebhookSecret()` in webhook handler | Env-specific |
| Timely | Documented ≥16 chars | 16 |
| HubSpot leadflow | Dedicated cron + webhook secrets | 16 |
| Legacy `/api/fi/*` machine | Bearer + feature flag (default off) | 16 when enabled |

Smoke script: `pnpm run smoke:prod` (requires `FI_BASE_URL`, optional secrets) — **not run against production** in Task 4.

---

## Security concerns

1. **Rotation not evidenced** — checklist item explicitly open.
2. **Dual reminder processors** — Supabase Edge `fi-reminder-processor` vs Next cron; only one should send (`fi-os-cron-production-audit.md`).
3. **HR cron self-HTTP** — depends on `FI_BASE_URL` DNS/TLS; misconfig → stale `fi_staff`.
4. **Public health endpoint** — `GET /api/health/iiohr-hr-staff-sync` unauthenticated (aggregates only); acceptable but monitor abuse.
5. **Missing fi-payments cron schedule** — revenue automation gap if Stripe/invoices enabled later.

---

## Remediation required (P0)

1. **Vercel production env:** Confirm `CRON_SECRET` (≥16), `FI_REMINDER_CRON_SECRET` (aligned or same), `EVOLVED_PERTH_TENANT_ID`, IIOHR chain — screenshot/redacted export for change log.
2. **Rotate** service role + cron + integration secrets per checklist; record dates in sprint change log.
3. **Post-deploy cron proof:** Vercel → Cron Jobs → verify last **200** for reminder + HR + financial-os jobs.
4. **Run** `pnpm run smoke:prod` against production URL with ops secrets (wrong-secret 401 checks).
5. **Decide** on `/api/cron/fi-payments/reminders?dryRun=1` schedule before Stripe go-live.
6. **Confirm** single active reminder worker (disable Edge delegator if using Vercel cron).

---

## BLK-SEC-02 disposition

| Field | Value |
|-------|-------|
| Validated | Yes — code auth strong; ops evidence missing |
| Resolved automatically | **No** |
| Still blocking production | **Yes** (rotation + cron 200 logs) |
| Task 5 disposition | **Still blocking** — operator checklist §4–5; rotation log pending |

---

## Evidence Closure Checklist

| # | Evidence item | Artifact placeholder | Owner | Target date | Status |
|---|---------------|----------------------|-------|-------------|--------|
| E1 | Production `CRON_SECRET` confirmed (≥16 chars) | Redacted Vercel export | Platform / infra | | ☐ |
| E2 | `FI_REMINDER_CRON_SECRET` aligned with cron auth | Redacted Vercel export | Platform / infra | | ☐ |
| E3 | Secret rotation log (service role, cron, webhooks) | Change log with dates | Security | | ☐ |
| E4 | Cron 200 — fi-reminder-jobs | `attachments/blk-sec-02-cron-reminder-<date>` | Platform / infra | | ☐ |
| E5 | Cron 200 — iiohr-hr-perth-staff-sync | `attachments/blk-sec-02-cron-hr-<date>` | Platform / infra | | ☐ |
| E6 | Cron 200 — financial-os automation + clearance-snapshots | `attachments/blk-sec-02-cron-financial-<date>` | Platform / infra | | ☐ |
| E7 | `pnpm run smoke:prod` against production | `attachments/smoke-prod-<date>.txt` | Platform / infra | | ☐ |
| E8 | Single reminder worker confirmed (Edge vs Vercel) | Note in this doc | Platform / infra | | ☐ |
| E9 | Decision on `/api/cron/fi-payments/reminders` schedule | Row below | Product / platform | | ☐ |

### Secret rotation log (template)

| Secret | Rotated (Y/N) | Date (UTC) | Operator | Ticket ref |
|--------|---------------|------------|----------|------------|
| `CRON_SECRET` | | | | |
| `SUPABASE_SERVICE_ROLE_KEY` | | | | |
| `FI_REMINDER_CRON_SECRET` | | | | |
| `IIOHR_HR_SYNC_SECRET` | | | | |

**Closure rule:** BLK-SEC-02 → **Complete** when E1–E8 Complete; E9 may be **Accepted risk** if Stripe invoices not live at go-live.
