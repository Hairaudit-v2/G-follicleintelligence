# FinancialOS Phase 2C — Payment Pathway Operations Inbox

## Purpose

Phase 2C turns patient payment **intent** (Phase 2 / 2B `fi_payment_pathways`) into an operational **workflow** for clinic finance teams. Non-standard pathways (medical finance, super release, international transfer, installment plan, manual) generate inbox tasks that staff must progress before surgery financial clearance.

Additive only. Does not change Stripe checkout, ConsultationOS, SurgeryOS business logic, or Clinical Intelligence. Patient public pathway selection (Phase 2B) continues unchanged.

## Database

### `fi_payment_pathway_tasks`

| Column | Notes |
|--------|--------|
| `payment_pathway_id` | FK → `fi_payment_pathways`, cascade delete |
| `task_type` | `finance_review`, `super_release_review`, `international_transfer_review`, `installment_review`, `manual_payment_review`, `follow_up_required` |
| `status` | `open`, `in_progress`, `waiting_patient`, `waiting_provider`, `completed`, `cancelled` |
| `priority` | `low`, `normal`, `high`, `urgent` |
| `assigned_to` | FK → `fi_users` |

RLS: tenant-scoped `SELECT` for authenticated members; writes via `service_role` (server actions).

Migration: `supabase/migrations/20260912120002_fi_financial_os_phase2c_payment_pathway_tasks.sql`

## Automation — task creation

On `createPaymentPathway()` (staff or patient public token path that inserts a new row):

| Pathway type | Task type |
|--------------|-----------|
| `medical_finance` | `finance_review` |
| `super_release` | `super_release_review` |
| `international_transfer` | `international_transfer_review` |
| `installment_plan` | `installment_review` |
| `manual` | `manual_payment_review` |
| `pay_in_full`, `deposit_balance` | **no task** |

Implementation: `createPaymentPathwayTaskForPathway()` in `financialPaymentPathwayInbox.server.ts`, invoked from `createPaymentPathway()` (best-effort; pathway insert never fails on task errors).

## Server API

`src/lib/financialOs/financialPaymentPathwayInbox.server.ts`

| Function | Role |
|----------|------|
| `loadPaymentPathwayInbox` | List with filters: status, priority, assigned_to, pathway_type |
| `createPaymentPathwayTask` | Manual task create |
| `updatePaymentPathwayTaskStatus` | Status transitions |
| `assignPaymentPathwayTask` | Assign to `fi_users` |
| `resolveOpenPaymentPathwayTasksForBooking` | Complete open tasks for a booking |
| `loadPaymentPathwayAttentionCount` | Ops Centre / attention widgets |
| `loadPaymentPathwayInboxDashboardCounts` | Dashboard widgets |
| `runPaymentPathwayTaskEscalationCron` | Cron escalation runner |

Pure logic: `financialPaymentPathwayInboxCore.ts` (mapping, escalation, attention summary).

## Staff UI

| Route | Component |
|-------|-----------|
| `/fi-admin/[tenantId]/financial/pathway-inbox` | `FinancialPaymentPathwayInboxTable` |

Supporting components:

- `FinancialPaymentPathwayTaskBadge`
- `FinancialPaymentPathwayTaskFilters`
- `FinancialPaymentPathwayTaskDrawer`

Actions: `lib/actions/financial-os-payment-pathway-inbox-actions.ts`

## Operational visibility

**FinancialOS dashboard** (`/financial/dashboard`): open, urgent, waiting patient, overdue pathway task counts.

**Operations Centre**: “Financial Pathway Tasks Requiring Attention” card → `/financial/pathway-inbox`.

**Dashboard Action Centre**: pathway task row with count.

## Surgery integration

`buildFinancialSurgeryPipelineStatus()` (Phase 1B core) extended:

- `task_attention_required` — unresolved open pathway inbox tasks for the booking
- `payment_attention_required` — includes `task_attention_required`
- `summary_label` — `Awaiting financial workflow completion` when tasks block clearance
- `pathwayTaskAttention` — detail object

Surfaced on Surgery Readiness, Tomorrow Board, Procedure Day Board, Case Financial Summary via existing `FinancialSurgeryPipelineInline` and pipeline loaders.

Batch loader loads unresolved tasks per booking via `loadUnresolvedPathwayTasksForBookings()`.

## Cron — pathway task escalation

`POST /api/cron/financial-os/pathway-task-escalation`

Auth: `CRON_SECRET`, `FINANCIAL_OS_CRON_SECRET`, or `FI_PAYMENTS_CRON_SECRET`.

Query: `dryRun=1`, `date=YYYY-MM-DD`, `tenantId`, `limit`.

Escalation rules (priority bump only when higher than current):

1. `open` > 3 days → `high`
2. `waiting_patient` > 7 days → `urgent`
3. Expected settlement date missed → `urgent`
4. Surgery within 7 days and unresolved task → `urgent`

## Tests

`src/lib/financialOs/financialPaymentPathwayInboxCore.test.ts` — mapping, escalation, attention propagation, dashboard aggregation.

## Related docs

- [Phase 2 — Payment pathway engine](./financial-os-phase2-payment-pathway-engine.md)
- [Phase 2B — Patient pathway selection](./financial-os-phase2b-patient-pathway-selection.md)
