import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiInvoiceKind, FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import { invoiceBalanceDueCents } from "@/src/lib/revenueOs/revenueInvoiceModel";

type FinancialOsBookingStatus = "tentative" | "deposit_pending" | "confirmed" | "paid_in_full";

async function resolveBookingIdForInvoice(
  tenantId: string,
  invoice: FiInvoiceRow
): Promise<string | null> {
  const supabase = supabaseAdmin();
  const cid = invoice.consultation_id?.trim();
  if (cid) {
    const { data, error } = await supabase
      .from("fi_consultations")
      .select("booking_id")
      .eq("tenant_id", tenantId)
      .eq("id", cid)
      .maybeSingle();
    if (error) return null;
    const bid = (data as { booking_id?: string | null } | null)?.booking_id?.trim();
    return bid || null;
  }
  return null;
}

function nextFinancialStatusForPaidInvoice(invoice: FiInvoiceRow): FinancialOsBookingStatus | null {
  const bal = invoiceBalanceDueCents(invoice);
  const kind = invoice.invoice_kind as FiInvoiceKind;

  if (kind === "consultation_quote") {
    if (bal <= 0) return "paid_in_full";
    if (invoice.amount_paid_cents > 0) return "deposit_pending";
    return null;
  }
  if (kind === "surgery_deposit" && bal <= 0) return "confirmed";
  if (kind === "surgery_balance" && bal <= 0) return "paid_in_full";
  return null;
}

/**
 * Best-effort: updates `fi_bookings.financial_os_status` when an invoice payment settles,
 * using consultation → booking linkage only (no ConsultationOS app mutations).
 */
export async function syncFinancialOsAfterInvoiceSettlement(args: {
  tenantId: string;
  invoice: FiInvoiceRow;
}): Promise<void> {
  const tid = args.tenantId.trim();
  if (!tid) return;

  const bookingId = await resolveBookingIdForInvoice(tid, args.invoice);
  if (!bookingId) return;

  const next = nextFinancialStatusForPaidInvoice(args.invoice);
  if (!next) return;

  const supabase = supabaseAdmin();
  const { data: row, error: le } = await supabase
    .from("fi_bookings")
    .select("id, financial_os_status")
    .eq("tenant_id", tid)
    .eq("id", bookingId)
    .maybeSingle();
  if (le || !row) return;

  const prev = (row as { financial_os_status?: string | null }).financial_os_status?.trim() || null;

  const rank: Record<FinancialOsBookingStatus, number> = {
    tentative: 0,
    deposit_pending: 1,
    confirmed: 2,
    paid_in_full: 3,
  };
  const validPrev = (Object.keys(rank) as FinancialOsBookingStatus[]).includes(
    prev as FinancialOsBookingStatus
  );
  const prevRank = validPrev ? rank[prev as FinancialOsBookingStatus] : -1;
  if (rank[next] <= prevRank) return;

  const now = new Date().toISOString();
  await supabase
    .from("fi_bookings")
    .update({
      financial_os_status: next,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", bookingId);
}
