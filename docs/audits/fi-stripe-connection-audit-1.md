# FI-STRIPE-CONNECTION-AUDIT-1

**Audit date:** 2026-07-15 (Australia/Brisbane)  
**Scope:** read-only Stripe connection, FI OS repository at `origin/main`, and production Supabase project `iqqvzgxoimxchhcnbzxl`  
**Change controls:** no Stripe or production writes; no HubSpot files or branch changes

## Verdict

**AMBER — integration code and production schema are materially scaffolded, but production-live Stripe processing is not verified.**

The Stripe connector is authenticated to account `acct_1TN2F45CMnrQiyQG`, displayed as **Follicle Intel**. This is consistent with FI naming, but the connector exposes insufficient account profile detail to independently prove that it is the intended Evolved business account. Production contains one Stripe-labelled succeeded payment/PaymentIntent mapping, but no Stripe webhook events, no Stripe connector/auth records, and no reconciliation rows. That isolated row is not sufficient evidence of a live end-to-end payment.

## Connected account verification

| Metadata | Result |
|---|---|
| Account/business display name | Follicle Intel |
| Account ID | `acct_1TN2F45CMnrQiyQG` |
| Intended Evolved business account | **PARTIAL** — naming is consistent; legal/business ownership was not exposed by the connector |
| Country | **UNKNOWN** |
| Default currency | **UNKNOWN** |
| Live/test capability state | **UNKNOWN** |
| Charges enabled | **UNKNOWN** |
| Payouts enabled | **UNKNOWN** |
| Account type | **UNKNOWN** |
| Capability statuses | **UNKNOWN** |

The connected Stripe tool returned only account ID and display name. Attempts to use its generic read interface for richer account metadata were unsupported. No secret, dashboard key, customer, or payment detail was recorded in this report.

## Current architecture

1. Server-only configuration selects `manual` or `stripe` and gates the system with `FI_PAYMENTS_ENABLED`.
2. Stripe Checkout creates one-time Sessions with inline `price_data`; FI tenant, invoice, and payment-request IDs are placed in Session and PaymentIntent metadata.
3. The public `/pay/[paymentRequestToken]` surface loads a tenant-bound FI payment request and uses the stored Checkout URL when Stripe is enabled.
4. `POST /api/fi-payments/stripe/webhook` verifies the raw request with `Stripe-Signature` and `STRIPE_WEBHOOK_SECRET` before database writes.
5. Verified events are stored in `fi_payment_webhook_events`; completed Checkouts flow into `fi_payments`, invoice settlement, payment-request state, reconciliation, CRM activity, and audit/event side effects.
6. Replay controls exist at Stripe event grain and tenant + PaymentIntent grain.
7. FI invoices, payment requests, payment records, payment pathways, reconciliation, reporting, and operator UI are internal FI OS records. They are not Stripe Billing invoices, Stripe Payment Links, or a Stripe product catalogue.

## Production evidence

Production Supabase was identified from both repository controls and the connected project list as **Follicle Intelligence** (`iqqvzgxoimxchhcnbzxl`).

| Evidence (aggregate only) | Production result |
|---|---|
| FI invoices | 421 |
| FI payments | 689 |
| Payment providers | 687 demo, 1 manual/no provider, 1 Stripe |
| Stripe succeeded payments | 1 |
| Stripe PaymentIntent mappings | 1 |
| FI payment requests | 800, all labelled demo |
| Stripe webhook events | 0 |
| Payment reconciliation rows | 0 |
| Stripe tenant connector records | 0 |
| Stripe connector auth sessions | 0 |

All core payment tables have `tenant_id`, RLS enabled, and at least one tenant policy. Production also contains both unique controls:

- `(provider, provider_event_id)` for webhook delivery replay.
- `(tenant_id, provider_payment_intent_id)` for Stripe PaymentIntent replay.

The production migration history includes the payment records, revenue payments, clinic payment operations, and Stripe PaymentIntent uniqueness migrations.

### What is production-live

- The FI invoice/payment/payment-request schema is deployed and populated.
- Tenant RLS and Stripe-related uniqueness indexes are deployed.
- FI financial UI/reporting has production data.

### What is scaffolded or unverified

- Stripe Checkout and webhook application code are implemented.
- The production webhook endpoint's existence in code is verified, but Stripe Dashboard endpoint registration and recent delivery health are **UNKNOWN**.
- Production environment variable presence and mode are **UNKNOWN**; values were not inspected.
- The single Stripe-labelled row is an unexplained exception, not proof of end-to-end live processing.
- Repository documentation explicitly states that Stripe is not live, and production telemetry does not disprove that statement.

## Coverage matrix

