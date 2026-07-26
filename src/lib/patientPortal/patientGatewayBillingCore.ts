/**
 * FI-PATIENT-APP-1E — patient-safe billing/invoice translation (pure).
 * Amounts are major currency units derived from FiOS cents (never client-supplied).
 */

import {
  invoiceBalanceDueCents,
  isInvoiceOpenForCollection,
  type FiInvoiceItemRow,
  type FiInvoiceRow,
  type FiInvoiceStatus,
} from "@/src/lib/revenueOs/revenueInvoiceModel";

export const PATIENT_GATEWAY_INVOICE_STATUSES = [
  "draft",
  "outstanding",
  "partially_paid",
  "paid",
  "overdue",
  "void",
  "refunded",
] as const;

export type PatientGatewayInvoiceStatus = (typeof PATIENT_GATEWAY_INVOICE_STATUSES)[number];

export type PatientGatewayPaymentStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "refunded";

export type PatientGatewayBillingSummary = {
  ok: true;
  currency: string;
  outstandingBalance: number;
  paidTotal: number;
  nextPaymentDue: {
    amount: number;
    dueAt: string | null;
    invoiceId: string;
  } | null;
  hasOutstandingBalance: boolean;
};

export type PatientGatewayInvoiceListItem = {
  id: string;
  number: string | null;
  title: string | null;
  status: PatientGatewayInvoiceStatus;
  issuedAt: string | null;
  dueAt: string | null;
  currency: string;
  total: number;
  paid: number;
  outstanding: number;
  canPay: boolean;
};

export type PatientGatewayInvoiceLineItem = {
  description: string;
  quantity: number;
  amount: number;
};

export type PatientGatewayPaymentItem = {
  id: string;
  amount: number;
  currency: string;
  status: PatientGatewayPaymentStatus;
  paidAt: string | null;
  methodLabel: string;
};

export type PatientGatewayInvoiceDetail = PatientGatewayInvoiceListItem & {
  lineItems: PatientGatewayInvoiceLineItem[];
  payments: PatientGatewayPaymentItem[];
};

/** Convert FiOS integer cents → major units (AUD dollars). Deterministic. */
export function centsToMajor(cents: number): number {
  return Math.round(cents) / 100;
}

export function mapFiInvoiceStatusToPatient(
  status: FiInvoiceStatus | string
): PatientGatewayInvoiceStatus {
  const s = String(status).trim().toLowerCase();
  if (s === "draft") return "draft";
  if (s === "partially_paid") return "partially_paid";
  if (s === "paid") return "paid";
  if (s === "overdue") return "overdue";
  if (s === "cancelled" || s === "canceled") return "void";
  if (s === "refunded") return "refunded";
  if (s === "sent" || s === "awaiting_payment" || s === "issued") return "outstanding";
  return "outstanding";
}

export function mapGatewayPaymentStatusToPatient(
  status: string
): PatientGatewayPaymentStatus {
  const s = status.trim().toLowerCase();
  if (s === "succeeded" || s === "manually_recorded") return "succeeded";
  if (s === "failed") return "failed";
  if (s === "refunded") return "refunded";
  return "pending";
}

export function invoiceCanPay(
  inv: Pick<FiInvoiceRow, "status" | "total_cents" | "amount_paid_cents">,
  paymentsEnabled: boolean
): boolean {
  if (!paymentsEnabled) return false;
  if (!isInvoiceOpenForCollection(inv.status)) return false;
  return invoiceBalanceDueCents(inv) > 0;
}

export function mapInvoiceToPatientListItem(
  inv: FiInvoiceRow,
  paymentsEnabled: boolean
): PatientGatewayInvoiceListItem {
  const outstandingCents = invoiceBalanceDueCents(inv);
  return {
    id: inv.id,
    number: inv.invoice_number,
    title: inv.title,
    status: mapFiInvoiceStatusToPatient(inv.status),
    issuedAt: inv.issued_at ?? inv.sent_at,
    dueAt: inv.due_date,
    currency: inv.currency.trim().toUpperCase() || "AUD",
    total: centsToMajor(inv.total_cents),
    paid: centsToMajor(inv.amount_paid_cents),
    outstanding: centsToMajor(outstandingCents),
    canPay: invoiceCanPay(inv, paymentsEnabled),
  };
}

