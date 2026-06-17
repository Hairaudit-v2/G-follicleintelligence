# FinancialOS Phase 3C — International Transfer Workflow Framework

## Purpose

Phase 3C adds a **dedicated provider-neutral international transfer workflow engine** so FI OS clinics can manage cross-border payment workflows for overseas patients paying by bank transfer, Wise, SWIFT, PayPal, or similar methods — **before any live provider API integration**.

International transfer is a **separate workflow** from finance applications and super release. It links to `international_transfer` payment pathways only.

Additive only. Does not change Stripe checkout, payment requests, ConsultationOS, SurgeryOS business logic, Clinical Intelligence, or Phases 1–3B behaviour.

## Database

Migration: `supabase/migrations/20260912120005_fi_financial_os_phase3c_international_transfer_workflow_framework.sql`

### `fi_international_transfer_applications`

| Column | Notes |
|--------|--------|
| `payment_pathway_id` | FK → `fi_payment_pathways` (requires `international_transfer` pathway type) |
| `transfer_method` | `bank_transfer`, `wise`, `swift`, `paypal`, `other` |
| `transfer_status` | Full lifecycle from `instructions_required` through `settled` / `cancelled` |
| `source_country_code` / `source_currency_code` | Origin country and currency |
| `settlement_currency_code` | Default `AUD` |
| `expected_settlement_amount_cents` / `received_amount_cents` | Settlement tracking |
| `expected_exchange_rate` / `actual_exchange_rate` | FX tracking (manual entry) |
| `settlement_variance_cents` | Computed variance on settlement update |
| `transfer_instructions` / `payment_reference` | Clinic-provided transfer details |

Statuses: `instructions_required`, `instructions_sent`, `awaiting_transfer`, `proof_received`, `under_reconciliation`, `settlement_pending`, `partially_settled`, `settled`, `variance_review`, `rejected`, `cancelled`.

### `fi_international_transfer_proofs`

Proof types: `payment_receipt`, `bank_confirmation`, `wise_receipt`, `swift_confirmation`, `custom`.

Statuses: `pending`, `requested`, `received`, `verified`, `rejected`.

### Indexes

- `tenant_id`
- `payment_pathway_id`
- `transfer_status`
- `expected_settlement_date`
- `source_country_code`
- `source_currency_code`
- `settlement_currency_code`

### RLS

Tenant-scoped `SELECT` for authenticated members; writes via `service_role` (server actions).

## Server API

`src/lib/financialOs/financialInternationalTransfer.server.ts`

| Function | Role |
|----------|------|
| `createInternationalTransferApplication` | Link to `international_transfer` pathway |
| `loadInternationalTransferApplications` | List with optional status filter |
| `loadInternationalTransferApplicationById` | Detail with proofs |
| `updateInternationalTransferStatus` | Lifecycle transitions |
| `updateInternationalTransferSettlement` | FX, amounts, dates, variance |
| `addInternationalTransferProof` | Proof row create |
| `updateInternationalTransferProof` | Status / file URL updates |
| `resolveInternationalTransferAttention` | Mark `settled` (clearance helper) |
| `loadInternationalTransferAnalytics` | Success rate, FX variance, source countries |
| `loadInternationalTransferDashboardCounts` | Dashboard widgets |
| `loadInternationalTransferAttentionCount` | Ops centre escalation count |
| `loadInternationalTransferApplicationsRequiringAttention` | SLA-breached applications |
| `loadUnresolvedInternationalTransferApplicationsForBookings` | Surgery pipeline batch load |
| `loadUnresolvedInternationalTransferApplicationsForPathways` | Surgery pipeline pathway lookup |

Pure logic: `financialInternationalTransferCore.ts` (attention rules, SLA breach, analytics aggregation).

Server actions: `lib/actions/financial-os-international-transfer-actions.ts`

## Attention rules

**Ops centre escalation (SLA breached):**

| Condition | Threshold |
|-----------|-----------|
| `instructions_required` | > 1 day in status |
| `instructions_sent` | > 3 days in status |
| `awaiting_transfer` | > 5 days in status |
| `proof_received` | > 2 days in status |
| `under_reconciliation` | > 2 days in status |
| `settlement_pending` + surgery within 14 days | Surgery horizon rule |
| `expected_settlement_date` missed | Past date, not `settled` |
| `variance_review` | Always |
| `rejected` | Always |
| `partially_settled` with remaining balance | `received_amount < expected_settlement_amount` |

**Surgery pipeline labels:**

- International Instructions Required
- Awaiting International Transfer
- Proof/Reconciliation Pending
- International Settlement Pending
- FX Variance Review
- International Transfer Settled

Any **unresolved** international transfer application blocks surgery financial clearance (`payment_attention_required = true`).

**Clearance:** Only `settled` clears international transfer application attention. `partially_settled` remains attention if balance remains.

Core returns per application:

- `international_transfer_attention_required`
- `international_transfer_summary_label`
- `days_in_status`
- `sla_breach`
- `settlement_variance_label`
- `financial_clearance_state`

## UI

Route: `/fi-admin/[tenantId]/financial/international-transfers`

Components:

- `FinancialInternationalTransferTable.tsx`
- `FinancialInternationalTransferStatusBadge.tsx`
- `FinancialInternationalTransferProofs.tsx`
- `FinancialInternationalTransferSettlementPanel.tsx`

Navigation: FinancialOS layout sub-nav + primary sidebar **International Transfers** item.

## Dashboard metrics

`loadFinancialOsDashboardMetrics` → `internationalTransfer`:

- Open international transfers
- Awaiting transfer
- Proof received
- Settlement pending
- Variance review
- Settled this month
- Average settlement days
- Total settlement variance
- Applications requiring attention

## Operations Centre

`TenantActionCentre.internationalTransferApplicationsAttention` — count of SLA-breached international transfer applications.

Card: **International Transfers Requiring Attention** → `/financial/international-transfers`

## Surgery pipeline integration

`financialSurgeryPipelineStatusCore.ts` extended with `internationalTransferApplicationAttention`.

`financialSurgeryPipelineStatus.server.ts` batch-loads unresolved international transfer applications by booking and active pathway (mirrors super release pattern).

## Analytics

`loadInternationalTransferAnalytics` tracks:

- Settlement success rate
- Average days to proof received
- Average days to settled
- Average FX variance
- Most common source countries
- Most common source currencies
- Transfer method usage

## Tests

`financialInternationalTransferCore.test.ts` — instructions_required SLA, awaiting_transfer SLA, proof_received reconciliation SLA, settlement pending + surgery within 14 days, expected settlement date missed, variance review, rejected transfer, partially settled with remaining balance, settled clears attention, analytics aggregation, surgery pipeline propagation.

## Workflow

When payment pathway = `international_transfer`, clinic staff can:

1. Create an international transfer application
2. Set transfer method and source country/currency
3. Send transfer instructions
4. Collect proof of payment
5. Reconcile received amounts and FX
6. Review settlement variance
7. Mark settled for financial clearance

No live Wise, bank, SWIFT, or FX provider APIs in Phase 3C.
