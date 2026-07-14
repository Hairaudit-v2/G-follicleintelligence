import "server-only";

import { formatMoneyFromCents } from "@/src/lib/format/money";
import { normalizeExpensePeriod } from "@/src/lib/financialOs/expenses/expensePeriodCore";
import { loadSurgeryEconomicsDashboardPayload } from "@/src/lib/financialOs/financialSurgeryEconomics.server";
import { getReportDefinition } from "@/src/lib/reports/reportCatalog";
import type { ReportGenerateResult } from "@/src/lib/reports/reportTypes";

export async function generateSurgeryGrossMarginReport(input: {
  tenantId: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  currency?: string | null;
  procedureType?: string | null;
  snapshotStatus?: "all" | "paid_in_full" | "outstanding" | null;
}): Promise<ReportGenerateResult> {
  const tid = input.tenantId.trim();
  if (!tid) throw new Error("tenantId is required.");
  const def = getReportDefinition("surgery_gross_margin");
  if (!def) throw new Error("surgery_gross_margin is not in the report catalog.");

  const { period_start, period_end } = normalizeExpensePeriod({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });

  const status = input.snapshotStatus?.trim();
  const snapshotStatus =
    status === "paid_in_full" || status === "outstanding" || status === "all" ? status : "all";

  const payload = await loadSurgeryEconomicsDashboardPayload(tid, 50, {
    dateFrom: period_start,
    dateTo: period_end,
    procedureType: input.procedureType?.trim() || null,
    snapshotStatus,
  });
  const currency = (input.currency?.trim() || payload.currency || "AUD").toUpperCase();
  const m = payload.metrics;
  const snaps = payload.recentSnapshots;

  return {
    reportId: def.id,
    title: def.title,
    periodStart: period_start,
    periodEnd: period_end,
    generatedAt: new Date().toISOString(),
    currency,
    metrics: [
      {
        key: "avg_margin",
        label: "Average gross margin",
        value: `${m.average_margin_percentage.toFixed(1)}%`,
        hint: `${period_start} → ${period_end}`,
      },
      {
        key: "rev_per_graft",
        label: "Avg revenue / graft",
        value:
          m.average_revenue_per_graft_cents != null
            ? formatMoneyFromCents(m.average_revenue_per_graft_cents, currency)
            : "—",
      },
      {
        key: "cost_per_graft",
        label: "Avg cost / graft",
        value:
          m.average_cost_per_graft_cents != null
            ? formatMoneyFromCents(m.average_cost_per_graft_cents, currency)
            : "—",
      },
      {
        key: "outstanding",
        label: "Outstanding surgery balances",
        value: formatMoneyFromCents(m.outstanding_surgery_balances_cents, currency),
      },
      {
        key: "top_procedure",
        label: "Most profitable procedure",
        value: m.most_profitable_procedure_type ?? "—",
      },
      {
        key: "snapshot_count",
        label: "Snapshots in window",
        value: String(snaps.length),
      },
    ],
    table:
      snaps.length === 0
        ? null
        : {
            columns: [
              { key: "patient", label: "Patient" },
              { key: "procedure", label: "Procedure" },
              { key: "revenue", label: "Revenue", align: "right" as const },
              { key: "cost", label: "Total cost", align: "right" as const },
              { key: "profit", label: "Gross profit", align: "right" as const },
              { key: "margin", label: "Margin", align: "right" as const },
              { key: "outstanding", label: "Outstanding", align: "right" as const },
              { key: "calculated", label: "Calculated" },
            ],
            rows: snaps.map((s) => ({
              patient: s.patient_label ?? s.patient_id?.slice(0, 8) ?? "—",
              procedure: s.procedure_type,
              revenue: formatMoneyFromCents(s.revenue_cents, currency),
              cost: formatMoneyFromCents(s.total_cost_cents, currency),
              profit: formatMoneyFromCents(s.gross_profit_cents, currency),
              margin: `${s.gross_margin_percentage.toFixed(1)}%`,
              outstanding: formatMoneyFromCents(s.outstanding_cents, currency),
              calculated: s.calculated_at.slice(0, 10),
            })),
          },
    emptyMessage:
      snaps.length === 0
        ? "No surgery profitability snapshots in this period. Complete procedures with cost models and invoices to build snapshots."
        : undefined,
  };
}
