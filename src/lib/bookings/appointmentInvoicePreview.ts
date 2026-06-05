import type { FiBookingRow } from "./types";

export type AppointmentInvoiceLineItem = {
  label: string;
  amount: string | null;
};

export type AppointmentInvoicePreview = {
  reference: string | null;
  status: string | null;
  currency: string | null;
  subtotalLabel: string | null;
  totalLabel: string | null;
  lineItems: AppointmentInvoiceLineItem[];
  notes: string | null;
};

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Reads optional invoice stub from `fi_bookings.metadata` until a billing module exists. */
export function parseAppointmentInvoicePreview(booking: FiBookingRow): AppointmentInvoicePreview {
  const meta = booking.metadata ?? {};
  const inv = meta.invoice;
  const block = inv && typeof inv === "object" && !Array.isArray(inv) ? (inv as Record<string, unknown>) : meta;

  const lineItems: AppointmentInvoiceLineItem[] = [];
  const rawLines = block.line_items ?? block.lineItems;
  if (Array.isArray(rawLines)) {
    for (const item of rawLines) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const r = item as Record<string, unknown>;
      const label = strOrNull(r.label ?? r.description);
      if (!label) continue;
      lineItems.push({
        label,
        amount: strOrNull(r.amount ?? r.total),
      });
    }
  }

  if (lineItems.length === 0 && booking.booking_type === "surgery") {
    const graft = strOrNull(meta.graft_count_estimate);
    lineItems.push({
      label: graft ? `Procedure (${graft} grafts est.)` : "Hair transplant procedure",
      amount: strOrNull(block.total ?? block.amount),
    });
  }

  return {
    reference: strOrNull(block.reference ?? block.invoice_number ?? booking.id.slice(0, 8)),
    status: strOrNull(block.status) ?? "draft",
    currency: strOrNull(block.currency) ?? "GBP",
    subtotalLabel: strOrNull(block.subtotal),
    totalLabel: strOrNull(block.total ?? block.amount),
    lineItems,
    notes: strOrNull(block.notes ?? block.memo),
  };
}
