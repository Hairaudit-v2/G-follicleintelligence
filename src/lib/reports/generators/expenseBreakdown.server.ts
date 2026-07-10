import "server-only";

import { formatMoneyFromCents } from "@/src/lib/format/money";
import { loadExpenseIntelligenceBundle } from "@/src/lib/financialOs/expenses/expenseIntelligence.server";
import { normalizeExpensePeriod } from "@/src/lib/financialOs/expenses/expensePeriodCore";
import { getReportDefinition } from "@/src/lib/reports/reportCatalog";
import type { ReportGenerateResult } from "@/src/lib/reports/reportTypes";

/**
 * Expense breakdown report — reuses Expenses Capture intelligence (posted spend by category).
 */
export async function generateExpenseBreakdownReport(input: {
  tenantId: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  currency?: string | null;
}): Promise<ReportGenerateResult> {
  const tid = input.tenantId.trim();
  if (!tid) throw new Error("tenantId is required.");

  const def = getReportDefinition("expense_breakdown");
  if (!def) throw new Error("expense_breakdown is not in the report catalog.");

  const { period_start, period_end } = normalizeExpensePeriod({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });

  const bundle = await loadExpenseIntelligenceBundle(tid, {
    periodStart: period_start,
    periodEnd: period_end,
  });

  const spend = bundle.spend;
  const currency = (input.currency?.trim() || "AUD").toUpperCase();

  const metrics = [
    {
      key: "total_spend",
      label: "Total posted spend",
      value: formatMoneyFromCents(spend.total_posted_spend_cents, currency),
      hint: `${period_start} → ${period_end}`,
    },
    {
      key: "expense_count",
      label: "Posted expenses",
      value: String(spend.expense_count),
    },
    {
      key: "categories",
      label: "Categories with spend",
      value: String(spend.by_category.length),
    },
  ];

  const table =
    spend.by_category.length === 0
      ? null
      : {
          columns: [
            { key: "category", label: "Category" },
            { key: "code", label: "Code" },
            { key: "count", label: "Count", align: "right" as const },
            { key: "spend", label: "Spend", align: "right" as const },
            { key: "share", label: "Share", align: "right" as const },
          ],
          rows: spend.by_category.map((row) => ({
            category: row.category_label,
            code: row.category_code,
            count: row.expense_count,
            spend: formatMoneyFromCents(row.spend_cents, currency),
            spend_cents: row.spend_cents,
            share: `${row.pct_of_total}%`,
          })),
        };

  return {
    reportId: def.id,
    title: def.title,
    periodStart: period_start,
    periodEnd: period_end,
    generatedAt: new Date().toISOString(),
    currency,
    metrics,
    table,
    emptyMessage:
      spend.expense_count === 0
        ? "No posted expenses in this period. Post expenses under Finances → Expenses, then generate again."
        : undefined,
  };
}

/** Build a simple FI CSV for expense breakdown rows. */
export function expenseBreakdownToCsv(result: ReportGenerateResult): string {
  const lines: string[] = [];
  lines.push(`Report,${csvEscape(result.title)}`);
  lines.push(`Period,${result.periodStart},${result.periodEnd}`);
  lines.push(`Generated,${result.generatedAt}`);
  lines.push("");
  for (const m of result.metrics) {
    lines.push(`${csvEscape(m.label)},${csvEscape(m.value)}`);
  }
  lines.push("");
  if (result.table && result.table.rows.length > 0) {
    lines.push(result.table.columns.map((c) => csvEscape(c.label)).join(","));
    for (const row of result.table.rows) {
      lines.push(
        result.table.columns
          .map((c) => csvEscape(row[c.key] == null ? "" : String(row[c.key])))
          .join(",")
      );
    }
  } else {
    lines.push("No category rows");
  }
  return lines.join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
