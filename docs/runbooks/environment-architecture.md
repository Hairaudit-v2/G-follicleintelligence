# Environment architecture

**Scope:** Follicle Intelligence OS (Next.js 14 App Router on Vercel + Supabase).  
**Template:** [`.env.example`](../../.env.example) at repo root (91 application variables; framework vars like `NODE_ENV` and `NEXT_RUNTIME` are excluded).  
**Validation:** Zod schemas in [`src/lib/env/`](../../src/lib/env/) — startup via [`instrumentation.ts`](../../instrumentation.ts), CI via `pnpm run check:env`.

---

## Design principles

| Principle | Implementation |
|-----------|----------------|
| **Client vs server split** | `NEXT_PUBLIC_*` → [`@/src/env/client`](../../src/env/client). All other vars → [`@/src/env/server`](../../src/env/server) with `import "server-only"`. |
| **Fail fast in production** | `assertEnvOnStartup()` runs on Node.js server init; production requires Supabase URL, anon key, and service role. |
| **No secret leakage in errors** | Validation reports variable names and messages only — never secret values. |
| **Optional by default** | Most feature flags and integrations are optional locally; production rules tighten when vars are set or features enabled. |

### Import rules

```typescript
// Client Components / shared browser code
import { clientEnv } from "@/src/env/client";

// Server Components, Route Handlers, Server Actions, cron, scripts
import { env } from "@/src/env/server";
```

Never import `@/src/env/server` from a `"use client"` file — the `server-only` package fails the build.

### Deploy URL variables

| Variable | Role |
|----------|------|
| `FI_BASE_URL` | **Scripts and server self-calls** — site root for HubSpot import admin links, HR cron self-POST, smoke/replay/verify scripts. Must not include `/fi-admin`. |
| `NEXT_PUBLIC_SITE_URL` | **Canonical public / auth URL** — password-reset links, auth redirect fallbacks, and script fallback when `FI_BASE_URL` is unset. |
| `NEXT_PUBLIC_APP_URL` | **Removed** — was redundant with `FI_BASE_URL` / `NEXT_PUBLIC_SITE_URL`. Delete from `.env.local` if still present. |

HubSpot import scripts resolve deploy links as: `FI_BASE_URL` → `NEXT_PUBLIC_SITE_URL` → `http://localhost:3000`.

---

## Variable inventory by section

See [`.env.example`](../../.env.example) for the authoritative list with inline comments. Summary:

| Section | Count | Notes |
|---------|------:|-------|
| App | 4 | Public site URL, `FI_BASE_URL`, `BASE_URL`, bundle analyzer |
| Supabase | 5 | Public URL/anon + server service role, storage bucket |
| Authentication | 2 | Legacy FI API Bearer gate |
| Stripe | 7 | RevenueOS payments |
| AI Providers | 3 | OpenAI core + pathology model |
| Email / Resend | 11 | Resend + Twilio + live-delivery kill-switch |
| Cron Jobs | 6 | Vercel cron Bearer secrets |
| Security Secrets | 8 | Admin keys, webhooks, dev bypass flags |
| Analytics | 0 | No env vars — AnalyticsOS uses Supabase |
| ImagingOS | 0 | No env vars — uses shared storage |
| HairAudit Integration | 2 | Classifier token and mode |
| HLI Integration | 5 | OpenAI model overrides for hair intelligence |
| IIOHR Integration | 6 | HR feed, tenant, sync health |
| FI OS Platform | 18 | HubSpot, intelligence flags, tenant bootstrap |
| Development Only | 14 | E2E, smoke, UAT, `SKIP_ENV_VALIDATION` |

---

## Local development

**File:** `.env.local` at repo root (gitignored). Copy from `.env.example`.

### Minimum to run `next dev`

| Variable | Required locally? | Purpose |
|----------|-------------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Recommended | Browser + server Supabase client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Recommended | Auth session (PKCE) |
| `SUPABASE_SERVICE_ROLE_KEY` | Recommended | FI admin pages and API routes using admin client |

Local validation **allows** missing Supabase vars when `NODE_ENV !== production`. Malformed URLs are still rejected if present.

### Common local additions

