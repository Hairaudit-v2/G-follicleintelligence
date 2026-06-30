import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateSuperReleaseAnalytics,
  aggregateSuperReleaseDashboardCounts,
  buildSuperReleaseAttentionSummary,
  computeDaysInStatus,
  requiresEscalatedSuperReleaseAttention,
  type FiSuperReleaseApplicationRow,
  type FiSuperReleaseClinicalLetterRow,
} from "@/src/lib/financialOs/financialSuperReleaseCore";
import { buildFinancialSurgeryPipelineStatus } from "@/src/lib/financialOs/financialSurgeryPipelineStatusCore";

function baseApp(over: Partial<FiSuperReleaseApplicationRow> = {}): FiSuperReleaseApplicationRow {
  return {
    id: "app-1",
    application_status: "draft",
    submitted_at: null,
    approved_at: null,
    funds_released_at: null,
    expected_release_date: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    payment_pathway_id: "path-1",
    booking_id: "book-1",
    provider_name: null,
    ...over,
  };
}

describe("financialSuperReleaseCore — lifecycle transitions", () => {
  it("marks unresolved applications as requiring surgery pipeline attention", () => {
    const summary = buildSuperReleaseAttentionSummary({
      todayYmd: "2026-06-10",
      application: baseApp({
        application_status: "submitted",
        submitted_at: "2026-06-09T00:00:00.000Z",
      }),
    });
    assert.equal(summary.super_release_attention_required, true);
    assert.ok(summary.super_release_attention_labels.includes("Super Release Approval Pending"));
  });

  it("does not require attention for funds_released applications", () => {
    const summary = buildSuperReleaseAttentionSummary({
      todayYmd: "2026-06-10",
      application: baseApp({
        application_status: "funds_released",
        funds_released_at: "2026-06-09T00:00:00.000Z",
      }),
    });
    assert.equal(summary.super_release_attention_required, false);
  });

  it("does not require attention for cancelled applications", () => {
    const summary = buildSuperReleaseAttentionSummary({
      todayYmd: "2026-06-10",
      application: baseApp({ application_status: "cancelled" }),
    });
    assert.equal(summary.super_release_attention_required, false);
  });
});

describe("financialSuperReleaseCore — document tracking attention", () => {
  it("labels documents_pending status", () => {
    const summary = buildSuperReleaseAttentionSummary({
      todayYmd: "2026-06-10",
      application: baseApp({ application_status: "documents_pending" }),
    });
    assert.ok(summary.super_release_attention_labels.includes("Super Release Documents Pending"));
  });

  it("escalates documents_pending older than 5 days", () => {
    const escalated = requiresEscalatedSuperReleaseAttention({
      todayYmd: "2026-06-10",
      application: baseApp({
        application_status: "documents_pending",
        updated_at: "2026-06-01T00:00:00.000Z",
      }),
    });
    assert.equal(escalated, true);
    assert.equal(
      buildSuperReleaseAttentionSummary({
        todayYmd: "2026-06-10",
        application: baseApp({
          application_status: "documents_pending",
          updated_at: "2026-06-01T00:00:00.000Z",
        }),
      }).sla_breach,
      true
    );
  });
});

describe("financialSuperReleaseCore — clinical letter workflow", () => {
  it("labels clinical_letter_required status", () => {
    const summary = buildSuperReleaseAttentionSummary({
      todayYmd: "2026-06-10",
      application: baseApp({ application_status: "clinical_letter_required" }),
    });
    assert.ok(summary.super_release_attention_labels.includes("Clinical Letter Required"));
  });

  it("escalates clinical_letter_required older than 3 days", () => {
    const escalated = requiresEscalatedSuperReleaseAttention({
      todayYmd: "2026-06-10",
      application: baseApp({
        application_status: "clinical_letter_required",
        updated_at: "2026-06-01T00:00:00.000Z",
      }),
    });
    assert.equal(escalated, true);
  });

  it("aggregates clinical letter turnaround in analytics", () => {
    const letters: FiSuperReleaseClinicalLetterRow[] = [
      {
        id: "l-1",
        letter_status: "issued",
        issued_at: "2026-06-05T00:00:00.000Z",
        created_at: "2026-06-01T00:00:00.000Z",
        updated_at: "2026-06-05T00:00:00.000Z",
      },
    ];
    const analytics = aggregateSuperReleaseAnalytics([], letters);
    assert.equal(analytics.averageClinicalLetterTurnaroundDays, 4);
  });
});

