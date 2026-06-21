import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import { buildAnalyticsExecutiveSnapshot } from "@/src/lib/analytics-os/analyticsExecutiveEngine";
import { generateAnalyticsExecutiveInsights } from "@/src/lib/analytics-os/analyticsExecutiveInsights";
import {
  buildExecutiveScoringEventSummary,
  calculateConversionPerformanceScore,
  calculateDataCompletenessScore,
  calculateOverallClinicHealthScore,
  calculateRevenueEfficiencyScore,
  calculateSurgicalEfficiencyScore,
  calculateWorkforceReadinessScore,
  clampScore,
  resolveScoreBand,
  type ExecutiveScoringInput,
} from "@/src/lib/analytics-os/analyticsExecutiveScoring";
import type { FiAnalyticsEventRow } from "@/src/lib/analytics-os/analyticsEventCore";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function event(
  partial: Partial<FiAnalyticsEventRow> & Pick<FiAnalyticsEventRow, "module_name" | "event_type">
): FiAnalyticsEventRow {
  return {
    id: randomUUID(),
    tenant_id: TENANT,
    clinic_id: null,
    entity_id: randomUUID(),
    entity_type: "booking",
    event_value: null,
    event_metadata: {},
    occurred_at: "2026-06-15T10:00:00.000Z",
    created_at: "2026-06-15T10:00:00.000Z",
    ...partial,
  };
}

function baseScoringInput(overrides?: Partial<ExecutiveScoringInput>): ExecutiveScoringInput {
  return {
    current: buildExecutiveScoringEventSummary([]),
    comparison: null,
    workforceReadiness: null,
    activeModuleNames: [],
    expectedModuleCount: 8,
    ...overrides,
  };
}