| Variable | When |
|----------|------|
| `FI_ENABLE_DEV_ADMIN_ACCESS=true` | List all tenants without full session (dev only) |
| `FI_ADMIN_API_KEY` | Break-glass API / script auth |
| `OPENAI_API_KEY` | Voice notes, pathology AI, HLI classifiers |
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL` | Email reminders and transactional mail |
| `FI_REMINDERS_LIVE_DELIVERY=false` | Safe default — no live patient email/SMS |
| `SKIP_ENV_VALIDATION=0` | Leave off locally so misconfig is caught early |

### Local commands

```bash
cp .env.example .env.local
# edit .env.local
pnpm run check:env    # Zod validation gate
pnpm dev
```

---

## Staging (preview / pre-production)

Use a **separate Supabase project** or restricted keys when possible. Mirror production shape but keep delivery safe.

### Staging profile

| Variable | Staging value |
|----------|----------------|
| `NEXT_PUBLIC_SITE_URL` | Preview deployment URL |
| `NEXT_PUBLIC_SUPABASE_*` | Staging Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging service role only |
| `FI_REMINDERS_LIVE_DELIVERY` | **`false`** unless testing delivery to test inboxes |
| `FI_REMINDER_TEST_EMAIL` | Operator test address when testing reminder copy |
| `FI_REMINDERS_TEST_SEND` | `true` only during controlled UAT |
| `FI_ENABLE_DEV_ADMIN_ACCESS` | **Unset / false** |
| `FI_ALLOW_INSECURE_API` | **false** |
| `FI_ALLOW_ADMIN_KEY_QUERY` | **false** |
| `FI_INTELLIGENCE_*` | Enable only for intelligence staging drills (non-production) |
| `ALLOW_EMPTY_HR_SYNC` | `true` if HR feed may be empty during setup |

### Staging cron and webhooks

- Point Zapier/Timely webhooks at the **preview URL** with a **staging-only** `FI_TIMELY_WEBHOOK_SECRET`.
- Use **distinct** cron secrets from production (`CRON_SECRET`, `FI_REMINDER_CRON_SECRET`, etc.).
- HR automation: set `EVOLVED_PERTH_TENANT_ID` to the staging tenant UUID.

---

## Production

### Required (validated)

| Variable | Constraint |
|----------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Valid `https://` Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Non-empty |
| `SUPABASE_SERVICE_ROLE_KEY` | Non-empty, server-only |

### Required when feature enabled

| Feature | Variables |
|---------|-----------|
| Live reminder email | `FI_REMINDERS_LIVE_DELIVERY` truthy → `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Legacy FI API | `FI_LEGACY_FI_API_ENABLED` → `FI_LEGACY_FI_API_SECRET` (≥16 chars) |
| Stripe checkout | `FI_PAYMENTS_ENABLED` + `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Timely webhooks | `FI_TIMELY_WEBHOOK_SECRET` (≥16 chars) |
| Machine ingest HMAC | `FI_MACHINE_INGEST_MASTER_KEY` (≥32 chars) |
| HR cron (Evolved Perth) | `CRON_SECRET` or `FI_HR_SYNC_CRON_SECRET`, `EVOLVED_PERTH_TENANT_ID`, `FI_BASE_URL`, feed URL, `IIOHR_HR_SYNC_SECRET` |

### Forbidden in production (validation fails)

| Variable | Reason |
|----------|--------|
| `FI_ALLOW_INSECURE_API=true` | Bypasses API access controls |
| `FI_ALLOW_ADMIN_KEY_QUERY=true` | Admin key in query strings |
| `FI_ENABLE_DEV_ADMIN_ACCESS=true` | Lists all tenants without auth |
| `SKIP_ENV_VALIDATION=true` | Disables Zod startup/CI validation on production runtime |
| `FI_ALLOW_CALENDAR_UAT_SEED=true` | Enables calendar UAT seed outside development |
| `FI_REMINDERS_TEST_SEND=true` | Allows test reminder sends on production runtime |

`SKIP_ENV_VALIDATION=1` is acceptable only on **ephemeral CI/build workers** that produce deploy artifacts — never set it on the Vercel **Production** environment.

### Recommended production set

Beyond required vars, production deployments typically configure:

