/**
 * Bank import line ↔ posted expense matching (Stage 6 scaffold).
 * Pure heuristics — amount + date (±days) + optional external_ref.
 */

export type BankReconLineInput = {
  id: string;
  transaction_date: string | null;
  amount_cents: number;
  external_ref: string | null;
  description_raw: string | null;
  vendor_name: string | null;
  status: string;
};

export type BankReconExpenseInput = {
  id: string;
  expense_date: string;
  amount_cents: number;
  vendor_name: string | null;
  description: string | null;
  status: string;
  source_import_line_id: string | null;
};

export type BankReconMatch = {
  line_id: string;
  expense_id: string;
  confidence: number;
  reason: string;
};

export type BankReconResult = {
  matches: BankReconMatch[];
  unmatched_line_ids: string[];
  unmatched_expense_ids: string[];
};

function ymdToUtcMs(ymd: string | null): number | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd.slice(0, 10))) return null;
  const t = Date.parse(`${ymd.slice(0, 10)}T00:00:00.000Z`);
  return Number.isFinite(t) ? t : null;
}

function daysBetween(a: string | null, b: string | null): number | null {
  const am = ymdToUtcMs(a);
  const bm = ymdToUtcMs(b);
  if (am == null || bm == null) return null;
  return Math.abs(am - bm) / (24 * 60 * 60 * 1000);
}

function normVendor(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Greedy matching: prefer source_import_line_id, then external uniqueness, then amount+date.
 */
export function matchBankLinesToExpenses(input: {
  lines: readonly BankReconLineInput[];
  expenses: readonly BankReconExpenseInput[];
  maxDateSkewDays?: number;
}): BankReconResult {
  const maxSkew = input.maxDateSkewDays ?? 3;
  const matches: BankReconMatch[] = [];
  const usedLines = new Set<string>();
  const usedExpenses = new Set<string>();

  const postedExpenses = input.expenses.filter((e) => e.status === "posted" || e.status === "reviewed");
  const openLines = input.lines.filter(
    (l) => l.status === "draft" || l.status === "accepted" || l.status === "committed"
  );

  // 1) Exact import-line linkage already on expense
  for (const exp of postedExpenses) {
    if (!exp.source_import_line_id || usedExpenses.has(exp.id)) continue;
    const line = openLines.find((l) => l.id === exp.source_import_line_id);
    if (!line || usedLines.has(line.id)) continue;
    matches.push({
      line_id: line.id,
      expense_id: exp.id,
      confidence: 1,
      reason: "source_import_line_id",
    });
    usedLines.add(line.id);
    usedExpenses.add(exp.id);
  }

  // 2) Amount + date + vendor
  for (const line of openLines) {
    if (usedLines.has(line.id)) continue;
    let best: BankReconMatch | null = null;
    for (const exp of postedExpenses) {
      if (usedExpenses.has(exp.id)) continue;
      if (Math.floor(exp.amount_cents) !== Math.floor(line.amount_cents)) continue;
      const skew = daysBetween(line.transaction_date, exp.expense_date);
      if (skew == null || skew > maxSkew) continue;
      let confidence = 0.55;
      let reason = "amount_date";
      if (skew === 0) confidence += 0.2;
      const lv = normVendor(line.vendor_name || line.description_raw);
      const ev = normVendor(exp.vendor_name || exp.description);
      if (lv && ev && (lv.includes(ev) || ev.includes(lv))) {
        confidence += 0.2;
        reason = "amount_date_vendor";
      }
      if (!best || confidence > best.confidence) {
        best = { line_id: line.id, expense_id: exp.id, confidence, reason };
      }
    }
    if (best && best.confidence >= 0.55) {
      matches.push(best);
      usedLines.add(best.line_id);
      usedExpenses.add(best.expense_id);
    }
  }

  return {
    matches,
    unmatched_line_ids: openLines.filter((l) => !usedLines.has(l.id)).map((l) => l.id),
    unmatched_expense_ids: postedExpenses.filter((e) => !usedExpenses.has(e.id)).map((e) => e.id),
  };
}
