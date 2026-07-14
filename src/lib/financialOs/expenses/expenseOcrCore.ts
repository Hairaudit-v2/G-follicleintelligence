/**
 * Pure OCR result shaping for expense receipts (no DB / network).
 */

import { parseAmountToSignedMajor, parseFlexibleDateToYmd } from "./expenseCsvParse";
import { suggestCategoryCodeFromText } from "./expenseCategories";

export const FI_EXPENSE_OCR_PROVIDERS = ["stub", "openai_vision"] as const;
export type FiExpenseOcrProviderId = (typeof FI_EXPENSE_OCR_PROVIDERS)[number];

export type ExpenseOcrExtractedFields = {
  vendor_name: string | null;
  description: string | null;
  expense_date: string | null;
  amount_cents: number | null;
  currency: string | null;
  tax_cents: number | null;
  invoice_number: string | null;
  suggested_category_code: string | null;
};

export type ExpenseOcrResult = {
  provider: FiExpenseOcrProviderId;
  ocr_status: "succeeded" | "failed" | "skipped";
  confidence: number | null;
  requires_manual_review: boolean;
  raw_text: string | null;
  fields: ExpenseOcrExtractedFields;
  error_message: string | null;
  latency_ms: number;
};

export type ExpenseDraftFromOcr = {
  expense_date: string;
  amount_cents: number;
  currency: string;
  vendor_name: string | null;
  description: string | null;
  suggested_category_code: string | null;
  status: "draft";
  needs_review: boolean;
  review_reasons: string[];
};

function clamp01(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n));
}

export function emptyOcrFields(): ExpenseOcrExtractedFields {
  return {
    vendor_name: null,
    description: null,
    expense_date: null,
    amount_cents: null,
    currency: null,
    tax_cents: null,
    invoice_number: null,
    suggested_category_code: null,
  };
}

/**
 * Heuristic extraction from free text (PDF ASCII / OCR dump).
 * Best-effort; always pairs with requires_manual_review when confidence low.
 */
