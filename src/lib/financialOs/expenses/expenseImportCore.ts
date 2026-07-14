import type { ExpenseCsvParsedLine } from "@/src/lib/financialOs/expenses/expenseCsvParse";
import { suggestCategoryCodeFromText } from "@/src/lib/financialOs/expenses/expenseCategories";
import type { FiExpenseImportLineStatus } from "@/src/lib/financialOs/expenses/expenseTypes";

export type CategoryCodeToId = ReadonlyMap<string, string>;

export type ExpenseImportLineDraft = {
  line_index: number;
  status: FiExpenseImportLineStatus;
  transaction_date: string | null;
  description_raw: string | null;
  amount_cents: number;
  currency: string;
  external_ref: string | null;
  merchant_hint: string | null;
  vendor_name: string | null;
  suggested_category_code: string | null;
  suggested_category_id: string | null;
  parse_warnings: string[];
  metadata: Record<string, unknown>;
};

export function buildImportLineDraftsFromCsv(
  lines: readonly ExpenseCsvParsedLine[],
  categoryCodeToId?: CategoryCodeToId
): ExpenseImportLineDraft[] {
  return lines.map((line) => {
    const suggestText = [line.merchantHint, line.descriptionRaw].filter(Boolean).join(" ");
    const code = suggestCategoryCodeFromText(suggestText);
    const suggestedId =
      code && categoryCodeToId ? (categoryCodeToId.get(code.toLowerCase()) ?? null) : null;

    return {
      line_index: line.lineIndex,
      status: "draft" as const,
      transaction_date: line.transactionDate,
      description_raw: line.descriptionRaw,
      amount_cents: Math.max(0, Math.floor(line.amountCents)),
      currency: line.currency || "AUD",
      external_ref: line.externalRef,
      merchant_hint: line.merchantHint,
      vendor_name: line.merchantHint,
      suggested_category_code: code,
      suggested_category_id: suggestedId,
      parse_warnings: [...line.warnings],
      metadata: { raw: line.raw },
    };
  });
}

export type CommitLineEligibility = { ok: true } | { ok: false; reason: string };

export function assertImportLineCommitEligible(input: {
  status: string;
  amount_cents: number;
  transaction_date: string | null;
}): CommitLineEligibility {
  if (input.status === "committed") {
    return { ok: false, reason: "Line already committed." };
  }
  if (input.status === "rejected" || input.status === "duplicate") {
    return { ok: false, reason: `Line status ${input.status} cannot be committed.` };
  }
  if (!Number.isFinite(input.amount_cents) || input.amount_cents < 0) {
    return { ok: false, reason: "Invalid amount." };
  }
  if (!input.transaction_date || !/^\d{4}-\d{2}-\d{2}$/.test(input.transaction_date)) {
    return { ok: false, reason: "Transaction date is required (YYYY-MM-DD)." };
  }
  return { ok: true };
}

export function resolveCommitStatuses(
  lines: readonly { id: string; status: string }[],
  options: { lineIds?: readonly string[] | null; commitAllAccepted?: boolean }
): string[] {
  if (options.commitAllAccepted) {
    return lines.filter((l) => l.status === "accepted" || l.status === "draft").map((l) => l.id);
  }
  const wanted = new Set((options.lineIds ?? []).map((id) => id.trim()).filter(Boolean));
  return lines.filter((l) => wanted.has(l.id)).map((l) => l.id);
}