- `NEXT_PUBLIC_SITE_URL` — canonical origin for auth redirects
- `FI_BASE_URL` — site root for HR self-POST, smoke scripts, and HubSpot import admin links
- `CRON_SECRET` — Vercel Cron Bearer (≥16 chars)
- `FI_ADMIN_API_KEY` — operator break-glass (≥20 chars)
- `FI_TIMELY_WEBHOOK_SECRET` — if Timely/Zapier is live
- `OPENAI_API_KEY` — if clinical AI features are on
- `FINANCIAL_OS_CRON_SECRET` / `FI_PAYMENTS_CRON_SECRET` — if financial-os crons are scheduled (see `vercel.json`)

---

## Variables that must NEVER be public

Only `NEXT_PUBLIC_*` variables are embedded in the browser bundle. **Never** prefix a secret with `NEXT_PUBLIC_`.

### Server-only secrets (highest sensitivity)

| Variable | Risk if exposed |
|----------|-----------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Full database bypass of RLS |
| `FI_ADMIN_API_KEY` | Break-glass admin API access |
| `FI_MACHINE_INGEST_MASTER_KEY` | Decrypts all per-tenant ingest HMAC secrets |
| `STRIPE_SECRET_KEY` | Payment API access |
| `STRIPE_WEBHOOK_SECRET` | Forge payment webhooks |
| `OPENAI_API_KEY` | Billable API abuse |
| `RESEND_API_KEY` | Send email as your domain |
| `TWILIO_AUTH_TOKEN` | Send SMS, account control |
| `CRON_SECRET` | Trigger Vercel cron and shared cron routes |
| `FI_REMINDER_CRON_SECRET` | Trigger reminder cron |
| `FI_HR_SYNC_CRON_SECRET` | Trigger HR staff-sync cron |
| `FI_PHOTO_PROTOCOL_ALERTS_CRON_SECRET` | Trigger photo-protocol alerts cron |
| `FINANCIAL_OS_CRON_SECRET` | Trigger financial-os cron routes |
| `FI_PAYMENTS_CRON_SECRET` | Trigger payment reminder cron |
| `FI_TIMELY_WEBHOOK_SECRET` | Inject Timely webhook events |
| `IIOHR_HR_SYNC_SECRET` | POST staff-sync payloads |
| `IIOHR_HR_PERTH_STAFF_FEED_KEY` | Bearer auth for HR staff feed GET |
| `HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN` | Classifier endpoint auth |
| `FI_LEGACY_FI_API_SECRET` | Legacy API Bearer |
| `SUPABASE_DB_PASSWORD` | Direct database access (scripts) |
| `FI_IMPORT_ADMIN_KEY` | Script admin access |
| `FI_E2E_DEMO_ADMIN_PASSWORD` | Throwaway e2e credentials (never production) |
| `TWILIO_ACCOUNT_SID` | Twilio account identifier paired with auth token |

### Public by design (still protect operationally)

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public project endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public JWT — **RLS must enforce all access** |
| `NEXT_PUBLIC_SITE_URL` | Public canonical URL for auth and browser-visible origin |
| `NEXT_PUBLIC_FI_CALENDAR_PERF` | Dev perf flag only |

The anon key is intentionally public in Supabase architecture; treat RLS policies as the real security boundary.

---

## Secret rotation policy

| Secret class | Rotation trigger | Procedure |
|--------------|------------------|-----------|
| **Supabase service role** | Compromise, staff offboarding, annual policy | Supabase Dashboard → API → rotate service role → update Vercel env → redeploy → verify admin routes |
| **Supabase anon key** | Rare; project reset | Update `NEXT_PUBLIC_SUPABASE_ANON_KEY` → redeploy (client bundle rebuild required) |
| **Cron secrets** (`CRON_SECRET`, `FI_*_CRON_SECRET`) | Quarterly or on leak | Generate new ≥16-char secret → update Vercel → update Vercel Cron (uses `CRON_SECRET`) → redeploy |
| **Webhook secrets** (Timely, Stripe, IIOHR) | Partner rotation, leak | Coordinate with Zapier/Stripe/IIOHR → update both sides → smoke-test webhook |
| **FI_ADMIN_API_KEY** | Quarterly or on leak | Generate new ≥20-char key → update Vercel + operator runbooks → revoke old key |
| **FI_MACHINE_INGEST_MASTER_KEY** | Compromise | Follow [`fi-os-machine-ingest-hmac-runbook.md`](fi-os-machine-ingest-hmac-runbook.md) — requires re-encrypting tenant HMAC secrets |
| **OPENAI / Resend / Twilio** | Provider dashboard rotation | Rotate in provider → update Vercel → no code change |
| **Stripe** | Dashboard → Developers → API keys | Rotate secret key + webhook signing secret → update Vercel → verify checkout + webhook |

