import type { FiInvoiceRow, FiPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import { invoiceBalanceDueCents } from "@/src/lib/revenueOs/revenueInvoiceModel";

export type PublicPaymentRequestUiState =
  | "invalid"
  | "payable"
  | "paid"
  | "expired"
  | "cancelled"
  | "manual_contact";

/** Hex token generated server-side (see `revenueInvoiceMutations`); avoids path traversal / odd chars. */
export function isPaymentPublicTokenFormat(raw: string | null | undefined): boolean {
  const s = raw?.trim() ?? "";
  return /^[a-f0-9]{24,64}$/i.test(s);
}

export function derivePublicPaymentPageState(input: {
  paymentRequest: FiPaymentRequestRow;
  invoice: Pick<FiInvoiceRow, "total_cents" | "amount_paid_cents" | "status">;
  nowMs: number;
  stripeCheckoutEnabled: boolean;
}): Exclude<PublicPaymentRequestUiState, "invalid"> {
  const { paymentRequest: pr, invoice: inv, nowMs, stripeCheckoutEnabled } = input;
  if (pr.status === "cancelled") return "cancelled";
  const bal = invoiceBalanceDueCents(inv);
  if (bal <= 0 || pr.status === "paid" || inv.status === "paid") return "paid";

  const ex = pr.expires_at?.trim();
  if (ex) {
    const t = new Date(ex).getTime();
    if (Number.isFinite(t) && t < nowMs) return "expired";
  }
  if (pr.status === "expired") return "expired";

  if (!stripeCheckoutEnabled || !pr.checkout_url?.trim()) return "manual_contact";
  return "payable";
}
