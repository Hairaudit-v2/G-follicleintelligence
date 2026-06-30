import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  mapFinancialTransactionRow,
  type FiFinancialTransactionRow,
} from "@/src/lib/financialOs/financialTransactionCore";
import type { FinancialOsCommandCentreAlertStrip } from "@/src/lib/financialOs/financialOsCommandCentreAlertsCore";
import { buildFinancialOsCommandCentreAlerts } from "@/src/lib/financialOs/financialOsCommandCentreAlertsCore";
import {
  loadSurgeryEconomicsDashboardPayload,
  type SurgeryEconomicsDashboardFilters,
  type SurgeryEconomicsDashboardPayload,
} from "@/src/lib/financialOs/financialSurgeryEconomics.server";
import {
  loadRevenueAttributionDashboardPayload,
  type RevenueAttributionDashboardPayload,
  type RevenueAttributionDashboardFilters,
} from "@/src/lib/financialOs/financialRevenueAttribution.server";
import { mapInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceMappers";
import type { FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import {
  invoiceBalanceDueCents,
  isInvoiceOpenForCollection,
  openCollectionStatusFilter,
} from "@/src/lib/revenueOs/revenueInvoiceModel";
import {
  loadAccountsReceivableDashboardMetrics,
  loadAccountsReceivableWorkQueue,
} from "@/src/lib/financialOs/financialAccountsReceivable.server";
import type { AccountsReceivableDashboardMetrics } from "@/src/lib/financialOs/financialAccountsReceivableCore";
import type { AccountsReceivableWorkQueueRow } from "@/src/lib/financialOs/financialAccountsReceivable.server";
import {
  loadExecutiveFinancePulsePayload,
  type ExecutiveFinancePulsePayload,
} from "@/src/lib/financialOs/financialExecutiveIntelligence.server";
import { monthPeriodForYmd } from "@/src/lib/financialOs/financialExecutiveIntelligenceCore";

export type FinancialOsCommandCentrePayload = {
  tenantId: string;
  currency: string;
  todayYmd: string;
  revenueTodayCents: number;
  revenueTodayFromLedger: true;
  outstandingInvoices: {
    count: number;
    totalCents: number;
    usesRemainingBalanceColumn: true;
  };
  depositsAwaitingPayment: {
    count: number;
    totalCents: number;
    depositInvoiceCount: number;
  };
  overdueInvoices: {
    count: number;
    totalCents: number;
  };
  recentTransactions: FiFinancialTransactionRow[];
  recentOpenInvoices: Array<
    Pick<
      FiInvoiceRow,
      | "id"
      | "title"
      | "status"
      | "invoice_kind"
      | "total_cents"
      | "remaining_balance_cents"
      | "due_date"
      | "days_overdue"
      | "currency"
    >
  >;
  alerts: FinancialOsCommandCentreAlertStrip;
  surgeryEconomics: SurgeryEconomicsDashboardPayload;
  revenueAttribution: RevenueAttributionDashboardPayload;
  accountsReceivable: {
    metrics: AccountsReceivableDashboardMetrics;
    rows: AccountsReceivableWorkQueueRow[];
  };
  executiveFinance: ExecutiveFinancePulsePayload;
};

function sumRemainingBalances(rows: FiInvoiceRow[]): number {
  return rows.reduce(
    (acc, r) => acc + Math.max(0, r.remaining_balance_cents ?? invoiceBalanceDueCents(r)),
    0
  );
}

function ymdAddDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * FinancialOS command centre metrics — read-only after portal gate.
 */
export async function loadFinancialOsCommandCentrePayload(
  tenantId: string,
  asOf: Date = new Date(),
  surgeryEconomicsFilters?: SurgeryEconomicsDashboardFilters,
  revenueAttributionFilters?: RevenueAttributionDashboardFilters
): Promise<FinancialOsCommandCentrePayload> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const todayYmd = asOf.toISOString().slice(0, 10);
  const dayStart = `${todayYmd}T00:00:00.000Z`;
  const dayEnd = `${todayYmd}T23:59:59.999Z`;
  const depositHorizonYmd = ymdAddDays(todayYmd, 2);

  const { data: txTodayRaw, error: txErr } = await supabase
    .from("fi_financial_transactions")
    .select("amount_cents, currency, direction")
    .eq("tenant_id", tid)
    .in("transaction_kind", ["payment_received", "deposit_paid", "balance_paid"])
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);
  if (txErr) throw new Error(txErr.message);

  let revenueTodayCents = 0;
  let currency = "AUD";
  for (const row of txTodayRaw ?? []) {
    const amt = Math.max(0, Number((row as { amount_cents?: unknown }).amount_cents ?? 0));
    const dir = String((row as { direction?: unknown }).direction ?? "credit");
    revenueTodayCents += dir === "debit" ? -amt : amt;
    currency = String((row as { currency?: unknown }).currency ?? currency).toUpperCase();
  }
  revenueTodayCents = Math.max(0, revenueTodayCents);

  const { data: openInvRaw, error: openErr } = await supabase
    .from("fi_invoices")
    .select("*")
    .eq("tenant_id", tid)
    .in("status", openCollectionStatusFilter())
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(500);
  if (openErr) throw new Error(openErr.message);

  const openInvoices = (openInvRaw ?? []).map((x) => mapInvoiceRow(x as Record<string, unknown>));
  const withBalance = openInvoices.filter(
    (r) => (r.remaining_balance_cents ?? invoiceBalanceDueCents(r)) > 0
  );

  const depositAwaiting = withBalance.filter((r) => r.invoice_kind === "surgery_deposit");
  const overdue = withBalance.filter((r) => r.status === "overdue" || r.days_overdue > 0);

  const { data: recentTxRaw, error: recentErr } = await supabase
    .from("fi_financial_transactions")
    .select("*")
    .eq("tenant_id", tid)
    .order("created_at", { ascending: false })
    .limit(12);
  if (recentErr) throw new Error(recentErr.message);

  const recentTransactions = (recentTxRaw ?? []).map((x) =>
    mapFinancialTransactionRow(x as Record<string, unknown>)
  );

  const { data: unmatchedRaw } = await supabase
    .from("fi_payment_reconciliation")
    .select(
      "id, provider, failure_reason, expected_amount_cents, received_amount_cents, invoice_id, created_at"
    )
    .eq("tenant_id", tid)
    .eq("reconciliation_status", "unmatched")
    .order("created_at", { ascending: false })
    .limit(20);

  const failedSince = new Date(asOf);
  failedSince.setUTCDate(failedSince.getUTCDate() - 60);
  const { data: failedPayRaw } = await supabase
    .from("fi_payments")
    .select("id, failure_message, created_at, invoice_id")
    .eq("tenant_id", tid)
    .eq("status", "failed")
    .gte("created_at", failedSince.toISOString())
    .order("created_at", { ascending: false })
    .limit(20);

  const depositDeadlineRows = depositAwaiting.filter((r) => {
    const due = r.due_date?.trim();
    return due != null && due >= todayYmd && due <= depositHorizonYmd;
  });

  const alerts = buildFinancialOsCommandCentreAlerts({
    unmatchedRows: (unmatchedRaw ?? []) as Record<string, unknown>[],
    overdueInvoices: overdue,
    failedPaymentRows: (failedPayRaw ?? []) as Record<string, unknown>[],
    depositDeadlineInvoices: depositDeadlineRows,
  });

  let surgeryEconomics: SurgeryEconomicsDashboardPayload = {
    metrics: {
      average_margin_percentage: 0,
      average_revenue_per_graft_cents: null,
      average_cost_per_graft_cents: null,
      outstanding_surgery_balances_cents: 0,
      most_profitable_procedure_type: null,
    },
    recentSnapshots: [],
    currency,
  };
  try {
    surgeryEconomics = await loadSurgeryEconomicsDashboardPayload(tid, 12, surgeryEconomicsFilters);
    if (!surgeryEconomics.currency) surgeryEconomics.currency = currency;
  } catch {
    // Table may not exist until migration is applied — command centre remains usable.
  }

  let revenueAttribution: RevenueAttributionDashboardPayload = {
    tenantId: tid,
    currency,
    filters: revenueAttributionFilters ?? {},
    metrics: {
      revenue_by_source: [],
      gross_profit_by_source: [],
      best_converting_source: null,
      highest_margin_source: null,
      unknown_attribution_percentage: 0,
    },
    rows: [],
    recentEvents: [],
  };
  try {
    revenueAttribution = await loadRevenueAttributionDashboardPayload(
      tid,
      revenueAttributionFilters
    );
    if (!revenueAttribution.currency) revenueAttribution.currency = currency;
  } catch {
    // Attribution table may not exist until migration is applied.
  }

  const recentOpenInvoices = withBalance.slice(0, 8).map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    invoice_kind: r.invoice_kind,
    total_cents: r.total_cents,
    remaining_balance_cents: r.remaining_balance_cents ?? invoiceBalanceDueCents(r),
    due_date: r.due_date,
    days_overdue: r.days_overdue,
    currency: r.currency,
  }));

  let accountsReceivable: FinancialOsCommandCentrePayload["accountsReceivable"] = {
    metrics: {
      totalOutstandingCents: 0,
      overdueRevenueCents: 0,
      criticalCaseCount: 0,
      depositsAtRiskCents: 0,
      averageDaysOverdue: 0,
      openCaseCount: 0,
    },
    rows: [],
  };
  try {
    const [metrics, rows] = await Promise.all([
      loadAccountsReceivableDashboardMetrics(tid),
      loadAccountsReceivableWorkQueue(tid, {}, 50),
    ]);
    accountsReceivable = { metrics, rows };
  } catch {
    // AR tables may not exist until migration is applied.
  }

  const monthPeriod = monthPeriodForYmd(todayYmd);
  let executiveFinance: ExecutiveFinancePulsePayload = {
    tenantId: tid,
    currency,
    periodStart: monthPeriod.period_start,
    periodEnd: monthPeriod.period_end,
    snapshot: {
      tenant_id: tid,
      clinic_id: null,
      period_start: monthPeriod.period_start,
      period_end: monthPeriod.period_end,
      gross_revenue_cents: 0,
      collected_revenue_cents: 0,
      outstanding_revenue_cents: 0,
      overdue_revenue_cents: 0,
      surgery_revenue_cents: 0,
      treatment_revenue_cents: 0,
      gross_profit_cents: 0,
      average_margin_percentage: 0,
      average_revenue_per_case_cents: 0,
      average_revenue_per_graft_cents: null,
      total_surgeries: 0,
      total_consults: 0,
      total_paid_invoices: 0,
      total_overdue_invoices: 0,
      best_revenue_source: null,
      best_profit_source: null,
      highest_margin_procedure_type: null,
      ar_risk_score: 0,
      forecast_revenue_cents: 0,
      forecast_confidence: 0,
      source_metadata: {},
      calculated_at: new Date().toISOString(),
    },
    comparison: {
      collected_revenue_delta_cents: 0,
      collected_revenue_delta_pct: null,
      gross_profit_delta_cents: 0,
      margin_delta_percentage_points: 0,
      outstanding_delta_cents: 0,
      ar_risk_delta: 0,
      forecast_delta_cents: 0,
      best_revenue_source_shift: { previous: null, current: null, changed: false },
      badges: {
        collected_vs_previous: "flat",
        margin: "flat",
        outstanding: "flat",
        source_shift: false,
      },
    },
    insights: [],
  };
  try {
    executiveFinance = await loadExecutiveFinancePulsePayload(tid, {}, asOf);
    if (!executiveFinance.currency) executiveFinance.currency = currency;
  } catch {
    // Executive snapshot table may not exist until migration is applied.
  }

  return {
    tenantId: tid,
    currency,
    todayYmd,
    revenueTodayCents,
    revenueTodayFromLedger: true,
    outstandingInvoices: {
      count: withBalance.filter((r) => isInvoiceOpenForCollection(r.status)).length,
      totalCents: sumRemainingBalances(withBalance),
      usesRemainingBalanceColumn: true,
    },
    depositsAwaitingPayment: {
      count: depositAwaiting.length,
      totalCents: sumRemainingBalances(depositAwaiting),
      depositInvoiceCount: depositAwaiting.length,
    },
    overdueInvoices: {
      count: overdue.length,
      totalCents: sumRemainingBalances(overdue),
    },
    recentTransactions,
    recentOpenInvoices,
    alerts,
    surgeryEconomics,
    revenueAttribution,
    accountsReceivable,
    executiveFinance,
  };
}
