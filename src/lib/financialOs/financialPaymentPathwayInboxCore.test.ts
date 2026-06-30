import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildFinancialSurgeryPipelineStatus } from "@/src/lib/financialOs/financialSurgeryPipelineStatusCore";
import {
  aggregatePathwayInboxDashboardCounts,
  buildPathwayTaskAttentionSummary,
  computeTaskEscalationPriority,
  filterUnresolvedOpenPathwayTasks,
  mapPathwayTypeToTaskType,
  type FiPaymentPathwayTaskRow,
} from "@/src/lib/financialOs/financialPaymentPathwayInboxCore";

function baseTask(over: Partial<FiPaymentPathwayTaskRow> = {}): FiPaymentPathwayTaskRow {
  return {
    id: "task-1",
    task_type: "finance_review",
    status: "open",
    priority: "normal",
    assigned_to: null,
    due_date: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...over,
  };
}

describe("financialPaymentPathwayInboxCore — task auto creation mapping", () => {
  it("maps non-standard pathway types to review task types", () => {
    assert.equal(mapPathwayTypeToTaskType("medical_finance"), "finance_review");
    assert.equal(mapPathwayTypeToTaskType("super_release"), "super_release_review");
    assert.equal(
      mapPathwayTypeToTaskType("international_transfer"),
      "international_transfer_review"
    );
    assert.equal(mapPathwayTypeToTaskType("installment_plan"), "installment_review");
    assert.equal(mapPathwayTypeToTaskType("manual"), "manual_payment_review");
  });

  it("does not create task mapping for pay_in_full or deposit_balance", () => {
    assert.equal(mapPathwayTypeToTaskType("pay_in_full"), null);
    assert.equal(mapPathwayTypeToTaskType("deposit_balance"), null);
  });
});

describe("financialPaymentPathwayInboxCore — escalation rules", () => {
  it("escalates open tasks older than 3 days to high", () => {
    const p = computeTaskEscalationPriority({
      todayYmd: "2026-06-10",
      task: baseTask({ created_at: "2026-06-01T00:00:00.000Z" }),
      expectedSettlementDateYmd: null,
      surgeryDateYmd: null,
    });
    assert.equal(p, "high");
  });

  it("escalates waiting_patient longer than 7 days to urgent", () => {
    const p = computeTaskEscalationPriority({
      todayYmd: "2026-06-20",
      task: baseTask({ status: "waiting_patient", updated_at: "2026-06-01T00:00:00.000Z" }),
      expectedSettlementDateYmd: null,
      surgeryDateYmd: null,
    });
    assert.equal(p, "urgent");
  });

  it("escalates missed expected settlement date to urgent", () => {
    const p = computeTaskEscalationPriority({
      todayYmd: "2026-06-20",
      task: baseTask(),
      expectedSettlementDateYmd: "2026-06-15",
      surgeryDateYmd: null,
    });
    assert.equal(p, "urgent");
  });

  it("escalates unresolved task when surgery within 7 days to urgent", () => {
    const p = computeTaskEscalationPriority({
      todayYmd: "2026-06-20",
      task: baseTask({ created_at: "2026-06-19T00:00:00.000Z" }),
      expectedSettlementDateYmd: null,
      surgeryDateYmd: "2026-06-24",
    });
    assert.equal(p, "urgent");
  });
});

describe("financialPaymentPathwayInboxCore — task attention propagation", () => {
  it("requires attention when unresolved open tasks exist", () => {
    const s = buildPathwayTaskAttentionSummary([baseTask()]);
    assert.equal(s.task_attention_required, true);
    assert.equal(s.unresolved_open_task_count, 1);
    assert.match(s.task_attention_reason ?? "", /awaiting financial workflow/i);
  });

  it("clears attention when tasks are completed", () => {
    const s = buildPathwayTaskAttentionSummary([baseTask({ status: "completed" })]);
    assert.equal(s.task_attention_required, false);
    assert.equal(filterUnresolvedOpenPathwayTasks([baseTask({ status: "completed" })]).length, 0);
  });

  it("folds task attention into surgery pipeline payment_attention_required", () => {
    const s = buildFinancialSurgeryPipelineStatus({
      todayYmd: "2026-06-16",
      calendarTimezone: "Australia/Brisbane",
      booking_status: "confirmed",
      financial_os_status: "paid_in_full",
      case_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      patient_id: null,
      invoices: [],
      paymentRequests: [],
      payments: [],
      installmentPlans: [],
      pathwayTasks: [baseTask()],
    });
    assert.equal(s.task_attention_required, true);
    assert.equal(s.payment_attention_required, true);
    assert.match(s.summary_label, /awaiting financial workflow/i);
  });
});

describe("financialPaymentPathwayInboxCore — dashboard counts", () => {
  it("aggregates open, urgent, waiting patient, and overdue counts", () => {
    const counts = aggregatePathwayInboxDashboardCounts(
      [
        baseTask({ priority: "urgent", status: "waiting_patient", due_date: "2026-06-01" }),
        baseTask({ id: "task-2", status: "in_progress" }),
      ],
      "2026-06-10"
    );
    assert.equal(counts.openCount, 2);
    assert.equal(counts.urgentCount, 1);
    assert.equal(counts.waitingPatientCount, 1);
    assert.equal(counts.overdueCount, 1);
  });
});
