import type { FiInvoiceStatus } from "@/src/lib/revenueOs/revenueInvoiceModel";
import {
  invoiceBalanceDueCents,
  normalizeInvoiceStatusValue,
} from "@/src/lib/revenueOs/revenueInvoiceModel";

function collectibleBaseStatus(status: FiInvoiceStatus): FiInvoiceStatus {
  const normalized = normalizeInvoiceStatusValue(status);
  if (normalized === "sent") return "awaiting_payment";
  return normalized;
}

export function computeNextInvoiceStatus(
  row: {
    status: FiInvoiceStatus | string;
    total_cents: number;
    amount_paid_cents: number;
    due_date: string | null;
  },
  todayYmd: string | null
): FiInvoiceStatus {
  const status = normalizeInvoiceStatusValue(String(row.status));
  if (status === "cancelled" || status === "refunded" || status === "draft") return status;
  const bal = invoiceBalanceDueCents(row);
  if (bal <= 0 && row.total_cents > 0) return "paid";
  if (row.amount_paid_cents > 0 && bal > 0) return "partially_paid";
  if (
    status === "awaiting_payment" ||
    status === "sent" ||
    status === "partially_paid" ||
    status === "overdue"
  ) {
    const due = row.due_date?.trim();
    if (due && todayYmd && due < todayYmd && bal > 0) return "overdue";
    if (status === "overdue" && due && todayYmd && due >= todayYmd) {
      return collectibleBaseStatus(status);
    }
    if (status === "overdue") return "overdue";
    return status === "sent" ? "sent" : "awaiting_payment";
  }
  return status;
}

/** Invoice line + tax total (single-line invoices use this shape in tests). */
export function invoiceLineTotalCents(amountCents: number, taxCents: number): number {
  return Math.max(0, Math.floor(amountCents)) + Math.max(0, Math.floor(taxCents));
}

export function invoiceAmountPaidAfterAllocation(
  currentPaidCents: number,
  paymentCents: number
): number {
  return Math.max(0, Math.floor(currentPaidCents)) + Math.max(0, Math.floor(paymentCents));
}

export function deriveCaseDepositReadinessBlock(
  ruleBlocksSurgeryWhenUnpaid: boolean,
  hasUnpaidOpenDeposit: boolean
): boolean {
  return Boolean(ruleBlocksSurgeryWhenUnpaid && hasUnpaidOpenDeposit);
}