export function mapInvoiceItemsToPatientLineItems(
  items: readonly FiInvoiceItemRow[]
): PatientGatewayInvoiceLineItem[] {
  return [...items]
    .sort((a, b) => a.sort_index - b.sort_index)
    .map((item) => ({
      description: item.description,
      quantity: item.quantity,
      amount: centsToMajor(item.line_total_cents),
    }));
}

export function buildPatientGatewayBillingSummary(
  invoices: readonly FiInvoiceRow[],
  paymentsEnabled: boolean
): PatientGatewayBillingSummary {
  let outstandingCents = 0;
  let paidCents = 0;
  let currency = "AUD";
  let next: { amountCents: number; dueAt: string | null; invoiceId: string } | null = null;

  for (const inv of invoices) {
    if (inv.currency) currency = inv.currency.trim().toUpperCase() || currency;
    paidCents += Math.max(0, inv.amount_paid_cents);
    if (!isInvoiceOpenForCollection(inv.status)) continue;
    const bal = invoiceBalanceDueCents(inv);
    if (bal <= 0) continue;
    outstandingCents += bal;
    if (!next) {
      next = { amountCents: bal, dueAt: inv.due_date, invoiceId: inv.id };
    } else if (inv.due_date && (!next.dueAt || inv.due_date < next.dueAt)) {
      next = { amountCents: bal, dueAt: inv.due_date, invoiceId: inv.id };
    }
  }

  void paymentsEnabled;

  return {
    ok: true,
    currency,
    outstandingBalance: centsToMajor(outstandingCents),
    paidTotal: centsToMajor(paidCents),
    nextPaymentDue: next
      ? {
          amount: centsToMajor(next.amountCents),
          dueAt: next.dueAt,
          invoiceId: next.invoiceId,
        }
      : null,
    hasOutstandingBalance: outstandingCents > 0,
  };
}

/** Detect staff/finance-only field leakage in serialized patient payloads. */
export function billingPayloadExposesInternalFields(payload: unknown): boolean {
  const serialized = JSON.stringify(payload);
  const forbidden = [
    "amount_cents",
    "tax_cents",
    "total_cents",
    "amount_paid_cents",
    "automation_hints",
    "metadata",
    "lead_id",
    "case_id",
    "clinic_id",
    "consultation_id",
    "public_token",
    "provider_checkout_session_id",
    "stripe_session",
    "staff_note",
    "remaining_balance_cents",
    "days_overdue",
  ];
  return forbidden.some((k) => serialized.includes(`"${k}"`));
}

/**
 * Validate optional client payment claims against server-derived values.
 * Absent claims are ignored; mismatched claims deny.
 */
export function validateClientPaymentClaims(input: {
  clientAmountMajor: number | null | undefined;
  clientCurrency: string | null | undefined;
  serverAmountCents: number;
  serverCurrency: string;
}): { ok: true } | { ok: false; code: "amount_mismatch" | "currency_mismatch"; message: string } {
  if (input.clientCurrency != null && String(input.clientCurrency).trim()) {
    const claimed = String(input.clientCurrency).trim().toUpperCase();
    const server = input.serverCurrency.trim().toUpperCase();
    if (claimed !== server) {
      return {
        ok: false,
        code: "currency_mismatch",
        message: "Currency must match the invoice currency derived server-side.",
      };
    }
  }
  if (input.clientAmountMajor != null && Number.isFinite(input.clientAmountMajor)) {
    const claimedCents = Math.round(Number(input.clientAmountMajor) * 100);
    if (claimedCents !== input.serverAmountCents) {
      return {
        ok: false,
        code: "amount_mismatch",
        message: "Payment amount must match the server-derived outstanding balance.",
      };
    }
  }
  return { ok: true };
}
