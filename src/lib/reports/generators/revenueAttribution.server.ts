import "server-only";

import { formatMoneyFromCents } from "@/src/lib/format/money";
import { normalizeExpensePeriod } from "@/src/lib/financialOs/expenses/expensePeriodCore";
import { loadRevenueAttributionDashboardPayload } from "@/src/lib/financialOs/financialRevenueAttribution.server";
import { getReportDefinition } from "@/src/lib/reports/reportCatalog";
import type { ReportGenerateResult } from "@/src/lib/reports/reportTypes";

export async function generateRevenueAttributionReport(input: {
  tenantId: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  currency?: string | null;
  attributionSource?: string | null;
  campaign?: string | null;
  procedureType?: string | null;
}): Promise<ReportGenerateResult> {
  const tid = input.tenantId.trim();
  if (!tid) throw new Error("tenantId is required.");
  const def = getReportDefinition("revenue_attribution_summary");
  if (!def) throw new Error("revenue_attribution_summary is not in the report catalog.");

  const { period_start, period_end } = normalizeExpensePeriod({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });

  const payload = await loadRevenueAttributionDashboardPayload(tid, {
    dateFrom: period_start,
    dateTo: period_end,
    source: input.attributionSource?.trim() || null,
    campaign: input.campaign?.trim() || null,
    procedureType: input.procedureType?.trim() || null,
  });
  const currency = (input.currency?.trim() || payload.currency || "AUD").toUpperCase();
  const m = payload.metrics;
  const totalCollected = m.revenue_by_source.reduce((acc, r) => acc + r.cents, 0);

  return {
    reportId: def.id,
    title: def.title,
    periodStart: period_start,
    periodEnd: period_end,
    generatedAt: new Date().toISOString(),
    currency,
    metrics: [
      {
        key: "total_collected",
        label: "Attributed collected revenue",
        value: formatMoneyFromCents(totalCollected, currency),
        hint: `${period_start} → ${period_end}`,
      },
      {
        key: "best_source",
        label: "Best converting source",
        value: m.best_converting_source
          ? `${m.best_converting_source.source} (${m.best_converting_source.conversion_rate}%)`
          : "—",
      },
      {
        key: "highest_margin",
        label: "Highest margin source",
        value: m.highest_margin_source
          ? `${m.highest_margin_source.source} (${m.highest_margin_source.margin_percentage}%)`
          : "—",
      },
      {
        key: "unknown_pct",
        label: "Unknown attribution",
        value: `${m.unknown_attribution_percentage}%`,
      },
      {
        key: "row_count",
        label: "Source / campaign rows",
        value: String(payload.rows.length),
      },
    ],
    table:
      payload.rows.length === 0
        ? null
        : {
            columns: [
              { key: "source", label: "Source" },
              { key: "campaign", label: "Campaign" },
              { key: "leads", label: "Leads", align: "right" as const },
              { key: "consults", label: "Consults", align: "right" as const },
              { key: "collected", label: "Collected", align: "right" as const },
              { key: "profit", label: "Gross profit", align: "right" as const },
              { key: "margin", label: "Margin", align: "right" as const },
              { key: "confidence", label: "Confidence" },
            ],
            rows: payload.rows.map((row) => ({
              source: row.source,
              campaign: row.campaign || "—",
              leads: row.leads,
              consults: row.consults,
              collected: formatMoneyFromCents(row.collected_revenue_cents, currency),
              profit: formatMoneyFromCents(row.gross_profit_cents, currency),
              margin:
                row.margin_percentage != null ? `${row.margin_percentage.toFixed(1)}%` : "—",
              confidence: row.confidence,
            })),
          },
    emptyMessage:
      payload.rows.length === 0
        ? "No revenue attribution events in this period. Attribution is written when payments and source metadata are linked."
        : undefined,
  };
}
