import type { FiInvoiceStatus } from "@/src/lib/revenueOs/revenueInvoiceModel";
import { invoiceBalanceDueCents } from "@/src/lib/revenueOs/revenueInvoiceModel";

export function computeNextInvoiceStatus(
  row: {
    status: FiInvoiceStatus;
    total_cents: number;
    amount_paid_cents: number;
    due_date: string | null;
  },
  todayYmd: string | null
): FiInvoiceStatus {
  if (row.status === "cancelled" || row.status === "refunded" || row.status === "draft") return row.status;
  const bal = invoiceBalanceDueCents(row);
  if (bal <= 0 && row.total_cents > 0) return "paid";
  if (row.amount_paid_cents > 0 && bal > 0) return "partially_paid";
  if (row.status === "issued" || row.status === "partially_paid" || row.status === "overdue") {
    const due = row.due_date?.trim();
    if (due && todayYmd && due < todayYmd && bal > 0) return "overdue";
    if (row.status === "overdue" && due && todayYmd && due >= todayYmd) return "issued";
    return row.status === "overdue" ? "overdue" : "issued";
  }
  return row.status;
}

/** Invoice line + tax total (single-line invoices use this shape in tests). */
export function invoiceLineTotalCents(amountCents: number, taxCents: number): number {
  return Math.max(0, Math.floor(amountCents)) + Math.max(0, Math.floor(taxCents));
}

export function invoiceAmountPaidAfterAllocation(currentPaidCents: number, paymentCents: number): number {
  return Math.max(0, Math.floor(currentPaidCents)) + Math.max(0, Math.floor(paymentCents));
}

export function deriveCaseDepositReadinessBlock(ruleBlocksSurgeryWhenUnpaid: boolean, hasUnpaidOpenDeposit: boolean): boolean {
  return Boolean(ruleBlocksSurgeryWhenUnpaid && hasUnpaidOpenDeposit);
}
