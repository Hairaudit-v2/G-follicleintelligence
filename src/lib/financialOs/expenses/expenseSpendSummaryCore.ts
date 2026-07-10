/**
 * Pure spend-by-category aggregation for FinancialOS Stage 5.
 */

export type ExpenseSpendInput = {
  amount_cents: number;
  expense_date: string;
  status: string;
  category_code: string | null;
  category_label: string | null;
};

export type ExpenseCategorySpendRow = {
  category_code: string;
  category_label: string;
  spend_cents: number;
  expense_count: number;
  pct_of_total: number;
};

export type ExpenseSpendSummary = {
  period_start: string;
  period_end: string;
  total_posted_spend_cents: number;
  expense_count: number;
  by_category: ExpenseCategorySpendRow[];
};

function inDateRangeYmd(dateYmd: string, start: string, end: string): boolean {
  const d = dateYmd.slice(0, 10);
  return d >= start.slice(0, 10) && d <= end.slice(0, 10);
}

export function aggregateExpenseSpendByCategory(input: {
  period_start: string;
  period_end: string;
  expenses: readonly ExpenseSpendInput[];
}): ExpenseSpendSummary {
  const period_start = input.period_start.slice(0, 10);
  const period_end = input.period_end.slice(0, 10);

  const byCode = new Map<
    string,
    { label: string; spend_cents: number; expense_count: number }
  >();
  let total_posted_spend_cents = 0;
  let expense_count = 0;

  for (const exp of input.expenses) {
    if (exp.status !== "posted") continue;
    if (!inDateRangeYmd(exp.expense_date, period_start, period_end)) continue;
    const amount = Math.max(0, Math.floor(exp.amount_cents));
    total_posted_spend_cents += amount;
    expense_count += 1;
    const code = (exp.category_code ?? "uncategorized").trim().toLowerCase() || "uncategorized";
    const label = exp.category_label?.trim() || code;
    const prev = byCode.get(code) ?? { label, spend_cents: 0, expense_count: 0 };
    prev.spend_cents += amount;
    prev.expense_count += 1;
    if (exp.category_label?.trim()) prev.label = exp.category_label.trim();
    byCode.set(code, prev);
  }

  const by_category: ExpenseCategorySpendRow[] = [...byCode.entries()]
    .map(([category_code, v]) => ({
      category_code,
      category_label: v.label,
      spend_cents: v.spend_cents,
      expense_count: v.expense_count,
      pct_of_total:
        total_posted_spend_cents > 0
          ? Math.round((v.spend_cents / total_posted_spend_cents) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.spend_cents - a.spend_cents || a.category_code.localeCompare(b.category_code));

  return {
    period_start,
    period_end,
    total_posted_spend_cents,
    expense_count,
    by_category,
  };
}