describe("financialSuperReleaseCore — attention rules and SLA breach", () => {
  it("escalates eligibility_review older than 3 days", () => {
    const escalated = requiresEscalatedSuperReleaseAttention({
      todayYmd: "2026-06-10",
      application: baseApp({
        application_status: "eligibility_review",
        updated_at: "2026-06-01T00:00:00.000Z",
      }),
    });
    assert.equal(escalated, true);
    assert.ok(
      buildSuperReleaseAttentionSummary({
        todayYmd: "2026-06-10",
        application: baseApp({
          application_status: "eligibility_review",
          updated_at: "2026-06-01T00:00:00.000Z",
        }),
      }).super_release_attention_labels.includes("Super Release Eligibility Review")
    );
  });

  it("escalates submitted older than 7 days", () => {
    const escalated = requiresEscalatedSuperReleaseAttention({
      todayYmd: "2026-06-20",
      application: baseApp({
        application_status: "submitted",
        submitted_at: "2026-06-01T00:00:00.000Z",
      }),
    });
    assert.equal(escalated, true);
  });

  it("escalates under_review older than 10 days", () => {
    const escalated = requiresEscalatedSuperReleaseAttention({
      todayYmd: "2026-06-20",
      application: baseApp({
        application_status: "under_review",
        submitted_at: "2026-06-01T00:00:00.000Z",
      }),
    });
    assert.equal(escalated, true);
  });

  it("escalates rejected applications", () => {
    const escalated = requiresEscalatedSuperReleaseAttention({
      todayYmd: "2026-06-10",
      application: baseApp({ application_status: "rejected" }),
    });
    assert.equal(escalated, true);
  });

  it("escalates missed expected release date", () => {
    const escalated = requiresEscalatedSuperReleaseAttention({
      todayYmd: "2026-06-20",
      application: baseApp({
        application_status: "release_pending",
        expected_release_date: "2026-06-15",
      }),
    });
    assert.equal(escalated, true);
  });

  it("computes days_in_status from status anchor", () => {
    const days = computeDaysInStatus(
      baseApp({
        application_status: "submitted",
        submitted_at: "2026-06-01T00:00:00.000Z",
      }),
      "2026-06-10"
    );
    assert.equal(days, 9);
  });
});

describe("financialSuperReleaseCore — release_pending + surgery within 14 days", () => {
  it("escalates release_pending when surgery within 14 days", () => {
    const escalated = requiresEscalatedSuperReleaseAttention({
      todayYmd: "2026-06-10",
      application: baseApp({
        application_status: "release_pending",
        approved_at: "2026-06-05T00:00:00.000Z",
      }),
      surgeryDateYmd: "2026-06-20",
    });
    assert.equal(escalated, true);
    const summary = buildSuperReleaseAttentionSummary({
      todayYmd: "2026-06-10",
      application: baseApp({ application_status: "release_pending" }),
      surgeryDateYmd: "2026-06-20",
    });
    assert.ok(summary.super_release_attention_labels.includes("Funds Release Pending"));
  });

  it("does not escalate release_pending when surgery is beyond 14 days", () => {
    const escalated = requiresEscalatedSuperReleaseAttention({
      todayYmd: "2026-06-10",
      application: baseApp({ application_status: "release_pending" }),
      surgeryDateYmd: "2026-08-01",
    });
    assert.equal(escalated, false);
  });

  it("propagates super release attention to surgery pipeline", () => {
    const status = buildFinancialSurgeryPipelineStatus({
      todayYmd: "2026-06-10",
      calendarTimezone: "Australia/Perth",
      booking_status: "confirmed",
      financial_os_status: null,
      case_id: "case-1",
      patient_id: "pat-1",
      invoices: [],
      paymentRequests: [],
      payments: [],
      installmentPlans: [],
      superReleaseApplication: baseApp({ application_status: "documents_pending" }),
    });
    assert.equal(status.payment_attention_required, true);
    assert.equal(status.superReleaseApplicationAttention.super_release_attention_required, true);
  });
});

describe("financialSuperReleaseCore — dashboard aggregation", () => {
  it("counts open applications and attention", () => {
    const counts = aggregateSuperReleaseDashboardCounts(
      [
        baseApp({
          application_status: "documents_pending",
          updated_at: "2026-06-01T00:00:00.000Z",
        }),
        baseApp({ id: "app-2", application_status: "funds_released" }),
      ],
      "2026-06-10"
    );
    assert.equal(counts.openCount, 1);
    assert.equal(counts.awaitingDocumentsCount, 1);
    assert.equal(counts.attentionCount, 1);
  });

  it("computes approval and rejection rates", () => {
    const analytics = aggregateSuperReleaseAnalytics([
      baseApp({ application_status: "approved" }),
      baseApp({ id: "app-2", application_status: "rejected" }),
      baseApp({ id: "app-3", application_status: "funds_released" }),
    ]);
    assert.equal(analytics.approvalRate, 2 / 3);
    assert.equal(analytics.rejectionRate, 1 / 3);
  });
});
