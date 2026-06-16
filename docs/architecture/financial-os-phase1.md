# FinancialOS Phase 1 — architecture & payment audit

This document summarizes the **existing** RevenueOS / payments stack and what Phase 1 adds as **FinancialOS** without modifying ConsultationOS, Clinical Intelligence, or SurgeryOS application logic.

## 1. Existing payment tables (audit)

Defined in `supabase/migrations/20260727120001_fi_os_stage7_revenue_payments.sql` (Stage 7) plus Stage 7F token column:

| Table | Role |
| --- | --- |
| `fi_invoices` | Tenant invoices (`invoice_kind`: consultation_quote, surgery_deposit, surgery_balance, adjustment, other). Statuses: draft, issued, partially_paid, paid, overdue, cancelled, refunded. |
| `fi_invoice_items` | Line items per invoice. |
| `fi_payments` | Allocated payments (gateway or manual); links optional `payment_request_id`. |
| `fi_payment_requests` | Checkout / link requests; Stripe session ids + `public_token` for `/pay/[token]` (7F). |
| `fi_deposit_rules` | Configurable deposit hints (percent / fixed / manual). |
| `fi_payment_webhook_events` | Stripe webhook audit + idempotency (`provider`, `provider_event_id`). |

RLS: authenticated **SELECT** on invoices/payments/requests/rules; **service_role** for writes. Webhook audit is service-only.

## 2. Integrations verified (no breaking changes)

- **Stripe Checkout**: `createPaymentRequestForInvoice` in `src/lib/revenueOs/revenueInvoiceMutations.server.ts` calls `resolvePaymentProvider().createCheckoutSession` when `send: true` and Stripe is active (`readFiPaymentsEnabled` + provider id).
- **Stripe webhooks**: `app/api/fi-payments/stripe/webhook/route.ts` verifies signature, inserts `fi_payment_webhook_events`, then `recordGatewayPaymentSuccess` / `recordGatewayPaymentFailure`.
- **Invoice creation**: `createInvoiceFromConsultationQuote`, `createDepositInvoiceFromSurgeryCase`, `createBalanceInvoiceFromSurgeryCase` in the same mutations module.
- **Consultation quote → invoice**: `lib/actions/fi-revenue-invoice-actions.ts` → `createInvoiceFromConsultationQuote` (unchanged).

## 3. Phase 1 additive schema

Migration: `supabase/migrations/20260901120001_fi_financial_os_phase1.sql`

- `fi_installment_plans` — installment schedule per invoice (staff-managed).
- `fi_bookings.financial_os_status` — nullable overlay: `tentative` \| `deposit_pending` \| `confirmed` \| `paid_in_full` (does **not** replace operational `booking_status`).
- `fi_financial_automation_runs` — idempotency for FinancialOS cron jobs.

## 4. FinancialOS UI module

Routes live under the existing authenticated shell (same portal gate as the rest of FI OS):

- `/fi-admin/[tenantId]/financial/dashboard`
- `/fi-admin/[tenantId]/financial/invoices`
- `/fi-admin/[tenantId]/financial/payments`
- `/fi-admin/[tenantId]/financial/payment-requests`
- `/fi-admin/[tenantId]/financial/installments`
- `/fi-admin/[tenantId]/financial/deposit-rules`

Primary nav: **FinancialOS** with sub-links (`src/lib/fiAdmin/fiOsShellPrimaryNav.ts`). Feature gate: `settings` (`src/config/fiRouteFeatureMap.ts`).

## 5. Deposit workflow (staff-triggered)

Implemented in `src/lib/financialOs/financialDepositWorkflow.server.ts` + dashboard form:

1. Staff provides a **consultation quote** `fi_invoices` id and deposit amount.
2. `startConsultationQuoteDepositPaymentRequest` calls existing `createPaymentRequestForInvoice` (RevenueOS).
3. If `fi_consultations.booking_id` is set, `fi_bookings.financial_os_status` is set to `deposit_pending`.
4. When Stripe (or manual) settlement updates the invoice, `syncFinancialOsAfterInvoiceSettlement` (`src/lib/financialOs/financialOsPaymentSync.server.ts`) advances overlay status using consultation → booking linkage only.

**ConsultationOS** quote acceptance flows are **not** edited.

## 6. Payment automation cron

- **Existing**: `POST /api/cron/fi-payments/reminders` — due-soon / overdue signals into `fi_revenue_reminder_runs` + CRM activities.
- **New**: `POST /api/cron/financial-os/automation?job=...` — `deposit_overdue`, `balance_due_reminders`, `failed_payment_recovery`, `payment_escalation_alerts`. Auth: `CRON_SECRET`, `FINANCIAL_OS_CRON_SECRET`, or `FI_PAYMENTS_CRON_SECRET`.

`recordGatewayPaymentFailure` now increments `metadata.stripe_failure_escalation_count` on the payment request so escalation jobs can fire after repeated failures.

## 7. Dashboard metrics

`loadFinancialOsDashboardMetrics` (`src/lib/financialOs/financialDashboardLoader.server.ts`) exposes:

- Outstanding revenue (open invoice balances)
- Upcoming payment links (sent/viewed) and installment `next_payment_date` in the next 30 days
- Failed gateway payments (60d)
- Deposit conversion (90d consultation-quote cohort with any payment)
- Monthly revenue forecast (average of prior 3 calendar months of succeeded `fi_payments`)

## 8. Constraints respected

- No schema deletions; no changes to clinical tables beyond additive `fi_bookings.financial_os_status`.
- RevenueOS mutations extended only with best-effort FinancialOS sync and failure metadata (additive).
- ConsultationOS / Clinical / SurgeryOS **source modules** untouched.
