# Infrastructure hardening audit — Follicle Intelligence

Principal security architecture review focused on **blast radius**, **defence in depth**, and **operational resilience** at multi-clinic scale. This document is the audit record; implementation deltas land in migrations and server modules referenced below.

## Executive summary

| Priority | Theme | Posture |
|----------|--------|---------|
| 1 | Service role (`supabaseAdmin`) | **Concentrated risk.** Most tenant data paths intentionally bypass RLS. Mitigation is strict **route / server-action gates** plus **RLS where the data model allows** (see `fi_cases`). |
| 2 | `fi_cases` RLS | **Fixed in DB:** tenant-member `SELECT` only for `authenticated`; **no** broad authenticated DML. Server ingestion unchanged (service role bypasses RLS). |
| 3 | `route.ts` boundaries | **Tenant APIs:** generally gated via `assertCrmTenantReadAllowed` / `assertCrmTenantWriteAllowed` (+ optional `FI_ADMIN_API_KEY`). **Legacy `/api/fi/*`:** gated by `FI_LEGACY_FI_API_ENABLED` + `FI_LEGACY_FI_API_SECRET` (Bearer only). **Audit/report routes:** `checkFiTenantPortalApiAccess` (session or explicit insecure bypass **never** in production). |
| 4 | Break-glass / legacy API | **`FI_LEGACY_FI_API_*`** is the main break-glass. Default **disabled**; production should keep it off and move partners to **per-tenant signed webhooks** or authenticated server-to-server flows. |
| 5 | Observability | **`logStructured`** (`src/lib/server/structuredLog.ts`) — JSON lines from cron/webhook failure paths; extend to high-risk routes as needed. |
| 6 | Webhooks / cron | **Stripe:** after persisting `processing_status = error` on `fi_payment_webhook_events`, respond **200** to avoid replay amplification when a row is already recorded (see webhook handler). **Crons:** failures now emit structured logs instead of silent `catch`. |

## 1. Service role usage

**Facts**

- `supabaseAdmin()` centralises `SUPABASE_SERVICE_ROLE_KEY` (`lib/supabaseAdmin.ts`).
- Heavy use in loaders, CRM, payments, imaging, and ingestion is **consistent with** “RLS is not the only enforcement layer” for complex workflows, but it **centralises** trust in application code.

**Recommendations (non-expanding)**

- Prefer **RLS-backed user clients** only where the query is a straight tenant-scoped read/write and gates duplicate what RLS already proves (reduces accidental missing `.eq('tenant_id', …)`).
- Treat **`FI_ADMIN_API_KEY`** as a **second service identity**: rotate often, never log, separate from `CRON_SECRET`.
- Keep internal audit tooling (`tools/audit-supabase-admin-from.*`) in CI as a **regression guard** for id-only service-role reads.

## 2. `fi_cases` RLS architecture

**Historical gap:** `fi_cases` had **no RLS** while other foundation tables used conservative tenant-member `SELECT` (`20260605140009_fi_foundation_rls.sql` explicitly deferred `fi_cases`).

**Change:** `20260818120002_fi_cases_tenant_select_rls.sql` enables RLS and adds `fi_cases_select_tenant_member` (same `fi_users` / `auth.uid()` pattern as `fi_patients`).

**Why safe for current app code:** all observed `fi_cases` mutations go through **server** code using **service role** or route handlers that already assert CRM/admin access; there is no reliance on authenticated direct PostgREST writes to `fi_cases`.

## 3. `route.ts` security boundary inventory

**Strong patterns**

- `/api/tenants/[tenantId]/...` CRM/clinical APIs: **`crmGate`** + tenant id in path.
- Cron: **`assertCronAuthorized`** + minimum secret length (`cronAuth.ts`).
- FI Admin tenant list: **session** via `resolveFiAdminTenantDirectory`.
- Stripe webhook: **signature verification** before DB writes.

**Notable gaps / footguns**

- **`POST /api/fi/copy-check`** — previously had **no auth** (DoS / abuse). **Hardened:** disabled in production unless `FI_ENABLE_PUBLIC_COPY_CHECK` is explicitly enabled (see route).
- **`FI_ALLOW_INSECURE_API`** — correctly **hard-disabled** when `NODE_ENV === production`** (`insecureFiApiBypass.ts`). Never set in prod/staging previews.
- **`FI_LEGACY_FI_API_*`** — single long-lived bearer equals **global blast radius** if leaked. Replace with per-integration credentials (below).

## 4. Replacing break-glass legacy API architecture

**Current model:** `assertLegacyFiApiAccess` (`legacyFiApiAuth.ts`) — feature flag + single shared secret, timing-safe compare, **404 when disabled** (does not advertise existence).

**Target architecture (incremental, no product expansion)**

1. **Per-tenant HMAC** (e.g. `X-FI-Signature` over body + timestamp) stored in tenant config — revocable per clinic.
2. **Supabase Edge Functions** with `verify_jwt` for first-party producers already on Supabase Auth.
3. **IP allowlists** at the edge (Vercel Firewall / Cloudflare) for fixed egress partners.

Until (1)–(3) exist, **operational contract:** `FI_LEGACY_FI_API_ENABLED` must remain **unset/false** in production; use **rotate-on-incident** for `FI_LEGACY_FI_API_SECRET` if ever enabled.

## 5. Structured logging

Use **`logStructured(level, event, { ... })`** for machine-parseable lines. **Do not** log full patient identifiers or clinical payloads — use **ids**, **route names**, **Stripe `event.id`**, **webhook row id**, **tenant_id** only when necessary for correlation.

## 6. Webhook and cron failure handling

- **Stripe:** business logic failures after the `fi_payment_webhook_events` row exists are persisted with `processing_status = error`; the handler **returns HTTP 200** so Stripe does not retry blindly (manual replay / dashboard still possible).
- **Crons (`fi-reminder-jobs`, `fi-payments/reminders`, `fi-photo-protocol-alerts`):** `catch` blocks now **log** the underlying error with `logStructured` while returning a generic JSON body to the caller.

---

## Continuation maps (security hardening)

| Doc | Contents |
|-----|----------|
| [`fi-cases-rls-migration-verification.md`](./fi-cases-rls-migration-verification.md) | `fi_cases` RLS vs `fi_foundation_rls` pattern; apply checklist |
| [`api-routes-inventory.md`](./api-routes-inventory.md) | Every `app/api/**/route.ts` — auth, tenant binding, service role, exposure, risk |
| [`supabase-admin-inventory.md`](./supabase-admin-inventory.md) | `supabaseAdmin()` classification by module (M / L / R / S) |
| [`payment-webhook-idempotency.md`](./payment-webhook-idempotency.md) | Stripe webhook + `recordGatewayPaymentSuccess` / `fi_payments` analysis |

---

*Last updated as part of the infrastructure hardening pass (see git history for concrete code changes).*
