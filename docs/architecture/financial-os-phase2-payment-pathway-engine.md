# FinancialOS Phase 2 — Payment Pathway Engine

## Purpose

ConsultationOS and RevenueOS already capture *what* a patient owes (invoices, payment requests,
payments, installment plans). They do not capture *how* the patient intends to settle that amount
once a quote or invoice is accepted — e.g. via a medical finance provider, a superannuation early
release, an international bank transfer, or simply paying the balance in full before surgery.

The Payment Pathway Engine is a first-class, additive layer that records this settlement intent and
tracks it operationally so clinic teams can see settlement risk before surgery — without changing
how invoices, Stripe checkout, payment requests, or payments behave today.

It explicitly does **not**:
- Drive Stripe checkout or any payment gateway.
- Change ConsultationOS quote acceptance behaviour.
- Change Clinical Intelligence.
- Change SurgeryOS booking/business logic.
- Block any surgery flow. It only surfaces attention.

## Schema

New table: `fi_payment_pathways` (migration
`supabase/migrations/20260910120001_fi_financial_os_phase2_payment_pathways.sql`).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | `gen_random_uuid()` |
| `tenant_id` | uuid not null | FK `fi_tenants` |
| `patient_id` | uuid null | FK `fi_patients`, `on delete set null` |
| `case_id` | uuid null | FK `fi_cases`, `on delete set null` |
| `invoice_id` | uuid null | FK `fi_invoices`, `on delete set null` |
| `booking_id` | uuid null | FK `fi_bookings`, `on delete set null` |
| `pathway_type` | text not null | see [Pathway types](#pathway-types) |
| `status` | text not null, default `selected` | see [Lifecycle](#pathway-lifecycle) |
| `provider` | text null | e.g. "MacCredit", "ATO super release", a named bank |
| `provider_reference` | text null | external reference/case number |
| `selected_at` | timestamptz, default `now()` | |
| `expected_settlement_date` | date null | drives 7/14-day attention horizons |
| `actual_settlement_date` | date null | set when settled |
| `currency_code` | text, default `AUD` | |
| `expected_amount_cents` | integer null | |
| `settled_amount_cents` | integer null | |
| `metadata` | jsonb not null, default `{}` | staff notes (`metadata.notes`) and free-form extras |
| `created_at` / `updated_at` | timestamptz not null | `updated_at` maintained by trigger |

A row can be linked to any combination of `patient_id`/`case_id`/`invoice_id`/`booking_id` — staff
attach it to whichever entity is most relevant at the time the pathway is selected. No existing
column on `fi_invoices`, `fi_payments`, `fi_payment_requests`, or `fi_bookings` is touched.

### Indexes

`tenant_id`, `patient_id`, `case_id`, `invoice_id`, `booking_id`, `pathway_type`, `status`, and a
partial index on `expected_settlement_date` (where not null).

### RLS

- `select`: tenant members (`fi_users.auth_user_id = auth.uid()` scoped to `tenant_id`), same pattern
  as `fi_installment_plans`.
- `insert`/`update`/`delete`: `service_role` only — writes go through
  `assertPaymentRecordWriteAllowed` (the existing FinancialOS/RevenueOS finance-write guard) via
  server actions, never directly from the client.
- `updated_at` is maintained by `fi_payment_pathways_set_updated_at()`, following the same
  before-update trigger pattern used by `fi_installment_plans` and other FI tables.

### Pathway types

`pay_in_full`, `deposit_balance`, `installment_plan`, `medical_finance`, `super_release`,
`international_transfer`, `manual`.

## Pathway lifecycle

```
draft → selected → pending_patient_action ─┐
                 → pending_clinic_action   ├─→ pending_provider → approved → settlement_pending → settled
                 → pending_provider ───────┘
                          └──────────────────────────────────────→ rejected
(any non-terminal status) ──────────────────────────────────────→ cancelled
```

Staff move a pathway through `status` values as the patient progresses (e.g. medical finance:
`selected` → `pending_provider` → `approved` → `settlement_pending` → `settled`). `rejected` and
`cancelled` are terminal; a rejected pathway always needs new staff action. Multiple pathway rows
can exist for the same invoice/case/booking over time — `resolveActivePaymentPathway` (in
`financialPaymentPathwayCore.ts`) picks the most recently updated non-cancelled row as "active" for
operational display.

## Operational attention rules

Pure logic lives in
[`src/lib/financialOs/financialPaymentPathwayCore.ts`](../../src/lib/financialOs/financialPaymentPathwayCore.ts)
(`buildPaymentPathwayAttentionSummary`), unit-tested in
[`financialPaymentPathwayCore.test.ts`](../../src/lib/financialOs/financialPaymentPathwayCore.test.ts).

A pathway requires attention when:

1. `pathway_type = medical_finance` and `status = pending_provider` and surgery is within **14 days**.
2. `pathway_type = super_release` and `status = pending_patient_action` and surgery is within **14 days**.
3. `pathway_type = international_transfer` and `status = settlement_pending` and surgery is within **7 days**.
4. `status = rejected` (always).
5. `expected_settlement_date` is in the past and `status` is not `settled` (or `cancelled`).

Attention is surfaced — never blocking. `loadFinancialSurgeryPipelineStatusByBookings` and
`loadCaseFinancialOsSurgeryPipelineSummary` (Phase 1B resolver,
`src/lib/financialOs/financialSurgeryPipelineStatus.server.ts`) now additionally resolve the active
pathway for each surgery context and fold `pathway_attention_required` into the existing
`payment_attention_required` flag, alongside a new `paymentPathway` field:

```ts
status.paymentPathway = {
  hasActivePathway: boolean;
  pathway_id: string | null;
  pathway_type: FiPaymentPathwayType | null;
  pathway_status: FiPaymentPathwayStatus | null;
  provider: string | null;
  expected_settlement_date: string | null;
  pathway_attention_required: boolean;
  pathway_attention_reason: string | null;
};
```

This is additive: when no pathway rows exist for a context, `paymentPathway.hasActivePathway` is
`false` and the rest of the resolver's existing fields/behaviour are unchanged — confirmed by the
pre-existing `financialSurgeryPipelineStatus.test.ts` suite, which exercises the resolver without
passing any pathway rows.

### Visible chips

A compact `FinancialPaymentPathwayBadge` (`src/components/fi/financial/FinancialPaymentPathwayBadge.tsx`)
renders pathway type, status, and an "Attention" flag, and is shown on:

- Case FinancialOS summary (`CaseDetailPageView.tsx`)
- Surgery Readiness board
- Tomorrow Board (surgery list and surgery-readiness section)
- Procedure Day Board
- Operations Centre payment-attention count (`loadSurgeryFinancialPaymentAttentionCount`, which now
  counts pathway-driven attention transparently because it reads `payment_attention_required`)

## Server & actions

- `src/lib/financialOs/financialPaymentPathways.server.ts` — CRUD/read functions:
  `loadPaymentPathwaysForCase`, `loadPaymentPathwaysForInvoice`, `loadPaymentPathwaysForBooking`,
  `loadPaymentPathwaysForTenant`, `createPaymentPathway`, `updatePaymentPathwayStatus`,
  `resolveActivePaymentPathwayForInvoice`, `resolveActivePaymentPathwayForBooking`,
  `loadFinancialPaymentPathwayDashboardCounts`.
- `lib/actions/financial-os-payment-pathway-actions.ts` — server actions:
  `createPaymentPathwayAction`, `updatePaymentPathwayStatusAction`, `cancelPaymentPathwayAction`.
  All call `assertPaymentRecordWriteAllowed` (the existing finance/payment write guard) before any
  mutation, matching the pattern in `lib/actions/financial-os-actions.ts`.

## UI

- `app/(fi-admin)/fi-admin/[tenantId]/financial/payment-pathways/page.tsx` — new FinancialOS section
  (nav item "Payment Pathways") to record and review pathways for a tenant.
- `src/components/fi/financial/FinancialPaymentPathwayForm.tsx` — staff form to select a pathway type
  (pay in full, deposit + balance, installment plan, medical finance, super release, international
  transfer, manual/other), status, provider, expected settlement date/amount, and notes.
- `src/components/fi/financial/FinancialPaymentPathwayTimeline.tsx` — table of recorded pathways with
  status/provider/expected settlement/amount/linked entities/notes, plus inline status transitions.
- `src/components/fi/financial/FinancialPaymentPathwayBadge.tsx` — compact chip used on boards.

## Dashboard

`loadFinancialOsDashboardMetrics` now also returns `paymentPathways`
(`loadFinancialPaymentPathwayDashboardCounts`): counts by `pathway_type`, counts by `status`,
pathways with `expected_settlement_date` in the next 30 days, and an attention count (rejected, or
past-due and not settled/cancelled). Rendered on the FinancialOS dashboard page alongside existing
revenue metrics.

## Out of scope (future provider integrations)

Intentionally **not** built in this phase:

- Direct API integrations with medical finance providers (e.g. automatic application submission or
  status webhooks).
- Automated superannuation early-release verification.
- International transfer/FX rate quoting or bank API integration.
- Auto-creating invoices, payment requests, or Stripe checkout sessions from a pathway.
- Auto-transitioning pathway status from gateway/payment events (today this is fully staff-managed,
  matching the existing `fi_installment_plans` "staff-managed; no auto-debit" pattern).

These can be layered on top of `fi_payment_pathways` later (e.g. a `provider_reference` lookup against
a vendor API) without further schema changes to the core table.
