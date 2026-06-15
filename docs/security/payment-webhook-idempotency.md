# Payment webhook idempotency — Stripe → `fi_payments`

**Scope:** `app/api/fi-payments/stripe/webhook/route.ts`, `src/lib/payments/stripeWebhookIdempotency.ts`, `src/lib/revenueOs/revenueInvoiceMutations.server.ts` (`recordGatewayPaymentSuccess`), schema `20260727120001_fi_os_stage7_revenue_payments.sql`, migration `20260818120003_fi_payments_stripe_intent_unique.sql`.

## What is idempotent today

### 1. `fi_payment_webhook_events` row (Stripe event grain)

- **Unique index:** `uq_fi_payment_webhook_events_provider_event` on `(provider, provider_event_id)` (`provider_event_id` ← Stripe `event.id`).
- **Handler:** On insert conflict, `isStripeWebhookDuplicateInsert` treats **23505** / duplicate message as success; route returns `{ ok: true, duplicate: true }` and **does not re-run** business logic.
- **Conclusion:** **Replay of the same Stripe event id** is safe — no second pass through `recordGatewayPaymentSuccess` for that delivery.

### 2. Webhook HTTP acknowledgement (processing failure path)

- After persisting `processing_status = 'error'` on the webhook row, the handler returns **HTTP 200** (see route) so Stripe does not blindly retry on application exceptions.
- **Trade-off:** Transient failures after insert of the webhook row but before success may require **manual replay** from Stripe Dashboard or a controlled replay job — acceptable when weighed against duplicate payment rows.

### 3. `fi_payments` row (Stripe PaymentIntent grain)

- **Unique index:** `uq_fi_payments_tenant_stripe_payment_intent` — partial unique on `(tenant_id, provider_payment_intent_id)` where `provider = 'stripe'` and `provider_payment_intent_id is not null` (migration `20260818120003_fi_payments_stripe_intent_unique.sql`). Applying this migration **fails** if duplicate rows already exist for the same tenant + Stripe intent; deduplicate or merge those rows first, then re-run the migration.
- **`recordGatewayPaymentSuccess`:** For Stripe with a non-empty `paymentIntentId`:
  1. **Pre-check:** If a `fi_payments` row already exists for that tenant + `provider = 'stripe'` + `provider_payment_intent_id`, the function **returns the current invoice** without inserting, without incrementing `fi_invoices.amount_paid_cents`, without updating `fi_payment_requests`, and without appending a second CRM activity.
  2. **Insert race:** If the insert hits a unique violation (**23505** / duplicate message) for that Stripe + intent path, the same **no-op return** applies (reload invoice and return).
- **Provider storage:** When the provider is Stripe (case-insensitive on input), the stored `fi_payments.provider` value is normalized to `stripe` so it aligns with the partial index predicate and lookups.
- **Conclusion:** **Calling `recordGatewayPaymentSuccess` more than once for the same Stripe PaymentIntent id (per tenant)** does not double-insert `fi_payments` or double-apply `amount_paid_cents`.

### 4. Non-Stripe / missing PaymentIntent

- If `provider` is not Stripe (after trim + lower-case match) or `paymentIntentId` is null/empty, behaviour is unchanged from the historical insert + `patchInvoiceAfterPayment` path (no partial unique index row applies).

## Partial failure after `fi_payments` insert

- If `patchInvoiceAfterPayment` throws after a successful `fi_payments` insert, the outer webhook `catch` marks the **webhook** row `error` and returns 200. A **manual** Stripe replay with the **same** `event.id` hits **duplicate webhook insert** → early return → **invoice may stay inconsistent** until ops repair. This is a **data repair** scenario, not silent double-pay (same event id).
- A replay that **does** reach `recordGatewayPaymentSuccess` again with the same PaymentIntent will hit the **pre-check** or **unique violation** path and will **not** add a second payment row; it will **not** increment `amount_paid_cents` again. If the invoice was never patched after the first insert, that situation still requires **manual reconciliation** (out of scope for this idempotency layer).

## Summary table

| Layer | Idempotent for same Stripe `event.id`? | Idempotent for same Stripe PaymentIntent across different deliveries / code paths? |
|-------|----------------------------------------|--------------------------------------------------------------------------------------|
| `fi_payment_webhook_events` insert | Yes (unique) | N/A |
| Webhook handler skip on duplicate | Yes | N/A |
| `fi_payments` Stripe intent (DB + app) | N/A | **Yes** — at most one row per `(tenant_id, provider_payment_intent_id)` for `provider = 'stripe'`; duplicate handler calls no-op without double-counting `amount_paid_cents` |
| `fi_payments` insert + invoice patch (non-Stripe or no intent id) | Only if handler never runs twice for that path | Same as historical behaviour |

---

*Infrastructure hardening — Stripe gateway payment idempotency.*
