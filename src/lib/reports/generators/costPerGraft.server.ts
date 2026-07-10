import "server-only";

import { formatMoneyFromCents } from "@/src/lib/format/money";
import { loadExpenseIntelligenceBundle } from "@/src/lib/financialOs/expenses/expenseIntelligence.server";
import { normalizeExpensePeriod } from "@/src/lib/financialOs/expenses/expensePeriodCore";
import { getReportDefinition } from "@/src/lib/reports/reportCatalog";
import type { ReportGenerateResult } from "@/src/lib/reports/reportTypes";

export async function generateCostPerGraftReport(input: {
  tenantId: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  currency?: string | null;
}): Promise<ReportGenerateResult> {
  const tid = input.tenantId.trim();
  if (!tid) throw new Error("tenantId is required.");
  const def = getReportDefinition("cost_per_graft_actuals");
  if (!def) throw new Error("cost_per_graft_actuals is not in the report catalog.");

  const { period_start, period_end } = normalizeExpensePeriod({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });
  const currency = (input.currency?.trim() || "AUD").toUpperCase();

  const bundle = await loadExpenseIntelligenceBundle(tid, {
    periodStart: period_start,
    periodEnd: period_end,
  });
  const cpg = bundle.costPerGraft;

  return {
    reportId: def.id,
    title: def.title,
    periodStart: period_start,
    periodEnd: period_end,
    generatedAt: new Date().toISOString(),
    currency,
    metrics: [
      {
        key: "clinical_spend",
        label: "Clinical spend",
        value: formatMoneyFromCents(cpg.total_clinical_spend_cents, currency),
        hint: `${period_start} → ${period_end}`,
      },
      {
        key: "grafts",
        label: "Grafts implanted",
        value: String(cpg.total_grafts_implanted),
      },
      {
        key: "overall_cpg",
        label: "Overall actual CPG",
        value:
          cpg.overall_actual_cpg_cents != null
            ? formatMoneyFromCents(cpg.overall_actual_cpg_cents, currency)
            : "—",
      },
      {
        key: "unlinked",
        label: "Unlinked clinical spend",
        value: formatMoneyFromCents(cpg.unlinked_clinical_spend_cents, currency),
        hint: "Clinical expenses without case / procedure link",
      },
    ],
    table:
      cpg.by_procedure.length === 0
        ? null
        : {
            columns: [
              { key: "procedure", label: "Procedure" },
              { key: "cases", label: "Cases", align: "right" as const },
              { key: "grafts", label: "Grafts", align: "right" as const },
              { key: "spend", label: "Spend", align: "right" as const },
              { key: "actual_cpg", label: "Actual CPG", align: "right" as const },
              { key: "standard_cpg", label: "Standard CPG", align: "right" as const },
              { key: "variance", label: "Variance", align: "right" as const },
            ],
            rows: cpg.by_procedure.map((row) => ({
              procedure: row.procedure_type,
              cases: row.case_count,
              grafts: row.grafts_implanted,
              spend: formatMoneyFromCents(row.spend_cents, currency),
              actual_cpg:
                row.actual_cost_per_graft_cents != null
                  ? formatMoneyFromCents(row.actual_cost_per_graft_cents, currency)
                  : "—",
              standard_cpg:
                row.standard_cost_per_graft_cents != null
                  ? formatMoneyFromCents(row.standard_cost_per_graft_cents, currency)
                  : "—",
              variance:
                row.variance_vs_standard_cents != null
                  ? formatMoneyFromCents(row.variance_vs_standard_cents, currency)
                  : "—",
            })),
          },
    emptyMessage:
      cpg.total_clinical_spend_cents === 0 && cpg.total_grafts_implanted === 0
        ? "No clinical spend or graft volume in this period. Link posted clinical expenses to cases/procedures and ensure graft data exists."
        : undefined,
  };
}
