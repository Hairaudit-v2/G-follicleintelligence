import "server-only";

import {
  getStubExpenseOcrProvider,
  isOpenAiExpenseOcrConfigured,
  resolveExpenseOcrProviderIdFromEnv,
  type ExpenseOcrProviderAdapter,
  type ExpenseOcrProviderEnvSlice,
} from "@/src/lib/financialOs/expenses/expenseOcrProvider";
import { OpenAiVisionExpenseOcrProvider } from "@/src/lib/financialOs/expenses/expenseOcrProviderOpenAi.server";

/**
 * Resolve OCR adapter. Defaults to stub.
 * When FI_EXPENSE_OCR_PROVIDER=openai_vision and OPENAI_API_KEY is set, uses vision model.
 * If openai is requested but not configured, falls back to stub (never throws).
 */
export function resolveExpenseOcrProvider(
  env: ExpenseOcrProviderEnvSlice = process.env as ExpenseOcrProviderEnvSlice
): ExpenseOcrProviderAdapter {
  const requested = resolveExpenseOcrProviderIdFromEnv(env);
  if (requested === "openai_vision" && isOpenAiExpenseOcrConfigured(env)) {
    return new OpenAiVisionExpenseOcrProvider();
  }
  return getStubExpenseOcrProvider();
}
