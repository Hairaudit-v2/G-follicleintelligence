# FI OS Stripe production connection readiness

## Current launch decision

FI OS should launch Stripe as a **one-time Checkout / PaymentIntent gateway** while retaining FI-native invoices as the financial system of record. Live processing remains disabled until the checklist below is complete.

Confirmed account:

- Display name: Follicle Intel
- Account ID: `acct_1TN2F45CMnrQiyQG`
- Ownership confirmed: 2026-07-15

## Customer and invoicing decision

| Stripe object | Required for first launch? | Decision |
|---|---:|---|
| Customer | No | Continue guest Checkout. Add a tenant-scoped customer mapping only when saved payment methods, repeat payer history, portal access, or subscriptions are approved. |
| Billing Invoice | No | FI `fi_invoices` remains authoritative. Do not create a second Stripe invoice ledger without a two-way status, tax, void, credit-note, and reconciliation design. |
| Product / Price | No | One-time invoice payments can continue using inline Checkout `price_data`. Introduce a catalogue only for stable reusable offerings. |
| Payment Link | No | FI payment requests and Checkout Sessions already provide scoped, expiring links. |
| Subscription | No | FI subscription tables are entitlement scaffolding only. Stripe Billing requires a separate lifecycle project. |
| Charge mapping | Recommended after launch gate | Persist Charge ID and balance transaction when settlement/payout reconciliation becomes operational. PaymentIntent remains the first-launch idempotency key. |
| Refund mapping | Required before operator refunds | Build refund request, authorization, Stripe refund webhook, ledger reversal, invoice state, and audit controls before enabling refunds. No refund action is part of first launch. |

## Environment contract

Configure secrets only in the production hosting environment; never commit their values.

| Variable | Production requirement |
|---|---|
| `STRIPE_SECRET_KEY` | Live secret or restricted key for the confirmed account |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the production endpoint |
| `STRIPE_EXPECTED_ACCOUNT_ID` | `acct_1TN2F45CMnrQiyQG` |
| `STRIPE_EXPECTED_MODE` | `live` |
| `FI_STRIPE_LIVE_MODE_ALLOWED` | Keep `false` through build and verification; set `true` only at approved cutover |
| `FI_PAYMENT_PROVIDER` | Keep `manual` through build; set `stripe` at approved cutover |
| `FI_PAYMENTS_ENABLED` | Keep `false` through build; set `true` last at approved cutover |
| `FI_PAYMENT_SUCCESS_URL` | Canonical production success URL |
| `FI_PAYMENT_CANCEL_URL` | Canonical production cancellation URL |

The application performs a read-only account retrieval before creating a Checkout Session. It rejects a wrong account, wrong key mode, disabled charges, inactive card-payments capability, or live mode without the explicit kill-switch release.

Verified webhook events are rejected when their `livemode` does not match `STRIPE_EXPECTED_MODE`, or when a live event arrives while the kill switch is closed.

## Stripe Dashboard evidence required

Do not change the endpoint until the existing configuration is inspected.

- Endpoint is the canonical production URL plus `/api/fi-payments/stripe/webhook`.
- Endpoint is in live mode.
- Signing secret matches the production-scoped `STRIPE_WEBHOOK_SECRET`.
- Required events:
  - `checkout.session.completed`
  - `checkout.session.async_payment_failed`
  - `payment_intent.payment_failed`
- No wildcard event subscription unless explicitly justified.
- Record API version, endpoint status, and recent delivery health.
- Confirm account metadata: country, default currency, account type, charges, payouts, and `card_payments` capability.

## Pre-live acceptance checklist

- [ ] Production key authenticates as `acct_1TN2F45CMnrQiyQG`.
- [ ] Account country/currency and capability evidence is recorded.
- [ ] Production variables exist with correct scopes; values are not exported.
- [ ] Preview/development do not receive production Stripe secrets.
- [ ] Production webhook registration and signing-secret pairing are verified.
- [ ] Signed live-mode webhook fixture is rejected while `FI_STRIPE_LIVE_MODE_ALLOWED=false`.
- [ ] Test-mode end-to-end Checkout succeeds in an isolated non-production environment.
- [ ] Payment creates exactly one `fi_payments` row and settles the intended FI invoice once.
- [ ] Duplicate event and duplicate PaymentIntent replays are no-ops.
- [ ] Amount/currency mismatch remains unresolved and does not settle the invoice.
- [ ] Operator monitoring covers webhook `error` rows and reconciliation exceptions.
- [ ] A documented repair procedure handles payment-row/invoice partial failure.
- [ ] Raw webhook payload/email retention and access controls are approved.
- [ ] Rollback is rehearsed: set `FI_PAYMENTS_ENABLED=false`, then `FI_PAYMENT_PROVIDER=manual`.

## Controlled cutover order

1. Deploy the readiness controls with payments disabled.
2. Configure production-scoped variables except the final enable flag.
3. Verify account binding and webhook registration using read-only checks.
4. Set `FI_STRIPE_LIVE_MODE_ALLOWED=true`.
5. Set `FI_PAYMENT_PROVIDER=stripe`.
6. Set `FI_PAYMENTS_ENABLED=true` last.
7. Redeploy and observe the first approved low-value payment with two operators.
8. Immediately disable payments on any account, mode, signature, duplicate, amount, currency, or settlement anomaly.

## Explicitly deferred

- Creating Stripe Customers or importing FI patients into Stripe.
- Stripe Billing invoices, Products, Prices, Payment Links, or Subscriptions.
- Refund execution and dispute automation.
- Payout/balance-transaction reconciliation.
- Stored payment methods.

Each deferred area requires its own data-minimisation, tenant-mapping, lifecycle, reconciliation, security, and rollback design before any Stripe records are created.

## Pre-live deployment evidence — 2026-07-15

| Check | Result |
|---|---|
| Isolated branch | `codex/fi-stripe-connection-audit-1` |
| Commit | `74a20e51e25ecd66a703e8d282330eca0b99c051` |
| Vercel preview deployment | `dpl_gQtheGCgxN5iU7iLahjku5tnfFio` |
| Preview status | READY |
| Preview URL | `https://g-follicleintelligence-5bwom2j7i-fi-ai-ef8ee84f.vercel.app` |
| Build errors | None |
| Preview runtime errors/fatals after deployment | None observed |
| Production promotion | **BLOCKED / NOT ATTEMPTED** |

Production was running a promoted deployment from `codex/fi-hubspot-live-sync-recovery` at the time of this check. The Stripe branch was based on `main`; promoting it directly could regress newer HubSpot recovery work. Integrate the three Stripe commits onto the current production code line and rebuild a preview before promotion.

The preview is protected by Vercel Authentication. Environment-variable name/scope inspection was unavailable through the connected Vercel read interface, and the local CLI could not reach Vercel. Stripe webhook endpoint inventory was also unavailable through the connected Stripe read interface. These checks remain open and no configuration was changed.
