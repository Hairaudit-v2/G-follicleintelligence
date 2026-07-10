import "server-only";

import { buildExpensePeriodExports } from "@/src/lib/financialOs/expenses/expenseStage6.server";
import { normalizeExpensePeriod } from "@/src/lib/financialOs/expenses/expensePeriodCore";
import { getReportDefinition } from "@/src/lib/reports/reportCatalog";
import type { ReportGenerateResult } from "@/src/lib/reports/reportTypes";

export type ExpenseExportPackFiles = {
  periodStart: string;
  periodEnd: string;
  files: Array<{ filename: string; csv: string; label: string }>;
};

export async function generateExpenseExportPackReport(input: {
  tenantId: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  currency?: string | null;
}): Promise<ReportGenerateResult> {
  const tid = input.tenantId.trim();
  if (!tid) throw new Error("tenantId is required.");
  const def = getReportDefinition("expense_export_pack");
  if (!def) throw new Error("expense_export_pack is not in the report catalog.");

  const { period_start, period_end } = normalizeExpensePeriod({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });
  const currency = (input.currency?.trim() || "AUD").toUpperCase();

  const pack = await buildExpensePeriodExports(tid, {
    periodStart: period_start,
    periodEnd: period_end,
  });

  return {
    reportId: def.id,
    title: def.title,
    periodStart: period_start,
    periodEnd: period_end,
    generatedAt: new Date().toISOString(),
    currency,
    metrics: [
      {
        key: "row_count",
        label: "Expense rows in period",
        value: String(pack.row_count),
        hint: `${period_start} → ${period_end}`,
      },
      {
        key: "posted_count",
        label: "Posted rows (QB/Xero)",
        value: String(pack.posted_count),
      },
      {
        key: "formats",
        label: "Export formats ready",
        value: "3",
        hint: "FI CSV · QuickBooks CSV · Xero CSV",
      },
    ],
    table: {
      columns: [
        { key: "format", label: "Format" },
        { key: "scope", label: "Scope" },
        { key: "status", label: "Status" },
      ],
      rows: [
        {
          format: "FI expenses CSV",
          scope: "All statuses in period",
          status: pack.row_count > 0 ? "Ready" : "Empty",
        },
        {
          format: "QuickBooks CSV",
          scope: "Posted only",
          status: pack.posted_count > 0 ? "Ready" : "Empty",
        },
        {
          format: "Xero CSV",
          scope: "Posted only",
          status: pack.posted_count > 0 ? "Ready" : "Empty",
        },
      ],
    },
    emptyMessage:
      pack.row_count === 0
        ? "No expenses in this period to export. Capture or import expenses under Finances → Expenses."
        : "Click Download CSV pack to save FI, QuickBooks, and Xero files.",
  };
}

export async function buildExpenseExportPackFiles(input: {
  tenantId: string;
  periodStart?: string | null;
  periodEnd?: string | null;
}): Promise<ExpenseExportPackFiles> {
  const tid = input.tenantId.trim();
  const { period_start, period_end } = normalizeExpensePeriod({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });
  const pack = await buildExpensePeriodExports(tid, {
    periodStart: period_start,
    periodEnd: period_end,
  });
  const stamp = `${period_start}_${period_end}`;
  return {
    periodStart: period_start,
    periodEnd: period_end,
    files: [
      {
        filename: `fi-expenses_${stamp}.csv`,
        csv: pack.fi_csv,
        label: "FI expenses",
      },
      {
        filename: `quickbooks-expenses_${stamp}.csv`,
        csv: pack.quickbooks_csv,
        label: "QuickBooks",
      },
      {
        filename: `xero-expenses_${stamp}.csv`,
        csv: pack.xero_csv,
        label: "Xero",
      },
    ],
  };
}
