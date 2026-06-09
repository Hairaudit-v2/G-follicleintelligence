# FI OS — Environment & Platform Setup Inventory

Complete configuration reference for deploying **Follicle Intelligence OS** (CRM, ClinicOS, SurgeryOS, DoctorOS, Patient Twin, AuditOS, AnalyticsOS, IIOHR/AcademyOS HR sync, calendar, reminders, pathology, prescribing, tenant admin, and patient portal) as it exists in this repository.

**Audit date:** 2026-06-09  
**Sources:** `.env.example`, all `process.env.*` / `getEnv(...)` references, API routes, server actions, Supabase migrations, middleware, `next.config.mjs`, and existing runbooks.

> Do **not** commit real secrets. Use placeholder values below. Where behaviour is inferred but not fully specified in code, items are marked **NEEDS CONFIRMATION**.

---

## Table of contents

1. [Required Environment Variables](#1-required-environment-variables)
2. [Public Frontend Variables](#2-public-frontend-variables)
3. [Secret Backend Variables](#3-secret-backend-variables)
4. [Supabase Requirements](#4-supabase-requirements)
5. [Vercel Requirements](#5-vercel-requirements)
6. [Resend Email Requirements](#6-resend-email-requirements)
7. [SMS / Twilio Requirements](#7-sms--twilio-requirements)
8. [OpenAI / AI Requirements](#8-openai--ai-requirements)
9. [Stripe / Payment Requirements](#9-stripe--payment-requirements)
10. [Third-party Integrations](#10-third-party-integrations)
11. [Feature Flags](#11-feature-flags)
12. [Missing or Undocumented Variables](#12-missing-or-undocumented-variables)
13. [Recommended `.env.example`](#13-recommended-envexample)
14. [Setup Checklist](#14-setup-checklist)

---

## 1. Required Environment Variables

### Core platform (required for production FI OS)

| Variable | Required | Used by feature | Expected format / example | Referenced in code | What breaks if missing | Production notes |
|----------|----------|-----------------|---------------------------|-------------------|------------------------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Required** | All FI Admin pages, API routes, auth, storage | `https://<project-ref>.supabase.co` | `lib/supabase/client.ts`, `lib/supabaseAdmin.ts`, most `app/api/**` and `app/(fi-admin)/**` | Server pages show “misconfigured”; API returns 500; login fails | Set in Vercel for Production, Preview, and Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Required** | Browser Supabase client, session cookies, CRM/API bearer resolution | JWT anon key from Supabase dashboard | `lib/supabase/client.ts`, `lib/actions/fi-os-auth-actions.ts`, `src/lib/crm/crmGate.ts` | Client auth fails; `resolveAuthUserId` returns null | Safe to expose (public); still treat as project-scoped credential |
| `SUPABASE_SERVICE_ROLE_KEY` | **Required** | All server-side DB/storage/admin auth | Service role JWT | `lib/supabaseAdmin.ts`, virtually all server loaders and API routes | `supabaseAdmin()` throws; pages and APIs fail | **Server-only.** Vercel encrypted env. Never expose to browser |
| `NODE_ENV` | **Required** (runtime) | Production access gates, dev-only endpoints | `production` on deploy; `development` for `next dev` | `src/lib/fiOs/fiOsPortalGate.server.ts`, `src/lib/fiAdmin/fiAdminTenantDirectory.ts`, `app/api/tenants/[tenantId]/seed/route.ts` | If not `production` on a public host, HTML route guards and `/api/tenants` staff checks are **disabled** | Vercel sets `production` for `next start`. **Do not rely on `VERCEL_ENV`** for access control |

### Optional but commonly needed in production

| Variable | Required | Used by feature | Expected format / example | Referenced in code | What breaks if missing | Production notes |
|----------|----------|-----------------|---------------------------|-------------------|------------------------|------------------|
| `NEXT_PUBLIC_SITE_URL` | Optional | Password reset fallback when proxy headers absent | `https://www.example.com` | `lib/actions/fi-os-auth-actions.ts`, `lib/actions/fi-tenant-admin-actions.ts` | Reset/invite links may fall back to `http://localhost:3000` if `Host` headers missing | Set to canonical production URL |
| `FI_ADMIN_API_KEY` | Optional* | Foundation backfill, directory bootstrap, CRM/service mutations via operator key, HR staff import scripts | Long random string | `lib/server/fiAdminKeyGate.ts`, `lib/actions/fi-actions.ts`, `src/lib/crm/crmGate.ts`, `src/lib/staffImport/iiohrHrStaffImportRunner.ts` | Admin-key-gated actions return “not configured” | *Required if operators use Configuration/Foundation tools or script imports without session |
| `FI_REMINDER_CRON_SECRET` | Optional* | Cron processor for appointment reminders | Min **16** chars | `app/api/cron/fi-reminder-jobs/route.ts` | Cron route returns **503** | *Required if reminder cron is enabled |
| `RESEND_API_KEY` | Optional* | Reminders, pathology email-to-patient, pharmacy transmission email | `re_...` | `src/lib/reminders/reminderDeliveryConfig.server.ts`, `src/lib/pathology/pathologySendToPatient.server.ts`, `lib/actions/fi-pharmacy-transmission-actions.ts` | Email channels fail at send time | *Required for any live email delivery |
| `RESEND_FROM_EMAIL` | Optional* | Same as above | `reminders@your-verified-domain.com` | Same | Sends fail: “RESEND_FROM_EMAIL is not configured” | Must be on a **verified Resend domain** |
| `RESEND_FROM_NAME` | Optional | Display name in From header | `Evolved Hair Clinics` | `src/lib/reminders/reminderDeliveryConfig.server.ts` | From address omits display name only | Recommended for patient-facing mail |
| `TWILIO_ACCOUNT_SID` | Optional* | SMS appointment reminders | `AC...` | `src/lib/reminders/reminderDeliveryConfig.server.ts` | SMS reminders not sent | *Required only if SMS reminders enabled |
| `TWILIO_AUTH_TOKEN` | Optional* | SMS reminders | Secret | Same | Same | Server-only |
| `TWILIO_FROM_NUMBER` or `TWILIO_PHONE_NUMBER` | Optional* | SMS sender | E.164 e.g. `+447700900000` | Same (`TWILIO_FROM_NUMBER` preferred; `TWILIO_PHONE_NUMBER` fallback) | SMS not configured | Either var works |
| `TWILIO_DEFAULT_COUNTRY_CODE` | Optional | Normalise local numbers to E.164 | `44` or `61` | Same | Local numbers without `+` may fail | Recommended for AU/UK clinics |
| `OPENAI_API_KEY` | Optional* | DoctorOS voice-to-note, pathology AI interpretation | `sk-...` | `src/lib/clinicalNotes/voiceClinicalNoteAi.server.ts`, `src/lib/pathology/pathologyAiInterpretationMutations.server.ts` | AI endpoints throw explicit errors | *Required for those AI features |
| `OPENAI_CLINICAL_NOTE_MODEL` | Optional | Voice note structuring | Default `gpt-4o-mini` | `src/lib/clinicalNotes/voiceClinicalNoteAi.server.ts` | Uses default model | Override if needed |
| `OPENAI_PATHOLOGY_INTERPRETATION_MODEL` | Optional | Pathology AI | Falls back to clinical note model, then `gpt-4o-mini` | `src/lib/pathology/pathologyAiInterpretationMutations.server.ts` | Uses fallback chain | — |
| `FI_STORAGE_BUCKET_INTAKES` | Optional | Case uploads, blood PDF pipeline, event ingestion | Default `fi-intakes` | `app/api/fi/uploads/route.ts`, `lib/fi/stages/blood_extract.ts`, etc. | Uses default bucket name | Bucket must exist in Supabase (see §4) |
| `FI_REMINDERS_LIVE_DELIVERY` | Optional | Safety gate for reminder cron | `true` (default) / `false` / `0` / `off` | `src/lib/reminders/reminderLiveDeliveryPolicy.server.ts` | When `false`, due jobs cancelled without sending | Set `false` on staging |
| `FI_REMINDERS_TEST_SEND` | Optional | Calendar UAT “send test email” | Must be `true` to allow | Same + `src/lib/reminders/reminderDelivery.server.ts` | Test send action blocked | Never enable in production unless intentional |
| `FI_REMINDER_TEST_EMAIL` | Optional | Override recipient for test sends | `ops@example.com` | `src/lib/reminders/reminderLiveDeliveryPolicy.server.ts` | Test send unavailable | Never patient email |
| `CRON_SECRET` | Optional* | IIOHR HR Perth scheduled sync | Min **16** chars | `src/lib/hr/iiohrHrPerthStaffSyncCron.ts`, `app/api/cron/iiohr-hr-perth-staff-sync/route.ts` | HR cron returns **503** | *Required if HR cron enabled |
| `EVOLVED_PERTH_TENANT_ID` | Optional* | HR cron target tenant | UUID | `src/lib/hr/runScheduledIiohrHrStaffSync.server.ts` | HR cron fails | *Required for Evolved Perth automation |
| `FI_BASE_URL` | Optional* | Outbound HR sync client POST to self | `https://fi.example.com` | `src/lib/hr/iiohrFiStaffSyncPush.ts`, `scripts/verify-fi-event-ingestion.ts` | Scheduled HR sync cannot POST staff-sync API | Must match deployed FI origin |
| `IIOHR_HR_SYNC_SECRET` | Optional* | Staff sync API auth | Shared secret | `src/lib/staffImport/iiohrHrStaffSyncPost.server.ts`, HR cron | Staff sync POST rejected | Must match header `x-iiohr-sync-secret` |
| `IIOHR_HR_PERTH_STAFF_FEED_URL` | Optional* | HR feed GET | HTTPS URL | `src/lib/hr/loadEvolvedPerthHrStaffSnapshot.server.ts` | HR cron/import cannot load rows | — |
| `IIOHR_HR_PERTH_STAFF_FEED_KEY` | Optional | HR feed Bearer auth | Secret | Same | Feed fetch fails if feed requires auth | Set when feed is protected |
| `ALLOW_EMPTY_HR_SYNC` | Optional | Allow empty HR feed on cron | `true` | `src/lib/hr/runScheduledIiohrHrStaffSync.server.ts` | Empty feed returns error on cron | Staging safety |
| `STAFF_SYNC_STALE_WARNING_HOURS` | Optional | HR health staleness | Hours, default **48** | `src/lib/hr/iiohrHrStaffSyncHealth.ts` | Default 48h used | — |
| `STAFF_SYNC_ALERT_EMAIL` | Optional | Alert intent logging after failed cron | Email | `src/lib/hr/staffSyncAlertIntent.server.ts` | No alert log lines | **Email not sent yet** — logs only |

### Development / scripts only (not production runtime)

| Variable | Required | Used by feature | Expected format / example | Referenced in code | What breaks if missing | Production notes |
|----------|----------|-----------------|---------------------------|-------------------|------------------------|------------------|
| `FI_ENABLE_DEV_ADMIN_ACCESS` | Dev only | Unauthenticated tenant list on `/fi-admin` | Must be `true` | `src/lib/fiAdmin/fiAdminTenantDirectory.ts` | Normal auth required | **Ignored when `NODE_ENV=production`** |
| `FI_ALLOW_CALENDAR_UAT_SEED` | Dev/staging | Calendar UAT demo seed | `true` | `src/lib/calendar/calendarUatSeed.server.ts` | Seed disabled outside `development` | Do not set in production |
| `FI_TENANT_ID` | Scripts | `verify-fi-events`, replay scripts | UUID | `scripts/verify-fi-event-ingestion.ts`, `scripts/replay-test.ts` | Scripts prompt for tenant | Local/CI only |
| `FI_CASE_ID` | Scripts | Job lock replay | UUID | `scripts/replay-job-lock-test.ts` | Script fails | Local/CI only |
| `BASE_URL` | Scripts | Fallback base URL | `http://localhost:3000` | `scripts/verify-fi-event-ingestion.ts` | Falls back to localhost | Prefer `FI_BASE_URL` |
| `FI_EVOLVED_TENANT_SLUG` | Scripts | `dev:provision:evolved` | e.g. `evolved-hair-clinics` | `scripts/provision-evolved-tenant.ts` | Uses script default | Provisioning only |
| `FI_EVOLVED_TENANT_NAME` | Scripts | Same | e.g. `Evolved Hair Clinics` | Same | Same | — |
| `FI_EVOLVED_DEFAULT_TIMEZONE` | Scripts | Same | e.g. `Australia/Brisbane` | Same | Same | — |
| `FI_IMPORT_ADMIN_KEY` | Scripts | `import-approved-fi-services` alias | Same as `FI_ADMIN_API_KEY` | `scripts/import-approved-fi-services.ts` | Script auth fails | Convenience alias only |
| `SUPABASE_DB_PASSWORD` | Scripts | Remote SQL push scripts | DB password | `scripts/apply-fi-consultations-remote.mjs`, `scripts/apply-fi-case-post-op-tracking-remote.mjs` | Remote migration scripts fail | Not used by Next.js runtime |

### Legacy / unused in active code

| Variable | Status | Notes |
|----------|--------|-------|
| `NEXT_PUBLIC_FI_CLINIC_OS_SHELL` | **Not read by app code** | Commented in `.env.example`; tenant layout always uses `FiOsAppShell` per `docs/fi-os-access-production.md` |

---

## 2. Public Frontend Variables

All variables prefixed with `NEXT_PUBLIC_` are embedded in client bundles and visible in the browser.

| Variable | Safe to expose? | Purpose | Notes |
|----------|-----------------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (by design) | Supabase project URL for browser client | Required for login session and client-side auth flows |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (by design) | Supabase anon key | Protected by Supabase Auth + RLS; still rotate if leaked |
| `NEXT_PUBLIC_SITE_URL` | Yes | Canonical public site URL | Used only as server-action fallback for auth redirects; exposing it is harmless |

**Not present in code but listed in old docs:** `NEXT_PUBLIC_FI_CLINIC_OS_SHELL` — remove from deploy configs; no longer used.

**Never use `NEXT_PUBLIC_` for:** service role key, Resend/Twilio/OpenAI keys, cron secrets, `FI_ADMIN_API_KEY`, or `IIOHR_HR_SYNC_SECRET`.

---

## 3. Secret Backend Variables

Mark all of the following as **Vercel encrypted environment variables** (Production + Preview as appropriate). Do not prefix with `NEXT_PUBLIC_`.

| Category | Variables |
|----------|-----------|
| Supabase | `SUPABASE_SERVICE_ROLE_KEY` |
| FI platform | `FI_ADMIN_API_KEY`, `FI_REMINDER_CRON_SECRET`, `CRON_SECRET`, `IIOHR_HR_SYNC_SECRET` |
| Email | `RESEND_API_KEY` |
| SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` |
| AI | `OPENAI_API_KEY` |
| HR feed | `IIOHR_HR_PERTH_STAFF_FEED_KEY` (if used) |
| DB scripts (CI/local) | `SUPABASE_DB_PASSWORD` |

**Preview vs Production:** Use separate Supabase projects or keys per environment when possible. Set `FI_REMINDERS_LIVE_DELIVERY=false` on Preview/staging to prevent patient contact.

---

## 4. Supabase Requirements

### 4.1 Project variables

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + session auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Server bypass of RLS; admin auth (`inviteUserByEmail`, impersonation, all FI loaders) |

### 4.2 Service role usage

The Next.js server uses **service role exclusively** for:

- All `supabaseAdmin()` calls (API routes, server actions, loaders)
- Storage uploads/downloads (case intakes, patient images, pathology PDFs)
- `auth.admin.*` (tenant admin invites, impersonation, user lookup RPC)
- CRM/booking/calendar mutations where RLS is read-only for authenticated role

**Browser anon key** is used for:

- FI OS login / session cookies (`@supabase/ssr`)
- Optional `Authorization: Bearer <user_jwt>` on API routes via `resolveAuthUserId`

### 4.3 Auth settings (Supabase Dashboard)

| Setting | Requirement |
|---------|-------------|
| **Site URL** | Production origin, e.g. `https://www.follicleintelligence.ai` (**NEEDS CONFIRMATION** — match your deploy domain) |
| **Redirect URLs** | Must allow: `/follicle-intelligence/update-password`, `/follicle-intelligence/login` (and wildcard variants per Supabase docs) |
| **Email provider** | Supabase Auth sends **invite** and **password recovery** emails (not Resend in current code) |
| **Email confirmation** | Tenant admin invites use `auth.admin.inviteUserByEmail` — configure SMTP/templates in Supabase for production deliverability |
| **Magic link / OTP** | Primary staff flow is **email + password** (`fiOsPasswordSignInAction`); magic link not used in FI OS login UI |

**Redirect URL construction:**

- Password reset: `{origin}/follicle-intelligence/update-password` where `origin` = `X-Forwarded-Proto` + `X-Forwarded-Host`, else `NEXT_PUBLIC_SITE_URL`, else `http://localhost:3000`
- Tenant admin invite: `{origin}/follicle-intelligence/login?next=/fi-admin/{tenantId}`

### 4.4 Storage buckets

| Bucket | Created by | Public | Used for | Setup |
|--------|------------|--------|----------|-------|
| `fi-intakes` | **Manual** (see `SUPABASE_SETUP.md`) | Private | Case file uploads, blood PDFs, FI event ingestion test uploads | Create in Dashboard; override name via `FI_STORAGE_BUCKET_INTAKES` |
| `patient-images` | Migration `20260613120001_fi_patient_images.sql` | Private | Patient photos, pathology PDF storage (`PATHOLOGY_PATIENT_PDF_BUCKET`) | Migration sets image MIME allow-list |

**NEEDS CONFIRMATION:** Migration allow-list for `patient-images` is image types only, but code uploads `application/pdf` pathology files to the same bucket. Service role uploads may still succeed; if PDF uploads fail in production, add `application/pdf` to bucket allowed MIME types in Supabase Dashboard.

**Voice clinical notes:** `fi_clinical_notes.audio_storage_bucket` column exists; no dedicated bucket migration found — audio may be processed in-memory without persistent storage (**NEEDS CONFIRMATION** for retention policy).

### 4.5 RLS expectations

Pattern across foundation migrations:

- **Authenticated read:** Many `fi_*` tables allow `SELECT` when `exists (fi_users where auth_user_id = auth.uid() and tenant_id matches)`.
- **Authenticated write:** Generally **denied** on foundation tables; mutations go through Next.js service role.
- **No client policies:** `fi_os_identities`, `fi_os_impersonation_sessions` — service role only.
- **`fi_cases`:** RLS intentionally **not enabled** in foundation migration (API-only access).

Key migration files (apply **all** under `supabase/migrations/` — 68 files):

- `20250220000001_fi_tenants_users.sql` — core tenants/users
- `20260605140009_fi_foundation_rls.sql` — foundation RLS
- `20260606150001_fi_crm_foundation_rls.sql` — CRM RLS
- `20260613120001_fi_patient_images.sql` — patient images + bucket
- `20260614120001_fi_os_identities.sql` — platform roles seed
- `20260702120001_fi_platform_admin.sql` — `fi_platform_admin`, impersonation audit
- `20260704120001_fi_tenant_admin_users.sql` — tenant admin users
- Plus all intermediate FI feature migrations (bookings, reminders, pathology, prescribing, staff sync, tax, etc.)

Apply via:

```bash
npx supabase db push
# or: npm run supabase:migration:up
```

### 4.6 Seed users / platform roles

| Identity | How provisioned | Role |
|----------|-------------------|------|
| `auditor@hairaudit.com` | Migration seed on `auth.users` match | `fi_platform_admin` (after `20260702120001`; was `fi_admin` in earlier migration) |
| Clinic staff | `fi_users` rows linked to `auth.users` | Tenant-scoped roles (`admin`, `fi_admin`, CRM roles, etc.) |
| Tenant admin users | `fi_tenant_admin_users` + optional Supabase invite | Admin capability roles (`clinic_admin`, `finance_admin`, …) |
| Patient portal | `fi_patients.portal_auth_user_id` → `auth.users.id` | `/patient/[tenantId]/medications` |

After migrations, create real auth users in Supabase Dashboard and upsert `fi_os_identities` / `fi_users` as documented in `docs/fi-os-access-production.md`.

### 4.7 Required RPC / functions

- `fi_admin_lookup_auth_user_id_by_email` — used by tenant admin invite flow (`lib/actions/fi-tenant-admin-actions.ts`)

---

## 5. Vercel Requirements

### 5.1 Repository state

- **No `vercel.json`** in repo — cron schedules and domain settings are configured in the **Vercel project dashboard** (or add `vercel.json` separately).
- **Framework:** Next.js 14 (`package.json`)
- **Build command:** `next build` (default)
- **Output:** standard Next.js App Router

### 5.2 Environments

| Environment | Notes |
|-------------|-------|
| **Production** | All required Supabase vars; `NODE_ENV=production` at runtime; enable live delivery flags intentionally |
| **Preview** | Recommend `FI_REMINDERS_LIVE_DELIVERY=false`; separate Supabase project recommended |
| **Development** | Local `.env.local`; may use `FI_ENABLE_DEV_ADMIN_ACCESS=true` with `next dev` only |

### 5.3 Domains

**NEEDS CONFIRMATION** for your tenant — marketing metadata uses `https://www.follicleintelligence.ai` in `app/layout.tsx`. Production FI OS auth paths:

- `/follicle-intelligence/login`
- `/follicle-intelligence/update-password`
- `/fi-admin/**`
- `/hair-audit/admin`
- `/patient/[tenantId]/medications`

Configure Supabase redirect URLs and `NEXT_PUBLIC_SITE_URL` to match the deployed host.

### 5.4 Build variables

All `NEXT_PUBLIC_*` vars must be present **at build time** (inlined into client bundle). Server secrets can be runtime-only on Vercel.

### 5.5 Cron jobs (configure in Vercel Cron or external scheduler)

| Schedule | Method | URL | Auth header |
|----------|--------|-----|-------------|
| Every 1–5 min (recommended for reminders) | `GET` or `POST` | `/api/cron/fi-reminder-jobs` | `Authorization: Bearer $FI_REMINDER_CRON_SECRET` or `x-fi-reminder-secret` |
| Daily early AM Australia/Brisbane (HR) | `POST` | `/api/cron/iiohr-hr-perth-staff-sync` | `Authorization: Bearer $CRON_SECRET` |

Both routes set `export const dynamic = "force-dynamic"`. HR cron wall timeout: **55 seconds**.

Example manual trigger:

```bash
curl -sS -X POST "https://<host>/api/cron/fi-reminder-jobs" \
  -H "Authorization: Bearer $FI_REMINDER_CRON_SECRET"

curl -sS -X POST "https://<host>/api/cron/iiohr-hr-perth-staff-sync" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### 5.6 Function runtime

- Default Node.js serverless on Vercel for App Router route handlers and server actions
- No `runtime = 'edge'` found on critical FI routes
- `@vercel/analytics` included in root layout — no env var required

### 5.7 Webhook / inbound URLs (external systems call FI)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/fi/events` | None in code (**NEEDS CONFIRMATION** — consider API key at edge) | HLI/HairAudit event ingestion |
| `POST /api/tenants/{tenantId}/integrations/iiohr-hr/staff-sync` | Header `x-iiohr-sync-secret` = `IIOHR_HR_SYNC_SECRET` | IIOHR HR staff commit sync |
| `GET /api/health/iiohr-hr-staff-sync` | None | HR automation health JSON |

Most tenant APIs require Supabase session (cookies or Bearer user JWT) + CRM/portal gates in production.

### 5.8 Middleware

`middleware.ts` only adds CORS/CORP headers for static images — **no auth** at middleware layer. All access control is in server layouts and route handlers.

---

## 6. Resend Email Requirements

### 6.1 Configuration

| Variable | Required for email |
|----------|-------------------|
| `RESEND_API_KEY` | Yes |
| `RESEND_FROM_EMAIL` | Yes |
| `RESEND_FROM_NAME` | Optional (display name) |

Shared loader: `src/lib/reminders/reminderDeliveryConfig.server.ts`  
From header builder: `buildResendFromAddress()` in `src/lib/reminders/reminderDeliveryConfig.ts`

### 6.2 Verified sender domain

Register and verify your clinic/domain in Resend. `RESEND_FROM_EMAIL` must use that domain or Resend rejects sends.

### 6.3 Features using Resend (not Supabase SMTP)

| Feature | Sender | Subject / content |
|---------|--------|-------------------|
| Appointment reminders (email) | `RESEND_FROM_*` | Template-rendered subject + body from reminder processor |
| Calendar UAT test email | Same | To `FI_REMINDER_TEST_EMAIL` only when `FI_REMINDERS_TEST_SEND=true` |
| Pathology blood request to patient | Same | `Your blood test request from {clinic}` + PDF attachment |
| Pharmacy order transmission | Same | Compound pharmacy order email + PDF attachment |
| Resend failed pharmacy transmission | Same | Retry via `resendFailedPharmacyTransmissionAction` |

### 6.4 Invite emails

**Tenant admin invites** use **Supabase Auth** `inviteUserByEmail`, not Resend (`lib/actions/fi-tenant-admin-actions.ts`). Configure Supabase Auth email/SMTP for production invite deliverability.

### 6.5 Test / live delivery flags

| Variable | Behaviour |
|----------|-----------|
| `FI_REMINDERS_LIVE_DELIVERY` | When `false`/`0`/`off`, reminder **cron** cancels due jobs without calling Resend/Twilio |
| `FI_REMINDERS_TEST_SEND` + `FI_REMINDER_TEST_EMAIL` | Explicit ops test sends only |
| Pathology / pharmacy sends | **No separate dry-run flag** — sends when invoked and Resend is configured |

---

## 7. SMS / Twilio Requirements

| Variable | Purpose |
|----------|---------|
| `TWILIO_ACCOUNT_SID` | Account |
| `TWILIO_AUTH_TOKEN` | Auth |
| `TWILIO_FROM_NUMBER` or `TWILIO_PHONE_NUMBER` | Sender |
| `TWILIO_DEFAULT_COUNTRY_CODE` | Parse local numbers to E.164 |

**Features:** SMS appointment reminders only (`src/lib/reminders/reminderDelivery.server.ts` → Twilio Messages API).

**Live/test:** Controlled by `FI_REMINDERS_LIVE_DELIVERY` for cron-driven reminders. No Twilio-specific sandbox flag in code.

**If missing:** SMS-type reminder jobs fail with configuration errors; email reminders may still work if Resend is configured.

---

## 8. OpenAI / AI Requirements

| Variable | Default | Feature |
|----------|---------|---------|
| `OPENAI_API_KEY` | — | Required for all AI calls |
| `OPENAI_CLINICAL_NOTE_MODEL` | `gpt-4o-mini` | Voice note JSON structuring |
| `OPENAI_PATHOLOGY_INTERPRETATION_MODEL` | falls back to clinical model | Pathology AI interpretation |

### Models referenced in code

| Model | Usage |
|-------|-------|
| `whisper-1` | Audio transcription (`voiceClinicalNoteAi.server.ts`) |
| `gpt-4o-mini` (configurable) | Structured clinical note sections (`response_format: json_object`) |
| Same chat model | Pathology AI interpretation (`pathologyAiInterpretationMutations.server.ts`) |

### Vision / structured outputs

- **Structured JSON:** Clinical notes and pathology interpretation use chat completions with JSON schema/object mode.
- **Vision:** Not used in current FI OS code paths audited.

### Fallback if `OPENAI_API_KEY` missing

- Voice note processing: throws `"OPENAI_API_KEY is not configured for voice-to-note."`
- Pathology AI: throws `"OPENAI_API_KEY is not configured for pathology AI interpretation."`
- UI/API returns error to caller; no silent fallback model

---

## 9. Stripe / Payment Requirements

**No Stripe integration found** in this codebase (no `STRIPE_*` env vars, no payment routes).

HLI/payment links (Release My Super, Humm90, etc.) are **not configured via environment variables** in this repo.

**NEEDS CONFIRMATION** if payments are handled in a separate service or future branch.

---

## 10. Third-party Integrations

| Integration | Configuration | Entry points |
|-------------|---------------|--------------|
| **IIOHR HR → FI staff sync** | `IIOHR_HR_*`, `EVOLVED_PERTH_TENANT_ID`, `FI_BASE_URL`, `CRON_SECRET` | `POST .../integrations/iiohr-hr/staff-sync`, cron route, `scripts/import-iiohr-hr-staff.ts` |
| **Evolved Perth staff feed** | `IIOHR_HR_PERTH_STAFF_FEED_URL`, optional `IIOHR_HR_PERTH_STAFF_FEED_KEY` | `loadEvolvedPerthHrStaffSnapshot.server.ts` |
| **Timely service import** | No env vars — file/CLI driven | `npm run timely:*`, `scripts/timely-*.ts`, `docs/timely-import/` |
| **QuickBooks** | Not implemented | — |
| **External audit / HairAudit** | Session + `fi_os_identities` roles; event ingest via `POST /api/fi/events` | `/hair-audit/admin`, `app/api/fi/audit/**` |
| **HLI event ingestion** | Supabase only | `POST /api/fi/events` |
| **Release My Super / Humm90** | Not in codebase | — |
| **Vercel Analytics** | Automatic via `@vercel/analytics` | `app/layout.tsx` |

---

## 11. Feature Flags

| Flag | Enables | Expected values | Safe default | Production note |
|------|---------|-----------------|--------------|-----------------|
| `FI_ENABLE_DEV_ADMIN_ACCESS` | Unauthenticated full tenant list on `/fi-admin` | `true` only | unset / false | **Ignored in production** |
| `FI_ALLOW_CALENDAR_UAT_SEED` | Calendar demo seed API | `true` | unset | Staging only |
| `FI_REMINDERS_LIVE_DELIVERY` | Real Resend/Twilio from reminder cron | `true` / `false` / `0` / `off` | unset (= live **on**) | Set `false` on non-prod |
| `FI_REMINDERS_TEST_SEND` | Calendar panel test email to override address | `true` | unset | Dev/staging only |
| `ALLOW_EMPTY_HR_SYNC` | HR cron success on empty feed | `true` | unset | Staging safety |
| `NODE_ENV` | Production security gates | `production` on deploy | `development` in dev | Critical — not a feature flag but controls enforcement |
| `NEXT_PUBLIC_FI_CLINIC_OS_SHELL` | *(legacy)* | — | — | **Unused** — do not set |

CRM/booking module visibility is **not** env-flagged — driven by `fi_users.role`, `fi_os_identities`, and tenant data (`crmShellAccess.ts`).

---

## 12. Missing or Undocumented Variables

### Used in code but missing from `.env.example`

| Variable | Should add to `.env.example` |
|----------|------------------------------|
| `FI_BASE_URL` | Yes — HR sync / scripts |
| `FI_STORAGE_BUCKET_INTAKES` | Yes |
| `FI_REMINDERS_LIVE_DELIVERY` | Yes |
| `FI_REMINDERS_TEST_SEND` | Yes |
| `FI_REMINDER_TEST_EMAIL` | Yes |
| `FI_ALLOW_CALENDAR_UAT_SEED` | Yes (comment: staging only) |
| `CRON_SECRET` | Yes — HR cron |
| `EVOLVED_PERTH_TENANT_ID` | Yes |
| `IIOHR_HR_SYNC_SECRET` | Yes |
| `IIOHR_HR_PERTH_STAFF_FEED_URL` | Yes |
| `IIOHR_HR_PERTH_STAFF_FEED_KEY` | Yes |
| `ALLOW_EMPTY_HR_SYNC` | Yes |
| `STAFF_SYNC_STALE_WARNING_HOURS` | Yes |
| `STAFF_SYNC_ALERT_EMAIL` | Yes |
| `OPENAI_PATHOLOGY_INTERPRETATION_MODEL` | Yes |
| `TWILIO_PHONE_NUMBER` | Yes (alias for `TWILIO_FROM_NUMBER`) |
| `FI_EVOLVED_TENANT_SLUG` / `NAME` / `DEFAULT_TIMEZONE` | Yes (script section) |
| `FI_TENANT_ID`, `FI_CASE_ID`, `BASE_URL` | Yes (scripts section) |
| `FI_IMPORT_ADMIN_KEY` | Yes |
| `SUPABASE_DB_PASSWORD` | Yes (scripts section) |

### In `.env.example` but not used in application code

| Variable | Status |
|----------|--------|
| `NEXT_PUBLIC_FI_CLINIC_OS_SHELL` | Documented as legacy; **not read** by layout or global search |

### Should be added for clarity

- Document that **`CRON_SECRET`** and **`FI_REMINDER_CRON_SECRET`** are separate secrets for two cron routes.
- Document **`TWILIO_PHONE_NUMBER`** as alias.
- Note Supabase Auth (not Resend) sends staff **invites**.

---

## 13. Recommended `.env.example`

```bash
# Copy to `.env.local`. Never commit real secrets.

# ── Supabase (required) ─────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Public site URL — password reset / invite fallback when proxy Host headers missing
# NEXT_PUBLIC_SITE_URL=https://www.example.com

# ── FI platform secrets (server only) ───────────────────────────────
# FI_ADMIN_API_KEY=

# Reminder cron: POST/GET /api/cron/fi-reminder-jobs (min 16 chars)
# FI_REMINDER_CRON_SECRET=

# HR cron: POST /api/cron/iiohr-hr-perth-staff-sync (min 16 chars)
# CRON_SECRET=

# Outbound HR sync + staff-sync API (header x-iiohr-sync-secret)
# IIOHR_HR_SYNC_SECRET=
# FI_BASE_URL=https://www.example.com
# EVOLVED_PERTH_TENANT_ID=
# IIOHR_HR_PERTH_STAFF_FEED_URL=
# IIOHR_HR_PERTH_STAFF_FEED_KEY=
# ALLOW_EMPTY_HR_SYNC=true
# STAFF_SYNC_STALE_WARNING_HOURS=48
# STAFF_SYNC_ALERT_EMAIL=ops@example.com

# ── Storage ───────────────────────────────────────────────────────
# FI_STORAGE_BUCKET_INTAKES=fi-intakes

# ── Email — Resend ──────────────────────────────────────────────────
# RESEND_API_KEY=re_...
# RESEND_FROM_EMAIL=reminders@your-verified-domain.com
# RESEND_FROM_NAME=Your Clinic Name

# ── SMS — Twilio ────────────────────────────────────────────────────
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_FROM_NUMBER=+447700900000
# TWILIO_PHONE_NUMBER=+447700900000
# TWILIO_DEFAULT_COUNTRY_CODE=44

# ── OpenAI ──────────────────────────────────────────────────────────
# OPENAI_API_KEY=sk-...
# OPENAI_CLINICAL_NOTE_MODEL=gpt-4o-mini
# OPENAI_PATHOLOGY_INTERPRETATION_MODEL=gpt-4o-mini

# ── Reminder safety flags ───────────────────────────────────────────
# FI_REMINDERS_LIVE_DELIVERY=true
# FI_REMINDERS_TEST_SEND=true
# FI_REMINDER_TEST_EMAIL=ops@example.com

# ── Local development only (ignored in production) ──────────────────
# FI_ENABLE_DEV_ADMIN_ACCESS=true
# FI_ALLOW_CALENDAR_UAT_SEED=true

# ── Scripts / provisioning (not Next.js runtime) ────────────────────
# SUPABASE_DB_PASSWORD=
# FI_TENANT_ID=
# FI_CASE_ID=
# BASE_URL=http://localhost:3000
# FI_IMPORT_ADMIN_KEY=
# FI_EVOLVED_TENANT_SLUG=evolved-hair-clinics
# FI_EVOLVED_TENANT_NAME=Evolved Hair Clinics
# FI_EVOLVED_DEFAULT_TIMEZONE=Australia/Brisbane

# Legacy — no longer read by app:
# NEXT_PUBLIC_FI_CLINIC_OS_SHELL=true
```

---

## 14. Setup Checklist

### Supabase

- [ ] Create project; copy URL, anon key, service role key into Vercel + local `.env.local`
- [ ] Run all migrations: `npx supabase db push` (68 files in `supabase/migrations/`)
- [ ] Create private bucket **`fi-intakes`** (or set `FI_STORAGE_BUCKET_INTAKES`)
- [ ] Confirm **`patient-images`** bucket exists after migration
- [ ] **NEEDS CONFIRMATION:** Add `application/pdf` to `patient-images` MIME allow-list if PDF uploads fail
- [ ] Configure Auth **Site URL** and **Redirect URLs** for production domain
- [ ] Configure Auth email/SMTP for invites and password recovery
- [ ] Create production auth users; seed `fi_os_identities` / `fi_users` / `fi_tenant_admin_users` as needed
- [ ] Verify `auditor@hairaudit.com` seed or manual platform admin row (`fi_platform_admin`)

### Vercel

- [ ] Connect repo; set `NODE_ENV=production` on production deployment (default for `next start`)
- [ ] Add all encrypted server secrets (§3)
- [ ] Add all `NEXT_PUBLIC_*` at build time
- [ ] Attach production domain; set `NEXT_PUBLIC_SITE_URL`
- [ ] Configure cron: `/api/cron/fi-reminder-jobs` and (if used) `/api/cron/iiohr-hr-perth-staff-sync`
- [ ] Confirm Preview uses `FI_REMINDERS_LIVE_DELIVERY=false` if sharing real patient data

### Auth

- [ ] Test `/follicle-intelligence/login` and `/fi-login` redirect
- [ ] Test password reset lands on `/follicle-intelligence/update-password`
- [ ] Test tenant admin invite email (Supabase) and first login
- [ ] Provision `fi_os_identities` for platform ops; `fi_users` for clinic staff
- [ ] Run production access checklist in `docs/fi-os-access-production.md`

### Email (Resend)

- [ ] Verify domain in Resend
- [ ] Set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`
- [ ] Send test pathology email or calendar test email (staging with override flags)
- [ ] Configure Supabase Auth email separately for invites

### Storage

- [ ] Upload test case file via `/api/tenants/{id}/cases/{caseId}/uploads`
- [ ] Upload patient image via patient images API
- [ ] Verify signed URL reads for patient portal / admin loaders

### Cron

- [ ] Set `FI_REMINDER_CRON_SECRET` (≥16 chars); curl cron route
- [ ] Set reminder templates in FI Admin → Settings → Reminders
- [ ] If HR automation: set `CRON_SECRET`, `EVOLVED_PERTH_TENANT_ID`, feed URL, sync secret; curl HR cron
- [ ] Check `GET /api/health/iiohr-hr-staff-sync`

### Payments

- [ ] N/A in current codebase (Stripe not integrated)

### Testing steps

- [ ] `next build && next start` with production env — re-run access checks §5–7 in `docs/fi-os-access-production.md`
- [ ] `docs/fi-os-smoke-test-stage-6f.md` pre-launch smoke test
- [ ] CRM lead create/convert, booking calendar, case submit/run-model pipeline
- [ ] Reminder job tick + cron delivery (staging with live delivery off first)
- [ ] DoctorOS voice note (requires `OPENAI_API_KEY`)
- [ ] Pathology AI interpretation (requires `OPENAI_API_KEY`)
- [ ] Patient medications portal with `portal_auth_user_id` linked
- [ ] `npm run verify:fi-events` against staging (optional)

---

## Related documentation

| Doc | Topic |
|-----|-------|
| `docs/fi-os-access-production.md` | Production auth, roles, redirects |
| `docs/fi-os-smoke-test-stage-6f.md` | Pre-launch smoke test |
| `docs/iiohr-hr-perth-staff-sync-cron.md` | HR cron env vars |
| `docs/runbooks/iiohr-hr-staff-sync-production-activation.md` | HR go-live |
| `docs/dev-local-fi-admin.md` | Local dev tenant list |
| `docs/dev-provision-evolved-tenant.md` | Evolved tenant provisioning |
| `SUPABASE_SETUP.md` | Legacy quick start (partial migration list — prefer full push) |

---

*Generated from repository audit. Update this file when new env vars or integrations are added.*
