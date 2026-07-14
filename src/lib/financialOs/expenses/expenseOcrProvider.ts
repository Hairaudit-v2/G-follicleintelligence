import {
  buildOcrResult,
  emptyOcrFields,
  extractExpenseFieldsFromText,
  type ExpenseOcrResult,
  type FiExpenseOcrProviderId,
} from "./expenseOcrCore";

export type ExpenseOcrProviderEnvSlice = Partial<
  Record<
    | "FI_EXPENSE_OCR_PROVIDER"
    | "FI_EXPENSE_OCR_MIN_CONFIDENCE"
    | "OPENAI_API_KEY"
    | "OPENAI_EXPENSE_OCR_MODEL"
    | "OPENAI_PATHOLOGY_EXTRACTION_MODEL",
    string
  >
>;

export type ExpenseOcrInput = {
  bytes: Uint8Array;
  contentType: string;
  filename?: string | null;
};

export interface ExpenseOcrProviderAdapter {
  readonly providerId: FiExpenseOcrProviderId;
  isConfigured(env?: ExpenseOcrProviderEnvSlice): boolean;
  extract(input: ExpenseOcrInput, env?: ExpenseOcrProviderEnvSlice): Promise<ExpenseOcrResult>;
}

export function resolveExpenseOcrProviderIdFromEnv(
  env: ExpenseOcrProviderEnvSlice = process.env as ExpenseOcrProviderEnvSlice
): FiExpenseOcrProviderId {
  const raw = env.FI_EXPENSE_OCR_PROVIDER?.trim().toLowerCase();
  if (raw === "openai_vision" || raw === "openai") return "openai_vision";
  return "stub";
}

export function readExpenseOcrMinConfidenceFromEnv(
  env: ExpenseOcrProviderEnvSlice = process.env as ExpenseOcrProviderEnvSlice
): number {
  const raw = env.FI_EXPENSE_OCR_MIN_CONFIDENCE?.trim();
  if (!raw) return 0.55;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0.55;
  return Math.min(1, Math.max(0, n));
}

export function isOpenAiExpenseOcrConfigured(
  env: ExpenseOcrProviderEnvSlice = process.env as ExpenseOcrProviderEnvSlice
): boolean {
  return Boolean(env.OPENAI_API_KEY?.trim());
}

/** Extract printable ASCII from PDF-ish bytes (same spirit as pathology stub). */
export function extractAsciiTextFromBytes(bytes: Uint8Array, maxChars = 12000): string {
  let out = "";
  for (let i = 0; i < bytes.length && out.length < maxChars; i++) {
    const c = bytes[i]!;
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126)) {
      out += String.fromCharCode(c);
    } else if (out.length > 0 && !out.endsWith(" ")) {
      out += " ";
    }
  }
  return out
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Stub provider — always available.
 * Uses ASCII extraction for PDFs/text; images require manual review unless OpenAI is configured.
 */
export class StubExpenseOcrProvider implements ExpenseOcrProviderAdapter {
  readonly providerId = "stub" as const;

  isConfigured(): boolean {
    return true;
  }

  async extract(
    input: ExpenseOcrInput,
    env: ExpenseOcrProviderEnvSlice = process.env as ExpenseOcrProviderEnvSlice
  ): Promise<ExpenseOcrResult> {
    const started = Date.now();
    const min = readExpenseOcrMinConfidenceFromEnv(env);
    const ct = (input.contentType || "").toLowerCase();

    if (ct.startsWith("text/") || ct === "text/csv") {
      const raw = new TextDecoder("utf-8", { fatal: false }).decode(input.bytes);
      const { fields, confidence } = extractExpenseFieldsFromText(raw);
      return buildOcrResult({
        provider: "stub",
        fields,
        confidence,
        raw_text: raw.slice(0, 8000),
        latency_ms: Date.now() - started,
        min_confidence: min,
      });
    }

    if (ct === "application/pdf" || input.filename?.toLowerCase().endsWith(".pdf")) {
      const raw = extractAsciiTextFromBytes(input.bytes);
      const { fields, confidence } = extractExpenseFieldsFromText(raw);
      return buildOcrResult({
        provider: "stub",
        fields,
        confidence: Math.min(confidence, raw.length > 40 ? confidence : 0.15),
        raw_text: raw.slice(0, 8000) || null,
        latency_ms: Date.now() - started,
        min_confidence: min,
      });
    }

    // Image without live vision model: queue for manual entry / later OpenAI.
    return buildOcrResult({
      provider: "stub",
      fields: emptyOcrFields(),
      confidence: 0.1,
      raw_text: null,
      error_message: null,
      latency_ms: Date.now() - started,
      min_confidence: min,
    });
  }
}

export function getStubExpenseOcrProvider(): StubExpenseOcrProvider {
  return new StubExpenseOcrProvider();
}
