import "server-only";

import { formatMoneyFromCents } from "@/src/lib/format/money";
import { normalizeExpensePeriod } from "@/src/lib/financialOs/expenses/expensePeriodCore";
import { loadOperatingPlSummary } from "@/src/lib/financialOs/expenses/expenseStage6.server";
import { getReportDefinition } from "@/src/lib/reports/reportCatalog";
import type { ReportGenerateResult } from "@/src/lib/reports/reportTypes";

export async function generateOperatingPlReport(input: {
  tenantId: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  currency?: string | null;
}): Promise<ReportGenerateResult> {
  const tid = input.tenantId.trim();
  if (!tid) throw new Error("tenantId is required.");
  const def = getReportDefinition("operating_pl");
  if (!def) throw new Error("operating_pl is not in the report catalog.");

  const { period_start, period_end } = normalizeExpensePeriod({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });
  const currency = (input.currency?.trim() || "AUD").toUpperCase();

  const pl = await loadOperatingPlSummary(tid, {
    periodStart: period_start,
    periodEnd: period_end,
  });

  const netPositive = pl.net_operating_cents >= 0;

  return {
    reportId: def.id,
    title: def.title,
    periodStart: period_start,
    periodEnd: period_end,
    generatedAt: new Date().toISOString(),
    currency,
    metrics: [
      {
        key: "revenue",
        label: "Collected revenue",
        value: formatMoneyFromCents(pl.revenue_collected_cents, currency),
        hint: `${pl.revenue_event_count} collection event(s)`,
      },
      {
        key: "opex_posted",
        label: "Opex posted",
        value: formatMoneyFromCents(pl.opex_posted_cents, currency),
        hint: `${pl.expense_event_count} expense_posted debit(s)`,
      },
      {
        key: "opex_voids",
        label: "Opex void reversals",
        value: formatMoneyFromCents(pl.opex_void_reversal_cents, currency),
      },
      {
        key: "opex_net",
        label: "Net opex",
        value: formatMoneyFromCents(pl.opex_net_cents, currency),
      },
      {
        key: "net_operating",
        label: "Net operating",
        value: formatMoneyFromCents(pl.net_operating_cents, currency),
        hint: netPositive ? "Collections exceed net opex" : "Net opex exceeds collections",
      },
    ],
    table: {
      columns: [
        { key: "line", label: "Line" },
        { key: "amount", label: "Amount", align: "right" as const },
        { key: "notes", label: "Notes" },
      ],
      rows: [
        {
          line: "Collected revenue",
          amount: formatMoneyFromCents(pl.revenue_collected_cents, currency),
          notes: `${pl.revenue_event_count} events`,
        },
        {
          line: "Opex posted",
          amount: formatMoneyFromCents(pl.opex_posted_cents, currency),
          notes: `${pl.expense_event_count} expense_posted`,
        },
        {
          line: "Opex void reversals",
          amount: formatMoneyFromCents(pl.opex_void_reversal_cents, currency),
          notes: "Credits reducing opex",
        },
        {
          line: "Net opex",
          amount: formatMoneyFromCents(pl.opex_net_cents, currency),
          notes: "Posted − voids",
        },
        {
          line: "Net operating",
          amount: formatMoneyFromCents(pl.net_operating_cents, currency),
          notes: netPositive ? "Positive" : "Negative",
        },
      ],
    },
    emptyMessage:
      pl.revenue_event_count === 0 && pl.expense_event_count === 0
        ? "No ledger collection or expense_posted events in this period. Post payments and expenses to build the operating snapshot."
        : undefined,
  };
}
