/**
 * Pure FinancialOS clearance engine (Phase 4) — safe for unit tests without DB.
 * Unifies payment, pathway, finance, super release, international transfer, installment,
 * deposit, and balance signals into one advisory clearance state per surgery context.
 * Does not block surgery workflows — operational visibility only.
 */

import { addDaysToCalendarDate } from "@/src/lib/calendar/calendarTimezone";
import type { FinanceApplicationAttentionSummary } from "@/src/lib/financialOs/financialFinanceApplicationsCore";
import type { InternationalTransferAttentionSummary } from "@/src/lib/financialOs/financialInternationalTransferCore";
import type { PaymentPathwayAttentionSummary } from "@/src/lib/financialOs/financialPaymentPathwayCore";
import type { PathwayTaskAttentionSummary } from "@/src/lib/financialOs/financialPaymentPathwayInboxCore";
import type { SuperReleaseAttentionSummary } from "@/src/lib/financialOs/financialSuperReleaseCore";
import type { FinancialInvoicePaymentState } from "@/src/lib/financialOs/financialSurgeryPipelineStatusCore";

export type FinancialClearanceState =
  | "not_ready"
  | "deposit_ready"
  | "pathway_pending"
  | "attention_required"
  | "financially_cleared"
  | "paid_in_full"
  | "unavailable";

export const FINANCIAL_CLEARANCE_STATE_LABELS: Record<FinancialClearanceState, string> = {
  unavailable: "Clearance unavailable",
  not_ready: "Not financially ready",
  deposit_ready: "Deposit cleared",
  pathway_pending: "Pathway in progress",
  attention_required: "Attention required",
  financially_cleared: "Financially cleared",
  paid_in_full: "Paid in full",
};

export type FinancialClearanceSourceBreakdown = {
  financial_os_status: string | null;
  deposit_invoice_state: FinancialInvoicePaymentState;
  balance_invoice_state: FinancialInvoicePaymentState;
  has_active_pathway: boolean;
  pathway_status: string | null;
  pathway_type: string | null;
  unresolved_pathway_tasks: number;
  finance_attention: boolean;
  super_release_attention: boolean;
  international_transfer_attention: boolean;
  balance_overdue: boolean;
  balance_due_within_14_days: boolean;
  failed_payment_in_last_60_days: boolean;
  installment_overdue: boolean;
};

export type FinancialClearanceResult = {
  clearance_state: FinancialClearanceState;
  clearance_label: string;
  clearance_reason: string;
  blocking_factors: string[];
  warning_factors: string[];
  amount_paid_cents: number;
  balance_due_cents: number;
  next_required_action: string | null;
  financially_safe_to_proceed: boolean;
  paid_in_full: boolean;
  requires_staff_attention: boolean;
  source_breakdown: FinancialClearanceSourceBreakdown;
};

export type BuildFinancialClearanceInput = {
  todayYmd: string;
  calendarTimezone: string;
  booking_status: string | null;
  financial_os_status: string | null;
  surgeryDateYmd: string | null;
  /** When true, resolver failed to load financial data. */
  dataLoadFailed?: boolean;
  financialDataAvailable: boolean;
  depositInvoiceState: FinancialInvoicePaymentState;
  balanceInvoiceState: FinancialInvoicePaymentState;
  amount_paid_cents: number;
  balance_due_cents: number;
  balance_overdue: boolean;
  balance_due_within_14_days: boolean;
  deposit_pending_for_confirmed_surgery: boolean;
  failed_payment_in_last_60_days: boolean;
  installment_overdue: boolean;
  paymentPathway: PaymentPathwayAttentionSummary;
  pathwayTaskAttention: PathwayTaskAttentionSummary;
  financeApplicationAttention: FinanceApplicationAttentionSummary;
  superReleaseApplicationAttention: SuperReleaseAttentionSummary;
  internationalTransferApplicationAttention: InternationalTransferAttentionSummary;
  /** Optional SLA / rejection flags when raw application rows are not passed into core. */
  financeSlaBreach?: boolean;
  financeRejected?: boolean;
};

