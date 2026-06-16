/**
 * Derive a positive invoice amount (cents) for RevenueOS "consultation quote" invoices.
 * Prefers explicit consultation quote_data, then parses CRM draft quote snapshots linked to the consultation.
 */
import type { ConsultationRow } from "@/src/lib/consultations/consultationTypes";
import { parseMoneyStringToCentsAud } from "@/src/lib/revenueOs/quoteAmountParse";

export type FiCrmQuoteRowLike = {
  line_items_snapshot?: unknown;
  metadata?: unknown;
  subtotal_amount?: unknown;
  total_amount?: unknown;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function textFromLineItems(raw: unknown): string {
  if (!Array.isArray(raw)) return "";
  const parts: string[] = [];
  for (const item of raw) {
    const o = asRecord(item);
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const desc = typeof o.description === "string" ? o.description.trim() : "";
    const kind = typeof o.kind === "string" ? o.kind.trim() : "";
    const blob = [kind, title, desc].filter(Boolean).join(" ");
    if (blob) parts.push(blob);
  }
  return parts.join("\n\n");
}

function parseNumericMoney(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.round(v * 100);
  const s = String(v).trim();
  if (!s) return null;
  return parseMoneyStringToCentsAud(s);
}

/**
 * Best-effort: returns null when no reliable amount is found (caller must require override or user input).
 */
export function resolveConsultationQuoteInvoiceAmountCents(
  consultation: Pick<ConsultationRow, "quote_data">,
  crmQuotes?: FiCrmQuoteRowLike[] | null
): number | null {
  const qd = consultation.quote_data && typeof consultation.quote_data === "object" ? consultation.quote_data : {};
  const fromPanel = parseMoneyStringToCentsAud(String((qd as { price_quoted?: unknown }).price_quoted ?? ""));
  if (fromPanel != null && fromPanel > 0) return fromPanel;

  const quotes = crmQuotes ?? [];
  for (const q of quotes) {
    const sub = parseNumericMoney(q.subtotal_amount);
    if (sub != null && sub > 0) return sub;
    const tot = parseNumericMoney(q.total_amount);
    if (tot != null && tot > 0) return tot;
    const meta = asRecord(q.metadata);
    const metaHint = parseMoneyStringToCentsAud(String(meta.price_quoted_hint ?? ""));
    if (metaHint != null && metaHint > 0) return metaHint;
    const metaPrice = parseMoneyStringToCentsAud(String(meta.price_quoted ?? ""));
    if (metaPrice != null && metaPrice > 0) return metaPrice;

    const blob = textFromLineItems(q.line_items_snapshot);
    const fromBlob = parseMoneyStringToCentsAud(blob);
    if (fromBlob != null && fromBlob > 0) return fromBlob;
  }

  return null;
}
