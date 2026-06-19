import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertFinancialOsSmokeInvariants,
  parseFinancialOsCommandCentrePayload,
} from "@/src/lib/financialOs/financialOsCommandCentrePayloadSchema";
import { buildFinancialOsPathwayFixture } from "@/src/lib/financialOs/financialOsPathwayFixture";

const TENANT = "11111111-1111-4111-8111-111111111111";

describe("FinancialOS command centre smoke payload", () => {
  it("parses and validates pilot payload shape", () => {
    const fixture = buildFinancialOsPathwayFixture();
    const payload = parseFinancialOsCommandCentrePayload({
      tenantId: TENANT,
      currency: "AUD",
      todayYmd: "2026-06-19",
      revenueTodayCents: 170_000,
      revenueTodayFromLedger: true,
      outstandingInvoices: { count: 1, totalCents: 30_000, usesRemainingBalanceColumn: true },
      depositsAwaitingPayment: { count: 1, totalCents: 30_000, depositInvoiceCount: 1 },
      overdueInvoices: { count: 0, totalCents: 0 },
      recentTransactions: fixture.ledgerTimeline.map((tx) => ({
        id: tx.id,
        tenant_id: TENANT,
        transaction_kind: tx.transaction_kind,
        amount_cents: tx.amount_cents,
        currency: tx.currency,
        direction: tx.direction,
        source_module: tx.source_module,
        created_at: tx.created_at,
      })),
      recentOpenInvoices: [
        {
          id: fixture.depositInvoice.id,
          status: "partially_paid",
          invoice_kind: "surgery_deposit",
          remaining_balance_cents: 30_000,
          currency: "AUD",
        },
      ],
      alerts: {
        unmatchedPayments: { count: 0, items: [] },
        overdueInvoices: { count: 0, items: [] },
        failedGatewayPayments: { count: 0, items: [] },
        depositDeadlines48h: { count: 1, items: [{ id: "d1", label: "Deposit due", severity: "warning" }] },
        needsReviewCount: 0,
      },
      surgeryEconomics: {
        metrics: {
          average_margin_percentage: 42.5,
          average_revenue_per_graft_cents: 400,
          average_cost_per_graft_cents: 230,
          outstanding_surgery_balances_cents: 30_000,
          most_profitable_procedure_type: "fue",
        },
        recentSnapshots: [],
        currency: "AUD",
      },
      revenueAttribution: {
        tenantId: TENANT,
        currency: "AUD",
        filters: {},
        metrics: {
          revenue_by_source: [{ source: "google_ads", cents: 170_000 }],
          gross_profit_by_source: [],
          best_converting_source: null,
          highest_margin_source: null,
          unknown_attribution_percentage: 0,
        },
        rows: [],
        recentEvents: [],
      },
      executiveFinance: {
        tenantId: TENANT,
        currency: "AUD",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
        snapshot: {
          collected_revenue_cents: 170_000,
          gross_profit_cents: 72_000,
          outstanding_revenue_cents: 30_000,
          ar_risk_score: 12.5,
          forecast_revenue_cents: 420_000,
          best_revenue_source: "google_ads",
        },
        comparison: {
          collected_revenue_delta_cents: 20_000,
          badges: {
            collected_vs_previous: "up",
            margin: "flat",
            outstanding: "down",
            source_shift: false,
          },
        },
        insights: [],
      },
    });
    assert.equal(payload.revenueTodayFromLedger, true);
    assert.doesNotThrow(() => assertFinancialOsSmokeInvariants(payload));
  });

  it("rejects cross-tenant recent transactions", () => {
    const payload = parseFinancialOsCommandCentrePayload({
      tenantId: TENANT,
      currency: "AUD",
      todayYmd: "2026-06-19",
      revenueTodayCents: 0,
      revenueTodayFromLedger: true,
      outstandingInvoices: { count: 0, totalCents: 0, usesRemainingBalanceColumn: true },
      depositsAwaitingPayment: { count: 0, totalCents: 0, depositInvoiceCount: 0 },
      overdueInvoices: { count: 0, totalCents: 0 },
      recentTransactions: [
        {
          id: "x",
          tenant_id: "22222222-2222-4222-8222-222222222222",
          transaction_kind: "payment_received",
          amount_cents: 100,
          currency: "AUD",
          direction: "credit",
          source_module: "revenue_os",
          created_at: "2026-06-19T10:00:00.000Z",
        },
      ],
      recentOpenInvoices: [],
      alerts: {
        unmatchedPayments: { count: 0, items: [] },
        overdueInvoices: { count: 0, items: [] },
        failedGatewayPayments: { count: 0, items: [] },
        depositDeadlines48h: { count: 0, items: [] },
        needsReviewCount: 0,
      },
      surgeryEconomics: {
        metrics: {
          average_margin_percentage: 0,
          average_revenue_per_graft_cents: null,
          average_cost_per_graft_cents: null,
          outstanding_surgery_balances_cents: 0,
          most_profitable_procedure_type: null,
        },
        recentSnapshots: [],
        currency: "AUD",
      },
      revenueAttribution: {
        tenantId: TENANT,
        currency: "AUD",
        filters: {},
        metrics: {
          revenue_by_source: [],
          gross_profit_by_source: [],
          best_converting_source: null,
          highest_margin_source: null,
          unknown_attribution_percentage: 0,
        },
        rows: [],
        recentEvents: [],
      },
      executiveFinance: {
        tenantId: TENANT,
        currency: "AUD",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
        snapshot: {
          collected_revenue_cents: 0,
          gross_profit_cents: 0,
          outstanding_revenue_cents: 0,
          ar_risk_score: 0,
          forecast_revenue_cents: 0,
          best_revenue_source: null,
        },
        comparison: {
          collected_revenue_delta_cents: 0,
          badges: {
            collected_vs_previous: "flat",
            margin: "flat",
            outstanding: "flat",
            source_shift: false,
          },
        },
        insights: [],
      },
    });
    assert.throws(() => assertFinancialOsSmokeInvariants(payload), /Cross-tenant/);
  });
});
