import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertAllowedExpenseDocumentFile,
  buildExpenseDocumentStoragePath,
  FI_FINANCIAL_DOCUMENTS_BUCKET,
} from "@/src/lib/financialOs/expenses/expenseDocumentStorageCore";
import {
  buildOcrResult,
  extractExpenseFieldsFromText,
  ocrResultToExpenseDraft,
} from "@/src/lib/financialOs/expenses/expenseOcrCore";
import {
  extractAsciiTextFromBytes,
  getStubExpenseOcrProvider,
  resolveExpenseOcrProviderIdFromEnv,
} from "@/src/lib/financialOs/expenses/expenseOcrProvider";

describe("expenseDocumentStorageCore", () => {
  it("allows pdf and jpeg within size limit", () => {
    assert.equal(assertAllowedExpenseDocumentFile({ size: 100, type: "application/pdf" }).ok, true);
    assert.equal(assertAllowedExpenseDocumentFile({ size: 100, type: "image/jpeg" }).ok, true);
    assert.equal(assertAllowedExpenseDocumentFile({ size: 0, type: "image/jpeg" }).ok, false);
  });

  it("builds tenant-prefixed storage paths", () => {
    const path = buildExpenseDocumentStoragePath({
      tenantId: "tenant-a",
      expenseId: "exp-1",
      documentId: "doc-1",
      originalFilename: "Office Rent.pdf",
      contentType: "application/pdf",
    });
    assert.equal(path.startsWith("tenant-a/expenses/exp-1/doc-1/"), true);
    assert.equal(path.endsWith(".pdf"), true);
    assert.equal(FI_FINANCIAL_DOCUMENTS_BUCKET, "fi-financial-documents");
  });
});

describe("expenseOcrCore", () => {
  it("extracts total amount and date from receipt-like text", () => {
    const text = [
      "META PLATFORMS IRELAND",
      "Invoice date: 01/07/2026",
      "Invoice # INV-9988",
      "Total: $250.00 AUD",
    ].join("\n");
    const { fields, confidence } = extractExpenseFieldsFromText(text);
    assert.equal(fields.amount_cents, 25000);
    assert.equal(fields.expense_date, "2026-07-01");
    assert.equal(fields.suggested_category_code, "marketing_ads");
    assert.ok((confidence ?? 0) >= 0.5);
  });

  it("builds draft with review reasons when amount missing", () => {
    const result = buildOcrResult({
      provider: "stub",
      fields: {
        vendor_name: "Cafe",
        description: null,
        expense_date: null,
        amount_cents: null,
        currency: null,
        tax_cents: null,
        invoice_number: null,
        suggested_category_code: null,
      },
      confidence: 0.2,
      raw_text: "Cafe",
      latency_ms: 1,
      min_confidence: 0.55,
    });
    const draft = ocrResultToExpenseDraft(result, { fallbackDateYmd: "2026-07-10" });
    assert.equal(draft.needs_review, true);
    assert.equal(draft.expense_date, "2026-07-10");
    assert.equal(draft.amount_cents, 0);
    assert.ok(draft.review_reasons.length > 0);
  });
});

describe("expenseOcrProvider stub", () => {
  it("defaults provider id to stub", () => {
    assert.equal(resolveExpenseOcrProviderIdFromEnv({}), "stub");
    assert.equal(
      resolveExpenseOcrProviderIdFromEnv({ FI_EXPENSE_OCR_PROVIDER: "openai_vision" }),
      "openai_vision"
    );
  });

  it("extracts fields from text bytes via stub", async () => {
    const provider = getStubExpenseOcrProvider();
    const raw = "Officeworks\nDate: 2026-07-01\nTotal: $12.50";
    const result = await provider.extract({
      bytes: new TextEncoder().encode(raw),
      contentType: "text/plain",
      filename: "note.txt",
    });
    assert.equal(result.provider, "stub");
    assert.equal(result.fields.amount_cents, 1250);
    assert.equal(result.fields.expense_date, "2026-07-01");
  });

  it("extracts ascii from binary-ish buffer", () => {
    const s = extractAsciiTextFromBytes(new TextEncoder().encode("Hello\x00World Total: $1.00"));
    assert.match(s, /Hello/);
    assert.match(s, /World/);
  });
});
