/**
 * Pure FinancialOS surgery pipeline status (Phase 1B) — safe for unit tests without DB.
 * Booking operational status is separate from `financial_os_status` overlay.
 */

import { addDaysToCalendarDate } from "@/src/lib/calendar/calendarTimezone";
import type { FiInvoiceRow, FiPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import { invoiceBalanceDueCents, isInvoiceOpenForCollection } from "@/src/lib/revenueOs/revenueInvoiceModel";

export const FINANCIAL_SURGERY_PIPELINE_UNAVAILABLE_COPY = "Financial status unavailable" as const;

export type FinancialInvoicePaymentState = "none" | "paid" | "pending" | "overdue" | "not_applicable";

export type FinancialSurgeryPipelineStatus = {
  /** False when resolver failed or there is no FinancialOS / revenue signal for this context. */
  financialDataAvailable: boolean;
  financial_os_status: string | null;
  depositInvoiceState: FinancialInvoicePaymentState;
  balanceInvoiceState: FinancialInvoicePaymentState;
  amount_paid_cents: number;
  balance_due_cents: number;
  currency: string;
  next_payment_due_date: string | null;
  balance_overdue: boolean;
  balance_due_within_14_days: boolean;
  deposit_pending_for_confirmed_surgery: boolean;
  failed_payment_in_last_60_days: boolean;
  installment_overdue: boolean;
  installment_active: boolean;
  payment_attention_required: boolean;
  latest_payment_request_status: string | null;
  /** Short label for chips, e.g. "Paid in full", "Payment attention". */
  summary_label: string;
};

function ymd(s: string | null | undefined): string | null {
  const t = s?.trim();
  if (!t) return null;
  return t.length >= 10 ? t.slice(0, 10) : t;
}

function invoiceMatchesBookingContext(inv: FiInvoiceRow, caseId: string | null, patientId: string | null): boolean {
  const cid = caseId?.trim() || null;
  const pid = patientId?.trim() || null;
  if (cid) {
    return inv.case_id?.trim() === cid;
  }
  if (!pid) return false;
  if (inv.patient_id?.trim() !== pid) return false;
  return !inv.case_id?.trim();
}

function isSurgeryRevenueKind(inv: FiInvoiceRow): boolean {
  return inv.invoice_kind === "surgery_deposit" || inv.invoice_kind === "surgery_balance";
}

function depositOpen(inv: FiInvoiceRow): boolean {
  return inv.invoice_kind === "surgery_deposit" && isInvoiceOpenForCollection(inv.status) && invoiceBalanceDueCents(inv) > 0;
}

function balanceOpen(inv: FiInvoiceRow): boolean {
  return inv.invoice_kind === "surgery_balance" && isInvoiceOpenForCollection(inv.status) && invoiceBalanceDueCents(inv) > 0;
}

function invoiceOverdue(inv: FiInvoiceRow, todayYmd: string): boolean {
  if (!isInvoiceOpenForCollection(inv.status)) return false;
  if (invoiceBalanceDueCents(inv) <= 0) return false;
  if (inv.status === "overdue") return true;
  const due = ymd(inv.due_date);
  return Boolean(due && due < todayYmd);
}

function balanceDueWithinHorizon(inv: FiInvoiceRow, todayYmd: string, horizonYmd: string): boolean {
  if (inv.invoice_kind !== "surgery_balance") return false;
  if (!isInvoiceOpenForCollection(inv.status)) return false;
  if (invoiceBalanceDueCents(inv) <= 0) return false;
  const due = ymd(inv.due_date);
  if (!due) return false;
  return due >= todayYmd && due <= horizonYmd;
}

export type BuildFinancialSurgeryPipelineStatusInput = {
  todayYmd: string;
  calendarTimezone: string;
  booking_status: string | null;
  financial_os_status: string | null;
  case_id: string | null;
  patient_id: string | null;
  invoices: FiInvoiceRow[];
  paymentRequests: FiPaymentRequestRow[];
  /** Payments touching invoices in context (any status). */
  payments: Array<{ invoice_id: string; status: string; created_at: string }>;
  installmentPlans: Array<{
    invoice_id: string;
    status: string;
    next_payment_date: string | null;
    remaining_balance: number;
  }>;
};

function foldInvoiceStates(
  kind: "surgery_deposit" | "surgery_balance",
  ctxInvoices: FiInvoiceRow[],
  todayYmd: string
): FinancialInvoicePaymentState {
  const rows = ctxInvoices.filter((i) => i.invoice_kind === kind);
  if (rows.length === 0) return "none";
  const open = rows.filter((i) => isInvoiceOpenForCollection(i.status) && invoiceBalanceDueCents(i) > 0);
  if (open.length === 0) return "paid";
  if (kind === "surgery_balance") {
    if (open.some((i) => invoiceOverdue(i, todayYmd))) return "overdue";
  }
  return "pending";
}

/**
 * Derives surgery pipeline financial snapshot for a single booking (or case-only context with synthetic booking fields).
 */
export function buildFinancialSurgeryPipelineStatus(input: BuildFinancialSurgeryPipelineStatusInput): FinancialSurgeryPipelineStatus {
  const {
    todayYmd,
    calendarTimezone,
    booking_status,
    financial_os_status,
    case_id,
    patient_id,
    invoices,
    paymentRequests,
    payments,
    installmentPlans,
  } = input;

  const fos = financial_os_status?.trim() || null;
  const ctxInvoices = invoices.filter((inv) => isSurgeryRevenueKind(inv) && invoiceMatchesBookingContext(inv, case_id, patient_id));

  const hasExplicitSignal =
    Boolean(fos) ||
    ctxInvoices.length > 0 ||
    paymentRequests.some((pr) => ctxInvoices.some((i) => i.id === pr.invoice_id)) ||
    installmentPlans.some((p) => ctxInvoices.some((i) => i.id === p.invoice_id));

  const horizonYmd = addDaysToCalendarDate(todayYmd, 14, calendarTimezone);

  if (!hasExplicitSignal) {
    return {
      financialDataAvailable: false,
      financial_os_status: null,
      depositInvoiceState: "not_applicable",
      balanceInvoiceState: "not_applicable",
      amount_paid_cents: 0,
      balance_due_cents: 0,
      currency: "AUD",
      next_payment_due_date: null,
      balance_overdue: false,
      balance_due_within_14_days: false,
      deposit_pending_for_confirmed_surgery: false,
      failed_payment_in_last_60_days: false,
      installment_overdue: false,
      installment_active: false,
      payment_attention_required: false,
      latest_payment_request_status: null,
      summary_label: FINANCIAL_SURGERY_PIPELINE_UNAVAILABLE_COPY,
    };
  }

  const currency = ctxInvoices[0]?.currency?.trim().toUpperCase() || "AUD";

  let amount_paid_cents = 0;
  let balance_due_cents = 0;
  for (const inv of ctxInvoices) {
    amount_paid_cents += Math.max(0, inv.amount_paid_cents ?? 0);
    if (isInvoiceOpenForCollection(inv.status)) {
      balance_due_cents += invoiceBalanceDueCents(inv);
    }
  }

  const depositInvoiceState = foldInvoiceStates("surgery_deposit", ctxInvoices, todayYmd);
  const balanceInvoiceState = foldInvoiceStates("surgery_balance", ctxInvoices, todayYmd);

  const balanceRows = ctxInvoices.filter((i) => i.invoice_kind === "surgery_balance");
  const balance_overdue = balanceRows.some((i) => invoiceOverdue(i, todayYmd));
  const balance_due_within_14_days = balanceRows.some((i) => balanceDueWithinHorizon(i, todayYmd, horizonYmd));

  const invIds = new Set(ctxInvoices.map((i) => i.id));
  const ctxPrs = paymentRequests.filter((pr) => invIds.has(pr.invoice_id));
  const latest_payment_request_status =
    ctxPrs.length === 0
      ? null
      : [...ctxPrs].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.status?.trim() ?? null;

  const failedCutoff = new Date();
  failedCutoff.setUTCDate(failedCutoff.getUTCDate() - 60);
  const failedIso = failedCutoff.toISOString();
  const failed_payment_in_last_60_days = payments.some(
    (p) =>
      invIds.has(p.invoice_id) &&
      String(p.status ?? "").toLowerCase() === "failed" &&
      String(p.created_at ?? "").trim() >= failedIso
  );

  const ctxPlans = installmentPlans.filter((p) => invIds.has(p.invoice_id) && String(p.status ?? "").toLowerCase() === "active");
  const installment_active = ctxPlans.some((p) => Number(p.remaining_balance ?? 0) > 0);
  const installment_overdue = ctxPlans.some((p) => {
    const next = ymd(p.next_payment_date);
    const rem = Number(p.remaining_balance ?? 0);
    return Boolean(next && next < todayYmd && rem > 0);
  });

  const bookingSt = String(booking_status ?? "").trim().toLowerCase();
  const depositPendingFromInvoices = ctxInvoices.some((i) => depositOpen(i));
  const deposit_pending_for_confirmed_surgery =
    bookingSt === "confirmed" && (depositPendingFromInvoices || fos === "deposit_pending");

  const payment_attention_required =
    deposit_pending_for_confirmed_surgery ||
    balance_due_within_14_days ||
    balance_overdue ||
    failed_payment_in_last_60_days ||
    installment_overdue;

  const dueCandidates: string[] = [];
  for (const inv of ctxInvoices) {
    if (!isInvoiceOpenForCollection(inv.status)) continue;
    if (invoiceBalanceDueCents(inv) <= 0) continue;
    const d = ymd(inv.due_date);
    if (d) dueCandidates.push(d);
  }
  for (const p of ctxPlans) {
    const d = ymd(p.next_payment_date);
    if (d && Number(p.remaining_balance ?? 0) > 0) dueCandidates.push(d);
  }
  const next_payment_due_date = dueCandidates.length ? dueCandidates.sort()[0]! : null;

  let summary_label = "Review finances";
  if (fos === "paid_in_full" && balance_due_cents <= 0 && !depositPendingFromInvoices) {
    summary_label = "Paid in full";
  } else if (payment_attention_required) {
    summary_label = "Payment attention required";
  } else if (balance_due_cents <= 0 && depositInvoiceState === "paid" && balanceInvoiceState === "paid") {
    summary_label = "Paid in full";
  } else if (balanceInvoiceState === "overdue") {
    summary_label = "Balance overdue";
  } else if (installment_active) {
    summary_label = "Installment plan active";
  } else if (fos === "confirmed") {
    summary_label = "Financially confirmed";
  } else if (fos === "deposit_pending") {
    summary_label = "Deposit pending";
  } else if (fos === "tentative") {
    summary_label = "Tentative";
  }

  return {
    financialDataAvailable: true,
    financial_os_status: fos,
    depositInvoiceState,
    balanceInvoiceState,
    amount_paid_cents,
    balance_due_cents,
    currency,
    next_payment_due_date,
    balance_overdue,
    balance_due_within_14_days,
    deposit_pending_for_confirmed_surgery,
    failed_payment_in_last_60_days,
    installment_overdue,
    installment_active,
    payment_attention_required,
    latest_payment_request_status,
    summary_label,
  };
}
