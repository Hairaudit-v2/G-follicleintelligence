/**
 * FinancialOS Phase 5 — pure executive finance intelligence engine.
 * Aggregates revenue, profitability, attribution, AR risk, and deterministic forecast signals.
 * Safe for unit tests without DB.
 */

import type { FiArRiskLevel } from "@/src/lib/financialOs/financialAccountsReceivableCore";
import { FI_AR_OPEN_STATUSES } from "@/src/lib/financialOs/financialAccountsReceivableCore";
import type { FiRevenueAttributionSource } from "@/src/lib/financialOs/financialRevenueAttributionCore";
import { FI_REVENUE_ATTRIBUTION_SOURCES } from "@/src/lib/financialOs/financialRevenueAttributionCore";
import type {
  FiFinancialTransactionDirection,
  FiFinancialTransactionKind,
} from "@/src/lib/financialOs/financialTransactionCore";
import type { FiInvoiceKind } from "@/src/lib/revenueOs/revenueInvoiceModel";

export const FI_EXECUTIVE_SNAPSHOT_APPEND_ONLY = true as const;

export type FiFinancialExecutiveSnapshotRow = {
  id: string;
  tenant_id: string;
  clinic_id: string | null;
  period_start: string;
  period_end: string;
  gross_revenue_cents: number;
  collected_revenue_cents: number;
  outstanding_revenue_cents: number;
  overdue_revenue_cents: number;
  surgery_revenue_cents: number;
  treatment_revenue_cents: number;
  gross_profit_cents: number;
  average_margin_percentage: number;
  average_revenue_per_case_cents: number;
  average_revenue_per_graft_cents: number | null;
  total_surgeries: number;
  total_consults: number;
  total_paid_invoices: number;
  total_overdue_invoices: number;
  best_revenue_source: FiRevenueAttributionSource | null;
  best_profit_source: FiRevenueAttributionSource | null;
  highest_margin_procedure_type: string | null;
  ar_risk_score: number;
  forecast_revenue_cents: number;
  forecast_confidence: number;
  source_metadata: Record<string, unknown>;
  calculated_at: string;
};

export type ExecutiveLedgerTransactionInput = {
  tenant_id: string;
  transaction_kind: FiFinancialTransactionKind;
  amount_cents: number;
  direction: FiFinancialTransactionDirection;
  invoice_id: string | null;
  consultation_id: string | null;
  case_id: string | null;
  clinic_id: string | null;
  created_at: string;
};

export type ExecutiveInvoiceInput = {
  id: string;
  tenant_id: string;
  invoice_kind: FiInvoiceKind;
  total_cents: number;
  remaining_balance_cents: number;
  status: string;
  days_overdue: number;
  clinic_id: string | null;
  consultation_id: string | null;
  case_id: string | null;
  created_at: string;
  paid_at: string | null;
};

export type ExecutiveProfitabilitySnapshotInput = {
  tenant_id: string;
  case_id: string | null;
  procedure_type: string;
  revenue_cents: number;
  collected_cents: number;
  outstanding_cents: number;
  gross_profit_cents: number;
  gross_margin_percentage: number;
  graft_count: number | null;
  revenue_per_graft_cents: number | null;
  calculated_at: string;
  clinic_id?: string | null;
};

export type ExecutiveAttributionEventInput = {
  tenant_id: string;
  attribution_source: FiRevenueAttributionSource;
  attributed_revenue_cents: number;
  attributed_collected_cents: number;
  gross_profit_cents: number | null;
  lead_id: string | null;
  consultation_id: string | null;
  invoice_id: string | null;
  procedure_type: string | null;
  clinic_id: string | null;
  consultant_fi_user_id: string | null;
  occurred_at: string;
};

export type ExecutiveArCaseInput = {
  tenant_id: string;
  outstanding_amount_cents: number;
  days_overdue: number;
  risk_level: FiArRiskLevel;
  receivable_type: string;
  status: string;
  clinic_id: string | null;
};

export type ExecutiveScheduledSurgeryInput = {
  surgery_id: string;
  scheduled_date: string;
  invoice_value_cents: number;
  clinic_id: string | null;
};

export type ExecutiveRevenueAggregation = {
  gross_revenue_cents: number;
  collected_revenue_cents: number;
  outstanding_revenue_cents: number;
  overdue_revenue_cents: number;
  surgery_revenue_cents: number;
  treatment_revenue_cents: number;
  total_paid_invoices: number;
  total_overdue_invoices: number;
  total_consults: number;
};

export type ExecutiveProfitabilityAggregation = {
  gross_profit_cents: number;
  average_margin_percentage: number;
  average_revenue_per_case_cents: number;
  average_revenue_per_graft_cents: number | null;
  total_surgeries: number;
  highest_margin_procedure_type: string | null;
};