describe("analyticsExecutiveScoring", () => {
  it("resolves score bands deterministically", () => {
    assert.equal(resolveScoreBand(90), "excellent");
    assert.equal(resolveScoreBand(75), "strong");
    assert.equal(resolveScoreBand(60), "watch");
    assert.equal(resolveScoreBand(45), "risk");
    assert.equal(resolveScoreBand(20), "critical");
    assert.equal(clampScore(150), 100);
    assert.equal(clampScore(-5), 0);
  });

  it("calculates weighted overall clinic health score", () => {
    const scores = {
      revenueEfficiencyScore: {
        score: 80,
        band: "strong" as const,
        label: "Revenue",
        explanation: "",
        contributingSignals: [],
        limitedSignal: false,
      },
      workforceReadinessScore: {
        score: 70,
        band: "strong" as const,
        label: "Workforce",
        explanation: "",
        contributingSignals: [],
        limitedSignal: false,
      },
      conversionPerformanceScore: {
        score: 60,
        band: "watch" as const,
        label: "Conversion",
        explanation: "",
        contributingSignals: [],
        limitedSignal: false,
      },
      surgicalEfficiencyScore: {
        score: 75,
        band: "strong" as const,
        label: "Surgical",
        explanation: "",
        contributingSignals: [],
        limitedSignal: false,
      },
      patientJourneyScore: {
        score: 55,
        band: "watch" as const,
        label: "Patient",
        explanation: "",
        contributingSignals: [],
        limitedSignal: false,
      },
      dataCompletenessScore: {
        score: 50,
        band: "watch" as const,
        label: "Data",
        explanation: "",
        contributingSignals: [],
        limitedSignal: false,
      },
    };

    const overall = calculateOverallClinicHealthScore(scores);
    assert.equal(overall.score, 68);
    assert.equal(overall.band, "watch");
  });

  it("scores revenue efficiency from payment events and comparison", () => {
    const currentEvents = [
      event({ module_name: "financial_os", event_type: "payment_received", event_value: 15000 }),
      event({ module_name: "financial_os", event_type: "payment_received", event_value: 8000 }),
      event({ module_name: "financial_os", event_type: "invoice_created" }),
    ];
    const comparisonEvents = [
      event({ module_name: "financial_os", event_type: "payment_received", event_value: 5000 }),
    ];

    const input = baseScoringInput({
      current: buildExecutiveScoringEventSummary(currentEvents),
      comparison: buildExecutiveScoringEventSummary(comparisonEvents),
      activeModuleNames: ["financial_os"],
    });

    const score = calculateRevenueEfficiencyScore(input);
    assert.ok(score.score >= 55);
    assert.equal(score.limitedSignal, false);
    assert.ok(score.explanation.includes("increased") || score.explanation.includes("Payment"));
  });

  it("uses workforce readiness overview when available", () => {
    const input = baseScoringInput({
      workforceReadiness: {
        averageReadinessScore: 82,
        activeStaff: 10,
        blockedCount: 0,
        operationalWarningCount: 1,
        restrictedCount: 0,
      },
      activeModuleNames: ["workforce_os"],
    });

    const score = calculateWorkforceReadinessScore(input);
    assert.ok(score.score >= 70);
    assert.equal(score.limitedSignal, false);
  });

  it("falls back to workforce events when readiness overview missing", () => {
    const currentEvents = [
      event({ module_name: "workforce_os", event_type: "staff_assigned", event_value: 90 }),
      event({ module_name: "workforce_os", event_type: "shift_created" }),
    ];
    const input = baseScoringInput({
      current: buildExecutiveScoringEventSummary(currentEvents),
      activeModuleNames: ["workforce_os"],
    });

    const score = calculateWorkforceReadinessScore(input);
    assert.ok(score.score > 0);
    assert.equal(score.limitedSignal, false);
  });

  it("handles conversion score with missing data gracefully", () => {
    const score = calculateConversionPerformanceScore(baseScoringInput());
    assert.ok(score.score >= 0);
    assert.equal(score.limitedSignal, true);
    assert.ok(score.explanation.includes("Limited"));
  });

  it("detects conversion gap when quotes lag consultations", () => {
    const currentEvents = [
      event({ module_name: "consultation_os", event_type: "consultation_booked" }),
      event({ module_name: "consultation_os", event_type: "consultation_booked" }),
      event({ module_name: "consultation_os", event_type: "consultation_booked" }),
      event({ module_name: "consultation_os", event_type: "consultation_booked" }),
    ];
    const input = baseScoringInput({
      current: buildExecutiveScoringEventSummary(currentEvents),
      activeModuleNames: ["consultation_os"],
    });
    const score = calculateConversionPerformanceScore(input);
    assert.ok(score.explanation.includes("low relative"));
  });

  it("scores surgical efficiency with limited data", () => {
    const score = calculateSurgicalEfficiencyScore(baseScoringInput());
    assert.ok(score.score >= 0);
    assert.equal(score.limitedSignal, true);

    const withSurgery = baseScoringInput({
      current: buildExecutiveScoringEventSummary([
        event({ module_name: "surgery_os", event_type: "surgery_completed" }),
        event({ module_name: "surgery_os", event_type: "surgery_completed" }),
      ]),
      activeModuleNames: ["surgery_os"],
    });
    const improved = calculateSurgicalEfficiencyScore(withSurgery);
    assert.ok(improved.score > score.score);
    assert.equal(improved.limitedSignal, false);
  });

  it("scores data completeness from module coverage", () => {
    const sparse = calculateDataCompletenessScore(
      baseScoringInput({ activeModuleNames: ["financial_os"], current: buildExecutiveScoringEventSummary([event({ module_name: "financial_os", event_type: "payment_received" })]) })
    );
    const rich = calculateDataCompletenessScore(
      baseScoringInput({
        activeModuleNames: ["financial_os", "workforce_os", "surgery_os", "consultation_os"],
        current: buildExecutiveScoringEventSummary([
          event({ module_name: "financial_os", event_type: "payment_received" }),
          event({ module_name: "workforce_os", event_type: "staff_assigned" }),
          event({ module_name: "surgery_os", event_type: "surgery_completed" }),
          event({ module_name: "consultation_os", event_type: "quote_sent" }),
          event({ module_name: "consultation_os", event_type: "quote_sent" }),
          event({ module_name: "consultation_os", event_type: "quote_sent" }),
          event({ module_name: "consultation_os", event_type: "quote_sent" }),
          event({ module_name: "consultation_os", event_type: "quote_sent" }),
          event({ module_name: "consultation_os", event_type: "quote_sent" }),
          event({ module_name: "consultation_os", event_type: "quote_sent" }),
        ]),
      })
    );

    assert.ok(rich.score > sparse.score);
    assert.equal(sparse.limitedSignal, true);
  });
});

