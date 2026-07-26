# FI-PATIENT-APP-1E — Billing + Payments Gateway

**Verdict: GREEN**

| Field | Value |
|-------|-------|
| Ticket | FI-PATIENT-APP-1E |
| Closed | 2026-07-27 |
| Production identity mutations | **None** |
| Schema / migrations | **None** |
| Second ledger / Stripe account | **None** |
| Raw card / CVV handling | **None** (Stripe Checkout hosted) |
| Mobile application | **Not implemented** |

Companion JSON: `evidence-fi-patient-app-1e-billing-payments.json`

---

## Scope executed

1. `GET /api/patient/v1/billing` — patient-safe account summary
2. `GET /api/patient/v1/invoices` — owned invoices only
3. `GET /api/patient/v1/invoices/{invoiceId}` — ownership re-check + line items + payment history
4. `POST /api/patient/v1/invoices/{invoiceId}/payment-session` — Stripe Checkout via existing `createPaymentRequestForInvoice`
5. Webhook audit hooks on existing `POST /api/fi-payments/stripe/webhook` (no second reconciler)
6. Patient billing ownership wrapper (`assertOwnedBillingRow` / `requirePatientGatewayOwnedInvoice`)
7. OpenAPI updated to **v1.0.4**
8. Fail-closed billing tests; 1B/1C/1D suites remain GREEN

## Reuse

| Domain | Source |
|--------|--------|
| Invoice list / summary | `loadPatientInvoiceSummary` |
| Payable balance | `invoiceBalanceDueCents` / `isInvoiceOpenForCollection` |
| Checkout | `createPaymentRequestForInvoice` → Stripe Checkout |
| Reconciliation | Existing webhook + `recordGatewayPaymentSuccess` (idempotent intent + amount match) |

## Security proofs

| Case | Result |
|------|--------|
| A–C Own billing/invoices | success |
| D/L Foreign invoice | denied |
| E Wrong tenant | denied |
| F Orphaned | denied |
| G Foreign patientId | ownership wrapper ignores |
| H Internal finance fields | absent |
| I Payment session (outstanding) | checkout URL |
| J/K Paid/void | `invoice_not_payable` |
| M/N Amount/currency tamper | denied |
| O Cross-tenant pay | denied |
| Q–V Webhook | existing Stripe webhook suite + audit hooks |
| W Session does not mark paid | confirmed |
| X–Z 1B/1C/1D | GREEN (85 gateway tests) |
| AA/AB FinanceOS + portal surfaces | unchanged exports |
| AC lint | pass |
| AD typecheck | pass |

## Return contract

App/browser return URLs (including future `folios://payment/return`) only signal **refresh billing**.  
Paid state requires verified Stripe webhook evidence.

## Test evidence

```bash
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test \
  src/lib/patientPortal/patientGateway*.test.ts \
  src/lib/payments/stripeWebhookProcessing.test.ts
```

Gateway suites: **85 passed / 0 failed** (2026-07-27).  
Webhook core: **4 passed** (idempotency / mismatch fail-closed).

Lint + `tsc --noEmit`: pass.