function ymd(s: string | null | undefined): string | null {
  const t = s?.trim();
  if (!t) return null;
  return t.length >= 10 ? t.slice(0, 10) : t;
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T00:00:00Z`);
  const b = Date.parse(`${toYmd}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

function isDepositSatisfied(input: BuildFinancialClearanceInput): boolean {
  if (input.depositInvoiceState === "paid") return true;
  const fos = input.financial_os_status?.trim() || null;
  if (fos === "confirmed" || fos === "paid_in_full") return true;
  if (input.amount_paid_cents > 0 && !input.deposit_pending_for_confirmed_surgery) return true;
  return false;
}

function pathwayFundsReleasedOrSettled(input: BuildFinancialClearanceInput): boolean {
  const pathway = input.paymentPathway;
  if (!pathway.hasActivePathway) return false;
  const status = pathway.pathway_status;
  if (status === "settled" || status === "approved") return true;
  if (
    pathway.pathway_type === "super_release" &&
    !input.superReleaseApplicationAttention.super_release_attention_required
  ) {
    return true;
  }
  if (
    pathway.pathway_type === "international_transfer" &&
    input.internationalTransferApplicationAttention.financial_clearance_state === "cleared"
  ) {
    return true;
  }
  if (
    pathway.pathway_type === "medical_finance" &&
    !input.financeApplicationAttention.finance_attention_required &&
    pathway.hasActivePathway
  ) {
    return true;
  }
  return false;
}

function hasUnresolvedWorkflowApplications(input: BuildFinancialClearanceInput): boolean {
  return (
    input.financeApplicationAttention.finance_attention_required ||
    input.superReleaseApplicationAttention.super_release_attention_required ||
    input.internationalTransferApplicationAttention.international_transfer_attention_required
  );
}

function hasWorkflowBlockers(input: BuildFinancialClearanceInput): boolean {
  return (
    input.pathwayTaskAttention.task_attention_required ||
    input.paymentPathway.pathway_attention_required ||
    hasUnresolvedWorkflowApplications(input)
  );
}

function surgeryWithinClearanceWindow(input: BuildFinancialClearanceInput): boolean {
  const surgery = ymd(input.surgeryDateYmd);
  if (!surgery) return false;
  const days = daysBetween(input.todayYmd, surgery);
  return days >= 0 && days <= 14;
}

function surgeryWithinBalanceDueWindow(input: BuildFinancialClearanceInput): boolean {
  return input.balance_due_within_14_days || surgeryWithinClearanceWindow(input);
}

function collectAttentionFactors(input: BuildFinancialClearanceInput): {
  blocking: string[];
  warnings: string[];
} {
  const blocking: string[] = [];
  const warnings: string[] = [];

  if (input.balance_overdue) blocking.push("Balance overdue");
  if (input.failed_payment_in_last_60_days) blocking.push("Failed payment in the last 60 days");
  if (input.pathwayTaskAttention.task_attention_required) {
    blocking.push(input.pathwayTaskAttention.task_attention_reason ?? "Unresolved pathway task");
  }
  if (input.financeRejected || input.financeSlaBreach) {
    blocking.push(
      input.financeRejected ? "Finance application rejected" : "Finance application SLA breach"
    );
  } else if (
    input.financeApplicationAttention.finance_attention_required &&
    input.financeSlaBreach
  ) {
    blocking.push("Finance application SLA breach");
  }
  if (input.superReleaseApplicationAttention.sla_breach) {
    blocking.push("Super release SLA breach");
  } else if (isSuperReleaseRejected(input)) {
    blocking.push("Super release rejected");
  }
  if (input.internationalTransferApplicationAttention.sla_breach) {
    blocking.push("International transfer SLA breach");
  }
  if (isInternationalTransferRejectedOrVariance(input)) {
    if (!blocking.some((b) => b.includes("International"))) {
      blocking.push("International transfer variance, rejection, or missed settlement");
    }
  }
  if (input.installment_overdue) blocking.push("Installment overdue");
  if (
    surgeryWithinClearanceWindow(input) &&
    input.balance_due_cents > 0 &&
    !pathwayFundsReleasedOrSettled(input)
  ) {
    blocking.push("Surgery within clearance window with unresolved funds");
  }
  if (
    input.paymentPathway.pathway_attention_required &&
    input.paymentPathway.pathway_attention_reason
  ) {
    warnings.push(input.paymentPathway.pathway_attention_reason);
  }
  if (input.deposit_pending_for_confirmed_surgery)
    warnings.push("Deposit pending for confirmed surgery");

  return { blocking, warnings };
}

function isSuperReleaseRejected(input: BuildFinancialClearanceInput): boolean {
  return Boolean(
    input.superReleaseApplicationAttention.super_release_attention_labels.some((l) =>
      l.toLowerCase().includes("reject")
    ) || input.superReleaseApplicationAttention.sla_breach
  );
}

function isFinanceRejected(input: BuildFinancialClearanceInput): boolean {
  if (input.financeRejected) return true;
  return input.financeApplicationAttention.finance_attention_labels.some((l) =>
    l.toLowerCase().includes("reject")
  );
}

function isInternationalTransferRejectedOrVariance(input: BuildFinancialClearanceInput): boolean {
  const intl = input.internationalTransferApplicationAttention;
  if (intl.sla_breach) return true;
  if (
    intl.financial_clearance_state === "blocked" ||
    intl.financial_clearance_state === "partial_settlement"
  ) {
    return true;
  }
  return intl.international_transfer_attention_labels.some((l) => {
    const lower = l.toLowerCase();
    return lower.includes("reject") || lower.includes("variance");
  });
}

function buildSourceBreakdown(
  input: BuildFinancialClearanceInput
): FinancialClearanceSourceBreakdown {
  return {
    financial_os_status: input.financial_os_status?.trim() || null,
    deposit_invoice_state: input.depositInvoiceState,
    balance_invoice_state: input.balanceInvoiceState,
    has_active_pathway: input.paymentPathway.hasActivePathway,
    pathway_status: input.paymentPathway.pathway_status,
    pathway_type: input.paymentPathway.pathway_type,
    unresolved_pathway_tasks: input.pathwayTaskAttention.unresolved_open_task_count,
    finance_attention: input.financeApplicationAttention.finance_attention_required,
    super_release_attention:
      input.superReleaseApplicationAttention.super_release_attention_required,
    international_transfer_attention:
      input.internationalTransferApplicationAttention.international_transfer_attention_required,
    balance_overdue: input.balance_overdue,
    balance_due_within_14_days: input.balance_due_within_14_days,
    failed_payment_in_last_60_days: input.failed_payment_in_last_60_days,
    installment_overdue: input.installment_overdue,
  };
}

function resolveNextRequiredAction(
  state: FinancialClearanceState,
  input: BuildFinancialClearanceInput,
  blocking: string[]
): string | null {
  if (state === "paid_in_full" || state === "financially_cleared" || state === "deposit_ready") {
    return null;
  }
  if (blocking.length) return blocking[0]!;
  if (state === "pathway_pending") {
    if (input.financeApplicationAttention.finance_attention_reason) {
      return input.financeApplicationAttention.finance_attention_reason;
    }
    if (input.superReleaseApplicationAttention.super_release_summary_label) {
      return input.superReleaseApplicationAttention.super_release_summary_label;
    }
    if (input.internationalTransferApplicationAttention.international_transfer_summary_label) {
      return input.internationalTransferApplicationAttention.international_transfer_summary_label;
    }
    return "Complete active payment pathway workflow";
  }
  if (state === "not_ready") {
    if (input.deposit_pending_for_confirmed_surgery) return "Collect surgery deposit";
    if (!input.paymentPathway.hasActivePathway) return "Select a payment pathway";
    if (input.balance_due_cents > 0) return "Issue or collect surgery invoice payment";
    return "Confirm financial setup before surgery";
  }
  if (state === "unavailable") return "Reload financial data or link revenue invoices";
  return null;
}

/**
 * Derives the authoritative financial clearance snapshot for a surgery booking or case context.
 */
export function buildFinancialClearance(
  input: BuildFinancialClearanceInput
): FinancialClearanceResult {
  const source_breakdown = buildSourceBreakdown(input);
  const amount_paid_cents = Math.max(0, input.amount_paid_cents);
  const balance_due_cents = Math.max(0, input.balance_due_cents);

  if (input.dataLoadFailed || !input.financialDataAvailable) {
    return {
      clearance_state: "unavailable",
      clearance_label: FINANCIAL_CLEARANCE_STATE_LABELS.unavailable,
      clearance_reason:
        "Financial data could not be loaded or no FinancialOS signals exist for this context.",
      blocking_factors: [],
      warning_factors: [],
      amount_paid_cents,
      balance_due_cents,
      next_required_action: "Reload financial data or link revenue invoices",
      financially_safe_to_proceed: false,
      paid_in_full: false,
      requires_staff_attention: false,
      source_breakdown,
    };
  }

  const financeSlaBreach = Boolean(input.financeSlaBreach);
  const financeRejected = isFinanceRejected({ ...input, financeSlaBreach });
  const attentionInput: BuildFinancialClearanceInput = {
    ...input,
    financeSlaBreach,
    financeRejected,
  };

  const { blocking, warnings } = collectAttentionFactors({
    ...attentionInput,
  });

  // Recompute blocking with explicit rejection checks
  const blocking_factors = [...blocking];
  if (
    financeRejected &&
    !blocking_factors.some((b) => b.includes("Finance application rejected"))
  ) {
    blocking_factors.unshift("Finance application rejected");
  }
  if (
    input.superReleaseApplicationAttention.sla_breach &&
    !blocking_factors.some((b) => b.includes("Super release"))
  ) {
    blocking_factors.push("Super release SLA breach");
  }
  if (
    isInternationalTransferRejectedOrVariance(input) &&
    !blocking_factors.some((b) => b.includes("International"))
  ) {
    blocking_factors.push("International transfer variance, rejection, or missed settlement");
  }

  const hasUrgentAttention =
    blocking_factors.length > 0 ||
    input.balance_overdue ||
    input.failed_payment_in_last_60_days ||
    input.installment_overdue ||
    input.pathwayTaskAttention.task_attention_required ||
    financeRejected ||
    financeSlaBreach ||
    input.superReleaseApplicationAttention.sla_breach ||
    isInternationalTransferRejectedOrVariance(input) ||
    (surgeryWithinClearanceWindow(input) &&
      balance_due_cents > 0 &&
      !pathwayFundsReleasedOrSettled(input));

  const paidInFullCandidate =
    balance_due_cents <= 0 &&
    !input.pathwayTaskAttention.task_attention_required &&
    !hasUnresolvedWorkflowApplications(input) &&
    !input.failed_payment_in_last_60_days;

  if (paidInFullCandidate) {
    return {
      clearance_state: "paid_in_full",
      clearance_label: FINANCIAL_CLEARANCE_STATE_LABELS.paid_in_full,
      clearance_reason: "Invoice balance settled with no unresolved pathway or workflow blockers.",
      blocking_factors: [],
      warning_factors: warnings,
      amount_paid_cents,
      balance_due_cents,
      next_required_action: null,
      financially_safe_to_proceed: true,
      paid_in_full: true,
      requires_staff_attention: false,
      source_breakdown,
    };
  }

  if (hasUrgentAttention) {
    const reason =
      blocking_factors[0] ??
      warnings[0] ??
      "Financial clearance requires staff follow-up before procedure day.";
    return {
      clearance_state: "attention_required",
      clearance_label: FINANCIAL_CLEARANCE_STATE_LABELS.attention_required,
      clearance_reason: reason,
      blocking_factors,
      warning_factors: warnings,
      amount_paid_cents,
      balance_due_cents,
      next_required_action: blocking_factors[0] ?? reason,
      financially_safe_to_proceed: false,
      paid_in_full: false,
      requires_staff_attention: true,
      source_breakdown,
    };
  }

  const depositSatisfied = isDepositSatisfied(input);
  const pathwayCleared = pathwayFundsReleasedOrSettled(input);
  const balanceNotUrgent = !input.balance_overdue && !surgeryWithinBalanceDueWindow(input);

  if (pathwayCleared && !hasWorkflowBlockers(input)) {
    return {
      clearance_state: "financially_cleared",
      clearance_label: FINANCIAL_CLEARANCE_STATE_LABELS.financially_cleared,
      clearance_reason:
        "Payment pathway settled or funds released with no urgent workflow blockers.",
      blocking_factors: [],
      warning_factors: warnings,
      amount_paid_cents,
      balance_due_cents,
      next_required_action:
        balance_due_cents > 0 ? "Collect remaining balance before surgery window" : null,
      financially_safe_to_proceed: true,
      paid_in_full: false,
      requires_staff_attention: false,
      source_breakdown,
    };
  }

  if (
    depositSatisfied &&
    balance_due_cents > 0 &&
    !hasWorkflowBlockers(input) &&
    !surgeryWithinBalanceDueWindow(input)
  ) {
    return {
      clearance_state: "deposit_ready",
      clearance_label: FINANCIAL_CLEARANCE_STATE_LABELS.deposit_ready,
      clearance_reason: "Deposit collected; remaining balance due outside the clearance window.",
      blocking_factors: [],
      warning_factors: warnings,
      amount_paid_cents,
      balance_due_cents,
      next_required_action: "Schedule balance collection before surgery enters the 14-day window",
      financially_safe_to_proceed: true,
      paid_in_full: false,
      requires_staff_attention: false,
      source_breakdown,
    };
  }

  if ((depositSatisfied || pathwayCleared) && !hasWorkflowBlockers(input) && balanceNotUrgent) {
    return {
      clearance_state: "financially_cleared",
      clearance_label: FINANCIAL_CLEARANCE_STATE_LABELS.financially_cleared,
      clearance_reason: pathwayCleared
        ? "Payment pathway settled or funds released with no urgent balance pressure."
        : "Deposit satisfied with no urgent workflow blockers.",
      blocking_factors: [],
      warning_factors: warnings,
      amount_paid_cents,
      balance_due_cents,
      next_required_action:
        balance_due_cents > 0 ? "Collect remaining balance before surgery window" : null,
      financially_safe_to_proceed: true,
      paid_in_full: false,
      requires_staff_attention: false,
      source_breakdown,
    };
  }

  const pathwayPending =
    input.paymentPathway.hasActivePathway &&
    (hasUnresolvedWorkflowApplications(input) ||
      (input.paymentPathway.pathway_status != null &&
        !["settled", "cancelled"].includes(input.paymentPathway.pathway_status)));

  if (pathwayPending && !hasUrgentAttention) {
    return {
      clearance_state: "pathway_pending",
      clearance_label: FINANCIAL_CLEARANCE_STATE_LABELS.pathway_pending,
      clearance_reason: "Active payment pathway or application is progressing without SLA breach.",
      blocking_factors: [],
      warning_factors: warnings,
      amount_paid_cents,
      balance_due_cents,
      next_required_action: resolveNextRequiredAction("pathway_pending", input, blocking_factors),
      financially_safe_to_proceed: false,
      paid_in_full: false,
      requires_staff_attention: false,
      source_breakdown,
    };
  }

  const notReadyReasons: string[] = [];
  if (!depositSatisfied) notReadyReasons.push("Deposit not collected");
  if (!input.paymentPathway.hasActivePathway) notReadyReasons.push("No payment pathway selected");
  if (input.balance_due_cents > 0 && input.balanceInvoiceState !== "paid") {
    notReadyReasons.push("Surgery invoice unpaid");
  }
  if (input.deposit_pending_for_confirmed_surgery) {
    notReadyReasons.push("Confirmed booking requires deposit before financial confirmation");
  }

  const clearance_reason =
    notReadyReasons.length > 0
      ? notReadyReasons.join("; ")
      : "Financial setup incomplete for this surgery context.";

  return {
    clearance_state: "not_ready",
    clearance_label: FINANCIAL_CLEARANCE_STATE_LABELS.not_ready,
    clearance_reason,
    blocking_factors: notReadyReasons,
    warning_factors: warnings,
    amount_paid_cents,
    balance_due_cents,
    next_required_action: notReadyReasons[0] ?? "Collect deposit and select payment pathway",
    financially_safe_to_proceed: false,
    paid_in_full: false,
    requires_staff_attention: surgeryWithinClearanceWindow(input) && balance_due_cents > 0,
    source_breakdown,
  };
}

export type FinancialClearanceDashboardMetrics = {
  financiallyClearedSurgeries: number;
  attentionRequired: number;
  pathwayPending: number;
  depositReady: number;
  paidInFull: number;
  notReady: number;
  unavailable: number;
  /** Share of upcoming surgeries (next 14 days) in cleared / paid_in_full / deposit_ready states. */
  clearanceRateNext14Days: number | null;
  totalUpcomingSurgeries: number;
};

export function aggregateFinancialClearanceDashboardMetrics(
  results: FinancialClearanceResult[]
): FinancialClearanceDashboardMetrics {
  const counts: Record<FinancialClearanceState, number> = {
    unavailable: 0,
    not_ready: 0,
    deposit_ready: 0,
    pathway_pending: 0,
    attention_required: 0,
    financially_cleared: 0,
    paid_in_full: 0,
  };
  for (const r of results) {
    counts[r.clearance_state] += 1;
  }
  const total = results.length;
  const clearedLike = counts.financially_cleared + counts.paid_in_full + counts.deposit_ready;
  return {
    financiallyClearedSurgeries: counts.financially_cleared,
    attentionRequired: counts.attention_required,
    pathwayPending: counts.pathway_pending,
    depositReady: counts.deposit_ready,
    paidInFull: counts.paid_in_full,
    notReady: counts.not_ready,
    unavailable: counts.unavailable,
    clearanceRateNext14Days: total > 0 ? clearedLike / total : null,
    totalUpcomingSurgeries: total,
  };
}

export function buildFinancialClearanceInputFromPipeline(args: {
  todayYmd: string;
  calendarTimezone: string;
  booking_status: string | null;
  financial_os_status: string | null;
  surgeryDateYmd: string | null;
  dataLoadFailed?: boolean;
  depositInvoiceState: FinancialInvoicePaymentState;
  balanceInvoiceState: FinancialInvoicePaymentState;
  amount_paid_cents: number;
  balance_due_cents: number;
  balance_overdue: boolean;
  balance_due_within_14_days: boolean;
  deposit_pending_for_confirmed_surgery: boolean;
  failed_payment_in_last_60_days: boolean;
  installment_overdue: boolean;
  financialDataAvailable: boolean;
  paymentPathway: PaymentPathwayAttentionSummary;
  pathwayTaskAttention: PathwayTaskAttentionSummary;
  financeApplicationAttention: FinanceApplicationAttentionSummary;
  superReleaseApplicationAttention: SuperReleaseAttentionSummary;
  internationalTransferApplicationAttention: InternationalTransferAttentionSummary;
  financeSlaBreach?: boolean;
  financeRejected?: boolean;
}): BuildFinancialClearanceInput {
  return args;
}

/** Convenience: map a surgery pipeline snapshot into clearance input (Phase 1B hub). */
export function buildFinancialClearanceFromPipelineStatus(args: {
  todayYmd: string;
  calendarTimezone: string;
  booking_status: string | null;
  surgeryDateYmd: string | null;
  dataLoadFailed?: boolean;
  financeSlaBreach?: boolean;
  financeRejected?: boolean;
  pipeline: {
    financialDataAvailable: boolean;
    financial_os_status: string | null;
    depositInvoiceState: FinancialInvoicePaymentState;
    balanceInvoiceState: FinancialInvoicePaymentState;
    amount_paid_cents: number;
    balance_due_cents: number;
    balance_overdue: boolean;
    balance_due_within_14_days: boolean;
    deposit_pending_for_confirmed_surgery: boolean;
    failed_payment_in_last_60_days: boolean;
    installment_overdue: boolean;
    paymentPathway: PaymentPathwayAttentionSummary;
    pathwayTaskAttention: PathwayTaskAttentionSummary;
    financeApplicationAttention: FinanceApplicationAttentionSummary;
    superReleaseApplicationAttention: SuperReleaseAttentionSummary;
    internationalTransferApplicationAttention: InternationalTransferAttentionSummary;
  };
}): FinancialClearanceResult {
  return buildFinancialClearance(
    buildFinancialClearanceInputFromPipeline({
      todayYmd: args.todayYmd,
      calendarTimezone: args.calendarTimezone,
      booking_status: args.booking_status,
      financial_os_status: args.pipeline.financial_os_status,
      surgeryDateYmd: args.surgeryDateYmd,
      dataLoadFailed: args.dataLoadFailed,
      financialDataAvailable: args.pipeline.financialDataAvailable,
      depositInvoiceState: args.pipeline.depositInvoiceState,
      balanceInvoiceState: args.pipeline.balanceInvoiceState,
      amount_paid_cents: args.pipeline.amount_paid_cents,
      balance_due_cents: args.pipeline.balance_due_cents,
      balance_overdue: args.pipeline.balance_overdue,
      balance_due_within_14_days: args.pipeline.balance_due_within_14_days,
      deposit_pending_for_confirmed_surgery: args.pipeline.deposit_pending_for_confirmed_surgery,
      failed_payment_in_last_60_days: args.pipeline.failed_payment_in_last_60_days,
      installment_overdue: args.pipeline.installment_overdue,
      paymentPathway: args.pipeline.paymentPathway,
      pathwayTaskAttention: args.pipeline.pathwayTaskAttention,
      financeApplicationAttention: args.pipeline.financeApplicationAttention,
      superReleaseApplicationAttention: args.pipeline.superReleaseApplicationAttention,
      internationalTransferApplicationAttention:
        args.pipeline.internationalTransferApplicationAttention,
      financeSlaBreach: args.financeSlaBreach,
      financeRejected: args.financeRejected,
    })
  );
}

export function computeClearanceHorizonEndYmd(
  todayYmd: string,
  calendarTimezone: string,
  horizonDays = 14
): string {
  return addDaysToCalendarDate(todayYmd, horizonDays, calendarTimezone);
}
