# FinancialOS Phase 3B — Super Release Workflow Framework

## Purpose

Phase 3B adds a **dedicated provider-neutral super release workflow engine** so FI OS clinics can manage medically justified retirement/superannuation release applications used to fund elective medical procedures — **before any live provider API integration**.

Super release is a **separate workflow** from finance applications (`fi_finance_applications`). It links to `super_release` payment pathways only.

Additive only. Does not change Stripe checkout, payment requests, ConsultationOS, SurgeryOS business logic, Clinical Intelligence, or Phases 1–3 behaviour.

## Database

Migration: `supabase/migrations/20260912120004_fi_financial_os_phase3b_super_release_workflow_framework.sql`

### `fi_super_release_applications`

| Column | Notes |
|--------|--------|
| `payment_pathway_id` | FK → `fi_payment_pathways` (requires `super_release` pathway type) |
| `provider_name` | Optional free-text provider label (no live API) |
| `application_status` | Full lifecycle from `draft` through `funds_released` / `cancelled` |
| `expected_release_date` | Target funds release date |
| `funds_released_at` | Terminal success timestamp |

Statuses: `draft`, `eligibility_review`, `documents_pending`, `clinical_letter_required`, `ready_for_submission`, `submitted`, `under_review`, `approved`, `rejected`, `release_pending`, `funds_released`, `cancelled`.

### `fi_super_release_documents`

Document types: `identity_document`, `medical_letter`, `financial_hardship_statement`, `super_release_form`, `consent_form`, `bank_details`, `custom`.

Statuses: `pending`, `requested`, `received`, `verified`, `rejected`.

### `fi_super_release_clinical_letters`

Letter statuses: `draft`, `review_required`, `approved`, `issued`.

### Indexes

- `tenant_id`
- `payment_pathway_id`
- `application_status`
- `expected_release_date`

### RLS

Tenant-scoped `SELECT` for authenticated members; writes via `service_role` (server actions).

## Server API

`src/lib/financialOs/financialSuperRelease.server.ts`

| Function | Role |
|----------|------|
| `createSuperReleaseApplication` | Link to `super_release` pathway |
| `loadSuperReleaseApplications` | List with optional status filter |
| `loadSuperReleaseApplicationById` | Detail with documents and clinical letters |
| `updateSuperReleaseStatus` | Lifecycle transitions + timestamps |
| `addSuperReleaseDocument` | Document row create |
| `updateSuperReleaseDocument` | Status / file URL updates |
| `createClinicalLetterRecord` | Clinical letter workflow start |
| `updateClinicalLetterStatus` | Letter review / issue |
| `resolveSuperReleaseAttention` | Mark `funds_released` (clearance helper) |
| `loadSuperReleaseAnalytics` | Approval/rejection rates, release timing |
| `loadSuperReleaseDashboardCounts` | Dashboard widgets |
| `loadSuperReleaseAttentionCount` | Ops centre escalation count |
| `loadSuperReleaseApplicationsRequiringAttention` | SLA-breached applications |
| `loadUnresolvedSuperReleaseApplicationsForBookings` | Surgery pipeline batch load |
| `loadUnresolvedSuperReleaseApplicationsForPathways` | Surgery pipeline pathway lookup |

Pure logic: `financialSuperReleaseCore.ts` (attention rules, SLA breach, analytics aggregation).

Server actions: `lib/actions/financial-os-super-release-actions.ts`

## Attention rules

**Ops centre escalation (SLA breached):**

| Condition | Threshold |
|-----------|-----------|
| `eligibility_review` | > 3 days in status |
| `documents_pending` | > 5 days in status |
| `clinical_letter_required` | > 3 days in status |
| `submitted` | > 7 days since submit |
| `under_review` | > 10 days since submit |
| `expected_release_date` missed | Past date, not `funds_released` |
| `rejected` | Always |
| `release_pending` + surgery within 14 days | Surgery horizon rule |

**Surgery pipeline labels:**

- Super Release Eligibility Review
- Super Release Documents Pending
- Clinical Letter Required
- Super Release Approval Pending
- Funds Release Pending

Any **unresolved** super release application blocks surgery financial clearance (`payment_attention_required = true`).

Core returns per application:

- `super_release_attention_required`
- `super_release_summary_label`
- `days_in_status`
- `sla_breach`

## UI

Route: `/fi-admin/[tenantId]/financial/super-release`

Components:

- `FinancialSuperReleaseTable.tsx`
- `FinancialSuperReleaseStatusBadge.tsx`
- `FinancialSuperReleaseDocuments.tsx`
- `FinancialSuperReleaseClinicalLetterPanel.tsx`

Navigation: FinancialOS layout sub-nav + primary sidebar **Super Release** item.

## Dashboard metrics

`loadFinancialOsDashboardMetrics` → `superRelease`:

- Open super release applications
- Clinical letters pending
- Awaiting documents
- Submitted applications
- Funds release pending
- Average approval time
- Applications requiring attention

## Operations Centre

`TenantActionCentre.superReleaseApplicationsAttention` — count of SLA-breached super release applications.

Card: **Super Release Applications Requiring Attention** → `/financial/super-release`

## Surgery pipeline integration

`financialSurgeryPipelineStatusCore.ts` extended with `superReleaseApplicationAttention`.

`financialSurgeryPipelineStatus.server.ts` batch-loads unresolved super release applications by booking and active pathway (mirrors finance application pattern).

## Analytics

`loadSuperReleaseAnalytics` tracks:

- Approval %
- Rejection %
- Average release days
- Average approval days
- Clinical letter turnaround

## Tests

`financialSuperReleaseCore.test.ts` — lifecycle transitions, document tracking, clinical letter workflow, attention rules, SLA breach, release_pending + surgery within 14 days, surgery pipeline propagation.

## Workflow

When payment pathway = `super_release`, clinic staff can:

1. Create a Super Release Application
2. Track eligibility review
3. Collect and verify documents
4. Manage clinical letter workflow
5. Progress through submission and approval
6. Set expected release date
7. Mark funds released

No live provider APIs in Phase 3B.
