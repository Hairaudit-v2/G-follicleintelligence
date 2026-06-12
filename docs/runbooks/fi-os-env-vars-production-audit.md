# FI OS — Environment variables production audit

**Scope:** Full-repo scan of `process.env.*` in `*.{ts,tsx,js,jsx,mjs,cjs}` (2026-06-12).  
**Related:** [`docs/FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md`](../FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md), [`.env.example`](../../.env.example).  
**Validation:** Central checks live in **`src/lib/env/fiEnv.server.ts`** (`validateFiServerEnv`, `assertFiServerEnv`, Zod-backed URL rules). Run **`pnpm run check:env`** before production deploys (CI-friendly; does not auto-run `next dev`).

## Legend

| Column | Meaning |
|--------|---------|
| **Req** | `required` = production feature broken or insecure without it; `optional` = feature degrades or dev-only; `script` = CLI/scripts only |
| **Local** | Needed for typical `next dev` on developer machine |
| **Vercel prod** | Needed on production Vercel project |
| **Source** | Where the value comes from |
| **.env.ex** | Present in [`.env.example`](../../.env.example) (commented counts as documented) |
| **Zod / typed validation** | `validateFiServerEnv` in `src/lib/env/fiEnv.server.ts` (production + conditional secrets); `pnpm run check:env` |

---

## Core platform (Supabase + Next)

| Env var | Req | Primary file(s) | Module | Local | Vercel prod | Source | Safe example | .env.ex | Validation |
|---------|-----|-------------------|--------|-------|-------------|--------|--------------|---------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | required | `lib/supabase/client.ts`, `lib/supabaseAdmin.ts`, most `app/api/**`, FI admin pages | All OS modules using DB | Yes | Yes | Supabase project → Settings → API | `https://xxxx.supabase.co` | Yes | None (trim checks only) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | required | `lib/supabase/client.ts`, `src/lib/crm/crmGate.ts`, `lib/actions/fi-os-auth-actions.ts`, `src/lib/fiOs/fiOsAuthDisplay.server.ts` | Auth session (browser + Bearer resolution) | Yes | Yes | Supabase → API (anon public) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (short public) | Yes | None |
| `SUPABASE_SERVICE_ROLE_KEY` | required | `lib/supabaseAdmin.ts`, all server routes using admin client | Server-side data access (bypasses RLS) | Yes | Yes | Supabase → API (**service_role**, secret) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long secret) | Yes | None |
| `NEXT_PUBLIC_SITE_URL` | optional | `src/lib/fiOs/fiOsPublicOrigin.server.ts`, `lib/actions/fi-tenant-admin-actions.ts`, `lib/actions/fi-os-auth-actions.ts` | Password reset / origin fallback when `Host` headers missing | Dev as needed | Recommended | Your canonical public URL | `https://app.example.com` | Yes (commented) | None |
| `NEXT_PUBLIC_APP_URL` | optional (scripts) | `scripts/hubspot-import-next-500.ts`, `scripts/hubspot-commit-latest-dry-run-batch.ts` | HubSpot import scripts calling the app | For those scripts | N/A unless scripts run in CI | Same as deploy URL | `https://app.example.com` | **No** | None |
| `NODE_ENV` | required (framework) | Many gates (`production` vs dev) | Security boundaries (portal gate, webhook fail-closed, error sanitisation) | Auto | Auto | Node / Vercel | `production` | N/A | N/A |

---

## FI Admin API key + automation

| Env var | Req | Primary file(s) | Module | Local | Vercel prod | Source | Safe example | .env.ex | Validation |
|---------|-----|-------------------|--------|-------|-------------|--------|--------------|---------|--------------|
| `FI_ADMIN_API_KEY` | optional* | `lib/server/fiAdminKeyGate.ts`, `lib/actions/fi-actions.ts`, `src/lib/crm/crmGate.ts`, `src/lib/staffImport/iiohrHrStaffImportRunner.ts`, `src/lib/payments/paymentRecordAccess.server.ts`, `src/lib/services/fiServicesManageAccess.server.ts`, `src/lib/crm/leadDetailsUpdate.ts`, scripts | Break-glass API + server actions when no user session; CRM write bypass | Optional | **Strongly recommended** for ops | Generate random 32+ chars | `fi_admin_xxxxxxxxxxxxxxxx` | Yes (commented) | String equality in code paths; unset disables admin-key path |
| `FI_IMPORT_ADMIN_KEY` | optional (script) | `scripts/import-approved-fi-services.ts` | Service import script | Script only | CI secret if used | Same as or distinct from `FI_ADMIN_API_KEY` | `fi_import_...` | **No** | Compared to `FI_ADMIN_API_KEY` in script |