export function extractExpenseFieldsFromText(rawText: string): {
  fields: ExpenseOcrExtractedFields;
  confidence: number;
} {
  const text = rawText.trim();
  if (!text) {
    return { fields: emptyOcrFields(), confidence: 0 };
  }

  let amountCents: number | null = null;
  let currency: string | null = null;

  // Prefer TOTAL / amount / AUD lines
  const totalPatterns = [
    /(?:total|amount\s*due|grand\s*total|balance\s*due)\s*[:\s]*\$?\s*([\d,]+\.\d{2})/i,
    /\$\s*([\d,]+\.\d{2})\s*(?:aud|total)?/i,
    /([\d,]+\.\d{2})\s*AUD/i,
  ];
  for (const re of totalPatterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const major = parseAmountToSignedMajor(m[1]);
      if (major != null && major !== 0) {
        amountCents = Math.round(Math.abs(major) * 100);
        currency = "AUD";
        break;
      }
    }
  }

  let expenseDate: string | null = null;
  const datePatterns = [
    /(?:date|invoice\s*date|receipt\s*date)\s*[:\s]*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    /(?:date|invoice\s*date)\s*[:\s]*(\d{4}-\d{2}-\d{2})/i,
    /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/,
    /\b(\d{4}-\d{2}-\d{2})\b/,
  ];
  for (const re of datePatterns) {
    const m = text.match(re);
    if (m?.[1]) {
      expenseDate = parseFlexibleDateToYmd(m[1]);
      if (expenseDate) break;
    }
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const vendor_name = lines[0]?.slice(0, 200) || null;

  let invoice_number: string | null = null;
  const inv = text.match(/(?:invoice|receipt)\s*(?:#|no\.?|number)?\s*[:\s]*([A-Z0-9\-]{3,})/i);
  if (inv?.[1]) invoice_number = inv[1].slice(0, 80);

  const description = lines.slice(0, 3).join(" · ").slice(0, 500) || null;
  const suggested = suggestCategoryCodeFromText(
    [vendor_name, description].filter(Boolean).join(" ")
  );

  let confidence = 0.2;
  if (amountCents != null) confidence += 0.35;
  if (expenseDate) confidence += 0.25;
  if (vendor_name) confidence += 0.1;
  if (invoice_number) confidence += 0.05;

  return {
    fields: {
      vendor_name,
      description,
      expense_date: expenseDate,
      amount_cents: amountCents,
      currency,
      tax_cents: null,
      invoice_number,
      suggested_category_code: suggested,
    },
    confidence: clamp01(confidence) ?? 0,
  };
}

export function buildOcrResult(input: {
  provider: FiExpenseOcrProviderId;
  fields: ExpenseOcrExtractedFields;
  confidence: number | null;
  raw_text: string | null;
  error_message?: string | null;
  latency_ms: number;
  min_confidence?: number;
}): ExpenseOcrResult {
  const min = input.min_confidence ?? 0.55;
  const conf = clamp01(input.confidence);
  const failed = Boolean(input.error_message);
  const requires =
    failed ||
    conf == null ||
    conf < min ||
    input.fields.amount_cents == null ||
    !input.fields.expense_date;

  return {
    provider: input.provider,
    ocr_status: failed ? "failed" : "succeeded",
    confidence: conf,
    requires_manual_review: requires,
    raw_text: input.raw_text,
    fields: input.fields,
    error_message: input.error_message ?? null,
    latency_ms: input.latency_ms,
  };
}

export function ocrResultToExpenseDraft(
  result: ExpenseOcrResult,
  options?: { fallbackDateYmd?: string }
): ExpenseDraftFromOcr {
  const reasons: string[] = [];
  const today = options?.fallbackDateYmd ?? new Date().toISOString().slice(0, 10);

  if (result.ocr_status === "failed") {
    reasons.push(result.error_message || "OCR failed.");
  }
  if (result.fields.amount_cents == null) reasons.push("Amount not detected.");
  if (!result.fields.expense_date) reasons.push("Date not detected.");
  if (result.requires_manual_review) reasons.push("Manual review required.");

  return {
    expense_date: result.fields.expense_date || today,
    amount_cents: result.fields.amount_cents ?? 0,
    currency: (result.fields.currency || "AUD").toUpperCase(),
    vendor_name: result.fields.vendor_name,
    description: result.fields.description,
    suggested_category_code: result.fields.suggested_category_code,
    status: "draft",
    needs_review: reasons.length > 0 || result.requires_manual_review,
    review_reasons: reasons,
  };
}

export function ocrResultToPayload(result: ExpenseOcrResult): Record<string, unknown> {
  return {
    provider: result.provider,
    ocr_status: result.ocr_status,
    confidence: result.confidence,
    requires_manual_review: result.requires_manual_review,
    raw_text: result.raw_text,
    fields: result.fields,
    error_message: result.error_message,
    latency_ms: result.latency_ms,
    extracted_at: new Date().toISOString(),
  };
}

export function mapExpenseDocumentRow(raw: Record<string, unknown>): {
  id: string;
  tenant_id: string;
  expense_id: string | null;
  import_id: string | null;
  doc_kind: string;
  storage_bucket: string;
  storage_path: string;
  content_type: string | null;
  byte_size: number | null;
  ocr_status: string;
  ocr_provider: string | null;
  ocr_payload: Record<string, unknown>;
  created_by_fi_user_id: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
} {
  const ocr_payload =
    raw.ocr_payload && typeof raw.ocr_payload === "object" && !Array.isArray(raw.ocr_payload)
      ? (raw.ocr_payload as Record<string, unknown>)
      : {};
  const metadata =
    raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : {};
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    expense_id: raw.expense_id != null ? String(raw.expense_id) : null,
    import_id: raw.import_id != null ? String(raw.import_id) : null,
    doc_kind: String(raw.doc_kind ?? "receipt"),
    storage_bucket: String(raw.storage_bucket ?? ""),
    storage_path: String(raw.storage_path ?? ""),
    content_type: raw.content_type != null ? String(raw.content_type) : null,
    byte_size: raw.byte_size != null ? Number(raw.byte_size) : null,
    ocr_status: String(raw.ocr_status ?? "none"),
    ocr_provider: raw.ocr_provider != null ? String(raw.ocr_provider) : null,
    ocr_payload,
    created_by_fi_user_id:
      raw.created_by_fi_user_id != null ? String(raw.created_by_fi_user_id) : null,
    created_at: String(raw.created_at ?? ""),
    metadata,
  };
}

export type FiExpenseDocumentRow = ReturnType<typeof mapExpenseDocumentRow>;
