import "server-only";

import { formatMoneyFromCents } from "@/src/lib/format/money";
import { normalizeExpensePeriod } from "@/src/lib/financialOs/expenses/expensePeriodCore";
import {
  loadAccountsReceivableDashboardMetrics,
  loadAccountsReceivableWorkQueue,
} from "@/src/lib/financialOs/financialAccountsReceivable.server";
import { getReportDefinition } from "@/src/lib/reports/reportCatalog";
import type { ReportGenerateResult } from "@/src/lib/reports/reportTypes";

function agingBand(daysOverdue: number): string {
  if (daysOverdue <= 0) return "Current";
  if (daysOverdue <= 30) return "1–30 days";
  if (daysOverdue <= 60) return "31–60 days";
  if (daysOverdue <= 90) return "61–90 days";
  return "90+ days";
}

export async function generateArAgingReport(input: {
  tenantId: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  currency?: string | null;
}): Promise<ReportGenerateResult> {
  const tid = input.tenantId.trim();
  if (!tid) throw new Error("tenantId is required.");
  const def = getReportDefinition("ar_aging_summary");
  if (!def) throw new Error("ar_aging_summary is not in the report catalog.");

  // AR is a point-in-time open-balance view; period is used for context / export labeling.
  const { period_start, period_end } = normalizeExpensePeriod({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });
  const currency = (input.currency?.trim() || "AUD").toUpperCase();

  const [metrics, rows] = await Promise.all([
    loadAccountsReceivableDashboardMetrics(tid),
    loadAccountsReceivableWorkQueue(tid, {}, 300),
  ]);

  const open = rows.filter((r) => r.outstanding_amount_cents > 0);
  const bandTotals = new Map<string, { cents: number; count: number }>();
  for (const r of open) {
    const band = agingBand(r.days_overdue);
    const prev = bandTotals.get(band) ?? { cents: 0, count: 0 };
    prev.cents += r.outstanding_amount_cents;
    prev.count += 1;
    bandTotals.set(band, prev);
  }
  const bandOrder = ["Current", "1–30 days", "31–60 days", "61–90 days", "90+ days"];

  return {
    reportId: def.id,
    title: def.title,
    periodStart: period_start,
    periodEnd: period_end,
    generatedAt: new Date().toISOString(),
    currency,
    metrics: [
      {
        key: "total_outstanding",
        label: "Total outstanding",
        value: formatMoneyFromCents(metrics.totalOutstandingCents, currency),
        hint: "Open AR cases (point in time)",
      },
      {
        key: "overdue",
        label: "Overdue revenue",
        value: formatMoneyFromCents(metrics.overdueRevenueCents, currency),
      },
      {
        key: "open_cases",
        label: "Open cases",
        value: String(metrics.openCaseCount),
      },
      {
        key: "critical",
        label: "Critical cases",
        value: String(metrics.criticalCaseCount),
      },
      {
        key: "deposits_risk",
        label: "Deposits at risk",
        value: formatMoneyFromCents(metrics.depositsAtRiskCents, currency),
      },
      {
        key: "avg_days",
        label: "Avg days overdue",
        value: String(metrics.averageDaysOverdue),
      },
    ],
    table: {
      columns: [
        { key: "band", label: "Aging band" },
        { key: "cases", label: "Cases", align: "right" as const },
        { key: "outstanding", label: "Outstanding", align: "right" as const },
      ],
      rows: [
        ...bandOrder
          .filter((b) => bandTotals.has(b))
          .map((band) => {
            const v = bandTotals.get(band)!;
            return {
              band,
              cases: v.count,
              outstanding: formatMoneyFromCents(v.cents, currency),
            };
          }),
        ...open.slice(0, 40).map((r) => ({
          band: `${agingBand(r.days_overdue)} · ${r.risk_level}`,
          cases: r.patient_label ?? r.patient_id?.slice(0, 8) ?? r.id.slice(0, 8),
          outstanding: formatMoneyFromCents(r.outstanding_amount_cents, currency),
        })),
      ],
    },
    emptyMessage:
      open.length === 0
        ? "No open accounts receivable cases. AR opens when invoices remain unpaid."
        : undefined,
  };
}
