import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateInternationalTransferAnalytics,
  aggregateInternationalTransferDashboardCounts,
  buildInternationalTransferAttentionSummary,
  computeDaysInStatus,
  requiresEscalatedInternationalTransferAttention,
  type FiInternationalTransferApplicationRow,
  type FiInternationalTransferProofRow,
} from "@/src/lib/financialOs/financialInternationalTransferCore";
import { buildFinancialSurgeryPipelineStatus } from "@/src/lib/financialOs/financialSurgeryPipelineStatusCore";

function baseApp(
  over: Partial<FiInternationalTransferApplicationRow> = {}
): FiInternationalTransferApplicationRow {
  return {
    id: "app-1",
    transfer_status: "instructions_required",
    transfer_method: "bank_transfer",
    source_country_code: "GB",
    source_currency_code: "GBP",
    settlement_currency_code: "AUD",
    expected_amount_cents: 100_000,
    expected_settlement_amount_cents: 200_000,
    received_amount_cents: null,
    expected_exchange_rate: 1.95,
    actual_exchange_rate: null,
    fx_fee_cents: null,
    settlement_variance_cents: null,
    expected_settlement_date: null,
    actual_settlement_date: null,
    payment_reference: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    payment_pathway_id: "path-1",
    booking_id: "book-1",
    ...over,
  };
}

describe("financialInternationalTransferCore — instructions_required SLA", () => {
  it("escalates instructions_required older than 1 day", () => {
    const escalated = requiresEscalatedInternationalTransferAttention({
      todayYmd: "2026-06-05",
      application: baseApp({
        transfer_status: "instructions_required",
        updated_at: "2026-06-01T00:00:00.000Z",
      }),
    });
    assert.equal(escalated, true);
    assert.equal(
      buildInternationalTransferAttentionSummary({
        todayYmd: "2026-06-05",
        application: baseApp({
          transfer_status: "instructions_required",
          updated_at: "2026-06-01T00:00:00.000Z",
        }),
      }).sla_breach,
      true
    );
  });

  it("does not escalate instructions_required within 1 day", () => {
    const escalated = requiresEscalatedInternationalTransferAttention({
      todayYmd: "2026-06-02",
      application: baseApp({
        transfer_status: "instructions_required",
        updated_at: "2026-06-01T00:00:00.000Z",
      }),
    });
    assert.equal(escalated, false);
  });
});

describe("financialInternationalTransferCore — awaiting_transfer SLA", () => {
  it("escalates awaiting_transfer older than 5 days", () => {
    const escalated = requiresEscalatedInternationalTransferAttention({
      todayYmd: "2026-06-10",
      application: baseApp({
        transfer_status: "awaiting_transfer",
        updated_at: "2026-06-01T00:00:00.000Z",
      }),
    });
    assert.equal(escalated, true);
    assert.ok(
      buildInternationalTransferAttentionSummary({
        todayYmd: "2026-06-10",
        application: baseApp({ transfer_status: "awaiting_transfer" }),
      }).international_transfer_attention_labels.includes("Awaiting International Transfer")
    );
  });
});

describe("financialInternationalTransferCore — proof_received reconciliation SLA", () => {
  it("escalates proof_received older than 2 days", () => {
    const escalated = requiresEscalatedInternationalTransferAttention({
      todayYmd: "2026-06-10",
      application: baseApp({
        transfer_status: "proof_received",
        updated_at: "2026-06-01T00:00:00.000Z",
      }),
    });
    assert.equal(escalated, true);
    assert.ok(
      buildInternationalTransferAttentionSummary({
        todayYmd: "2026-06-10",
        application: baseApp({ transfer_status: "proof_received" }),
      }).international_transfer_attention_labels.includes(
        "Proof Received — Reconciliation Required"
      )
    );
  });

  it("escalates under_reconciliation older than 2 days", () => {
    const escalated = requiresEscalatedInternationalTransferAttention({
      todayYmd: "2026-06-10",
      application: baseApp({
        transfer_status: "under_reconciliation",
        updated_at: "2026-06-01T00:00:00.000Z",
      }),
    });
    assert.equal(escalated, true);
  });
});

