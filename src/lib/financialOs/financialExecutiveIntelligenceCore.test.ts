import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateExecutiveAccountsReceivable,
  aggregateExecutiveAttribution,
  aggregateExecutiveProfitability,
  aggregateExecutiveRevenue,
  assertExecutiveDataTenantScoped,
  buildExecutiveFinanceSnapshot,
  calculateArRiskScore,
  calculateRevenueForecast,
  compareExecutivePeriods,
  executiveZeroDataSnapshot,
  generateExecutiveFinanceInsights,
} from "@/src/lib/financialOs/financialExecutiveIntelligenceCore";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("financialExecutiveIntelligenceCore", () => {
  it("aggregateExecutiveRevenue sums ledger collections and invoice exposure", () => {
    const result = aggregateExecutiveRevenue({
      period_start: "2026-06-01",
      period_end: "2026-06-30",
      ledger_transactions: [
        {
          tenant_id: TENANT_A,
          transaction_kind: "payment_received",
          amount_cents: 50_000,
          direction: "credit",
          invoice_id: "inv-1",
          consultation_id: "consult-1",
          case_id: null,
          clinic_id: null,
          created_at: "2026-06-10T10:00:00.000Z",
        },
        {
          tenant_id: TENANT_A,
          transaction_kind: "deposit_paid",
          amount_cents: 100_000,
          direction: "credit",
          invoice_id: "inv-2",
          consultation_id: null,
          case_id: "case-1",
          clinic_id: null,
          created_at: "2026-06-15T10:00:00.000Z",
        },
      ],
      invoices: [
        {
          id: "inv-1",
          tenant_id: TENANT_A,
          invoice_kind: "consultation_quote",
          total_cents: 50_000,
          remaining_balance_cents: 0,
          status: "paid",
          days_overdue: 0,
          clinic_id: null,
          consultation_id: "consult-1",
          case_id: null,
          created_at: "2026-06-01T00:00:00.000Z",
          paid_at: "2026-06-10T00:00:00.000Z",
        },
        {
          id: "inv-3",
          tenant_id: TENANT_A,
          invoice_kind: "surgery_balance",
          total_cents: 200_000,
          remaining_balance_cents: 80_000,
          status: "overdue",
          days_overdue: 5,
          clinic_id: null,
          consultation_id: null,
          case_id: "case-2",
          created_at: "2026-06-05T00:00:00.000Z",
          paid_at: null,
        },
      ],
    });

    assert.equal(result.collected_revenue_cents, 150_000);
    assert.equal(result.outstanding_revenue_cents, 80_000);
    assert.equal(result.overdue_revenue_cents, 80_000);
    assert.equal(result.total_overdue_invoices, 1);
    assert.equal(result.surgery_revenue_cents, 200_000);
  });

  it("aggregateExecutiveProfitability computes margin and per-case averages", () => {
    const result = aggregateExecutiveProfitability({
      period_start: "2026-06-01",
      period_end: "2026-06-30",
      snapshots: [
        {
          tenant_id: TENANT_A,
          case_id: "case-1",
          procedure_type: "fue",
          revenue_cents: 300_000,
          collected_cents: 300_000,
          outstanding_cents: 0,
          gross_profit_cents: 120_000,
          gross_margin_percentage: 40,
          graft_count: 2000,
          revenue_per_graft_cents: 150,
          calculated_at: "2026-06-20T12:00:00.000Z",
        },
        {
          tenant_id: TENANT_A,
          case_id: "case-2",
          procedure_type: "fut",
          revenue_cents: 200_000,
          collected_cents: 100_000,
          outstanding_cents: 100_000,
          gross_profit_cents: 60_000,
          gross_margin_percentage: 30,
          graft_count: 1500,
          revenue_per_graft_cents: 133,
          calculated_at: "2026-06-22T12:00:00.000Z",
        },
      ],
    });

    assert.equal(result.gross_profit_cents, 180_000);
    assert.equal(result.average_margin_percentage, 35);
    assert.equal(result.total_surgeries, 2);
    assert.equal(result.average_revenue_per_case_cents, 250_000);
    assert.equal(result.highest_margin_procedure_type, "fue");
  });

  it("aggregateExecutiveAttribution identifies best revenue and profit sources", () => {
    const metrics = aggregateExecutiveAttribution({
      period_start: "2026-06-01",
      period_end: "2026-06-30",
      events: [
        {
          tenant_id: TENANT_A,
          attribution_source: "google_ads",
          attributed_revenue_cents: 100_000,
          attributed_collected_cents: 80_000,
          gross_profit_cents: 30_000,
          lead_id: "l1",
          consultation_id: "c1",
          invoice_id: "i1",
          procedure_type: "fue",
          clinic_id: null,
          consultant_fi_user_id: null,
          occurred_at: "2026-06-10T00:00:00.000Z",
        },
        {
          tenant_id: TENANT_A,
          attribution_source: "referral",
          attributed_revenue_cents: 50_000,
          attributed_collected_cents: 50_000,
          gross_profit_cents: 35_000,
          lead_id: "l2",
          consultation_id: "c2",
          invoice_id: "i2",
          procedure_type: "fut",
          clinic_id: null,
          consultant_fi_user_id: null,
          occurred_at: "2026-06-12T00:00:00.000Z",
        },
        {
          tenant_id: TENANT_A,
          attribution_source: "unknown",
          attributed_revenue_cents: 20_000,
          attributed_collected_cents: 20_000,
          gross_profit_cents: 5_000,
          lead_id: null,
          consultation_id: null,
          invoice_id: "i3",
          procedure_type: null,
          clinic_id: null,
          consultant_fi_user_id: null,
          occurred_at: "2026-06-14T00:00:00.000Z",
        },
      ],
    });

    assert.equal(metrics.best_revenue_source, "google_ads");
    assert.equal(metrics.best_profit_source, "referral");
    assert.equal(metrics.unknown_attribution_percentage, 13.33);
  });

  it("calculateArRiskScore returns 0 for empty AR and higher for critical exposure", () => {
    const empty = aggregateExecutiveAccountsReceivable([]);
    assert.equal(calculateArRiskScore({ ar: empty, gross_revenue_cents: 500_000 }), 0);

    const ar = aggregateExecutiveAccountsReceivable([
      {
        tenant_id: TENANT_A,
        outstanding_amount_cents: 300_000,
        days_overdue: 20,
        risk_level: "critical",
        receivable_type: "surgery_balance",
        status: "escalated",
        clinic_id: null,
      },
    ]);
    const score = calculateArRiskScore({ ar, gross_revenue_cents: 500_000 });
    assert.ok(score > 30);
    assert.ok(score <= 100);
  });

  it("calculateRevenueForecast is deterministic with explanation factors", () => {
    const forecast = calculateRevenueForecast({
      period_start: "2026-06-01",
      period_end: "2026-06-30",
      as_of_ymd: "2026-06-15",
      collected_revenue_cents: 300_000,
      gross_revenue_cents: 400_000,
      ar_cases: [
        {
          tenant_id: TENANT_A,
          outstanding_amount_cents: 100_000,
          days_overdue: 3,
          risk_level: "medium",
          receivable_type: "surgery_balance",
          status: "open",
          clinic_id: null,
        },
      ],
      scheduled_surgeries: [
        {
          surgery_id: "s1",
          scheduled_date: "2026-06-20",
          invoice_value_cents: 200_000,
          clinic_id: null,
        },
      ],
    });

    assert.ok(forecast.forecast_revenue_cents >= 300_000);
    assert.ok(forecast.forecast_confidence > 0);
    assert.equal(forecast.explanation_factors.length, 4);
    assert.ok(forecast.historical_collection_rate > 0);
  });

  it("compareExecutivePeriods produces comparison badges", () => {
    const current = {
      collected_revenue_cents: 200_000,
      gross_profit_cents: 80_000,
      average_margin_percentage: 35,
      outstanding_revenue_cents: 50_000,
      ar_risk_score: 20,
      forecast_revenue_cents: 350_000,
      best_revenue_source: "google_ads" as const,
    };
    const previous = {
      collected_revenue_cents: 150_000,
      gross_profit_cents: 70_000,
      average_margin_percentage: 38,
      outstanding_revenue_cents: 40_000,
      ar_risk_score: 15,
      forecast_revenue_cents: 300_000,
      best_revenue_source: "referral" as const,
    };

    const cmp = compareExecutivePeriods(current, previous);
    assert.equal(cmp.collected_revenue_delta_cents, 50_000);
    assert.equal(cmp.badges.collected_vs_previous, "up");
    assert.equal(cmp.badges.margin, "down");
    assert.equal(cmp.badges.outstanding, "up");
    assert.equal(cmp.best_revenue_source_shift.changed, true);
  });

  it("unknown attribution warning insight", () => {
    const attribution = aggregateExecutiveAttribution({
      period_start: "2026-06-01",
      period_end: "2026-06-30",
      events: [
        {
          tenant_id: TENANT_A,
          attribution_source: "unknown",
          attributed_revenue_cents: 50_000,
          attributed_collected_cents: 50_000,
          gross_profit_cents: 10_000,
          lead_id: null,
          consultation_id: null,
          invoice_id: "i1",
          procedure_type: null,
          clinic_id: null,
          consultant_fi_user_id: null,
          occurred_at: "2026-06-10T00:00:00.000Z",
        },
        {
          tenant_id: TENANT_A,
          attribution_source: "google_ads",
          attributed_revenue_cents: 50_000,
          attributed_collected_cents: 50_000,
          gross_profit_cents: 20_000,
          lead_id: "l1",
          consultation_id: null,
          invoice_id: "i2",
          procedure_type: null,
          clinic_id: null,
          consultant_fi_user_id: null,
          occurred_at: "2026-06-11T00:00:00.000Z",
        },
      ],
    });

    const snapshot = buildExecutiveFinanceSnapshot({
      tenant_id: TENANT_A,
      period_start: "2026-06-01",
      period_end: "2026-06-30",
      as_of_ymd: "2026-06-30",
      ledger_transactions: [],
      invoices: [],
      profitability_snapshots: [],
      attribution_events: [],
      ar_cases: [],
      scheduled_surgeries: [],
    });

    const insights = generateExecutiveFinanceInsights({
      snapshot,
      attribution,
      ar: { surgery_balance_outstanding_cents: 0 },
      profitability_snapshots: [],
      comparison: null,
    });

    assert.ok(insights.some((i) => i.kind === "high_unknown_attribution"));
  });

  it("margin compression insight when margin falls vs previous period", () => {
    const snapshot = buildExecutiveFinanceSnapshot({
      tenant_id: TENANT_A,
      period_start: "2026-06-01",
      period_end: "2026-06-30",
      as_of_ymd: "2026-06-30",
      ledger_transactions: [],
      invoices: [],
      profitability_snapshots: [
        {
          tenant_id: TENANT_A,
          case_id: "c1",
          procedure_type: "fue",
          revenue_cents: 100_000,
          collected_cents: 100_000,
          outstanding_cents: 0,
          gross_profit_cents: 20_000,
          gross_margin_percentage: 20,
          graft_count: 1000,
          revenue_per_graft_cents: 100,
          calculated_at: "2026-06-15T00:00:00.000Z",
        },
      ],
      attribution_events: [],
      ar_cases: [],
      scheduled_surgeries: [],
    });

    const comparison = compareExecutivePeriods(
      {
        collected_revenue_cents: snapshot.collected_revenue_cents,
        gross_profit_cents: snapshot.gross_profit_cents,
        average_margin_percentage: 20,
        outstanding_revenue_cents: snapshot.outstanding_revenue_cents,
        ar_risk_score: snapshot.ar_risk_score,
        forecast_revenue_cents: snapshot.forecast_revenue_cents,
        best_revenue_source: snapshot.best_revenue_source,
      },
      {
        collected_revenue_cents: 100_000,
        gross_profit_cents: 30_000,
        average_margin_percentage: 30,
        outstanding_revenue_cents: 0,
        ar_risk_score: 0,
        forecast_revenue_cents: 200_000,
        best_revenue_source: "google_ads",
      }
    );

    const insights = generateExecutiveFinanceInsights({
      snapshot,
      attribution: {
        best_revenue_source: null,
        best_profit_source: null,
        unknown_attribution_percentage: 0,
        revenue_by_source: [],
        profit_by_source: [],
      },
      ar: { surgery_balance_outstanding_cents: 0 },
      profitability_snapshots: [],
      comparison,
    });

    assert.ok(insights.some((i) => i.kind === "margin_compression"));
  });

  it("tenant isolation guard rejects cross-tenant rows", () => {
    assert.throws(() => {
      assertExecutiveDataTenantScoped(TENANT_A, [{ tenant_id: TENANT_B }]);
    }, /tenant-scoped/);
  });

  it("zero-data safe state produces empty snapshot", () => {
    const snap = executiveZeroDataSnapshot(TENANT_A, "2026-06-01", "2026-06-30");
    assert.equal(snap.tenant_id, TENANT_A);
    assert.equal(snap.collected_revenue_cents, 0);
    assert.equal(snap.forecast_revenue_cents, 0);
    assert.equal(snap.ar_risk_score, 0);
    assert.equal(snap.total_surgeries, 0);
  });
});
