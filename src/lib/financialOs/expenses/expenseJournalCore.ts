/**
 * Pure double-entry journal construction for expense post/void (Stage 8).
 */

export type JournalSide = "debit" | "credit";

export type JournalLineDraft = {
  side: JournalSide;
  amount_cents: number;
  gl_account_code: string;
  gl_account_name: string;
  gl_account_id?: string | null;
  line_memo?: string | null;
  sort_order: number;
};

export type JournalEntryDraft = {
  entry_date: string;
  memo: string;
  source: "expense_post" | "expense_void";
  currency: string;
  lines: JournalLineDraft[];
  total_debit_cents: number;
  total_credit_cents: number;
  balanced: boolean;
};

export function isJournalBalanced(lines: readonly JournalLineDraft[]): boolean {
  let d = 0;
  let c = 0;
  for (const l of lines) {
    const a = Math.max(0, Math.floor(l.amount_cents));
    if (l.side === "debit") d += a;
    else c += a;
  }
  return d === c && d > 0;
}

/**
 * Post expense: Dr expense GL, Cr cash/AP (funding account).
 */
export function buildExpensePostJournal(input: {
  expense_date: string;
  amount_cents: number;
  currency?: string;
  expense_gl: { code: string; name: string; id?: string | null };
  funding_gl: { code: string; name: string; id?: string | null };
  memo?: string | null;
}): JournalEntryDraft {
  const amount = Math.max(0, Math.floor(input.amount_cents));
  const lines: JournalLineDraft[] = [
    {
      side: "debit",
      amount_cents: amount,
      gl_account_code: input.expense_gl.code,
      gl_account_name: input.expense_gl.name,
      gl_account_id: input.expense_gl.id ?? null,
      line_memo: input.memo ?? "Expense",
      sort_order: 0,
    },
    {
      side: "credit",
      amount_cents: amount,
      gl_account_code: input.funding_gl.code,
      gl_account_name: input.funding_gl.name,
      gl_account_id: input.funding_gl.id ?? null,
      line_memo: "Payment / clearing",
      sort_order: 1,
    },
  ];
  return {
    entry_date: input.expense_date.slice(0, 10),
    memo: input.memo?.trim() || "Expense posted",
    source: "expense_post",
    currency: (input.currency || "AUD").toUpperCase(),
    lines,
    total_debit_cents: amount,
    total_credit_cents: amount,
    balanced: isJournalBalanced(lines),
  };
}

/**
 * Void expense: reverse — Dr funding, Cr expense GL.
 */
export function buildExpenseVoidJournal(input: {
  expense_date: string;
  amount_cents: number;
  currency?: string;
  expense_gl: { code: string; name: string; id?: string | null };
  funding_gl: { code: string; name: string; id?: string | null };
  memo?: string | null;
}): JournalEntryDraft {
  const amount = Math.max(0, Math.floor(input.amount_cents));
  const lines: JournalLineDraft[] = [
    {
      side: "debit",
      amount_cents: amount,
      gl_account_code: input.funding_gl.code,
      gl_account_name: input.funding_gl.name,
      gl_account_id: input.funding_gl.id ?? null,
      line_memo: "Void reverse funding",
      sort_order: 0,
    },
    {
      side: "credit",
      amount_cents: amount,
      gl_account_code: input.expense_gl.code,
      gl_account_name: input.expense_gl.name,
      gl_account_id: input.expense_gl.id ?? null,
      line_memo: input.memo ?? "Expense voided",
      sort_order: 1,
    },
  ];
  return {
    entry_date: input.expense_date.slice(0, 10),
    memo: input.memo?.trim() || "Expense void reversal",
    source: "expense_void",
    currency: (input.currency || "AUD").toUpperCase(),
    lines,
    total_debit_cents: amount,
    total_credit_cents: amount,
    balanced: isJournalBalanced(lines),
  };
}

export function fundingGlForPaymentMethod(
  paymentMethod: string | null | undefined
): { code: string; name: string } {
  const m = (paymentMethod ?? "").toLowerCase();
  if (m === "card" || m === "bank" || m === "direct_debit" || m === "cash") {
    return { code: "1000", name: "Cash & bank" };
  }
  return { code: "2000", name: "Accounts payable" };
}