export type ExecutiveAttributionAggregation = {
  best_revenue_source: FiRevenueAttributionSource | null;
  best_profit_source: FiRevenueAttributionSource | null;
  unknown_attribution_percentage: number;
  revenue_by_source: Array<{ source: FiRevenueAttributionSource; cents: number }>;
  profit_by_source: Array<{ source: FiRevenueAttributionSource; cents: number }>;
};

export type ExecutiveArAggregation = {
  total_outstanding_cents: number;
  overdue_revenue_cents: number;
  open_case_count: number;
  critical_case_count: number;
  average_days_overdue: number;
  surgery_balance_outstanding_cents: number;
};

export type RevenueForecastResult = {
  forecast_revenue_cents: number;
  forecast_confidence: number;
  explanation_factors: Array<{ factor: string; contribution_cents: number; weight: number }>;
  historical_collection_rate: number;
};

export type ExecutivePeriodComparison = {
  collected_revenue_delta_cents: number;
  collected_revenue_delta_pct: number | null;
  gross_profit_delta_cents: number;
  margin_delta_percentage_points: number;
  outstanding_delta_cents: number;
  ar_risk_delta: number;
  forecast_delta_cents: number;
  best_revenue_source_shift: {
    previous: FiRevenueAttributionSource | null;
    current: FiRevenueAttributionSource | null;
    changed: boolean;
  };
  badges: {
    collected_vs_previous: "up" | "down" | "flat";
    margin: "up" | "down" | "flat";
    outstanding: "up" | "down" | "flat";
    source_shift: boolean;
  };
};

export type ExecutiveFinanceInsightKind =
  | "revenue_source_dependency"
  | "overdue_revenue_rising"
  | "margin_compression"
  | "high_unknown_attribution"
  | "outstanding_surgery_balances"
  | "underpriced_procedure_type";

export type ExecutiveFinanceInsight = {
  kind: ExecutiveFinanceInsightKind;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
};

export type BuildExecutiveFinanceSnapshotInput = {
  tenant_id: string;
  clinic_id?: string | null;
  period_start: string;
  period_end: string;
  as_of_ymd: string;
  ledger_transactions: ExecutiveLedgerTransactionInput[];
  invoices: ExecutiveInvoiceInput[];
  profitability_snapshots: ExecutiveProfitabilitySnapshotInput[];
  attribution_events: ExecutiveAttributionEventInput[];
  ar_cases: ExecutiveArCaseInput[];
  scheduled_surgeries: ExecutiveScheduledSurgeryInput[];
  calculated_at?: string;
};

const COLLECTION_KINDS: readonly FiFinancialTransactionKind[] = [
  "payment_received",
  "deposit_paid",
  "balance_paid",
];

const SURGERY_INVOICE_KINDS: readonly FiInvoiceKind[] = ["surgery_deposit", "surgery_balance"];

function isInPeriod(iso: string, periodStart: string, periodEnd: string): boolean {
  const day = iso.slice(0, 10);
  return day >= periodStart && day <= periodEnd;
}

function signedLedgerAmount(
  kind: FiFinancialTransactionKind,
  amount: number,
  direction: FiFinancialTransactionDirection
): number {
  const amt = Math.max(0, Math.floor(amount));
  if (kind === "refund_processed") return direction === "debit" ? amt : -amt;
  return direction === "debit" ? -amt : amt;
}

function isSurgeryInvoiceKind(kind: FiInvoiceKind): boolean {
  return SURGERY_INVOICE_KINDS.includes(kind);
}

