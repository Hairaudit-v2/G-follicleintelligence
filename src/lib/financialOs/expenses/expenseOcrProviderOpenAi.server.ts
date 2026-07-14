import "server-only";

import { z } from "zod";

import {
  buildOcrResult,
  emptyOcrFields,
  type ExpenseOcrResult,
} from "@/src/lib/financialOs/expenses/expenseOcrCore";
import {
  extractAsciiTextFromBytes,
  isOpenAiExpenseOcrConfigured,
  readExpenseOcrMinConfidenceFromEnv,
  type ExpenseOcrInput,
  type ExpenseOcrProviderAdapter,
  type ExpenseOcrProviderEnvSlice,
} from "@/src/lib/financialOs/expenses/expenseOcrProvider";
import { parseFlexibleDateToYmd } from "@/src/lib/financialOs/expenses/expenseCsvParse";
import { suggestCategoryCodeFromText } from "@/src/lib/financialOs/expenses/expenseCategories";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

const openAiExpenseSchema = z.object({
  vendor_name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  expense_date: z.string().nullable().optional(),
  amount_major: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  tax_major: z.number().nullable().optional(),
  invoice_number: z.string().nullable().optional(),
  confidence: z.number().nullable().optional(),
});

function expenseOcrModel(env: ExpenseOcrProviderEnvSlice): string {
  return (
    env.OPENAI_EXPENSE_OCR_MODEL?.trim() ||
    env.OPENAI_PATHOLOGY_EXTRACTION_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export class OpenAiVisionExpenseOcrProvider implements ExpenseOcrProviderAdapter {
  readonly providerId = "openai_vision" as const;

  isConfigured(
    env: ExpenseOcrProviderEnvSlice = process.env as ExpenseOcrProviderEnvSlice
  ): boolean {
    return isOpenAiExpenseOcrConfigured(env);
  }

  async extract(
    input: ExpenseOcrInput,
    env: ExpenseOcrProviderEnvSlice = process.env as ExpenseOcrProviderEnvSlice
  ): Promise<ExpenseOcrResult> {
    const started = Date.now();
    const min = readExpenseOcrMinConfidenceFromEnv(env);
    const apiKey = env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return buildOcrResult({
        provider: "openai_vision",
        fields: emptyOcrFields(),
        confidence: 0,
        raw_text: null,
        error_message: "OPENAI_API_KEY not configured.",
        latency_ms: Date.now() - started,
        min_confidence: min,
      });
    }

    const ct = (input.contentType || "application/octet-stream").toLowerCase();
    const system = `You extract structured fields from clinic expense receipts/invoices.
Return ONLY JSON with keys: vendor_name, description, expense_date (YYYY-MM-DD), amount_major (number), currency (ISO), tax_major, invoice_number, confidence (0-1).
Amounts are major units (dollars), not cents. Prefer AUD when ambiguous.`;

    type ContentPart =
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } };

    const userContent: ContentPart[] = [
      {
        type: "text",
        text: `Filename: ${input.filename ?? "unknown"}. Extract expense fields.`,
      },
    ];

    if (ct.startsWith("image/")) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${ct};base64,${bytesToBase64(input.bytes)}` },
      });
    } else {
      const ascii = extractAsciiTextFromBytes(input.bytes, 10000);
      userContent.push({
        type: "text",
        text: ascii
          ? `Document text extract:\n${ascii}`
          : "Binary document with no extractable ASCII; return null fields and low confidence.",
      });
    }

    try {
      const res = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: expenseOcrModel(env),
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: userContent },
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return buildOcrResult({
          provider: "openai_vision",
          fields: emptyOcrFields(),
          confidence: 0,
          raw_text: null,
          error_message: `OpenAI HTTP ${res.status}: ${errText.slice(0, 200)}`,
          latency_ms: Date.now() - started,
          min_confidence: min,
        });
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content ?? "{}";
      const parsedJson = JSON.parse(content) as unknown;
      const parsed = openAiExpenseSchema.safeParse(parsedJson);
      if (!parsed.success) {
        return buildOcrResult({
          provider: "openai_vision",
          fields: emptyOcrFields(),
          confidence: 0.2,
          raw_text: content.slice(0, 2000),
          error_message: "OpenAI response did not match schema.",
          latency_ms: Date.now() - started,
          min_confidence: min,
        });
      }

      const d = parsed.data;
      const amountMajor = d.amount_major;
      const amount_cents =
        amountMajor != null && Number.isFinite(amountMajor)
          ? Math.round(Math.abs(amountMajor) * 100)
          : null;
      const tax_cents =
        d.tax_major != null && Number.isFinite(d.tax_major)
          ? Math.round(Math.abs(d.tax_major) * 100)
          : null;
      const expense_date = d.expense_date ? parseFlexibleDateToYmd(d.expense_date) : null;
      const vendor_name = d.vendor_name?.trim() || null;
      const description = d.description?.trim() || null;
      const suggested = suggestCategoryCodeFromText(
        [vendor_name, description].filter(Boolean).join(" ")
      );

      return buildOcrResult({
        provider: "openai_vision",
        fields: {
          vendor_name,
          description,
          expense_date,
          amount_cents,
          currency: d.currency?.trim().toUpperCase() || "AUD",
          tax_cents,
          invoice_number: d.invoice_number?.trim() || null,
          suggested_category_code: suggested,
        },
        confidence: d.confidence ?? 0.7,
        raw_text: content.slice(0, 4000),
        latency_ms: Date.now() - started,
        min_confidence: min,
      });
    } catch (e) {
      return buildOcrResult({
        provider: "openai_vision",
        fields: emptyOcrFields(),
        confidence: 0,
        raw_text: null,
        error_message: e instanceof Error ? e.message : "OpenAI OCR failed.",
        latency_ms: Date.now() - started,
        min_confidence: min,
      });
    }
  }
}