\*Several flows work without it if the user is authenticated with appropriate roles; many **tenant API routes** accept `x-fi-admin-key` / query `adminKey` / body when this is set.

---

## Cron

| Env var | Req | Primary file(s) | Module | Local | Vercel prod | Source | Safe example | .env.ex | Validation |
|---------|-----|-------------------|--------|-------|-------------|--------|--------------|---------|--------------|
| `FI_REMINDER_CRON_SECRET` | required if reminder cron enabled | `app/api/cron/fi-reminder-jobs/route.ts` | ReminderOS / `fi_reminder_jobs` processor | If testing cron locally | Yes (≥16 chars) | Generate random | `cron_rem_xxxxxxxxxxxxxxxx` | Yes (commented) | Min length 16; Bearer or `x-fi-reminder-secret` |
| `CRON_SECRET` | required if HR cron enabled | `src/lib/hr/iiohrHrPerthStaffSyncCron.ts` | HR Perth scheduled sync | If testing | Yes (≥16 chars) | Generate random (separate from reminder secret) | `cron_hr_xxxxxxxxxxxxxxxx` | **No** (documented in `docs/FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md`) | Min length 16; Bearer only |

---

## Timely / Zapier webhooks

| Env var | Req | Primary file(s) | Module | Local | Vercel prod | Source | Safe example | .env.ex | Validation |
|---------|-----|-------------------|--------|-------|-------------|--------|--------------|---------|--------------|
| `FI_TIMELY_WEBHOOK_SECRET` | **required in production** for Timely routes | `src/lib/integrations/timely/timelyWebhookAuth.server.ts`, Timely routes, admin discovery UI | LeadFlow / bookings — Zapier → FI | Set if exercising webhooks | **Yes** | Shared with Zapier “Bearer” step | `zap_timely_xxxxxxxx` | Yes (commented) | Production: 503 if unset on Timely routes; dev: 503 if unset when hit |

---

## Resend + Twilio (reminders + comms)

| Env var | Req | Primary file(s) | Module | Local | Vercel prod | Source | Safe example | .env.ex | Validation |
|---------|-----|-------------------|--------|-------|-------------|--------|--------------|---------|--------------|
| `RESEND_API_KEY` | optional* | `src/lib/reminders/reminderDeliveryConfig.server.ts` | Email reminder delivery | If sending email | Yes if email reminders | Resend dashboard | `re_xxxx` | Yes (commented) | Null → email channel unavailable |
| `RESEND_FROM_EMAIL` | optional* | same | From address | If sending | Yes | Verified domain in Resend | `reminders@clinic.example` | Yes | None |
| `RESEND_FROM_NAME` | optional | same | Display name | Optional | Optional | Marketing choice | `Clinic Name` | Yes | None |
| `TWILIO_ACCOUNT_SID` | optional* | same | SMS | If SMS | Yes if SMS | Twilio | `ACxxxxxxxx` | Yes | None |
| `TWILIO_AUTH_TOKEN` | optional* | same | SMS | If SMS | Yes | Twilio | `xxxxxxxx` | Yes | None |
| `TWILIO_FROM_NUMBER` / `TWILIO_PHONE_NUMBER` | optional* | same | SMS sender | If SMS | Yes | Twilio number | `+61400000000` | Yes | Either key accepted for “from” |
| `TWILIO_DEFAULT_COUNTRY_CODE` | optional | same | E.164 normalisation | Optional | Optional | Ops | `61` | Yes | None |

\*Required for **live** reminder delivery on those channels; cron may still run and cancel/skip per policy.

### Reminder safety / test toggles

| Env var | Req | Primary file(s) | Module | Local | Vercel prod | Source | Safe example | .env.ex | Validation |
|---------|-----|-------------------|--------|-------|-------------|--------|--------------|---------|--------------|
| `FI_REMINDERS_LIVE_DELIVERY` | optional | `src/lib/reminders/reminderLiveDeliveryPolicy.server.ts` | Staging kill-switch | Staging | Staging: `false`; prod: `true` | Ops policy | `false` | See `docs/FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md` | truthy/falsey parsing |
| `FI_REMINDER_TEST_EMAIL` | optional | same | Redirect email in non-live modes | Dev | Rarely | Ops | `you+test@example.com` | **No** | None |
| `FI_REMINDERS_TEST_SEND` | optional | same | Test send flag | Dev | Avoid in prod | Ops | `true` | **No** | None |

