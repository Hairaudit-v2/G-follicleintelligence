/**
 * FinancialOS — clinic-facing presentation helpers (UI copy only; no loader changes).
 */

import type { FinancialOsCommandCentrePayload } from "@/src/lib/financialOs/financialOsCommandCentreLoader.server";
import type { FinancialOsCommandCentreAlertStrip } from "@/src/lib/financialOs/financialOsCommandCentreAlertsCore";
import type { AccountsReceivableWorkQueueRow } from "@/src/lib/financialOs/financialAccountsReceivable.server";
import { FI_AR_HIGH_VALUE_THRESHOLD_CENTS } from "@/src/lib/financialOs/financialAccountsReceivableCore";
import type { FiFinancialTransactionRow } from "@/src/lib/financialOs/financialTransactionCore";

export const financialOsLinkButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-[#141C33]/60 px-3 py-2 text-sm font-medium text-[#E2E8F0] transition hover:border-[#22C1FF]/35 hover:text-[#22C1FF] disabled:pointer-events-none disabled:opacity-40";

export type FinancialHealthCard = {
  id: string;
  label: string;
  value: string;
  detail: string;
  href?: string;
};

export type FinancialAttentionItem = {
  id: string;
  headline: string;
  detail?: string;
  href?: string;
  severity: "critical" | "warning" | "info";
  priorityScore: number;
};

export type CollectionPriorityItem = {
  id: string;
  patientLabel: string;
  amountDueCents: number;
  dueStatus: string;
  relatedContext: string | null;
  nextAction: string;
  invoiceHref: string;
  patientHref: string | null;
  paymentRequestHref: string;
  paymentsInboxHref: string;
  priorityScore: number;
};

export type ProcedureProfitabilitySummary = {
  completedWithData: number;
  averageRevenueCents: number | null;
  averageMarginPct: number;
  casesMissingCostData: number;
  bestMarginSignal: string | null;
  worstMarginSignal: string | null;
  hasLimitedData: boolean;
};

export type ConsultationRevenueBridgeItem = {
  id: string;
  label: string;
  value: string;
  detail: string;
};

export type RecentFinancialActivityItem = {
  id: string;
  label: string;
  detail: string;
  occurredAt: string;
};

export type FinancialReportNavCard = {
  id: string;
  title: string;
  description: string;
  href: string;
};

function plural(count: number, singular: string, pluralForm?: string): string {
  if (count === 1) return `1 ${singular}`;
  return `${count} ${pluralForm ?? `${singular}s`}`;
}

export function fmtFinancialMoney(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtFinancialWhen(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countPaymentBlockers(alerts: FinancialOsCommandCentreAlertStrip): number {
  return (
    alerts.needsReviewCount +
    alerts.failedGatewayPayments.count +
    alerts.depositDeadlines48h.count +
    (alerts.unmatchedPayments.count > 0 ? alerts.unmatchedPayments.count : 0)
  );
}

function invoiceKindLabel(kind: string): string {
  return kind.replace(/_/g, " ");
}

function invoiceDueStatus(
  inv: FinancialOsCommandCentrePayload["recentOpenInvoices"][number]
): string {
  if (inv.status === "overdue" || inv.days_overdue > 0) {
    return inv.days_overdue > 0 ? `${inv.days_overdue} days overdue` : "Overdue";
  }
  if (inv.due_date) return `Due ${inv.due_date}`;
  return "Awaiting payment";
}

function arNextAction(row: AccountsReceivableWorkQueueRow): string {
  if (row.status === "call_required") return "Call patient to confirm payment plan";
  if (row.status === "reminder_sent") return "Follow up on reminder response";
  if (row.status === "escalated") return "Review escalated case with clinic lead";
  if (row.status === "payment_plan") return "Confirm installment schedule";
  if (row.risk_level === "critical") return "Prioritise collection — critical risk";
  if (row.days_overdue > 7) return "Send payment request or call patient";
  return "Send payment reminder";
}

function arPriorityScore(row: AccountsReceivableWorkQueueRow): number {
  const riskScore = { critical: 100, high: 80, medium: 55, low: 30 }[row.risk_level] ?? 30;
  return (
    riskScore +
    Math.min(30, row.days_overdue) +
    Math.min(20, Math.floor(row.outstanding_amount_cents / 100_000))
  );
}

function invoicePriorityScore(
  inv: FinancialOsCommandCentrePayload["recentOpenInvoices"][number]
): number {
  let score = 40;
  if (inv.status === "overdue") score += 35;
  score += Math.min(25, inv.days_overdue);
  score += Math.min(15, Math.floor(inv.remaining_balance_cents / 100_000));
  return score;
}

function activityLabelForTransaction(tx: FiFinancialTransactionRow): string {
  const kind = tx.transaction_kind;
  switch (kind) {
    case "payment_received":
      return "Payment received";
    case "invoice_created":
      return "Invoice issued";
    case "deposit_paid":
      return "Deposit paid";
    case "balance_paid":
      return "Balance paid";
    case "refund_processed":
      return "Refund processed";
    case "cancellation_fee":
      return "Cancellation fee recorded";
    default: {
      const fallback = kind as string;
      return fallback.replace(/_/g, " ");
    }
  }
}

function activityDetailForTransaction(tx: FiFinancialTransactionRow, currency: string): string {
  const amount = fmtFinancialMoney(tx.amount_cents, tx.currency || currency);
  const prefix = tx.direction === "debit" ? "−" : "+";
  if (tx.description?.trim()) return `${prefix}${amount} · ${tx.description.trim()}`;
  return `${prefix}${amount}`;
}

export function buildFinancialHealthCards(
  base: string,
  data: FinancialOsCommandCentrePayload
): FinancialHealthCard[] {
  const {
    currency,
    executiveFinance,
    outstandingInvoices,
    depositsAwaitingPayment,
    alerts,
    surgeryEconomics,
    accountsReceivable,
  } = data;
  const financialModule = `${base}/financial`;
  const blockers = countPaymentBlockers(alerts);
  const snapshotCount = surgeryEconomics.recentSnapshots.length;
  const marginPct = surgeryEconomics.metrics.average_margin_percentage;

  return [
    {
      id: "revenue_collected",
      label: "Revenue collected",
      value: fmtFinancialMoney(executiveFinance.snapshot.collected_revenue_cents, currency),
      detail: `${fmtFinancialMoney(data.revenueTodayCents, currency)} collected today · period ${executiveFinance.periodStart} → ${executiveFinance.periodEnd}`,
      href: `${base}/financial-os/executive`,
    },
    {
      id: "outstanding_balances",
      label: "Outstanding balances",
      value: fmtFinancialMoney(outstandingInvoices.totalCents, currency),
      detail: `${plural(outstandingInvoices.count, "open invoice")} awaiting collection`,
      href: `${financialModule}/invoices`,
    },
    {
      id: "deposits_due",
      label: "Deposits due",
      value: fmtFinancialMoney(depositsAwaitingPayment.totalCents, currency),
      detail:
        depositsAwaitingPayment.count > 0
          ? `${plural(depositsAwaitingPayment.count, "surgery deposit")} awaiting payment`
          : "No outstanding surgery deposits",
      href: `${base}/payments`,
    },
    {
      id: "payment_blockers",
      label: "Payment blockers",
      value: String(blockers),
      detail:
        blockers > 0
          ? "Issues that may delay revenue collection or procedure clearance"
          : "No payment issues detected",
      href: blockers > 0 ? `${base}/payments` : `${financialModule}/payments`,
    },
    {
      id: "procedure_profitability",
      label: "Procedure profitability",
      value: snapshotCount > 0 ? `${marginPct.toFixed(1)}% avg margin` : "—",
      detail:
        snapshotCount > 0
          ? `${plural(snapshotCount, "completed procedure")} with profitability data`
          : "Profitability strengthens as surgery costs and payments are captured",
      href: `${base}/financial-os/cost-models`,
    },
    {
      id: "ar_risk",
      label: "Accounts receivable risk",
      value: `${executiveFinance.snapshot.ar_risk_score.toFixed(0)} / 100`,
      detail:
        accountsReceivable.metrics.criticalCaseCount > 0
          ? `${plural(accountsReceivable.metrics.criticalCaseCount, "critical case")} need collection action`
          : `${plural(accountsReceivable.metrics.openCaseCount, "open case")} in receivables queue`,
      href: `${base}/financial-os/accounts-receivable`,
    },
  ];
}

export function buildFinancialAttentionPriorities(
  base: string,
  data: FinancialOsCommandCentrePayload,
  maxItems = 5
): FinancialAttentionItem[] {
  const items: FinancialAttentionItem[] = [];
  const {
    alerts,
    outstandingInvoices,
    overdueInvoices,
    depositsAwaitingPayment,
    accountsReceivable,
    surgeryEconomics,
    executiveFinance,
  } = data;
  const financialModule = `${base}/financial`;

  if (alerts.depositDeadlines48h.count > 0) {
    items.push({
      id: "deposit_deadlines",
      headline: `${plural(alerts.depositDeadlines48h.count, "surgery has", "surgeries have")} payment issues before procedure day`,
      detail: "Deposits are due within 48 hours — confirm payment before surgery clearance.",
      href: `${base}/payments`,
      severity: "critical",
      priorityScore: 95,
    });
  }

  if (alerts.needsReviewCount > 0) {
    items.push({
      id: "payment_review",
      headline: `${plural(alerts.needsReviewCount, "payment needs", "payments need")} review before settlement`,
      detail: "Unmatched payment amounts were detected — invoices may not be fully settled.",
      href: `${base}/payments`,
      severity: "critical",
      priorityScore: 92,
    });
  }

  if (overdueInvoices.count > 0) {
    items.push({
      id: "overdue_invoices",
      headline: `${fmtFinancialMoney(overdueInvoices.totalCents, data.currency)} remains outstanding on overdue invoices`,
      detail: `${plural(overdueInvoices.count, "invoice is", "invoices are")} past due — prioritise collection.`,
      href: `${financialModule}/invoices`,
      severity: overdueInvoices.count >= 3 ? "critical" : "warning",
      priorityScore: 88,
    });
  }

  if (outstandingInvoices.count > 0 && overdueInvoices.count === 0) {
    items.push({
      id: "outstanding_invoices",
      headline: `${fmtFinancialMoney(outstandingInvoices.totalCents, data.currency)} remains outstanding on active invoices`,
      detail: `${plural(outstandingInvoices.count, "invoice awaits", "invoices await")} payment.`,
      href: `${financialModule}/invoices`,
      severity: "warning",
      priorityScore: 75,
    });
  }

  if (depositsAwaitingPayment.count > 0 && alerts.depositDeadlines48h.count === 0) {
    items.push({
      id: "deposits_overdue",
      headline: `${plural(depositsAwaitingPayment.count, "deposit is", "deposits are")} overdue or awaiting payment`,
      detail: `${fmtFinancialMoney(depositsAwaitingPayment.totalCents, data.currency)} in surgery deposits still open.`,
      href: `${base}/payments`,
      severity: "warning",
      priorityScore: 82,
    });
  }

  if (accountsReceivable.metrics.criticalCaseCount > 0) {
    items.push({
      id: "ar_critical",
      headline: `${plural(accountsReceivable.metrics.criticalCaseCount, "accounts receivable case is", "accounts receivable cases are")} at critical risk`,
      detail: "Escalate collection on high-risk outstanding balances.",
      href: `${base}/financial-os/accounts-receivable`,
      severity: "critical",
      priorityScore: 86,
    });
  }

  if (alerts.failedGatewayPayments.count > 0) {
    items.push({
      id: "failed_payments",
      headline: `${plural(alerts.failedGatewayPayments.count, "online payment failed", "online payments failed")}`,
      detail: "Follow up with patients or resend a payment request.",
      href: `${base}/payments`,
      severity: "warning",
      priorityScore: 80,
    });
  }

  const snapshotCount = surgeryEconomics.recentSnapshots.length;
  if (snapshotCount === 0 || surgeryEconomics.metrics.average_margin_percentage === 0) {
    items.push({
      id: "profitability_limited",
      headline: "Profitability visibility is limited for recent procedures",
      detail: "Capture surgery costs and payments to strengthen margin reporting.",
      href: `${base}/financial-os/cost-models`,
      severity: "info",
      priorityScore: 45,
    });
  }

  if (executiveFinance.comparison.ar_risk_delta > 5) {
    items.push({
      id: "ar_risk_rising",
      headline: "Accounts receivable risk is increasing",
      detail: `Risk score rose ${executiveFinance.comparison.ar_risk_delta.toFixed(1)} points vs the previous period.`,
      href: `${base}/financial-os/accounts-receivable`,
      severity: "warning",
      priorityScore: 70,
    });
  }

  return items.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, maxItems);
}

export function hasUrgentFinancialAttention(items: FinancialAttentionItem[]): boolean {
  return items.some((i) => i.severity === "critical" || i.severity === "warning");
}

export function financialAttentionSeverityClass(
  severity: FinancialAttentionItem["severity"]
): string {
  if (severity === "critical") return "border-rose-500/25 bg-rose-500/[0.06]";
  if (severity === "warning") return "border-amber-500/25 bg-amber-500/[0.05]";
  return "border-white/[0.08] bg-[#0c1220]/50";
}

export function buildCollectionPriorities(
  base: string,
  data: FinancialOsCommandCentrePayload,
  maxItems = 5
): CollectionPriorityItem[] {
  const financialModule = `${base}/financial`;
  const paymentsInboxHref = `${base}/payments`;
  const paymentRequestHref = `${financialModule}/payment-requests`;
  const invoiceListHref = `${financialModule}/invoices`;
  const items: CollectionPriorityItem[] = [];

  for (const row of data.accountsReceivable.rows) {
    if (
      row.outstanding_amount_cents <= 0 ||
      row.status === "resolved" ||
      row.status === "written_off"
    )
      continue;
    items.push({
      id: `ar-${row.id}`,
      patientLabel: row.patient_label ?? "Patient",
      amountDueCents: row.outstanding_amount_cents,
      dueStatus: row.days_overdue > 0 ? `${row.days_overdue} days overdue` : "Open balance",
      relatedContext: row.invoice_label ?? invoiceKindLabel(row.receivable_type),
      nextAction: arNextAction(row),
      invoiceHref: invoiceListHref,
      patientHref: row.patient_id ? `${base}/patients/${row.patient_id}` : null,
      paymentRequestHref,
      paymentsInboxHref,
      priorityScore: arPriorityScore(row),
    });
  }

  for (const inv of data.recentOpenInvoices) {
    if (items.some((i) => i.id === `inv-${inv.id}`)) continue;
    items.push({
      id: `inv-${inv.id}`,
      patientLabel: inv.title ?? invoiceKindLabel(inv.invoice_kind),
      amountDueCents: inv.remaining_balance_cents,
      dueStatus: invoiceDueStatus(inv),
      relatedContext: invoiceKindLabel(inv.invoice_kind),
      nextAction:
        inv.status === "overdue" ? "Send payment request or call patient" : "Send payment reminder",
      invoiceHref: invoiceListHref,
      patientHref: null,
      paymentRequestHref,
      paymentsInboxHref,
      priorityScore: invoicePriorityScore(inv),
    });
  }

  return items.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, maxItems);
}

export function buildProcedureProfitabilitySummary(
  data: FinancialOsCommandCentrePayload
): ProcedureProfitabilitySummary {
  const { recentSnapshots, metrics } = data.surgeryEconomics;
  const completedWithData = recentSnapshots.length;

  if (completedWithData === 0) {
    return {
      completedWithData: 0,
      averageRevenueCents: null,
      averageMarginPct: 0,
      casesMissingCostData: 0,
      bestMarginSignal: null,
      worstMarginSignal: null,
      hasLimitedData: true,
    };
  }

  const revenueSum = recentSnapshots.reduce((acc, s) => acc + s.revenue_cents, 0);
  const averageRevenueCents = Math.round(revenueSum / completedWithData);
  const casesMissingCostData = recentSnapshots.filter((s) => s.total_cost_cents <= 0).length;

  const byProcedure = new Map<string, { marginSum: number; count: number }>();
  for (const snap of recentSnapshots) {
    const key = snap.procedure_type || "unknown";
    const entry = byProcedure.get(key) ?? { marginSum: 0, count: 0 };
    entry.marginSum += snap.gross_margin_percentage;
    entry.count += 1;
    byProcedure.set(key, entry);
  }

  let best: { type: string; margin: number } | null = null;
  let worst: { type: string; margin: number } | null = null;
  for (const [type, { marginSum, count }] of byProcedure) {
    const avg = marginSum / count;
    if (!best || avg > best.margin) best = { type, margin: avg };
    if (!worst || avg < worst.margin) worst = { type, margin: avg };
  }

  return {
    completedWithData,
    averageRevenueCents,
    averageMarginPct: metrics.average_margin_percentage,
    casesMissingCostData,
    bestMarginSignal: best
      ? `${best.type.replace(/_/g, " ")} · ${best.margin.toFixed(1)}% margin`
      : null,
    worstMarginSignal:
      worst && worst.type !== best?.type
        ? `${worst.type.replace(/_/g, " ")} · ${worst.margin.toFixed(1)}% margin`
        : null,
    hasLimitedData: completedWithData < 3 || casesMissingCostData > completedWithData / 2,
  };
}

export function buildConsultationRevenueBridge(
  data: FinancialOsCommandCentrePayload
): ConsultationRevenueBridgeItem[] {
  const quoteAwaiting = data.recentOpenInvoices.filter(
    (inv) => inv.invoice_kind === "consultation_quote"
  ).length;
  const consultsWithDeposit = data.revenueAttribution.rows.reduce(
    (acc, row) => acc + (row.invoices > 0 && row.consults > 0 ? 1 : 0),
    0
  );
  const proceduresWithoutDeposit = data.depositsAwaitingPayment.count;
  const highValueOpen = data.accountsReceivable.rows.filter(
    (r) =>
      r.outstanding_amount_cents >= FI_AR_HIGH_VALUE_THRESHOLD_CENTS &&
      r.status !== "resolved" &&
      r.status !== "written_off"
  ).length;

  return [
    {
      id: "quotes_awaiting",
      label: "Quotes awaiting payment",
      value: String(quoteAwaiting),
      detail:
        quoteAwaiting > 0
          ? "Consultation quotes with open balances"
          : "No open consultation quotes",
    },
    {
      id: "consult_deposit",
      label: "Consultations converted to deposit",
      value: String(consultsWithDeposit),
      detail: "Lead sources with both consultations and invoiced revenue in range",
    },
    {
      id: "booked_no_deposit",
      label: "Procedures booked without deposit",
      value: String(proceduresWithoutDeposit),
      detail:
        proceduresWithoutDeposit > 0
          ? "Surgery deposit invoices still awaiting payment"
          : "All booked procedures have deposit coverage",
    },
    {
      id: "high_value_opportunities",
      label: "High-value opportunities awaiting financial action",
      value: String(highValueOpen),
      detail:
        highValueOpen > 0
          ? "Outstanding balances above clinic high-value threshold"
          : "No high-value balances flagged",
    },
  ];
}

export function buildRecentFinancialActivity(
  data: FinancialOsCommandCentrePayload,
  maxItems = 8
): RecentFinancialActivityItem[] {
  return data.recentTransactions.slice(0, maxItems).map((tx) => ({
    id: tx.id,
    label: activityLabelForTransaction(tx),
    detail: activityDetailForTransaction(tx, data.currency),
    occurredAt: tx.created_at,
  }));
}

export function buildFinancialReportNavCards(base: string): FinancialReportNavCard[] {
  const financialModule = `${base}/financial`;
  return [
    {
      id: "payments_inbox",
      title: "Payments Inbox",
      description: "Review due invoices, send payment links, and resolve collection tasks.",
      href: `${base}/payments`,
    },
    {
      id: "invoices",
      title: "Invoices",
      description: "Open invoice list, balances, and collection status.",
      href: `${financialModule}/invoices`,
    },
    {
      id: "ledger",
      title: "Ledger",
      description: "Full transaction history and financial record detail.",
      href: `${financialModule}/payments`,
    },
    {
      id: "profitability",
      title: "Profitability",
      description: "Surgery cost models and procedure margin snapshots.",
      href: `${base}/financial-os/cost-models`,
    },
    {
      id: "executive_finance",
      title: "Executive Finance",
      description: "Period comparisons, forecasts, and owner finance intelligence.",
      href: `${base}/financial-os/executive`,
    },
    {
      id: "integrations",
      title: "Payment settings",
      description: "Stripe and payment provider configuration for this clinic.",
      href: `${base}/settings/payments`,
    },
  ];
}

export function financialDiagnosticCounts(data: FinancialOsCommandCentrePayload) {
  return {
    ledgerTransactionCount: data.recentTransactions.length,
    openInvoiceCount: data.recentOpenInvoices.length,
    alertReviewCount: data.alerts.needsReviewCount,
    arCaseCount: data.accountsReceivable.rows.length,
    profitabilitySnapshotCount: data.surgeryEconomics.recentSnapshots.length,
    attributionEventCount: data.revenueAttribution.rows.length,
    executiveInsightCount: data.executiveFinance.insights.length,
  };
}