describe("financialInternationalTransferCore — settlement pending + surgery within 14 days", () => {
  it("escalates settlement_pending when surgery is within 14 days", () => {
    const escalated = requiresEscalatedInternationalTransferAttention({
      todayYmd: "2026-06-10",
      surgeryDateYmd: "2026-06-20",
      application: baseApp({ transfer_status: "settlement_pending" }),
    });
    assert.equal(escalated, true);
    assert.ok(
      buildInternationalTransferAttentionSummary({
        todayYmd: "2026-06-10",
        surgeryDateYmd: "2026-06-20",
        application: baseApp({ transfer_status: "settlement_pending" }),
        surgeryPipelineLabels: true,
      }).international_transfer_attention_labels.includes("International Settlement Pending")
    );
  });
});

describe("financialInternationalTransferCore — expected settlement date missed", () => {
  it("escalates when expected settlement date is past", () => {
    const escalated = requiresEscalatedInternationalTransferAttention({
      todayYmd: "2026-06-20",
      application: baseApp({
        transfer_status: "settlement_pending",
        expected_settlement_date: "2026-06-15",
      }),
    });
    assert.equal(escalated, true);
  });
});

describe("financialInternationalTransferCore — variance review", () => {
  it("always escalates variance_review status", () => {
    const escalated = requiresEscalatedInternationalTransferAttention({
      todayYmd: "2026-06-10",
      application: baseApp({ transfer_status: "variance_review" }),
    });
    assert.equal(escalated, true);
    assert.ok(
      buildInternationalTransferAttentionSummary({
        todayYmd: "2026-06-10",
        application: baseApp({ transfer_status: "variance_review" }),
      }).international_transfer_attention_labels.includes("FX Variance Review")
    );
  });
});

describe("financialInternationalTransferCore — rejected transfer", () => {
  it("always escalates rejected applications", () => {
    const escalated = requiresEscalatedInternationalTransferAttention({
      todayYmd: "2026-06-10",
      application: baseApp({ transfer_status: "rejected" }),
    });
    assert.equal(escalated, true);
    assert.equal(
      buildInternationalTransferAttentionSummary({
        todayYmd: "2026-06-10",
        application: baseApp({ transfer_status: "rejected" }),
      }).international_transfer_attention_required,
      true
    );
  });
});

describe("financialInternationalTransferCore — partially settled with remaining balance", () => {
  it("requires attention when partially_settled with remaining balance", () => {
    const summary = buildInternationalTransferAttentionSummary({
      todayYmd: "2026-06-10",
      application: baseApp({
        transfer_status: "partially_settled",
        expected_settlement_amount_cents: 200_000,
        received_amount_cents: 150_000,
      }),
    });
    assert.equal(summary.international_transfer_attention_required, true);
    assert.equal(summary.financial_clearance_state, "partial_settlement");
    assert.equal(
      requiresEscalatedInternationalTransferAttention({
        todayYmd: "2026-06-10",
        application: baseApp({
          transfer_status: "partially_settled",
          expected_settlement_amount_cents: 200_000,
          received_amount_cents: 150_000,
        }),
      }),
      true
    );
  });
});

