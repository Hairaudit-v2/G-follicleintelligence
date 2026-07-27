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

## Webapp non-regression (mandatory)

**Architecture:** 1E is an additive `/api/patient/v1` access path. Existing FiOS webapp continues to use FinanceOS / RevenueOS services directly against the same billing records.

### Diff boundary (`527cd30a`)

| Area | Changed? |
|------|----------|
| `src/lib/revenueOs/*` staff services | **No** |
| `src/lib/financialOs/*` | **No** |
| `src/lib/payments/*` providers / reconcilers | **No** |
| `lib/actions/fi-revenue-invoice-actions.ts` | **No** |
| `app/patient/*` portal pages / auth | **No** |
| `supabase/migrations` | **No** |
| Staff UI components | **No** |
| Frontend deps on `/api/patient/v1` | **None** |
| `app/api/fi-payments/stripe/webhook/route.ts` | **Audit-only** (`writePatientGatewayAudit` side effects; verification, reconciliation, HTTP statuses unchanged) |

Rollback: revert `527cd30a` + evidence commit(s) removes the gateway layer without touching historical financial data or staff billing architecture.

### Mandatory checks

| # | Requirement | Proof |
|---|-------------|-------|
| 1–5 | Staff FinanceOS / invoices / payment actions / checkout path | Existing RevenueOS + FinanceOS suites GREEN; staff exports unchanged |
| 6 | Webhook / reconciliation | `stripeWebhookProcessing`, `gatewayPaymentSuccess`, payment record suites GREEN |
| 7 | `/patient/*` portal unchanged | No 1E edits under `app/patient`; portal access module does not import gateway |
| 8 | Staff auth unchanged | No CRM/staff gate files in 1E diff |
| 9 | No frontend route depends on `/api/patient/v1` | Grep + non-regression test |
| 10 | No schema compatibility break | Zero migrations in 1E commits |

### Regression suites run (2026-07-27)

```bash
# Webapp / FinanceOS / payments (post-1E)
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test \
  src/lib/payments/stripeWebhookProcessing.test.ts \
  src/lib/payments/gatewayPaymentSuccess.test.ts \
  src/lib/payments/paymentRecordPolicy.test.ts \
  src/lib/payments/paymentRecordModel.test.ts \
  src/lib/revenueOs/revenueOsPaymentsStage7f.test.ts \
  src/lib/revenueOs/consultationInvoiceAmountResolve.test.ts \
  src/lib/revenueOs/paymentsInboxQuoteMetadata.test.ts \
  src/lib/financialOs/financialInvoiceLifecycle.test.ts \
  src/lib/financialOs/financialInvoiceTransitionCore.test.ts \
  src/lib/financialOs/financialPaymentReconciliationCore.test.ts \
  src/lib/financialOs/financialPaymentPathwayCore.test.ts \
  src/lib/financialOs/publicPaymentPathwaySelectionCore.test.ts \
  src/lib/financialOs/financialAccountsReceivableCore.test.ts \
  src/lib/patientPortal/patientPortalImagingEnabled.test.ts \
  src/lib/patientPortal/patientGatewayBillingNonRegression.test.ts
```

Result: **Finance/payment regression suite GREEN** (74 + 24 payment tests; non-regression suite **5/5**).

## Test evidence

```bash
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test \
  src/lib/patientPortal/patientGateway*.test.ts \
  src/lib/payments/stripeWebhookProcessing.test.ts
```

Gateway suites: **85 passed / 0 failed** (2026-07-27) + non-regression **5 passed**.  
Webhook core: **4 passed** (idempotency / mismatch fail-closed).

Lint + `tsc --noEmit`: pass.

**Final acceptance:** Current FiOS webapp billing, FinanceOS, staff workflows, and `/patient/*` portal behaviour are demonstrably unchanged by the patient billing gateway.
