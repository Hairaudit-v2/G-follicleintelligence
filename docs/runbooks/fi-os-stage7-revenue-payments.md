# FI OS Stage 7 — RevenueOS / PaymentsOS

## Scope

- **Database:** `fi_invoices`, `fi_invoice_items`, `fi_payments`, `fi_payment_requests`, `fi_deposit_rules`, `fi_payment_webhook_events` (migration `20260727120001_fi_os_stage7_revenue_payments.sql`).
- **Manual tracking:** Existing `fi_payment_records` and UI remain unchanged.
- **Automation hints:** `fi_invoices.automation_hints` and `fi_deposit_rules.metadata` hold reminder-oriented structure only — no automatic patient contact without templates + consent.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `FI_PAYMENTS_ENABLED` | Gate RevenueOS dashboard KPIs and Stripe checkout from server actions. |
| `FI_PAYMENT_PROVIDER` | e.g. `stripe` or `manual`. |
| `STRIPE_SECRET_KEY` | Server-side Stripe API. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client publishable key when building hosted checkout from the browser (future); checkout today is server-created. |
| `STRIPE_WEBHOOK_SECRET` | Verifies `POST /api/fi-payments/stripe/webhook`. |
| `FI_PAYMENT_SUCCESS_URL` | Stripe Checkout `success_url`. |
| `FI_PAYMENT_CANCEL_URL` | Stripe Checkout `cancel_url`. |

## Webhook

Configure Stripe to send events to:

`POST /api/fi-payments/stripe/webhook`

Handled events today: `checkout.session.completed` (allocates payment), failure events enqueue CRM `fi_os_payment_failed` when tenant metadata is present.

## CRM activity kinds

- `fi_os_payment_received`
- `fi_os_payment_failed`

These are informational for CRM timelines; they do not change clinical or surgical authorization.

## Surgery readiness

When an active `fi_deposit_rules` row sets `blocks_surgery_readiness_when_unpaid` and an open `surgery_deposit` invoice has a balance, `buildCaseReadiness` adds a **bookings** section check. This is a **soft, explainable signal** — staff can still proceed after manual verification.