---

## OpenAI (DoctorOS / pathology)

| Env var | Req | Primary file(s) | Module | Local | Vercel prod | Source | Safe example | .env.ex | Validation |
|---------|-----|-------------------|--------|-------|-------------|--------|--------------|---------|--------------|
| `OPENAI_API_KEY` | optional* | `src/lib/clinicalNotes/voiceClinicalNoteAi.server.ts`, `src/lib/pathology/pathologyAiInterpretationMutations.server.ts` | Voice clinical notes; pathology AI interpretation | If using features | Yes if features on | OpenAI | `sk-...` | Yes (commented) | Unset → mutations fail at runtime |
| `OPENAI_CLINICAL_NOTE_MODEL` | optional | `src/lib/clinicalNotes/voiceClinicalNoteAi.server.ts` | Voice notes model override | Optional | Optional | OpenAI model slug | `gpt-4o-mini` | Yes | Defaults to `gpt-4o-mini` |
| `OPENAI_PATHOLOGY_INTERPRETATION_MODEL` | optional | `src/lib/pathology/pathologyAiInterpretationMutations.server.ts` | Pathology AI | Optional | Optional | OpenAI | `gpt-4o-mini` | **No** | Falls back to `OPENAI_CLINICAL_NOTE_MODEL` then `gpt-4o-mini` |

---

## HR staff feed + IIOHR sync

| Env var | Req | Primary file(s) | Module | Local | Vercel prod | Source | Safe example | .env.ex | Validation |
|---------|-----|-------------------|--------|-------|-------------|--------|--------------|---------|--------------|
| `IIOHR_HR_PERTH_STAFF_FEED_URL` | optional* | `src/lib/hr/loadEvolvedPerthHrStaffSnapshot.server.ts` | HR JSON feed fetch | If running HR import/cron | Yes if automation | IIOHR / internal feed URL | `https://hr-feed.example/staff.json` | **No** | URL trim |
| `IIOHR_HR_PERTH_STAFF_FEED_KEY` | optional | same | Bearer for feed GET | If feed requires auth | If feed requires auth | Shared secret with feed host | `feed_key_xxxx` | **No** | None |
| `IIOHR_HR_SYNC_SECRET` | optional* | `src/lib/staffImport/iiohrHrStaffSyncPost.server.ts`, `src/lib/hr/iiohrFiStaffSyncPush.ts`, health actions | `x-iiohr-sync-secret` on `POST .../integrations/iiohr-hr/staff-sync` | If testing POST | **Yes** if endpoint exposed | Generate random | `iiohr_sync_xxxx` | **No** | Compared to header |
| `FI_BASE_URL` | optional* | `src/lib/hr/iiohrFiStaffSyncPush.ts`, tests, replay scripts | Outbound HR client posts back to FI | Cron worker host | **Yes** for HR cron self-POST | Public deploy URL | `https://app.example.com` | **No** | None |
| `EVOLVED_PERTH_TENANT_ID` | optional* | `src/lib/hr/runScheduledIiohrHrStaffSync.server.ts`, scripts | Target tenant UUID for Perth automation | If automation | Yes if HR cron | DB `fi_tenants.id` | UUID | **No** | UUID zod in cron |
| `ALLOW_EMPTY_HR_SYNC` | optional | `src/lib/hr/runScheduledIiohrHrStaffSync.server.ts`, `src/lib/actions/fi-hr-sync-health-actions.ts` | Allow empty feed no-op | Staging | Rarely prod | Ops | `true` | **No** | `=== "true"` |
| `STAFF_SYNC_STALE_WARNING_HOURS` | optional | `src/lib/hr/iiohrHrStaffSyncHealth.ts` | Health thresholds | Optional | Optional | Ops | `48` | **No** | Parsed int |
| `STAFF_SYNC_ALERT_EMAIL` | optional | `src/lib/hr/staffSyncAlertIntent.server.ts` | Alert intent logging (email not sent yet) | Optional | Optional | Ops email | `ops@example.com` | **No** | None |

