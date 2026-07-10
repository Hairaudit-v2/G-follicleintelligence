import "server-only";

import { formatMoneyFromCents } from "@/src/lib/format/money";
import { loadExpenseCplSummary } from "@/src/lib/financialOs/expenses/expenseCpl.server";
import { normalizeExpensePeriod } from "@/src/lib/financialOs/expenses/expensePeriodCore";
import { getReportDefinition } from "@/src/lib/reports/reportCatalog";
import type { ReportGenerateResult } from "@/src/lib/reports/reportTypes";

export async function generateMarketingCplReport(input: {
  tenantId: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  currency?: string | null;
}): Promise<ReportGenerateResult> {
  const tid = input.tenantId.trim();
  if (!tid) throw new Error("tenantId is required.");
  const def = getReportDefinition("marketing_cpl");
  if (!def) throw new Error("marketing_cpl is not in the report catalog.");

  const { period_start, period_end } = normalizeExpensePeriod({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });
  const currency = (input.currency?.trim() || "AUD").toUpperCase();

  const cpl = await loadExpenseCplSummary(tid, {
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
        key: "marketing_spend",
        label: "Marketing spend",
        value: formatMoneyFromCents(cpl.total_marketing_spend_cents, currency),
        hint: `${period_start} → ${period_end}`,
      },
      {
        key: "leads",
        label: "Leads created",
        value: String(cpl.total_leads),
      },
      {
        key: "overall_cpl",
        label: "Overall CPL",
        value:
          cpl.overall_cpl_cents != null
            ? formatMoneyFromCents(cpl.overall_cpl_cents, currency)
            : "—",
        hint:
          cpl.overall_cpl_cents == null
            ? "Needs posted marketing spend and at least one lead"
            : undefined,
      },
      {
        key: "unattributed",
        label: "Unattributed spend",
        value: formatMoneyFromCents(cpl.unattributed_spend_cents, currency),
      },
    ],
    table:
      cpl.by_campaign.length === 0
        ? null
        : {
            columns: [
              { key: "campaign", label: "Campaign" },
              { key: "spend", label: "Spend", align: "right" as const },
              { key: "leads", label: "Leads", align: "right" as const },
              { key: "cpl", label: "CPL", align: "right" as const },
            ],
            rows: cpl.by_campaign.map((row) => ({
              campaign: row.campaign_key,
              spend: formatMoneyFromCents(row.spend_cents, currency),
              leads: row.lead_count,
              cpl:
                row.cpl_cents != null ? formatMoneyFromCents(row.cpl_cents, currency) : "—",
            })),
          },
    emptyMessage:
      cpl.total_marketing_spend_cents === 0 && cpl.total_leads === 0
        ? "No marketing spend or leads in this period. Tag expenses with marketing categories or campaign keys, and ensure leads fall in range."
        : undefined,
  };
}
