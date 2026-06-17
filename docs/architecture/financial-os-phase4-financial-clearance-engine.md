# FinancialOS Phase 4 — Financial Clearance Engine

Phase 4 introduces a single authoritative **financial clearance engine** for surgery bookings and cases. It unifies signals from Phases 1–3C (deposits, invoices, payment pathways, pathway inbox tasks, finance applications, super release, international transfer, installments) into one advisory clearance state.

**This phase is additive and advisory only.** It does not:

- Change payment recording or Stripe checkout behaviour
- Block SurgeryOS, ConsultationOS, or Clinical Intelligence workflows
- Replace `financial_os_status` or operational booking status

## Clearance states

| State | Meaning |
| --- | --- |
| `unavailable` | Missing or failed financial data load |
| `not_ready` | No deposit, no pathway, or invoice unpaid before confirmation |
| `deposit_ready` | Deposit satisfied; balance still due but surgery outside balance-due window |
| `pathway_pending` | Active pathway/application progressing without SLA breach |
| `attention_required` | Overdue balance, failed payments, workflow SLA breach, or surgery within window with unresolved funds |
| `financially_cleared` | Deposit satisfied or pathway settled/released; no urgent blockers |
| `paid_in_full` | Zero balance due with no unresolved workflow blockers |

Each resolved snapshot also exposes:

- `financially_safe_to_proceed` — advisory green-light for clinic teams
- `requires_staff_attention` — ops / action centre escalation
- `blocking_factors[]`, `warning_factors[]`, `next_required_action`
- `source_breakdown` — structured inputs used for the decision

## Architecture

```
financialClearanceCore.ts          Pure decision engine (unit tested)
        ↑
financialSurgeryPipelineStatusCore  Phase 1B hub (invoice + workflow summaries)
        ↑
financialClearance.server.ts       Batch resolvers, dashboard metrics, cron snapshots
        ↑
Boards / Case / Ops / Dashboard    UI via FinancialClearanceBadge + FinancialClearancePanel
```

### Core module

- **File:** `src/lib/financialOs/financialClearanceCore.ts`
- **Entry:** `buildFinancialClearance(input)` and `buildFinancialClearanceFromPipelineStatus(...)`
- **Inputs:** booking `financial_os_status`, invoice/payment summary, pathway summaries, workflow attention summaries, surgery date
- **Aggregation:** `aggregateFinancialClearanceDashboardMetrics(results)`

### Server module

- **File:** `src/lib/financialOs/financialClearance.server.ts`
- **Functions:**
  - `resolveFinancialClearanceForBooking`
  - `resolveFinancialClearanceForBookings`
  - `resolveFinancialClearanceForCase`
  - `buildFinancialClearanceMapFromPipeline` — maps existing pipeline batch loads without duplicate queries
  - `loadFinancialClearanceAttentionCount`
  - `loadFinancialClearanceDashboardMetrics`
  - `runFinancialClearanceSnapshotCron`

Server resolvers reuse `loadFinancialSurgeryPipelineStatusByBookings` and `loadCaseFinancialOsSurgeryPipelineSummary` from Phase 1B.

## Database (optional snapshots)

**Migration:** `supabase/migrations/20260912120006_fi_financial_os_phase4_financial_clearance_engine.sql`

Table: `fi_financial_clearance_snapshots`

- Service role writes (cron)
- Tenant-scoped `SELECT` for authenticated portal users
- Indexes on `tenant_id`, `booking_id`, `case_id`, `clearance_state`, `computed_at`

## UI

| Component | Path |
| --- | --- |
| Badge | `src/components/fi/financial/FinancialClearanceBadge.tsx` |
| Panel | `src/components/fi/financial/FinancialClearancePanel.tsx` |

Integrated into:

- Surgery Readiness Board
- Tomorrow Board
- Procedure Day Board
- Operations Centre — **Financial Clearance Attention** card
- Case detail — FinancialOS surgery pipeline section
- FinancialOS dashboard — clearance metrics section
- Tenant Action Centre — **Financial clearance issues before surgery** row

## Cron

**Route:** `POST|GET /api/cron/financial-os/clearance-snapshots`

**Auth:** Bearer `CRON_SECRET`, `FINANCIAL_OS_CRON_SECRET`, or `FI_PAYMENTS_CRON_SECRET` (timing-safe via `assertCronAuthorized`).

**Query parameters:**

| Param | Description |
| --- | --- |
| `dry_run=1` | Compute counts only; do not insert snapshots |
| `tenantId` | Limit to one tenant |
| `date=YYYY-MM-DD` | Operational run date |
| `horizonDays` | Surgery horizon (default 14) |
| `limit` | Max bookings per tenant (default 200, max 500) |

## Tests

**File:** `src/lib/financialOs/financialClearanceCore.test.ts`

Covers all Phase 4 scenarios: unavailable, not ready, deposit ready, pathway pending, attention paths (finance rejection, overdue balance, failed payment, installment, pathway task), financially cleared (super release / international transfer), and paid in full.

## Related docs

- [Phase 1 — Revenue overlay](./financial-os-phase1.md)
- [Phase 2 — Payment pathway engine](./financial-os-phase2-payment-pathway-engine.md)
- [Phase 3C — International transfer](./financial-os-phase3c-international-transfer-workflow-framework.md)