\*Required for the **Evolved Perth HR cron + staff-sync pipeline** as documented in [`docs/iiohr-hr-perth-staff-sync-cron.md`](../iiohr-hr-perth-staff-sync-cron.md).

---

## Storage

| Env var | Req | Primary file(s) | Module | Local | Vercel prod | Source | Safe example | .env.ex | Validation |
|---------|-----|-------------------|--------|-------|-------------|--------|--------------|---------|--------------|
| `FI_STORAGE_BUCKET_INTAKES` | optional | `app/api/fi/uploads/route.ts`, `lib/fi/stages/blood_extract.ts`, `lib/fi/stages/pdf_render.ts`, scripts | Intake / case file bucket name | Optional | Optional if default ok | Supabase Storage bucket | `fi-intakes` | **No** | Defaults to `fi-intakes` |

---

## Tenant bootstrap / provisioning (scripts)

| Env var | Req | Primary file(s) | Module | Local | Vercel prod | Source | Safe example | .env.ex | Validation |
|---------|-----|-------------------|--------|-------|-------------|--------|--------------|---------|--------------|
| `FI_EVOLVED_TENANT_SLUG` | optional | `scripts/provision-evolved-tenant.ts`, HubSpot scripts | Bootstrap / import | Scripts | Rarely | Chosen slug | `evolved` | **No** | Defaults in scripts |
| `FI_EVOLVED_TENANT_NAME` | optional | `scripts/provision-evolved-tenant.ts` | Bootstrap | Scripts | Rarely | Display name | `Evolved Perth` | **No** | Default in script |
| `FI_EVOLVED_DEFAULT_TIMEZONE` | optional | `scripts/provision-evolved-tenant.ts` | Bootstrap | Scripts | Rarely | IANA TZ | `Australia/Perth` | **No** | Default |
| `FI_HUBSPOT_IMPORT_TENANT_ID` | optional | HubSpot import scripts | LeadFlow import | Scripts | N/A | UUID from DB | UUID | **No** | None |

---

## Development / UAT toggles (avoid in production)

| Env var | Req | Primary file(s) | Module | Local | Vercel prod | Source | Safe example | .env.ex | Validation |
|---------|-----|-------------------|--------|-------|-------------|--------|--------------|---------|--------------|
| `FI_ENABLE_DEV_ADMIN_ACCESS` | optional (dev only) | `src/lib/fiAdmin/fiAdminTenantDirectory.ts` | Lists all tenants without session when `NODE_ENV !== production` | Local only | **Must be unset/false** | Local `.env.local` | `true` | Yes (commented) | Ignored when `NODE_ENV=production` |
| `FI_DEVELOPMENT_ADMIN_AUTH_USER_IDS` | optional | `src/lib/fiOs/developmentClinicAccess.ts` | Grants broad ClinicOS mutation access to listed auth user IDs | Dev convenience | **Avoid** — bypasses normal role matrix | Comma-separated auth UUIDs | `uuid1,uuid2` | **No** | String split |
| `FI_ALLOW_CALENDAR_UAT_SEED` | optional | `src/lib/calendar/calendarUatSeed.server.ts` | UAT calendar seed | Dev | **Avoid prod** | Ops | `true` | **No** | `=== "true"` |

---

## Misc script / DB maintenance

| Env var | Req | Primary file(s) | Module | Local | Vercel prod | Source | Safe example | .env.ex | Validation |
|---------|-----|-------------------|--------|-------|-------------|--------|--------------|---------|--------------|
| `SUPABASE_DB_PASSWORD` | optional (scripts) | `scripts/apply-fi-consultations-remote.mjs`, `scripts/apply-fi-case-post-op-tracking-remote.mjs` | Remote SQL apply | Script machine | **Not on Vercel app** | Supabase DB password | `(secret)` | **No** | None |
| `FI_BASE_URL`, `FI_TENANT_ID`, `FI_CASE_ID` | optional | `scripts/replay-test.ts`, `scripts/replay-job-lock-test.ts`, `scripts/verify-fi-event-ingestion.ts` | QA / replay | Scripts | N/A | Local/staging URL + UUIDs | — | **No** | None |

---

## Previously missing from `.env.example` (now documented)

The following were added in Patch PR 4 to [`.env.example`](../../.env.example) (commented placeholders):

