# FI OS — Webhook infrastructure production audit

**Scope:** `app/api/**/integrations/**`, `app/api/cron/**`, `app/api/fi/events`, Timely libs, HR staff sync, integration migrations (2026-06-12).

---

## Endpoint inventory

| Route | Provider | Auth | Tenant resolution | Body validation | Event logging table |
|-------|----------|------|--------------------|-----------------|---------------------|
| `POST /api/tenants/[tenantId]/integrations/timely/patient` | Timely (Zapier) | `Authorization: Bearer` → `FI_TIMELY_WEBHOOK_SECRET` | Path `tenantId` UUID | Zod `timelyPatientWebhookSchema` | Processor may write business tables; discovery uses `fi_integration_webhook_events` |
| `POST /api/tenants/[tenantId]/integrations/timely/appointment` | Timely | same | path | Zod (appointment schema) | same |
| `POST /api/tenants/[tenantId]/integrations/timely/discovery` | Timely (temporary) | same | path | Raw JSON → `insertTimelyZapierDiscoveryWebhookEvent` | **`fi_integration_webhook_events`** |
| `POST /api/tenants/[tenantId]/integrations/iiohr-hr/staff-sync` | IIOHR HR | Header `x-iiohr-sync-secret` vs `IIOHR_HR_SYNC_SECRET` | path | `processIiohrHrStaffSyncPost` (row limits, etc.) | **`fi_staff_sync_runs`** (+ metadata trigger) |
| `POST /api/cron/iiohr-hr-perth-staff-sync` | Internal cron | Bearer `CRON_SECRET` | Env `EVOLVED_PERTH_TENANT_ID` | N/A (orchestrator) | Delegates to staff-sync |
| `POST /api/cron/fi-reminder-jobs` | Internal cron | Bearer `FI_REMINDER_CRON_SECRET` | DB-driven | N/A | Updates `fi_reminder_jobs` |
| `POST /api/fi/events` | HLI / HairAudit / generic FI | **None** | From envelope payload | `parseFiEventEnvelope` + typed discriminated union | Depends on handler (writes via service role) |

### HubSpot

- **No** `app/api/.../hubspot/.../webhook` route located.
- CRM HubSpot flows are **server actions** (`lib/actions/fi-hubspot-crm-import-actions.ts`) and admin UI — treat future inbound HubSpot webhooks as **greenfield** with signature verification (v3 signatures) and tenant routing.

### Zapier

- Practically synonymous with **Timely** routes today (Bearer secret shared with Zapier).

### HR feed (not HTTP webhook)

- `GET` staff JSON from `IIOHR_HR_PERTH_STAFF_FEED_URL` — authenticate with optional `IIOHR_HR_PERTH_STAFF_FEED_KEY` as Bearer to feed host.

---

## `fi_integration_webhook_events` (migration `20260721120001_fi_integration_webhook_events.sql`)

| Property | Detail |
|----------|--------|
| Purpose | Raw JSON capture for discovery / future processors |
| RLS | `authenticated` **SELECT** where `fi_users` tenant match; **service_role** DML |
| Providers enum | `timely`, `hubspot`, `cliniko`, `pabau`, `fresha` |
| Status enum | `received`, `processed`, `error` |
| Indexes | tenant+provider+time, payload_hash partial index |
| Replay protection | **Not implemented** in table alone — requires application logic |
| Idempotency key | **Optional** `payload_hash` column — population depends on writer |

---

## Auth method matrix

| Mechanism | Used where | Notes |
|-----------|------------|-------|
| Bearer (timing-safe) | Timely, reminder cron, HR cron | Timely uses SHA256-based compare (`timingSafeSecretEquals`) |
| Shared header secret | IIOHR staff-sync | Compared in `processIiohrHrStaffSyncPost` |
| None | `/api/fi/events` | **Critical gap** for internet exposure |

---

## Error response safety

| Route style | Leak risk |
|-------------|-----------|
| Timely routes | Return `{ success:false, error }` — messages are mostly controlled |
| HR cron | Explicitly avoids stack traces (`iiohrHrPerthStaffSyncCron.ts` comment) |
| FI events | Generic 500 may include `Error.message` from handlers — review before exposing |

---

## Dead-letter / failure logging

| System | Behaviour |
|--------|-----------|
| Reminder jobs | `error_log`, statuses `failed`, `cancelled`, `processing` stuck detection (ops) |
| Staff sync | `fi_staff_sync_runs` status + metadata |
| Integration inbox | `fi_integration_webhook_events.error_message` (when used) |
| FI events | Returns JSON result; no dedicated DLQ table observed |

---

## Gaps and recommendations (patch stage)

1. **`POST /api/fi/events`** — add **HMAC**, static bearer, or **mTLS**; per-tenant API keys; rate limiting.
2. **Replay / idempotency** — require external `Idempotency-Key` or hash dedupe for Timely appointment writes (not only discovery).
3. **HubSpot future webhook** — verify `X-HubSpot-Signature-v3`, clock skew, tenant mapping from portal id.
4. **Retention** — TTL job to purge or encrypt `fi_integration_webhook_events.payload` after N days.
5. **Structured audit** — correlate webhook `id` with CRM `fi_crm_lead_activity` rows for operator visibility.

---

## Cross-reference

- Auth audit: [`fi-os-auth-production-audit.md`](fi-os-auth-production-audit.md)
- Env vars: [`fi-os-env-vars-production-audit.md`](fi-os-env-vars-production-audit.md)
