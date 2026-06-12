# FI OS Stage 7 — RevenueOS / PaymentsOS

## Scope

- **Database:** `fi_invoices`, `fi_invoice_items`, `fi_payments`, `fi_payment_requests`, `fi_deposit_rules`, `fi_payment_webhook_events` (migration `20260727120001_fi_os_stage7_revenue_payments.sql`).
- **Stage 7F (clinic ops + reminders):** `fi_payment_requests.public_token` (public pay links) and `fi_revenue_reminder_runs` (cron idempotency) — migration `20260728120001_fi_os_stage7f_clinic_payment_ops.sql`.
- **Manual tracking:** Existing `fi_payment_records` and UI remain unchanged.
- **Automation hints:** `fi_invoices.automation_hints` and `fi_deposit_rules.metadata` hold reminder-oriented structure only — no automatic patient contact without templates + consent.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `FI_PAYMENTS_ENABLED` | Gate RevenueOS dashboard KPIs and Stripe checkout from server actions. |
| `FI_PAYMENT_PROVIDER` | e.g. `stripe` or `manual`. |
| `FI_PAYMENTS_CRON_SECRET` | **Preferred** secret for **`/api/cron/fi-payments/reminders`** (Bearer or `x-fi-payments-secret`); min length **16** (see `cronAuth`). |
| `FI_PAYMENT_REQUEST_EXPIRY_DAYS` | Default suggested expiry window for payment links (informational; Stripe Checkout has its own session TTL). **Set explicitly in production** (e.g. `7`). If omitted, server code currently defaults to **`14`** (`fiPaymentEnv.server.ts`). |
| `STRIPE_SECRET_KEY` | Server-side Stripe API. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client publishable key when building hosted checkout from the browser (future); checkout today is server-created. |
| `STRIPE_WEBHOOK_SECRET` | Verifies `POST /api/fi-payments/stripe/webhook`. |
| `FI_PAYMENT_SUCCESS_URL` | Stripe Checkout `success_url`. |
| `FI_PAYMENT_CANCEL_URL` | Stripe Checkout `cancel_url`. |
| `CRON_SECRET` | **Fallback** for payments reminder cron (same as other Vercel crons); native Vercel Cron injects this into `Authorization: Bearer`. |

### Required for RevenueOS + reminder cron (production checklist)

| Variable | Example / note |
|----------|------------------|
| `FI_PAYMENTS_ENABLED` | `true` |
| `FI_PAYMENTS_CRON_SECRET` | Strong random secret (≥16 chars); preferred dedicated secret for payments cron |
| `FI_PAYMENT_REQUEST_EXPIRY_DAYS` | `7` (align staff expectations with Stripe session behaviour) |

### Provider: manual mode

| Variable | Value |
|----------|--------|
| `FI_PAYMENT_PROVIDER` | `manual` |

Online card checkout is not created; staff share **public pay links** (`/pay/[token]`) that tell the patient to contact the clinic.

### Provider: Stripe mode

| Variable | Purpose |
|----------|---------|
| `FI_PAYMENT_PROVIDER` | `stripe` |
| `STRIPE_SECRET_KEY` | Server Stripe API |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Publishable key (future client flows; server creates Checkout today) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `FI_PAYMENT_SUCCESS_URL` | Checkout `success_url` |
| `FI_PAYMENT_CANCEL_URL` | Checkout `cancel_url` |

## Stage 7F — Payment reminder cron

**Cron URL:** **`GET /api/cron/fi-payments/reminders`** ( **`POST`** supported with the same handler).

**Auth**

- **`FI_PAYMENTS_CRON_SECRET`** preferred.
- **`CRON_SECRET`** fallback (useful when Vercel Cron only injects `CRON_SECRET` into `Authorization: Bearer`).
- Accepted via **`Authorization: Bearer <secret>`** or header **`x-fi-payments-secret: <secret>`** (timing-safe compare; secrets must meet min length — see [`fi-os-cron-production-audit.md`](fi-os-cron-production-audit.md)).

**Optional query parameters**

| Param | Meaning |
|-------|---------|
| `dryRun=1` or `dry_run=1` | Count / evaluate only — **no** inserts into `fi_revenue_reminder_runs` and **no** CRM writes |
| `tenantId=<uuid>` | Run only for that tenant’s invoices (scoped path) |
| `date=YYYY-MM-DD` | “As of” calendar day for reminder matching (defaults to **UTC** today from the handler) |
| `limit=<number>` | Max invoices examined (default **200**, max **500**) |

**Behaviour**

- Cron reads **`fi_invoices`** in collectible statuses with a **`due_date`**, using **`automation_hints`** (e.g. `deposit_due_reminder_days`, `balance_due_reminder_days`, `overdue_reminder_enabled`).
- On a non–dry-run hit, it inserts a row into **`fi_revenue_reminder_runs`** and appends CRM activity **`fi_os_revenue_reminder_due`** (anchors optional when invoice has no lead/patient/case).
- **Idempotency:** unique **`(tenant_id, invoice_id, reminder_key, run_date)`** on `fi_revenue_reminder_runs` — duplicate invocations for the same logical reminder do not double-write. (Keyed per **invoice**, not per `fi_payment_requests` row; rotating payment links does not reset reminder deduplication for that day/key.)
- **Stage 7F does not send email or SMS.** Outbound patient contact requires a later communication sender stage, explicit tenant settings, and safe sender configuration.
- **Production:** use **`dryRun=1`** first; confirm `examined` / `candidates` / `recorded` in JSON, then switch the schedule to a non–dry-run path when ready.
- **`FI_PAYMENTS_ENABLED`** gates other RevenueOS server paths (checkout, dashboard KPIs). The reminder cron route does **not** currently short-circuit on this flag, but keep **`true`** in any environment where Stage 7 payments are operational so staff-facing flows stay consistent.

**Public payment links**

- Patient pages load by **`fi_payment_requests.public_token`** at **`/pay/[token]`** — **no** tenant dashboard auth, **no** exposure of internal tenant UUIDs in the UI, and **no** clinical narrative (invoice summary / amount / brand only).
- See also: cron jobs audit table — [`fi-os-cron-production-audit.md`](fi-os-cron-production-audit.md).

### Vercel cron example

**Note:** **`21:00` UTC** is **07:00** in Brisbane during **AEST**.

```json
{
  "crons": [
    {
      "path": "/api/cron/fi-payments/reminders?dryRun=1",
      "schedule": "0 21 * * *"
    }
  ]
}
```

Remove `dryRun=1` from the path when you intend live `fi_revenue_reminder_runs` + CRM writes.

## Webhook

Configure Stripe to send events to:

`POST /api/fi-payments/stripe/webhook`

Handled events today: `checkout.session.completed` (allocates payment), failure events enqueue CRM `fi_os_payment_failed` when tenant metadata is present.

## CRM activity kinds

- `fi_os_payment_received`
- `fi_os_payment_failed`
- `fi_os_revenue_reminder_due` (Stage 7F — cron automation signal; **no** outbound send in 7F)

These are informational for CRM timelines; they do not change clinical or surgical authorization.

## Surgery readiness

When an active `fi_deposit_rules` row sets `blocks_surgery_readiness_when_unpaid` and an open `surgery_deposit` invoice has a balance, `buildCaseReadiness` adds a **bookings** section check. This is a **soft, explainable signal** — staff can still proceed after manual verification.