| Area | Coverage | Evidence / limitation |
|---|---|---|
| Stripe API client | **IMPLEMENTED** | Server-only Stripe SDK; Checkout Session create and webhook verification |
| Environment variables | **PARTIAL** | Names, defaults, and fail-closed readers exist; production presence/mode unknown |
| Encrypted credentials | **SCHEMA ONLY** | Generic encrypted connector credential schema exists; no Stripe connector/auth records; runtime uses host env secrets |
| Webhook route | **IMPLEMENTED** | Node runtime route at `/api/fi-payments/stripe/webhook` |
| Webhook signature verification | **IMPLEMENTED** | Raw body + `constructEvent`; rejects missing/invalid signatures before DB write |
| Customer mappings | **NOT IMPLEMENTED** | No Stripe customer ID mapping found |
| PaymentIntent mappings | **IMPLEMENTED** | `fi_payments.provider_payment_intent_id`; production unique index and one row |
| Charges | **PARTIAL** | Checkout/PaymentIntent settlement represented; no dedicated Stripe Charge mapping or ingestion |
| Refunds | **SCHEMA ONLY** | FI statuses/ledger concepts exist; no Stripe refund API or refund webhook handling |
| Invoices | **PARTIAL** | FI-native invoices are implemented; no Stripe Billing Invoice mapping/sync |
| Subscriptions | **SCHEMA ONLY** | Internal FI entitlement/billing tables explicitly defer Stripe billing |
| Products and prices | **NOT IMPLEMENTED** | Checkout uses ephemeral inline product/price data; no catalogue mapping/sync |
| Payment links | **PARTIAL** | FI public payment-request URLs and stored Checkout URLs; no Stripe Payment Link objects |
| Reconciliation jobs | **PARTIAL** | Amount comparison, rows, audit events, and tests exist; no scheduled Stripe reconciliation/recovery job and zero production rows |
| Idempotency | **PARTIAL** | Strong event/PaymentIntent uniqueness; non-Stripe/no-intent paths weaker; partial-failure repair remains manual |
| Audit logs | **PARTIAL** | Webhook rows, structured errors, reconciliation/audit events; raw webhook payload and customer email retention need review |
| Tenant isolation | **IMPLEMENTED** | Tenant IDs, RLS, tenant policies, tenant-filtered service-role reads/writes |
| Payment UI and reporting | **IMPLEMENTED** | Public pay page, admin payments/settings, Financial OS invoices/payments/AR surfaces |
| Tests | **PARTIAL** | Webhook processing, gateway success, reconciliation, and core idempotency tests; no Stripe test-clock/signed fixture or deployed endpoint E2E |
| Runbooks | **PARTIAL** | Production readiness and idempotency docs exist; no Stripe account/key rotation, webhook registration, replay/repair, or go-live runbook |
| Test/live separation | **UNKNOWN** | Example key is test-mode; connected account and production secret mode were not exposed |

## Security and operational gaps

1. **Account binding is not pinned.** Runtime does not retrieve and compare the authenticated Stripe account ID to an expected `STRIPE_ACCOUNT_ID`; a valid key for the wrong account could create Checkout Sessions.
2. **Mode is not asserted.** Production does not fail closed on `sk_test_` versus `sk_live_`, and no expected livemode check is persisted with webhook processing.
3. **Webhook endpoint registration is unverified.** Endpoint URL, enabled event list, livemode, secret pairing, API version, and recent deliveries need a Stripe Dashboard evidence check.
4. **Partial failure is not self-healing.** A payment row can persist before invoice patching; same-event replay then short-circuits. There is no automated recovery/reconciliation worker.
5. **Raw Stripe payload retention is broad.** Full verified events are stored, and unresolved metadata can include customer email. Define minimisation, access, encryption, redaction, and TTL controls.
6. **Error responses can expose internal database messages.** The webhook insert failure path returns `whe.message`; use a generic external response and structured internal log.
7. **No customer/Charge/refund/Billing mapping.** This limits dispute/refund/support reconciliation and makes FI records incomplete as a Stripe ledger.
8. **No explicit Stripe API version.** SDK default/account version drift is not pinned in client construction.
9. **No observed rate/size guard.** The public webhook route reads and persists the complete request without an application-level body-size control.
10. **Documentation conflicts with code.** The production-readiness runbook says Stripe is not live while executable Stripe code and one production mapping exist.

## Is a new Stripe app or API key required?

**Not proven. Do not create one yet.** The plugin already authenticates to a Stripe account and FI OS is designed for a server-side restricted/secret key plus a webhook signing secret, not necessarily a Stripe App. First prove ownership of `acct_1TN2F45CMnrQiyQG`, inspect its capability/mode metadata, and compare the deployed production key's account ID using a non-mutating account retrieval. Rotate or issue a restricted key only if the deployed credential is missing, wrong-account, wrong-mode, over-privileged, or cannot be governed/rotated.

## Minimum next implementation slice

Keep payments disabled while completing a read-only go-live evidence pack:

1. Confirm the Stripe legal/business profile, country, currency, account type, capabilities, charges/payouts state, and account ownership for `acct_1TN2F45CMnrQiyQG`.
2. Verify only the presence and mode/account binding of production env configuration; never export secret values.
3. Verify the registered webhook endpoint, livemode, selected events, secret pairing, API version, and delivery history without changing it.
4. Add fail-closed expected-account and expected-mode checks, generic webhook errors, payload minimisation/retention, and a repairable reconciliation worker.
5. Run signed test-mode Checkout/webhook E2E in an isolated tenant, then require an explicit go-live approval before any live transaction.

No product, price, Payment Link, customer, webhook, invoice, payment, or refund record should be created until steps 1–3 pass.

## Audit constraints

- Stripe connector account metadata was limited to display name and account ID.
- Production environment values and Stripe Dashboard configuration were not available through the read interfaces used.
- A request to inspect row-level Stripe identifiers/metadata was rejected as unnecessarily sensitive; aggregate evidence was used instead.
- Dependencies are held in the parent checkout. Using that existing runtime, reconciliation and webhook-processing tests passed (six checks); the gateway integration test was blocked by the worktree's `server-only` preload resolution, not by a product assertion.
