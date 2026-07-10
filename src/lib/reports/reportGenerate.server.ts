import "server-only";

import type { ReportId } from "@/src/lib/reports/reportCatalog";
import type { ReportGenerateFilters } from "@/src/lib/reports/reportFilters";
import type { ReportGenerateResult } from "@/src/lib/reports/reportTypes";
import { generateArAgingReport } from "@/src/lib/reports/generators/arAging.server";
import { generateCostPerGraftReport } from "@/src/lib/reports/generators/costPerGraft.server";
import { generateExpenseBreakdownReport } from "@/src/lib/reports/generators/expenseBreakdown.server";
import { generateExpenseExportPackReport } from "@/src/lib/reports/generators/expenseExportPack.server";
import { generateMarketingCplReport } from "@/src/lib/reports/generators/marketingCpl.server";
import { generateOperatingPlReport } from "@/src/lib/reports/generators/operatingPl.server";
import { generateRevenueAttributionReport } from "@/src/lib/reports/generators/revenueAttribution.server";
import { generateSurgeryGrossMarginReport } from "@/src/lib/reports/generators/surgeryGrossMargin.server";

export type ReportGenerateInput = {
  tenantId: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  currency?: string | null;
} & ReportGenerateFilters;

/** Shared generator dispatch (UI actions + scheduled cron). */
export async function runReportGenerator(
  reportId: ReportId,
  input: ReportGenerateInput
): Promise<ReportGenerateResult> {
  switch (reportId) {
    case "expense_breakdown":
      return generateExpenseBreakdownReport(input);
    case "marketing_cpl":
      return generateMarketingCplReport(input);
    case "cost_per_graft_actuals":
      return generateCostPerGraftReport(input);
    case "operating_pl":
      return generateOperatingPlReport(input);
    case "surgery_gross_margin":
      return generateSurgeryGrossMarginReport(input);
    case "revenue_attribution_summary":
      return generateRevenueAttributionReport(input);
    case "ar_aging_summary":
      return generateArAgingReport(input);
    case "expense_export_pack":
      return generateExpenseExportPackReport(input);
    default:
      throw new Error("Report generator is not implemented yet.");
  }
}