function marginPct(revenue: number, profit: number): number | null {
  if (revenue <= 0) return null;
  return Math.round((profit / revenue) * 10_000) / 100;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function deltaBadge(delta: number, flatThreshold = 0): "up" | "down" | "flat" {
  if (Math.abs(delta) <= flatThreshold) return "flat";
  return delta > 0 ? "up" : "down";
}

const AR_RISK_WEIGHTS: Record<FiArRiskLevel, number> = {
  low: 0.85,
  medium: 0.65,
  high: 0.35,
  critical: 0.1,
};

/** Aggregate executive revenue from ledger transactions and invoice balances. */
export function aggregateExecutiveRevenue(args: {
  period_start: string;
  period_end: string;
  ledger_transactions: ExecutiveLedgerTransactionInput[];
  invoices: ExecutiveInvoiceInput[];
}): ExecutiveRevenueAggregation {
  const { period_start, period_end } = args;

  let collected_revenue_cents = 0;
  let gross_from_ledger = 0;

  const consultIds = new Set<string>();
  const paidInvoiceIds = new Set<string>();

  for (const tx of args.ledger_transactions) {
    if (!isInPeriod(tx.created_at, period_start, period_end)) continue;
    const signed = signedLedgerAmount(tx.transaction_kind, tx.amount_cents, tx.direction);
    if (tx.transaction_kind === "invoice_created" && signed > 0) {
      gross_from_ledger += signed;
    }
    if (COLLECTION_KINDS.includes(tx.transaction_kind) && signed > 0) {
      collected_revenue_cents += signed;
      if (tx.invoice_id) paidInvoiceIds.add(tx.invoice_id);
    }
    if (tx.consultation_id) consultIds.add(tx.consultation_id);
  }

  let gross_from_invoices = 0;
  let surgery_revenue_cents = 0;
  let treatment_revenue_cents = 0;
  let outstanding_revenue_cents = 0;
  let overdue_revenue_cents = 0;
  let total_overdue_invoices = 0;
  let total_paid_invoices = 0;
  let total_consults = 0;

  for (const inv of args.invoices) {
    const createdInPeriod = isInPeriod(inv.created_at, period_start, period_end);
    if (createdInPeriod) {
      gross_from_invoices += Math.max(0, inv.total_cents);
      if (isSurgeryInvoiceKind(inv.invoice_kind)) {
        surgery_revenue_cents += Math.max(0, inv.total_cents);
      } else {
        treatment_revenue_cents += Math.max(0, inv.total_cents);
      }
    }
    if (inv.consultation_id && createdInPeriod) total_consults += 1;

    const balance = Math.max(0, inv.remaining_balance_cents);
    if (balance > 0 && inv.status !== "cancelled" && inv.status !== "refunded") {
      outstanding_revenue_cents += balance;
      if (inv.days_overdue > 0 || inv.status === "overdue") {
        overdue_revenue_cents += balance;
        total_overdue_invoices += 1;
      }
    }
    if (inv.status === "paid" && inv.paid_at && isInPeriod(inv.paid_at, period_start, period_end)) {
      total_paid_invoices += 1;
    }
  }

  total_paid_invoices = Math.max(total_paid_invoices, paidInvoiceIds.size);
  total_consults = Math.max(total_consults, consultIds.size);

  const gross_revenue_cents = Math.max(
    gross_from_invoices,
    gross_from_ledger,
    collected_revenue_cents
  );

  return {
    gross_revenue_cents,
    collected_revenue_cents,
    outstanding_revenue_cents,
    overdue_revenue_cents,
    surgery_revenue_cents,
    treatment_revenue_cents,
    total_paid_invoices,
    total_overdue_invoices,
    total_consults,
  };
}

/** Aggregate executive profitability from surgery profitability snapshots. */
export function aggregateExecutiveProfitability(args: {
  period_start: string;
  period_end: string;
  snapshots: ExecutiveProfitabilitySnapshotInput[];
}): ExecutiveProfitabilityAggregation {
  const inPeriod = args.snapshots.filter((s) =>
    isInPeriod(s.calculated_at, args.period_start, args.period_end)
  );

  if (!inPeriod.length) {
    return {
      gross_profit_cents: 0,
      average_margin_percentage: 0,
      average_revenue_per_case_cents: 0,
      average_revenue_per_graft_cents: null,
      total_surgeries: 0,
      highest_margin_procedure_type: null,
    };
  }

  let gross_profit_cents = 0;
  let marginSum = 0;
  let revenueSum = 0;
  let revenuePerGraftSum = 0;
  let revenuePerGraftCount = 0;
  const caseIds = new Set<string>();
  const marginByProcedure = new Map<string, { sum: number; count: number }>();

  for (const s of inPeriod) {
    gross_profit_cents += s.gross_profit_cents;
    marginSum += s.gross_margin_percentage;
    revenueSum += Math.max(0, s.revenue_cents);
    if (s.case_id) caseIds.add(s.case_id);
    if (s.revenue_per_graft_cents != null && s.revenue_per_graft_cents > 0) {
      revenuePerGraftSum += s.revenue_per_graft_cents;
      revenuePerGraftCount += 1;
    }
    const key = s.procedure_type.trim().toLowerCase();
    const entry = marginByProcedure.get(key) ?? { sum: 0, count: 0 };
    entry.sum += s.gross_margin_percentage;
    entry.count += 1;
    marginByProcedure.set(key, entry);
  }

  let highest_margin_procedure_type: string | null = null;
  let bestAvg = -Infinity;
  for (const [procedure, stats] of marginByProcedure) {
    const avg = stats.sum / stats.count;
    if (avg > bestAvg) {
      bestAvg = avg;
      highest_margin_procedure_type = procedure;
    }
  }

  const total_surgeries = caseIds.size > 0 ? caseIds.size : inPeriod.length;

  return {
    gross_profit_cents,
    average_margin_percentage: round2(marginSum / inPeriod.length),
    average_revenue_per_case_cents:
      total_surgeries > 0 ? Math.round(revenueSum / total_surgeries) : 0,
    average_revenue_per_graft_cents:
      revenuePerGraftCount > 0 ? Math.round(revenuePerGraftSum / revenuePerGraftCount) : null,
    total_surgeries,
    highest_margin_procedure_type,
  };
}

/** Aggregate executive attribution from revenue attribution events. */
export function aggregateExecutiveAttribution(args: {
  period_start: string;
  period_end: string;
  events: ExecutiveAttributionEventInput[];
}): ExecutiveAttributionAggregation {
  const revenueBySource = new Map<FiRevenueAttributionSource, number>();
  const profitBySource = new Map<FiRevenueAttributionSource, number>();
  let totalCollected = 0;
  let unknownCollected = 0;

  for (const ev of args.events) {
    if (!isInPeriod(ev.occurred_at, args.period_start, args.period_end)) continue;
    const collected = Math.max(0, ev.attributed_collected_cents);
    const profit = ev.gross_profit_cents ?? 0;
    revenueBySource.set(
      ev.attribution_source,
      (revenueBySource.get(ev.attribution_source) ?? 0) + collected
    );
    profitBySource.set(
      ev.attribution_source,
      (profitBySource.get(ev.attribution_source) ?? 0) + profit
    );
    totalCollected += collected;
    if (ev.attribution_source === "unknown") unknownCollected += collected;
  }

  let best_revenue_source: FiRevenueAttributionSource | null = null;
  let bestRevenue = -1;
  let best_profit_source: FiRevenueAttributionSource | null = null;
  let bestProfit = -1;

  for (const source of FI_REVENUE_ATTRIBUTION_SOURCES) {
    const rev = revenueBySource.get(source) ?? 0;
    const profit = profitBySource.get(source) ?? 0;
    if (rev > bestRevenue) {
      bestRevenue = rev;
      best_revenue_source = rev > 0 ? source : null;
    }
    if (profit > bestProfit) {
      bestProfit = profit;
      best_profit_source = profit > 0 ? source : null;
    }
  }

  return {
    best_revenue_source,
    best_profit_source,
    unknown_attribution_percentage:
      totalCollected > 0 ? round2((unknownCollected / totalCollected) * 100) : 0,
    revenue_by_source: FI_REVENUE_ATTRIBUTION_SOURCES.map((source) => ({
      source,
      cents: revenueBySource.get(source) ?? 0,
    })).filter((x) => x.cents > 0),
    profit_by_source: FI_REVENUE_ATTRIBUTION_SOURCES.map((source) => ({
      source,
      cents: profitBySource.get(source) ?? 0,
    })).filter((x) => x.cents > 0),
  };
}

/** Aggregate executive accounts receivable exposure. */
export function aggregateExecutiveAccountsReceivable(
  cases: ExecutiveArCaseInput[]
): ExecutiveArAggregation {
  const open = cases.filter(
    (c) =>
      FI_AR_OPEN_STATUSES.includes(c.status as (typeof FI_AR_OPEN_STATUSES)[number]) &&
      c.outstanding_amount_cents > 0
  );

  const total_outstanding_cents = open.reduce((acc, c) => acc + c.outstanding_amount_cents, 0);
  const overdue = open.filter((c) => c.days_overdue > 0);
  const overdue_revenue_cents = overdue.reduce((acc, c) => acc + c.outstanding_amount_cents, 0);
  const critical_case_count = open.filter((c) => c.risk_level === "critical").length;
  const average_days_overdue =
    overdue.length > 0
      ? Math.round(overdue.reduce((acc, c) => acc + c.days_overdue, 0) / overdue.length)
      : 0;
  const surgery_balance_outstanding_cents = open
    .filter(
      (c) => c.receivable_type === "surgery_balance" || c.receivable_type === "surgery_deposit"
    )
    .reduce((acc, c) => acc + c.outstanding_amount_cents, 0);

  return {
    total_outstanding_cents,
    overdue_revenue_cents,
    open_case_count: open.length,
    critical_case_count,
    average_days_overdue,
    surgery_balance_outstanding_cents,
  };
}

/**
 * Deterministic AR risk score (0–100).
 * Weights overdue ratio, critical cases, average days overdue, and high-value exposure.
 */
export function calculateArRiskScore(args: {
  ar: ExecutiveArAggregation;
  gross_revenue_cents: number;
}): number {
  const { ar, gross_revenue_cents } = args;
  if (ar.open_case_count === 0 && ar.total_outstanding_cents === 0) return 0;

  const overdueRatio =
    ar.total_outstanding_cents > 0 ? ar.overdue_revenue_cents / ar.total_outstanding_cents : 0;
  const revenueExposure =
    gross_revenue_cents > 0 ? Math.min(1, ar.total_outstanding_cents / gross_revenue_cents) : 0;
  const criticalRatio = ar.open_case_count > 0 ? ar.critical_case_count / ar.open_case_count : 0;
  const daysFactor = Math.min(1, ar.average_days_overdue / 30);

  const raw = overdueRatio * 35 + revenueExposure * 25 + criticalRatio * 25 + daysFactor * 15;
  return round2(Math.min(100, Math.max(0, raw)));
}

/**
 * Deterministic revenue forecast v1 — no AI.
 * Uses run-rate, scheduled surgery invoice values, risk-weighted open balances, and historical collection rate.
 */
export function calculateRevenueForecast(args: {
  period_start: string;
  period_end: string;
  as_of_ymd: string;
  collected_revenue_cents: number;
  gross_revenue_cents: number;
  ar_cases: ExecutiveArCaseInput[];
  scheduled_surgeries: ExecutiveScheduledSurgeryInput[];
}): RevenueForecastResult {
  const periodStartMs = Date.parse(`${args.period_start}T00:00:00.000Z`);
  const periodEndMs = Date.parse(`${args.period_end}T00:00:00.000Z`);
  const asOfMs = Date.parse(`${args.as_of_ymd}T00:00:00.000Z`);

  const totalDays =
    Number.isFinite(periodStartMs) && Number.isFinite(periodEndMs)
      ? Math.max(1, Math.floor((periodEndMs - periodStartMs) / 86_400_000) + 1)
      : 30;
  const elapsedDays =
    Number.isFinite(periodStartMs) && Number.isFinite(asOfMs)
      ? Math.max(1, Math.min(totalDays, Math.floor((asOfMs - periodStartMs) / 86_400_000) + 1))
      : Math.max(1, Math.floor(totalDays / 2));
  const remainingDays = Math.max(0, totalDays - elapsedDays);

  const historical_collection_rate =
    args.gross_revenue_cents > 0
      ? Math.min(1, Math.max(0, args.collected_revenue_cents / args.gross_revenue_cents))
      : args.collected_revenue_cents > 0
        ? 0.75
        : 0.5;

  const dailyRunRate = args.collected_revenue_cents / elapsedDays;
  const runRateProjection = Math.round(dailyRunRate * remainingDays);

  const scheduledInPeriod = args.scheduled_surgeries.filter(
    (s) => s.scheduled_date >= args.as_of_ymd && s.scheduled_date <= args.period_end
  );
  const scheduledGross = scheduledInPeriod.reduce(
    (acc, s) => acc + Math.max(0, s.invoice_value_cents),
    0
  );
  const scheduledContribution = Math.round(scheduledGross * historical_collection_rate);

  const openCases = args.ar_cases.filter(
    (c) =>
      FI_AR_OPEN_STATUSES.includes(c.status as (typeof FI_AR_OPEN_STATUSES)[number]) &&
      c.outstanding_amount_cents > 0
  );
  let weightedOpenBalance = 0;
  for (const c of openCases) {
    const weight = AR_RISK_WEIGHTS[c.risk_level] ?? 0.5;
    weightedOpenBalance += Math.round(c.outstanding_amount_cents * weight);
  }
  const openBalanceContribution = Math.round(
    weightedOpenBalance * historical_collection_rate * 0.5
  );

  const forecast_revenue_cents =
    args.collected_revenue_cents +
    runRateProjection +
    scheduledContribution +
    openBalanceContribution;

  const explanation_factors: RevenueForecastResult["explanation_factors"] = [
    { factor: "collected_to_date", contribution_cents: args.collected_revenue_cents, weight: 1 },
    {
      factor: "run_rate_projection",
      contribution_cents: runRateProjection,
      weight: round2(remainingDays / totalDays),
    },
    {
      factor: "scheduled_surgeries",
      contribution_cents: scheduledContribution,
      weight: historical_collection_rate,
    },
    {
      factor: "risk_weighted_open_balances",
      contribution_cents: openBalanceContribution,
      weight: historical_collection_rate * 0.5,
    },
  ];

  let dataPoints = 0;
  if (args.collected_revenue_cents > 0) dataPoints += 1;
  if (scheduledInPeriod.length > 0) dataPoints += 1;
  if (openCases.length > 0) dataPoints += 1;
  if (args.gross_revenue_cents > 0) dataPoints += 1;

  const forecast_confidence = round2(
    Math.min(95, 35 + dataPoints * 15 + historical_collection_rate * 20)
  );

  return {
    forecast_revenue_cents,
    forecast_confidence,
    explanation_factors,
    historical_collection_rate: round2(historical_collection_rate * 100),
  };
}

/** Build a complete executive finance snapshot from aggregated inputs. */
export function buildExecutiveFinanceSnapshot(
  input: BuildExecutiveFinanceSnapshotInput
): Omit<FiFinancialExecutiveSnapshotRow, "id"> {
  const revenue = aggregateExecutiveRevenue({
    period_start: input.period_start,
    period_end: input.period_end,
    ledger_transactions: input.ledger_transactions,
    invoices: input.invoices,
  });

  const profitability = aggregateExecutiveProfitability({
    period_start: input.period_start,
    period_end: input.period_end,
    snapshots: input.profitability_snapshots,
  });

  const attribution = aggregateExecutiveAttribution({
    period_start: input.period_start,
    period_end: input.period_end,
    events: input.attribution_events,
  });

  const ar = aggregateExecutiveAccountsReceivable(input.ar_cases);
  const ar_risk_score = calculateArRiskScore({
    ar,
    gross_revenue_cents: revenue.gross_revenue_cents,
  });

  const forecast = calculateRevenueForecast({
    period_start: input.period_start,
    period_end: input.period_end,
    as_of_ymd: input.as_of_ymd,
    collected_revenue_cents: revenue.collected_revenue_cents,
    gross_revenue_cents: revenue.gross_revenue_cents,
    ar_cases: input.ar_cases,
    scheduled_surgeries: input.scheduled_surgeries,
  });

  return {
    tenant_id: input.tenant_id.trim(),
    clinic_id: input.clinic_id?.trim() || null,
    period_start: input.period_start,
    period_end: input.period_end,
    gross_revenue_cents: revenue.gross_revenue_cents,
    collected_revenue_cents: revenue.collected_revenue_cents,
    outstanding_revenue_cents: revenue.outstanding_revenue_cents,
    overdue_revenue_cents: revenue.overdue_revenue_cents,
    surgery_revenue_cents: revenue.surgery_revenue_cents,
    treatment_revenue_cents: revenue.treatment_revenue_cents,
    gross_profit_cents: profitability.gross_profit_cents,
    average_margin_percentage: profitability.average_margin_percentage,
    average_revenue_per_case_cents: profitability.average_revenue_per_case_cents,
    average_revenue_per_graft_cents: profitability.average_revenue_per_graft_cents,
    total_surgeries: profitability.total_surgeries,
    total_consults: revenue.total_consults,
    total_paid_invoices: revenue.total_paid_invoices,
    total_overdue_invoices: revenue.total_overdue_invoices,
    best_revenue_source: attribution.best_revenue_source,
    best_profit_source: attribution.best_profit_source,
    highest_margin_procedure_type: profitability.highest_margin_procedure_type,
    ar_risk_score,
    forecast_revenue_cents: forecast.forecast_revenue_cents,
    forecast_confidence: forecast.forecast_confidence,
    source_metadata: {
      forecast_explanation: forecast.explanation_factors,
      historical_collection_rate_pct: forecast.historical_collection_rate,
      unknown_attribution_percentage: attribution.unknown_attribution_percentage,
      revenue_by_source: attribution.revenue_by_source,
      profit_by_source: attribution.profit_by_source,
      ar_open_case_count: ar.open_case_count,
      ar_surgery_balance_outstanding_cents: ar.surgery_balance_outstanding_cents,
    },
    calculated_at: input.calculated_at ?? new Date().toISOString(),
  };
}

/** Compare current period snapshot against previous period. */
export function compareExecutivePeriods(
  current: Pick<
    FiFinancialExecutiveSnapshotRow,
    | "collected_revenue_cents"
    | "gross_profit_cents"
    | "average_margin_percentage"
    | "outstanding_revenue_cents"
    | "ar_risk_score"
    | "forecast_revenue_cents"
    | "best_revenue_source"
  >,
  previous: Pick<
    FiFinancialExecutiveSnapshotRow,
    | "collected_revenue_cents"
    | "gross_profit_cents"
    | "average_margin_percentage"
    | "outstanding_revenue_cents"
    | "ar_risk_score"
    | "forecast_revenue_cents"
    | "best_revenue_source"
  > | null
): ExecutivePeriodComparison {
  if (!previous) {
    return {
      collected_revenue_delta_cents: 0,
      collected_revenue_delta_pct: null,
      gross_profit_delta_cents: 0,
      margin_delta_percentage_points: 0,
      outstanding_delta_cents: 0,
      ar_risk_delta: 0,
      forecast_delta_cents: 0,
      best_revenue_source_shift: {
        previous: null,
        current: current.best_revenue_source,
        changed: false,
      },
      badges: {
        collected_vs_previous: "flat",
        margin: "flat",
        outstanding: "flat",
        source_shift: false,
      },
    };
  }

  const collectedDelta = current.collected_revenue_cents - previous.collected_revenue_cents;
  const marginDelta = current.average_margin_percentage - previous.average_margin_percentage;
  const outstandingDelta = current.outstanding_revenue_cents - previous.outstanding_revenue_cents;
  const sourceChanged =
    (current.best_revenue_source ?? null) !== (previous.best_revenue_source ?? null) &&
    current.best_revenue_source != null &&
    previous.best_revenue_source != null;

  return {
    collected_revenue_delta_cents: collectedDelta,
    collected_revenue_delta_pct:
      previous.collected_revenue_cents > 0
        ? round2((collectedDelta / previous.collected_revenue_cents) * 100)
        : null,
    gross_profit_delta_cents: current.gross_profit_cents - previous.gross_profit_cents,
    margin_delta_percentage_points: round2(marginDelta),
    outstanding_delta_cents: outstandingDelta,
    ar_risk_delta: round2(current.ar_risk_score - previous.ar_risk_score),
    forecast_delta_cents: current.forecast_revenue_cents - previous.forecast_revenue_cents,
    best_revenue_source_shift: {
      previous: previous.best_revenue_source,
      current: current.best_revenue_source,
      changed: sourceChanged,
    },
    badges: {
      collected_vs_previous: deltaBadge(collectedDelta, 100),
      margin: deltaBadge(marginDelta, 0.05),
      outstanding: deltaBadge(outstandingDelta, 100),
      source_shift: sourceChanged,
    },
  };
}

/** Generate deterministic executive finance insights — no AI. */
export function generateExecutiveFinanceInsights(args: {
  snapshot: Pick<
    FiFinancialExecutiveSnapshotRow,
    | "best_revenue_source"
    | "overdue_revenue_cents"
    | "average_margin_percentage"
    | "outstanding_revenue_cents"
    | "highest_margin_procedure_type"
  >;
  attribution: ExecutiveAttributionAggregation;
  ar: Pick<ExecutiveArAggregation, "surgery_balance_outstanding_cents">;
  profitability_snapshots: ExecutiveProfitabilitySnapshotInput[];
  comparison: ExecutivePeriodComparison | null;
  dependency_threshold_pct?: number;
  unknown_attribution_threshold_pct?: number;
  margin_compression_threshold_pp?: number;
  underpriced_margin_threshold_pct?: number;
}): ExecutiveFinanceInsight[] {
  const insights: ExecutiveFinanceInsight[] = [];
  const depThreshold = args.dependency_threshold_pct ?? 40;
  const unknownThreshold = args.unknown_attribution_threshold_pct ?? 15;
  const marginThreshold = args.margin_compression_threshold_pp ?? 2;
  const underpricedThreshold = args.underpriced_margin_threshold_pct ?? 20;

  const totalRevenue = args.attribution.revenue_by_source.reduce((acc, x) => acc + x.cents, 0);
  if (totalRevenue > 0 && args.snapshot.best_revenue_source) {
    const top = args.attribution.revenue_by_source.find(
      (x) => x.source === args.snapshot.best_revenue_source
    );
    const share = top ? (top.cents / totalRevenue) * 100 : 0;
    if (share >= depThreshold) {
      insights.push({
        kind: "revenue_source_dependency",
        severity: share >= 60 ? "critical" : "warning",
        title: "Revenue source dependency risk",
        detail: `${args.snapshot.best_revenue_source.replace(/_/g, " ")} accounts for ${round2(share)}% of attributed collected revenue.`,
      });
    }
  }

  if (
    args.comparison &&
    args.comparison.outstanding_delta_cents > 0 &&
    args.comparison.badges.outstanding === "up"
  ) {
    insights.push({
      kind: "overdue_revenue_rising",
      severity: args.snapshot.overdue_revenue_cents > 0 ? "warning" : "info",
      title: "Outstanding revenue rising",
      detail: `Outstanding revenue increased by ${args.comparison.outstanding_delta_cents} cents vs the previous period.`,
    });
  }

  if (
    args.comparison &&
    args.comparison.margin_delta_percentage_points <= -marginThreshold &&
    args.comparison.badges.margin === "down"
  ) {
    insights.push({
      kind: "margin_compression",
      severity: "warning",
      title: "Margin compression",
      detail: `Average margin fell ${Math.abs(args.comparison.margin_delta_percentage_points).toFixed(1)} percentage points vs the previous period.`,
    });
  }

  if (args.attribution.unknown_attribution_percentage >= unknownThreshold) {
    insights.push({
      kind: "high_unknown_attribution",
      severity: args.attribution.unknown_attribution_percentage >= 25 ? "critical" : "warning",
      title: "High unknown attribution",
      detail: `${args.attribution.unknown_attribution_percentage.toFixed(1)}% of attributed collected revenue has unknown source.`,
    });
  }

  const surgeryOutstanding = args.ar.surgery_balance_outstanding_cents;
  if (surgeryOutstanding > 0) {
    insights.push({
      kind: "outstanding_surgery_balances",
      severity: surgeryOutstanding >= 500_000 ? "critical" : "warning",
      title: "Outstanding surgery balances",
      detail: `${surgeryOutstanding} cents in surgery deposit/balance receivables remain open.`,
    });
  }

  const byProcedure = new Map<string, { marginSum: number; count: number; revenue: number }>();
  for (const s of args.profitability_snapshots) {
    const key = s.procedure_type.trim().toLowerCase();
    const entry = byProcedure.get(key) ?? { marginSum: 0, count: 0, revenue: 0 };
    entry.marginSum += s.gross_margin_percentage;
    entry.count += 1;
    entry.revenue += s.revenue_cents;
    byProcedure.set(key, entry);
  }
  for (const [procedure, stats] of byProcedure) {
    const avgMargin = stats.marginSum / stats.count;
    if (stats.count >= 2 && avgMargin < underpricedThreshold && stats.revenue >= 100_000) {
      insights.push({
        kind: "underpriced_procedure_type",
        severity: "warning",
        title: "Underpriced procedure type",
        detail: `${procedure.toUpperCase()} averages ${round2(avgMargin)}% margin across ${stats.count} cases — review pricing or cost model.`,
      });
      break;
    }
  }

  return insights;
}

export function mapExecutiveSnapshotRow(
  raw: Record<string, unknown>
): FiFinancialExecutiveSnapshotRow {
  const metadata =
    raw.source_metadata &&
    typeof raw.source_metadata === "object" &&
    !Array.isArray(raw.source_metadata)
      ? (raw.source_metadata as Record<string, unknown>)
      : {};
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    clinic_id: raw.clinic_id != null ? String(raw.clinic_id) : null,
    period_start: String(raw.period_start ?? "").slice(0, 10),
    period_end: String(raw.period_end ?? "").slice(0, 10),
    gross_revenue_cents: Number(raw.gross_revenue_cents ?? 0),
    collected_revenue_cents: Number(raw.collected_revenue_cents ?? 0),
    outstanding_revenue_cents: Number(raw.outstanding_revenue_cents ?? 0),
    overdue_revenue_cents: Number(raw.overdue_revenue_cents ?? 0),
    surgery_revenue_cents: Number(raw.surgery_revenue_cents ?? 0),
    treatment_revenue_cents: Number(raw.treatment_revenue_cents ?? 0),
    gross_profit_cents: Number(raw.gross_profit_cents ?? 0),
    average_margin_percentage: Number(raw.average_margin_percentage ?? 0),
    average_revenue_per_case_cents: Number(raw.average_revenue_per_case_cents ?? 0),
    average_revenue_per_graft_cents:
      raw.average_revenue_per_graft_cents != null
        ? Number(raw.average_revenue_per_graft_cents)
        : null,
    total_surgeries: Number(raw.total_surgeries ?? 0),
    total_consults: Number(raw.total_consults ?? 0),
    total_paid_invoices: Number(raw.total_paid_invoices ?? 0),
    total_overdue_invoices: Number(raw.total_overdue_invoices ?? 0),
    best_revenue_source: raw.best_revenue_source
      ? (String(raw.best_revenue_source) as FiRevenueAttributionSource)
      : null,
    best_profit_source: raw.best_profit_source
      ? (String(raw.best_profit_source) as FiRevenueAttributionSource)
      : null,
    highest_margin_procedure_type:
      raw.highest_margin_procedure_type != null ? String(raw.highest_margin_procedure_type) : null,
    ar_risk_score: Number(raw.ar_risk_score ?? 0),
    forecast_revenue_cents: Number(raw.forecast_revenue_cents ?? 0),
    forecast_confidence: Number(raw.forecast_confidence ?? 0),
    source_metadata: metadata,
    calculated_at: String(raw.calculated_at ?? ""),
  };
}