- `CRON_SECRET`, `EVOLVED_PERTH_TENANT_ID`, `FI_BASE_URL`, `IIOHR_HR_SYNC_SECRET`, `IIOHR_HR_PERTH_STAFF_FEED_URL`, `IIOHR_HR_PERTH_STAFF_FEED_KEY`, `ALLOW_EMPTY_HR_SYNC`
- `FI_STORAGE_BUCKET_INTAKES`
- `NEXT_PUBLIC_APP_URL`
- `OPENAI_PATHOLOGY_INTERPRETATION_MODEL`
- `FI_REMINDERS_LIVE_DELIVERY`, `FI_REMINDER_TEST_EMAIL`, `FI_REMINDERS_TEST_SEND`
- `STAFF_SYNC_STALE_WARNING_HOURS`, `STAFF_SYNC_ALERT_EMAIL`
- `FI_DEVELOPMENT_ADMIN_AUTH_USER_IDS`, `FI_ALLOW_CALENDAR_UAT_SEED`
- `FI_HUBSPOT_IMPORT_TENANT_ID`, `FI_IMPORT_ADMIN_KEY`, `FI_EVOLVED_*` provisioning trio
- `FI_LEGACY_FI_API_*`, `FI_ALLOW_INSECURE_API`, `FI_ALLOW_ADMIN_KEY_QUERY`

---

## ~~Missing from `.env.example` (gaps)~~ (resolved — see above)

## Central validation (mitigated)

- **`src/lib/env/fiEnv.server.ts`** — `validateFiServerEnv` / `assertFiServerEnv` (Zod URL checks, production forbidden flags, conditional secret lengths). Run **`pnpm run check:env`** in CI or before go-live with the same env as production. Not auto-imported by `next dev` (explicit check first).
- **Residual:** misconfiguration can still surface at runtime if `check:env` is skipped; consider a CI gate on merge to main.

---

## Remaining deployment risks (not fully covered by central validation)

- **Service role** is widely required; a typo in `NEXT_PUBLIC_SUPABASE_URL` vs service URL alignment may not fail until first DB call.
- **`FI_ADMIN_API_KEY`** in header / body enables powerful bypass — must never leak to browser bundles (today it is server-only; keep that invariant).

---

## Zapier / HubSpot / “webhook secrets” summary

| Integration | Secret env | Inbound route pattern |
|-------------|------------|------------------------|
| Timely via Zapier | `FI_TIMELY_WEBHOOK_SECRET` | `POST /api/tenants/[tenantId]/integrations/timely/{patient,appointment,discovery}` |
| IIOHR HR → FI | `IIOHR_HR_SYNC_SECRET` | `POST /api/tenants/[tenantId]/integrations/iiohr-hr/staff-sync` (`x-iiohr-sync-secret`) |
| HubSpot | **No dedicated inbound webhook route found** in `app/api` | Imports via FI Admin + server actions (`lib/actions/fi-hubspot-crm-import-actions.ts`) — keys/secrets belong in **scripts** or **server env** for API clients if added later |
| Generic integration inbox | N/A (table exists) | `fi_integration_webhook_events` (see webhook audit) |
| FI RevenueOS / Stripe | `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY` | `POST /api/fi-payments/stripe/webhook` (see [`docs/runbooks/fi-os-stage7-revenue-payments.md`](fi-os-stage7-revenue-payments.md)) |

---

## Checklist: variables called out in hardening brief

| Topic | Covered by |
|-------|------------|
| Supabase URL / anon / service role | Core platform table |
| Resend | Resend + Twilio table |
| OpenAI | OpenAI table |
| Timely | `FI_TIMELY_WEBHOOK_SECRET` |
| Zapier / webhook secrets | Timely bearer + IIOHR header |
| Cron secrets | `FI_REMINDER_CRON_SECRET`, `CRON_SECRET` |
| Admin API keys | `FI_ADMIN_API_KEY`, script keys |
| Site URL / app URL | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL` |
| Tenant bootstrap | Provisioning / HubSpot script vars |
| Staff feed / HR sync | HR table |
| Central env validation | `validateFiServerEnv` / `pnpm run check:env` ([`src/lib/env/fiEnv.server.ts`](../../src/lib/env/fiEnv.server.ts)) |
| Smoke (cron / webhook hygiene) | `pnpm run smoke:prod` — [`scripts/fi-production-smoke-test.ts`](../../scripts/fi-production-smoke-test.ts) |
| Pathology / reminder email | OpenAI + Resend + reminder toggles |
