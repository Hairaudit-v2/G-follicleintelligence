import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createPaymentRequestForInvoice } from "@/src/lib/revenueOs/revenueInvoiceMutations.server";
import { mapInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceMappers";
import {
  invoiceBalanceDueCents,
  isInvoiceOpenForCollection,
} from "@/src/lib/revenueOs/revenueInvoiceModel";

/**
 * FinancialOS deposit path: create a (Stripe) payment request for a consultation quote invoice
 * and mark the linked booking as `deposit_pending` when a booking exists.
 * Does not change ConsultationOS quote acceptance — staff-triggered from FinancialOS only.
 */
export async function startConsultationQuoteDepositPaymentRequest(args: {
  tenantId: string;
  invoiceId: string;
  depositAmountCents: number;
  sendCheckout: boolean;
}): Promise<{ paymentRequestId: string; bookingId: string | null }> {
  const tid = args.tenantId.trim();
  const iid = args.invoiceId.trim();
  if (!tid || !iid) throw new Error("tenantId and invoiceId are required.");

  const supabase = supabaseAdmin();
  const { data: raw, error } = await supabase
    .from("fi_invoices")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", iid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!raw) throw new Error("Invoice not found.");
  const inv = mapInvoiceRow(raw as Record<string, unknown>);
  if (inv.invoice_kind !== "consultation_quote")
    throw new Error("Only consultation quote invoices support this deposit flow.");
  if (!isInvoiceOpenForCollection(inv.status))
    throw new Error("Invoice is not open for collection.");

  const bal = invoiceBalanceDueCents(inv);
  const dep = Math.max(0, Math.floor(args.depositAmountCents));
  if (!dep) throw new Error("depositAmountCents must be positive.");
  if (dep > bal) throw new Error("Deposit exceeds invoice balance due.");

  const pr = await createPaymentRequestForInvoice({
    tenantId: tid,
    invoiceId: iid,
    amountCents: dep,
    taxCents: 0,
    send: args.sendCheckout,
    staffNote: "FinancialOS consultation deposit",
  });

  let bookingId: string | null = null;
  const cid = inv.consultation_id?.trim();
  if (cid) {
    const { data: cRow } = await supabase
      .from("fi_consultations")
      .select("booking_id")
      .eq("tenant_id", tid)
      .eq("id", cid)
      .maybeSingle();
    bookingId = (cRow as { booking_id?: string | null } | null)?.booking_id?.trim() || null;
    if (bookingId) {
      const now = new Date().toISOString();
      await supabase
        .from("fi_bookings")
        .update({
          financial_os_status: "deposit_pending",
          updated_at: now,
        })
        .eq("tenant_id", tid)
        .eq("id", bookingId);
    }
  }

  return { paymentRequestId: pr.id, bookingId };
}

export async function setBookingFinancialOsStatus(args: {
  tenantId: string;
  bookingId: string;
  status: "tentative" | "deposit_pending" | "confirmed" | "paid_in_full";
}): Promise<void> {
  const supabase = supabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("fi_bookings")
    .update({ financial_os_status: args.status, updated_at: now })
    .eq("tenant_id", args.tenantId.trim())
    .eq("id", args.bookingId.trim());
  if (error) throw new Error(error.message);
}
