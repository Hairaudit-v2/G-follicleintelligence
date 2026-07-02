# Module: FinancialOS

## Purpose

Revenue, payments, invoicing, deposits, financing, accounts receivable, and executive finance intelligence. FinancialOS gates surgical clearance, drives deposit workflows for LeadFlow, and feeds AnalyticsOS with revenue attribution.

## Dependencies

- **Platform Core** — tenancy, tax localisation
- **LeadFlow** — quote → deposit → conversion
- **PatientOS** — patient billing linkage
- **SurgeryOS** — procedure economics, clearance before surgery
- **CalendarOS** — deposit-confirmed booking holds
- **AnalyticsOS** — executive snapshots, attribution

## Events Published

| Event | Channel | Status |
|-------|---------|--------|
| `invoice.created` | Target FI Event Bus | Planned |
| `payment.received` | Target FI Event Bus | Planned |
| `deposit.overdue` | Target FI Event Bus | Planned |
| `refund.created` | Target FI Event Bus | Planned |
| `finance.alert.triggered` | Target FI Event Bus | Planned |
| `payment.deposit.confirmed` | Target FI Event Bus | Planned (critical downstream) |
| Payment / invoice lifecycle | `fi_financial_transaction_audit_events` | Current |
| Revenue pipeline updates | `fi_revenue_pipeline` | Current |

## Events Consumed

| Event | Source | Action |
|-------|--------|--------|
| `consultation.booked` / quote accepted | LeadFlow | Generate invoice / deposit request |
| `surgery.booked` | SurgeryOS | Procedure payment schedule |
| Stripe / payment webhooks | Stripe | Reconcile `fi_payment_records`, `fi_financial_transactions` |
| Tax settings change | Platform Core | Recalculate invoice tax |

## Database Tables

- `fi_invoices`, `fi_payment_records`, `fi_quotes` (CRM overlap)
- `fi_financial_transactions`, `fi_payment_reconciliation`
- `fi_financial_transaction_audit_events`
- `fi_finance_providers`, `fi_finance_applications`, `fi_finance_application_documents`
- `fi_super_release_applications`, `fi_super_release_documents`, `fi_super_release_clinical_letters`
- `fi_revenue_pipeline`
- `fi_financial_executive_snapshots`
- `fi_tax_localisation_settings`, `fi_tax_localisation_audit_events`

**Migration block:** Primarily `10xx` (core financial phases); dedicated financial phases use descriptive `fi_financial_os_*` migrations.

## External Integrations

- **Stripe** — payment intents, webhooks (see `docs/security/payment-webhook-idempotency.md`)
- **Finance providers** — third-party financing applications (phase 3)
- **Super release workflow** — AU superannuation release framework (phase 3b)

## Security Boundaries

- Payment webhooks: idempotency keys, signature verification, service_role writes only.
- Financial transactions: append-only audit trail; no client-side amount mutation.
- PCI: card data never stored in FI; Stripe-hosted flows only.
- Executive snapshots: tenant admin / finance roles.

## Ownership Rules

| Data | System of record |
|------|------------------|
| Invoice / payment state | FinancialOS (FI Supabase) |
| Card / bank instruments | Stripe |
| Financing application (external) | Finance provider |
| CRM quote (pre-financial) | LeadFlow (`fi_crm_quotes`) — converging with `fi_invoices` |

## Failure Conditions

| Condition | Impact | Mitigation |
|-----------|--------|------------|
| Webhook duplicate | Double payment credit | Idempotency on webhook events |
| Reconciliation mismatch | Incorrect AR balance | `fi_payment_reconciliation` + ops review |
| Deposit not confirmed | Surgery blocked incorrectly | Clearance engine (phase 4) + manual override audit |
| Overdue invoice undetected | Revenue leakage | `days_overdue` denormalized column + reminder automation |
| Tax misconfiguration | Wrong invoice totals | `fi_tax_localisation_settings` audit events |
