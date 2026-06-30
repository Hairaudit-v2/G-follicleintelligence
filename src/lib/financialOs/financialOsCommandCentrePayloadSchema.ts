import { z } from "zod";

const financialTransactionSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  transaction_kind: z.string(),
  amount_cents: z.number(),
  currency: z.string(),
  direction: z.enum(["credit", "debit"]),
  source_module: z.string(),
  created_at: z.string(),
});

const alertItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string().optional(),
  severity: z.enum(["info", "warning", "critical"]),
});

export const financialOsCommandCentreAlertStripSchema = z.object({
  unmatchedPayments: z.object({ count: z.number(), items: z.array(alertItemSchema) }),
  overdueInvoices: z.object({ count: z.number(), items: z.array(alertItemSchema) }),
  failedGatewayPayments: z.object({ count: z.number(), items: z.array(alertItemSchema) }),
  depositDeadlines48h: z.object({ count: z.number(), items: z.array(alertItemSchema) }),
  needsReviewCount: z.number(),
});

export const financialOsCommandCentrePayloadSchema = z.object({
  tenantId: z.string(),
  currency: z.string(),
  todayYmd: z.string(),
  revenueTodayCents: z.number(),
  revenueTodayFromLedger: z.literal(true),
  outstandingInvoices: z.object({
    count: z.number(),
    totalCents: z.number(),
    usesRemainingBalanceColumn: z.literal(true),
  }),
  depositsAwaitingPayment: z.object({
    count: z.number(),
    totalCents: z.number(),
    depositInvoiceCount: z.number(),
  }),
  overdueInvoices: z.object({
    count: z.number(),
    totalCents: z.number(),
  }),
  recentTransactions: z.array(financialTransactionSchema),
  recentOpenInvoices: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      invoice_kind: z.string(),
      remaining_balance_cents: z.number(),
      currency: z.string(),
    })
  ),
  alerts: financialOsCommandCentreAlertStripSchema,
  surgeryEconomics: z.object({
    metrics: z.object({
      average_margin_percentage: z.number(),
      average_revenue_per_graft_cents: z.number().nullable(),
      average_cost_per_graft_cents: z.number().nullable(),
      outstanding_surgery_balances_cents: z.number(),
      most_profitable_procedure_type: z.string().nullable(),
    }),
    recentSnapshots: z.array(
      z.object({
        id: z.string().optional(),
        tenant_id: z.string(),
        case_id: z.string().nullable(),
        surgery_id: z.string().nullable(),
        patient_id: z.string().nullable(),
        procedure_type: z.string(),
        revenue_cents: z.number(),
        total_cost_cents: z.number(),
        gross_profit_cents: z.number(),
        gross_margin_percentage: z.number(),
        graft_count: z.number().nullable(),
        revenue_per_graft_cents: z.number().nullable(),
        calculated_at: z.string(),
        patient_label: z.string().nullable(),
      })
    ),
    currency: z.string(),
  }),
  revenueAttribution: z.object({
    tenantId: z.string(),
    currency: z.string(),
    filters: z.record(z.string().nullable().optional()),
    metrics: z.object({
      revenue_by_source: z.array(z.object({ source: z.string(), cents: z.number() })),
      gross_profit_by_source: z.array(z.object({ source: z.string(), cents: z.number() })),
      best_converting_source: z
        .object({ source: z.string(), conversion_rate: z.number() })
        .nullable(),
      highest_margin_source: z
        .object({ source: z.string(), margin_percentage: z.number() })
        .nullable(),
      unknown_attribution_percentage: z.number(),
    }),
    rows: z.array(
      z.object({
        source: z.string(),
        campaign: z.string(),
        leads: z.number(),
        consults: z.number(),
        invoices: z.number(),
        collected_revenue_cents: z.number(),
        gross_profit_cents: z.number(),
        margin_percentage: z.number().nullable(),
        confidence: z.string(),
      })
    ),
    recentEvents: z.array(z.object({ id: z.string(), attribution_source: z.string() })),
  }),
  executiveFinance: z.object({
    tenantId: z.string(),
    currency: z.string(),
    periodStart: z.string(),
    periodEnd: z.string(),
    snapshot: z.object({
      collected_revenue_cents: z.number(),
      gross_profit_cents: z.number(),
      outstanding_revenue_cents: z.number(),
      ar_risk_score: z.number(),
      forecast_revenue_cents: z.number(),
      best_revenue_source: z.string().nullable(),
    }),
    comparison: z.object({
      collected_revenue_delta_cents: z.number(),
      badges: z.object({
        collected_vs_previous: z.enum(["up", "down", "flat"]),
        margin: z.enum(["up", "down", "flat"]),
        outstanding: z.enum(["up", "down", "flat"]),
        source_shift: z.boolean(),
      }),
    }),
    insights: z.array(
      z.object({
        kind: z.string(),
        severity: z.enum(["info", "warning", "critical"]),
        title: z.string(),
        detail: z.string(),
      })
    ),
  }),
});

export type FinancialOsCommandCentrePayloadValidated = z.infer<
  typeof financialOsCommandCentrePayloadSchema
>;

export function parseFinancialOsCommandCentrePayload(
  raw: unknown
): FinancialOsCommandCentrePayloadValidated {
  return financialOsCommandCentrePayloadSchema.parse(raw);
}

/** Smoke-check invariants without full Zod parse (for deployed-host script). */
export function assertFinancialOsSmokeInvariants(
  payload: FinancialOsCommandCentrePayloadValidated
): void {
  if (payload.revenueTodayFromLedger !== true) {
    throw new Error("revenueTodayFromLedger must be true");
  }
  if (payload.outstandingInvoices.usesRemainingBalanceColumn !== true) {
    throw new Error("outstandingInvoices must use remaining_balance_cents");
  }
  const tid = payload.tenantId;
  for (const tx of payload.recentTransactions) {
    if (tx.tenant_id !== tid) {
      throw new Error(`Cross-tenant transaction in recentTransactions: ${tx.id}`);
    }
  }
  if (
    payload.depositsAwaitingPayment.count !== payload.depositsAwaitingPayment.depositInvoiceCount
  ) {
    throw new Error("depositsAwaitingPayment count must match depositInvoiceCount filter");
  }
}