describe("financialInternationalTransferCore — settled clears attention", () => {
  it("does not require attention for settled applications", () => {
    const summary = buildInternationalTransferAttentionSummary({
      todayYmd: "2026-06-10",
      application: baseApp({
        transfer_status: "settled",
        received_amount_cents: 200_000,
        actual_settlement_date: "2026-06-09",
      }),
    });
    assert.equal(summary.international_transfer_attention_required, false);
    assert.equal(summary.financial_clearance_state, "cleared");
    assert.equal(
      requiresEscalatedInternationalTransferAttention({
        todayYmd: "2026-06-10",
        application: baseApp({ transfer_status: "settled" }),
      }),
      false
    );
  });

  it("propagates cleared state to surgery pipeline when settled", () => {
    const pipeline = buildFinancialSurgeryPipelineStatus({
      todayYmd: "2026-06-10",
      calendarTimezone: "Australia/Sydney",
      booking_status: "confirmed",
      financial_os_status: "confirmed",
      case_id: "case-1",
      patient_id: "patient-1",
      invoices: [],
      paymentRequests: [],
      payments: [],
      installmentPlans: [],
      internationalTransferApplication: baseApp({
        transfer_status: "settled",
        received_amount_cents: 200_000,
      }),
    });
    assert.equal(
      pipeline.internationalTransferApplicationAttention.international_transfer_attention_required,
      false
    );
    assert.equal(
      pipeline.internationalTransferApplicationAttention.financial_clearance_state,
      "cleared"
    );
  });

  it("blocks surgery pipeline clearance for unresolved international transfer", () => {
    const pipeline = buildFinancialSurgeryPipelineStatus({
      todayYmd: "2026-06-10",
      calendarTimezone: "Australia/Sydney",
      booking_status: "confirmed",
      financial_os_status: "confirmed",
      case_id: "case-1",
      patient_id: "patient-1",
      invoices: [],
      paymentRequests: [],
      payments: [],
      installmentPlans: [],
      paymentPathways: [
        {
          id: "path-1",
          pathway_type: "international_transfer",
          status: "settlement_pending",
          provider: null,
          provider_reference: null,
          expected_settlement_date: null,
          actual_settlement_date: null,
          expected_amount_cents: null,
          settled_amount_cents: null,
          currency_code: "AUD",
          created_at: "",
          updated_at: "",
        },
      ],
      internationalTransferApplication: baseApp({ transfer_status: "awaiting_transfer" }),
    });
    assert.equal(
      pipeline.internationalTransferApplicationAttention.international_transfer_attention_required,
      true
    );
    assert.equal(pipeline.payment_attention_required, true);
  });
});

describe("financialInternationalTransferCore — analytics aggregation", () => {
  it("aggregates settlement success rate and source countries", () => {
    const apps: FiInternationalTransferApplicationRow[] = [
      baseApp({
        id: "a1",
        transfer_status: "settled",
        actual_settlement_date: "2026-06-05",
        source_country_code: "GB",
      }),
      baseApp({ id: "a2", transfer_status: "rejected", source_country_code: "US" }),
      baseApp({ id: "a3", transfer_status: "cancelled", source_country_code: "GB" }),
    ];
    const proofs: FiInternationalTransferProofRow[] = [
      {
        id: "p1",
        international_transfer_application_id: "a1",
        proof_type: "payment_receipt",
        status: "verified",
        created_at: "2026-06-03T00:00:00.000Z",
        updated_at: "2026-06-03T00:00:00.000Z",
      },
    ];
    const analytics = aggregateInternationalTransferAnalytics(apps, proofs);
    assert.equal(analytics.totalApplications, 3);
    assert.equal(analytics.settledCount, 1);
    assert.equal(analytics.rejectedCount, 1);
    assert.equal(analytics.settlementSuccessRate, 0.5);
    assert.equal(analytics.mostCommonSourceCountries[0]?.countryCode, "GB");
    assert.equal(analytics.averageDaysToProofReceived, 2);
    assert.equal(analytics.averageDaysToSettled, 4);
  });

  it("aggregates dashboard counts", () => {
    const counts = aggregateInternationalTransferDashboardCounts(
      [
        baseApp({ transfer_status: "awaiting_transfer" }),
        baseApp({ id: "a2", transfer_status: "proof_received" }),
        baseApp({
          id: "a3",
          transfer_status: "settled",
          actual_settlement_date: "2026-06-15",
          created_at: "2026-06-01T00:00:00.000Z",
        }),
      ],
      "2026-06-20"
    );
    assert.equal(counts.openCount, 2);
    assert.equal(counts.awaitingTransferCount, 1);
    assert.equal(counts.proofReceivedCount, 1);
    assert.equal(counts.settledThisMonthCount, 1);
    assert.equal(counts.averageSettlementDays, 14);
  });

  it("computes days_in_status from updated_at anchor", () => {
    const days = computeDaysInStatus(
      baseApp({
        transfer_status: "proof_received",
        updated_at: "2026-06-01T00:00:00.000Z",
      }),
      "2026-06-10"
    );
    assert.equal(days, 9);
  });
});
