# FinancialOS Phase 3 — Provider-Ready Financing Framework

## Purpose

Phase 3 adds a **provider-neutral financing infrastructure layer** so FI OS clinics can manage external financing providers, applications, approval workflows, document collection, settlement tracking, and provider performance **before any live provider API integration**.

Additive only. Does not change Stripe checkout, payment requests, ConsultationOS, SurgeryOS business logic, or Clinical Intelligence. Phases 1, 1B, 2, 2B, and 2C behaviour is preserved.

## Database

### `fi_finance_providers`

| Column | Notes |
|--------|--------|
| `tenant_id` | Nullable — global catalog when null |
| `provider_type` | `medical_financing`, `bnpl`, `super_release`, `international_financing`, `custom` |
| `is_active` | Clinic can enable/disable for new applications |

### `fi_finance_applications`

| Column | Notes |
|--------|--------|
| `payment_pathway_id` | FK → `fi_payment_pathways` (requires `medical_finance` pathway type) |
| `finance_provider_id` | FK → `fi_finance_providers` |
| `application_status` | `draft` → `settled` / `cancelled` lifecycle |

### `fi_finance_application_documents`

Document types: `id_verification`, `bank_statement`, `medical_letter`, `super_release_form`, `income_verification`, `consent_form`, `custom`.

Statuses: `pending`, `requested`, `received`, `verified`, `rejected`.

RLS: tenant-scoped `SELECT` for authenticated members; writes via `service_role` (server actions).

Migration: `supabase/migrations/20260912120003_fi_financial_os_phase3_financing_framework.sql`

### Seed providers (global, inactive except Custom Provider)

- Zip Money Australia (`bnpl`)
- Afterpay Australia (`bnpl`)
- Humm Australia (`bnpl`)
- MediPay Australia (`medical_financing`)
- Custom Provider (`custom`, **active**)

## Server API

### Providers — `financialFinanceProviders.server.ts`

| Function | Role |
|----------|------|
| `loadFinanceProviders` | Global catalog + tenant providers |
| `createFinanceProvider` | Tenant-specific provider |
| `updateFinanceProvider` | Activate/deactivate or edit metadata |

### Applications — `financialFinanceApplications.server.ts`

| Function | Role |
|----------|------|
| `createFinanceApplication` | Link to `medical_finance` pathway |
| `loadFinanceApplications` | List with optional filters |
| `loadFinanceApplicationById` | Detail with documents |
| `updateFinanceApplicationStatus` | Lifecycle transitions + timestamps |
| `addFinanceApplicationDocument` | Document row create |
| `updateFinanceApplicationDocument` | Status / file URL updates |
| `resolveFinanceApplicationAttention` | Mark settled (clearance helper) |
| `loadFinanceProviderAnalytics` | Per-provider performance |
| `loadFinanceApplicationsDashboardCounts` | Dashboard widgets |
| `loadFinanceApplicationAttentionCount` | Ops centre escalation count |
| `loadUnresolvedFinanceApplicationsForBookings` | Surgery pipeline batch load |

Pure logic: `financialFinanceApplicationsCore.ts` (attention rules, analytics aggregation).

## Attention rules

**Ops centre escalation (SLA breached):**

| Condition | Threshold |
|-----------|-----------|
| `documents_pending` | > 3 days since update |
| `submitted` | > 5 days since submit |
| `under_review` | > 7 days since submit |
| Expected settlement | Date passed |
| `rejected` | Always |
| `settlement_pending` + surgery | Surgery within 14 days |

**Surgery pipeline:** any unresolved application (not `settled` / `cancelled`) sets `payment_attention_required = true`.

Labels on surgery boards:

- Finance Documents Pending
- Finance Approval Pending
- Settlement Pending

## Staff UI

| Route | Component |
|-------|-----------|
| `/fi-admin/[tenantId]/financial/providers` | `FinancialProviderTable`, `FinancialProviderForm` |
| `/fi-admin/[tenantId]/financial/finance-applications` | `FinancialFinanceApplicationTable`, `FinancialFinanceApplicationDocuments` |

Supporting: `FinancialFinanceApplicationStatusBadge`

Actions: `lib/actions/financial-os-finance-actions.ts`

Sidebar: FinancialOS → Providers, Finance Applications (layout nav + primary shell sub-items).

## Dashboard metrics

- Applications submitted / approved / pending docs / settlement pending
- Applications requiring attention (SLA)
- Average approval time (days)
- Provider conversion rates
- Most used provider

## Operations Centre

Card: **Finance Applications Requiring Attention** → `/financial/finance-applications`

Dashboard Action Centre row with escalation count.

## Surgery integration

`financialSurgeryPipelineStatusCore.ts` extended with `financeApplicationAttention`.

Server batch loader resolves active unresolved application per booking (by booking id, else active pathway).

## Analytics

Per provider:

- Approval % / rejection %
- Average approval days
- Average settlement days
- Application volume (most used provider on dashboard)

## Tests

`src/lib/financialOs/financialFinanceApplicationsCore.test.ts` — lifecycle attention, SLA escalation, analytics, surgery pipeline propagation.

## Out of scope (Phase 3)

- Live Zip / Afterpay / Humm / MediPay API integrations
- ConsultationOS changes
- SurgeryOS business logic changes
- Clinical Intelligence changes