**After every rotation:** run `pnpm run check:env`, deploy, then `pnpm run smoke:prod` (with smoke tenant configured).

**Never** commit secrets to git, paste into tickets, or log in application output.

---

## Deployment checklist

### Before merge / deploy

- [ ] `.env.example` matches code scan (no orphan or missing vars)
- [ ] `pnpm run check:env` passes with production-shaped env (or staging profile)
- [ ] `pnpm run typecheck` passes
- [ ] No `FI_ALLOW_INSECURE_API`, `FI_ALLOW_ADMIN_KEY_QUERY`, `FI_ENABLE_DEV_ADMIN_ACCESS`, `SKIP_ENV_VALIDATION`, `FI_ALLOW_CALENDAR_UAT_SEED`, or `FI_REMINDERS_TEST_SEND` in production Vercel env

### Vercel project settings

- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` set for **Production** (and Preview if used)
- [ ] `NEXT_PUBLIC_SITE_URL` matches production domain
- [ ] `CRON_SECRET` set (≥16 chars) — Vercel Cron sends this as Bearer
- [ ] Cron schedules in [`vercel.json`](../../vercel.json) match enabled features
- [ ] Secrets scoped: Production vs Preview — avoid sharing production service role with previews

### Post-deploy verification

- [ ] App loads FI admin home for authenticated user
- [ ] Supabase auth sign-in / password reset (uses `NEXT_PUBLIC_SITE_URL` fallback)
- [ ] `pnpm run smoke:prod` with `FI_SMOKE_TENANT_ID` (optional secrets for cron/webhook tests)
- [ ] Stripe webhook test event (if payments enabled)
- [ ] Timely discovery webhook 401 with wrong secret, 2xx with correct secret (if Timely live)
- [ ] Reminder cron: check Vercel cron logs for `/api/cron/fi-reminder-jobs`

### Build pipelines without secrets

Docker or CI image builds that lack real secrets may set:

```bash
SKIP_ENV_VALIDATION=1
```

Do **not** use this on production runtime — only during artifact build steps.

---

## Related runbooks

| Document | Topic |
|----------|--------|
| [`fi-os-production-env-and-cron.md`](fi-os-production-env-and-cron.md) | Cron routes and Vercel schedules |
| [`fi-os-env-vars-production-audit.md`](fi-os-env-vars-production-audit.md) | Per-variable module map |
| [`fi-os-machine-ingest-hmac-runbook.md`](fi-os-machine-ingest-hmac-runbook.md) | `FI_MACHINE_INGEST_MASTER_KEY` |
| [`resend-and-transactional-email.md`](resend-and-transactional-email.md) | Resend configuration |
| [`fi-os-stage7-revenue-payments.md`](fi-os-stage7-revenue-payments.md) | Stripe / RevenueOS |
| [`iiohr-hr-perth-staff-sync-cron.md`](../iiohr-hr-perth-staff-sync-cron.md) | HR automation |
| [`fi-os-production-release-checklist.md`](fi-os-production-release-checklist.md) | Full release gate |

---

## Maintenance

When adding a new `process.env.*` reference:

1. Add the variable to [`src/lib/env/schema.ts`](../../src/lib/env/schema.ts) (client or server schema).
2. Add a commented placeholder to [`.env.example`](../../.env.example) in the correct section.
3. Update this document if the variable changes local/staging/production requirements.
4. Run `pnpm run check:env` and unit tests under `src/lib/env/`.

When removing a variable from code, remove it from `.env.example` and `schema.ts` in the same change.