export function assertExecutiveDataTenantScoped(
  tenantId: string,
  rows: Array<{ tenant_id: string }>
): void {
  const tid = tenantId.trim();
  for (const row of rows) {
    if (row.tenant_id.trim() !== tid) {
      throw new Error("Executive finance data must be tenant-scoped.");
    }
  }
}

export function executiveZeroDataSnapshot(
  tenantId: string,
  periodStart: string,
  periodEnd: string
): Omit<FiFinancialExecutiveSnapshotRow, "id"> {
  return buildExecutiveFinanceSnapshot({
    tenant_id: tenantId,
    period_start: periodStart,
    period_end: periodEnd,
    as_of_ymd: periodEnd,
    ledger_transactions: [],
    invoices: [],
    profitability_snapshots: [],
    attribution_events: [],
    ar_cases: [],
    scheduled_surgeries: [],
  });
}

export function monthPeriodForYmd(ymd: string): { period_start: string; period_end: string } {
  const [y, m] = ymd.split("-").map((x) => Number(x));
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { period_start: start, period_end: end };
}

export function previousMonthPeriod(periodStart: string): {
  period_start: string;
  period_end: string;
} {
  const [y, m] = periodStart.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 2, 1));
  const py = dt.getUTCFullYear();
  const pm = dt.getUTCMonth() + 1;
  const start = `${py}-${String(pm).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  const end = `${py}-${String(pm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { period_start: start, period_end: end };
}

export { marginPct };
