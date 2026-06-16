/**
 * Derive a positive invoice amount (cents) for RevenueOS "consultation quote" invoices.
 * Prefers explicit consultation quote_data, then parses CRM draft quote snapshots linked to the consultation.
 */
import type { ConsultationRow } from "@/src/lib/consultations/consultationTypes";
import { parseMoneyStringToCentsAud } from "@/src/lib/revenueOs/quoteAmountParse";

export type FiCrmQuoteRowLike = {
  id?: unknown;
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

function quoteRowUuid(q: FiCrmQuoteRowLike): string | null {
  const raw = q.id;
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) return null;
  return s;
}

export type ConsultationQuoteInvoiceSource = {
  amountCents: number | null;
  /** `fi_crm_quotes.id` when a CRM quote row informed the amount or is the primary draft for this consultation. */
  crmQuoteId: string | null;
};

/**
 * Best-effort amount + CRM quote linkage for RevenueOS consultation-quote invoices.
 */
export function resolveConsultationQuoteInvoiceSource(
  consultation: Pick<ConsultationRow, "quote_data">,
  crmQuotes?: FiCrmQuoteRowLike[] | null
): ConsultationQuoteInvoiceSource {
  const qd = consultation.quote_data && typeof consultation.quote_data === "object" ? consultation.quote_data : {};
  const quotes = crmQuotes ?? [];
  const primaryQuoteId = quotes.length ? quoteRowUuid(quotes[0]!) : null;

  const fromPanel = parseMoneyStringToCentsAud(String((qd as { price_quoted?: unknown }).price_quoted ?? ""));
  if (fromPanel != null && fromPanel > 0) {
    return { amountCents: fromPanel, crmQuoteId: primaryQuoteId };
  }

  for (const q of quotes) {
    const qid = quoteRowUuid(q);
    const sub = parseNumericMoney(q.subtotal_amount);
    if (sub != null && sub > 0) return { amountCents: sub, crmQuoteId: qid };
    const tot = parseNumericMoney(q.total_amount);
    if (tot != null && tot > 0) return { amountCents: tot, crmQuoteId: qid };
    const meta = asRecord(q.metadata);
    const metaHint = parseMoneyStringToCentsAud(String(meta.price_quoted_hint ?? ""));
    if (metaHint != null && metaHint > 0) return { amountCents: metaHint, crmQuoteId: qid };
    const metaPrice = parseMoneyStringToCentsAud(String(meta.price_quoted ?? ""));
    if (metaPrice != null && metaPrice > 0) return { amountCents: metaPrice, crmQuoteId: qid };

    const blob = textFromLineItems(q.line_items_snapshot);
    const fromBlob = parseMoneyStringToCentsAud(blob);
    if (fromBlob != null && fromBlob > 0) return { amountCents: fromBlob, crmQuoteId: qid };
  }

  return { amountCents: null, crmQuoteId: null };
}

/**
 * Best-effort: returns null when no reliable amount is found (caller must require override or user input).
 */
export function resolveConsultationQuoteInvoiceAmountCents(
  consultation: Pick<ConsultationRow, "quote_data">,
  crmQuotes?: FiCrmQuoteRowLike[] | null
): number | null {
  return resolveConsultationQuoteInvoiceSource(consultation, crmQuotes).amountCents;
}