describe("analyticsExecutiveEngine", () => {
  it("builds deterministic snapshot output", () => {
    const events = [
      event({ module_name: "financial_os", event_type: "payment_received", event_value: 12000 }),
      event({ module_name: "workforce_os", event_type: "staff_assigned", event_value: 85 }),
      event({ module_name: "surgery_os", event_type: "surgery_completed" }),
      event({ module_name: "consultation_os", event_type: "quote_sent" }),
      event({ module_name: "consultation_os", event_type: "consultation_booked" }),
    ];
    const comparison = [
      event({ module_name: "financial_os", event_type: "payment_received", event_value: 4000 }),
    ];

    const snapshot = buildAnalyticsExecutiveSnapshot({
      tenantId: TENANT,
      periodStart: "2026-06-01T00:00:00.000Z",
      periodEnd: "2026-06-30T23:59:59.999Z",
      currentEvents: events,
      comparisonEvents: comparison,
      generatedAt: "2026-06-22T12:00:00.000Z",
      workforceReadiness: {
        averageReadinessScore: 78,
        activeStaff: 5,
        blockedCount: 0,
        operationalWarningCount: 0,
        restrictedCount: 0,
      },
    });

    assert.equal(snapshot.tenantId, TENANT);
    assert.ok(snapshot.overallClinicHealthScore.score > 0);
    assert.equal(snapshot.generatedAt, "2026-06-22T12:00:00.000Z");
    assert.equal(snapshot.moduleCoverage.filter((m) => m.status === "active").length, 4);
    assert.ok(snapshot.metrics.length >= 5);
    assert.ok(snapshot.insights.length > 0);

    const again = buildAnalyticsExecutiveSnapshot({
      tenantId: TENANT,
      periodStart: "2026-06-01T00:00:00.000Z",
      periodEnd: "2026-06-30T23:59:59.999Z",
      currentEvents: events,
      comparisonEvents: comparison,
      generatedAt: "2026-06-22T12:00:00.000Z",
      workforceReadiness: {
        averageReadinessScore: 78,
        activeStaff: 5,
        blockedCount: 0,
        operationalWarningCount: 0,
        restrictedCount: 0,
      },
    });

    assert.deepEqual(
      {
        overall: snapshot.overallClinicHealthScore.score,
        revenue: snapshot.revenueEfficiencyScore.score,
        metrics: snapshot.metrics.map((m) => m.value),
      },
      {
        overall: again.overallClinicHealthScore.score,
        revenue: again.revenueEfficiencyScore.score,
        metrics: again.metrics.map((m) => m.value),
      }
    );
  });

  it("never crashes on empty events", () => {
    const snapshot = buildAnalyticsExecutiveSnapshot({
      tenantId: TENANT,
      periodStart: "2026-06-01T00:00:00.000Z",
      periodEnd: "2026-06-30T23:59:59.999Z",
      currentEvents: [],
      comparisonEvents: [],
    });

    assert.ok(snapshot.overallClinicHealthScore.score >= 0);
    assert.equal(snapshot.dataCompletenessScore.limitedSignal, true);
    assert.ok(snapshot.insights.some((i) => i.type === "data_gap"));
  });
});

describe("analyticsExecutiveInsights", () => {
  it("generates revenue momentum insight on payment growth", () => {
    const snapshot = buildAnalyticsExecutiveSnapshot({
      tenantId: TENANT,
      periodStart: "2026-06-01T00:00:00.000Z",
      periodEnd: "2026-06-30T23:59:59.999Z",
      currentEvents: [
        event({ module_name: "financial_os", event_type: "payment_received", event_value: 20000 }),
        event({ module_name: "financial_os", event_type: "payment_received", event_value: 20000 }),
      ],
      comparisonEvents: [
        event({ module_name: "financial_os", event_type: "payment_received", event_value: 5000 }),
      ],
    });

    const insights = generateAnalyticsExecutiveInsights(snapshot, []);
    assert.ok(insights.some((i) => i.type === "revenue_momentum" && i.severity === "positive"));
  });
});
