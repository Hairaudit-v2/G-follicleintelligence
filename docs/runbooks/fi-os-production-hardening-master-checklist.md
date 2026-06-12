# FI OS — Production hardening master checklist

**Purpose:** Single entry point after module audits ([env](fi-os-env-vars-production-audit.md), [auth](fi-os-auth-production-audit.md), [backup](fi-os-backup-recovery-production.md), [cron](fi-os-cron-production-audit.md), [webhooks](fi-os-webhook-production-audit.md)).  
**Related:** [`fi-os-production-readiness.md`](fi-os-production-readiness.md), [`../FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md`](../FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md).

---

## Must fix before production

- [x] **Lock down legacy `/api/fi/*` machine routes** (`events`, `submit`, `uploads`, `cases`, `partners`, `run-model`) — gated by **`FI_LEGACY_FI_API_ENABLED`** (default off) + **`FI_LEGACY_FI_API_SECRET`** via `Authorization: Bearer` only (`src/lib/fiOs/legacyFiApiAuth.ts`). Remove flag after callers migrate to tenant-scoped APIs.
- [ ] **Rotate and store secrets** — `SUPABASE_SERVICE_ROLE_KEY`, `FI_ADMIN_API_KEY`, `FI_REMINDER_CRON_SECRET`, `CRON_SECRET`, `FI_TIMELY_WEBHOOK_SECRET`, `IIOHR_HR_SYNC_SECRET`, `FI_LEGACY_FI_API_SECRET` (legacy `/api/fi/*` machine routes, if enabled) in secret manager; never in `NEXT_PUBLIC_*`.
- [ ] **Remove query-string `adminKey`** usage for production clients (prefer header only); scrub access logs.
- [x] **Staging parity** — `checkFiTenantPortalApiAccess` uses explicit **`FI_ALLOW_INSECURE_API`** (`src/lib/fiAdmin/insecureFiApiBypass.ts`); **ignored in production**. Public previews with `NODE_ENV=production` no longer auto-allow without session.
- [ ] **Supabase PITR + backup drill** — enable managed backups; document RTO/RPO; test restore to isolated project.
- [ ] **Vercel cron** — configure jobs + secrets for reminder and HR POST; confirm only one active reminder processor (Edge vs Next).
- [ ] **Production gates verified** — smoke test `assertFiAdminShellAccess` / tenant portal with real `fi_users` + `fi_os_identities` rows.
- [ ] **RLS + service role audit** — confirm no accidental exposure via Supabase Data API for tables that should be server-only.

---

## Should fix before beta

- [ ] **Expand `.env.example`** — all vars from [env audit](fi-os-env-vars-production-audit.md) § “Missing from `.env.example`”.
- [ ] **Central env validation** — e.g. Zod schema at boot for required production vars (fail fast).
- [ ] **Role hardening plan** — narrow `crm_operator` / `member` for sensitive PatientOS mutations; document interim matrix.
- [ ] **Staff PIN** — rate limiting, lockout policy, audit export for PIN attempts.
- [ ] **Impersonation** — admin audit trail + UI banner + session TTL review.
- [ ] **Webhook replay protection** — idempotency keys for Timely appointment + future HubSpot.
- [ ] **Integration payload retention** — policy for `fi_integration_webhook_events` JSONB.
- [ ] **Error sanitisation** — `/api/fi/events` and search endpoints: uniform safe messages in prod.

---

## Can defer

- [ ] **Automated cross-region DR** for Storage
- [ ] **STAFF_SYNC_ALERT_EMAIL** actual email delivery (currently intent log)
- [ ] **mTLS** between internal services (HR self-POST) unless threat model demands
- [ ] **HubSpot inbound webhooks** (not in codebase yet)

---

## Manual setup — Vercel

- [ ] Production + Preview + Development env var sets (mirror names; different values).
- [ ] **Cron schedules** — `/api/cron/fi-reminder-jobs` (GET or POST); `/api/cron/iiohr-hr-perth-staff-sync` (**POST**).
- [ ] **Domains** — canonical `NEXT_PUBLIC_SITE_URL` / redirect rules.
- [ ] **Function timeouts** — ensure adequate for HR cron (≤55s wall + Vercel max).
- [ ] **Log drains** (optional) — SIEM for 401/403 spikes on cron + webhooks.

---

## Manual setup — Supabase

- [ ] Auth settings — site URL, redirect URLs for FI Admin + patient portal.
- [ ] **RLS policies** reviewed after each migration deploy.
- [ ] **Storage policies** for `fi-intakes` (and other buckets) — no public list.
- [ ] **Database backups / PITR** tier purchase and retention.
- [ ] **Auth user provisioning** for platform admins (`fi_os_identities`) — least privilege.

---

## Manual setup — Resend

- [ ] Verify sending domain.
- [ ] Create API key scoped to sending (rotate periodically).
- [ ] Align `RESEND_FROM_EMAIL` / `RESEND_FROM_NAME` with brand.
- [ ] Staging: use test domain or `FI_REMINDERS_LIVE_DELIVERY=false`.

---

## Manual setup — external tools

| Tool | Tasks |
|------|---------|
| **Zapier / Timely** | Bearer = `FI_TIMELY_WEBHOOK_SECRET`; URLs include tenant UUID; monitor 401 rates |
| **IIOHR / HR feed** | Feed URL + optional feed key; align `x-iiohr-sync-secret` with `IIOHR_HR_SYNC_SECRET` |
| **Twilio** | Numbers, sender ID compliance, opt-out handling for SMS reminders |
| **OpenAI** | Org billing alerts; model allowlist (`OPENAI_*_MODEL`) |
| **DNS / TLS** | Certificates for `FI_BASE_URL` used by HR cron self-call |

---

## Smoke tests after deploy

- [ ] **Auth** — FI Admin login, tenant switch, logout; patient portal login (if enabled).
- [ ] **CRM** — create lead, move stage, add note (as `crm_operator` and as `member` read-only check).
- [ ] **Calendar** — create/move booking; conflict detection.
- [ ] **Patient chart** — open patient, pathology list, imaging (no 500s).
- [ ] **Reminders** — enqueue test job → cron processes (staging with live delivery off first).
- [ ] **Timely webhook** — signed test POST to discovery or sandbox tenant.
- [ ] **HR sync** — manual POST to staff-sync + optional cron dry run.
- [ ] **Storage** — upload intake file; verify DB row + object listing.
- [ ] **Audit / reports** — `/api/fi/audit/queue` with session; approve/reject flows if in scope.
- [ ] **Health** — `GET /api/health/iiohr-hr-staff-sync` returns expected shape.

---

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Engineering | | | |
| Clinical / ops | | | |
| Security / compliance | | | |
