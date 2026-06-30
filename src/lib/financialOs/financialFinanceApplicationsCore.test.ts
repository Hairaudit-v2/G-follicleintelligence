import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateFinanceApplicationsDashboardCounts,
  aggregateFinanceProviderAnalytics,
  buildFinanceApplicationAttentionSummary,
  requiresEscalatedFinanceApplicationAttention,
  type FiFinanceApplicationRow,
} from "@/src/lib/financialOs/financialFinanceApplicationsCore";
import { buildFinancialSurgeryPipelineStatus } from "@/src/lib/financialOs/financialSurgeryPipelineStatusCore";

function baseApp(over: Partial<FiFinanceApplicationRow> = {}): FiFinanceApplicationRow {
  return {
    id: "app-1",
    application_status: "draft",
    submitted_at: null,
    approved_at: null,
    settled_at: null,
    expected_settlement_date: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    finance_provider_id: "prov-1",
    payment_pathway_id: "path-1",
    booking_id: "book-1",
    ...over,
  };
}

describe("financialFinanceApplicationsCore — application lifecycle attention", () => {
  it("marks unresolved applications as requiring surgery pipeline attention", () => {
    const summary = buildFinanceApplicationAttentionSummary({
      todayYmd: "2026-06-10",
      application: baseApp({
        application_status: "submitted",
        submitted_at: "2026-06-09T00:00:00.000Z",
      }),
    });
    assert.equal(summary.finance_attention_required, true);
    assert.ok(summary.finance_attention_labels.includes("Finance Approval Pending"));
  });

  it("does not require attention for settled applications", () => {
    const summary = buildFinanceApplicationAttentionSummary({
      todayYmd: "2026-06-10",
      application: baseApp({
        application_status: "settled",
        settled_at: "2026-06-09T00:00:00.000Z",
      }),
    });
    assert.equal(summary.finance_attention_required, false);
  });

  it("escalates documents_pending older than 3 days", () => {
    const escalated = requiresEscalatedFinanceApplicationAttention({
      todayYmd: "2026-06-10",
      application: baseApp({
        application_status: "documents_pending",
        updated_at: "2026-06-01T00:00:00.000Z",
      }),
    });
    assert.equal(escalated, true);
  });

  it("escalates submitted older than 5 days", () => {
    const escalated = requiresEscalatedFinanceApplicationAttention({
      todayYmd: "2026-06-20",
      application: baseApp({
        application_status: "submitted",
        submitted_at: "2026-06-01T00:00:00.000Z",
      }),
    });
    assert.equal(escalated, true);
  });

  it("escalates under_review older than 7 days", () => {
    const escalated = requiresEscalatedFinanceApplicationAttention({
      todayYmd: "2026-06-20",
      application: baseApp({
        application_status: "under_review",
        submitted_at: "2026-06-01T00:00:00.000Z",
      }),
    });
    assert.equal(escalated, true);
  });

  it("escalates rejected applications", () => {
    const escalated = requiresEscalatedFinanceApplicationAttention({
      todayYmd: "2026-06-10",
      application: baseApp({ application_status: "rejected" }),
    });
    assert.equal(escalated, true);
  });

  it("escalates missed expected settlement date", () => {
    const escalated = requiresEscalatedFinanceApplicationAttention({
      todayYmd: "2026-06-20",
      application: baseApp({
        application_status: "settlement_pending",
        expected_settlement_date: "2026-06-15",
      }),
    });
    assert.equal(escalated, true);
  });

  it("escalates settlement_pending when surgery within 14 days", () => {
    const escalated = requiresEscalatedFinanceApplicationAttention({
      todayYmd: "2026-06-20",
      application: baseApp({ application_status: "settlement_pending" }),
      surgeryDateYmd: "2026-06-25",
    });
    assert.equal(escalated, true);
  });
});

describe("financialFinanceApplicationsCore — analytics", () => {
  it("computes provider approval and rejection rates", () => {
    const apps = [
      baseApp({
        id: "a1",
        finance_provider_id: "p1",
        application_status: "approved",
        submitted_at: "2026-06-01T00:00:00.000Z",
        approved_at: "2026-06-05T00:00:00.000Z",
      }),
      baseApp({
        id: "a2",
        finance_provider_id: "p1",
        application_status: "rejected",
        submitted_at: "2026-06-01T00:00:00.000Z",
      }),
      baseApp({
        id: "a3",
        finance_provider_id: "p2",
        application_status: "settled",
        submitted_at: "2026-06-01T00:00:00.000Z",
        approved_at: "2026-06-03T00:00:00.000Z",
        settled_at: "2026-06-10T00:00:00.000Z",
      }),
    ];
    const names = new Map([
      ["p1", "Provider One"],
      ["p2", "Provider Two"],
    ]);
    const analytics = aggregateFinanceProviderAnalytics(apps, names);
    const p1 = analytics.find((a) => a.providerId === "p1");
    assert.ok(p1);
    assert.equal(p1!.approvalRate, 0.5);
    assert.equal(p1!.rejectionRate, 0.5);
    assert.equal(p1!.averageApprovalDays, 4);

    const dashboard = aggregateFinanceApplicationsDashboardCounts(apps, "2026-06-20", names);
    assert.equal(dashboard.submittedCount, 3);
    assert.equal(dashboard.approvedCount, 2);
    assert.ok(dashboard.mostUsedProvider);
    assert.equal(dashboard.mostUsedProvider!.providerName, "Provider One");
  });
});

describe("financialFinanceApplicationsCore — surgery pipeline propagation", () => {
  it("sets payment_attention_required when finance application unresolved", () => {
    const status = buildFinancialSurgeryPipelineStatus({
      todayYmd: "2026-06-10",
      calendarTimezone: "Australia/Sydney",
      booking_status: "confirmed",
      financial_os_status: null,
      case_id: "case-1",
      patient_id: "pat-1",
      invoices: [],
      paymentRequests: [],
      payments: [],
      installmentPlans: [],
      financeApplication: baseApp({
        application_status: "under_review",
        submitted_at: "2026-06-09T00:00:00.000Z",
      }),
    });
    assert.equal(status.payment_attention_required, true);
    assert.ok(status.financeApplicationAttention.finance_attention_labels.length > 0);
  });
});
