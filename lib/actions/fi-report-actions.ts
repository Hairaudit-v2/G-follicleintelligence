"use server";

import { z } from "zod";

import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { assertStaffModuleAccess } from "@/src/lib/staffAccess/staffAccessGuards.server";
import {
  getReportDefinition,
  isReportId,
  type ReportId,
} from "@/src/lib/reports/reportCatalog";
import { generateArAgingReport } from "@/src/lib/reports/generators/arAging.server";
import { generateCostPerGraftReport } from "@/src/lib/reports/generators/costPerGraft.server";
import { generateExpenseBreakdownReport } from "@/src/lib/reports/generators/expenseBreakdown.server";
import {
  buildExpenseExportPackFiles,
  generateExpenseExportPackReport,
} from "@/src/lib/reports/generators/expenseExportPack.server";
import { generateMarketingCplReport } from "@/src/lib/reports/generators/marketingCpl.server";
import { generateOperatingPlReport } from "@/src/lib/reports/generators/operatingPl.server";
import { generateRevenueAttributionReport } from "@/src/lib/reports/generators/revenueAttribution.server";
import { generateSurgeryGrossMarginReport } from "@/src/lib/reports/generators/surgeryGrossMargin.server";
import type { ReportGenerateFilters } from "@/src/lib/reports/reportFilters";
import { reportCsvFilename, reportResultToCsv } from "@/src/lib/reports/reportCsv";
import type { ReportGenerateResult } from "@/src/lib/reports/reportTypes";

function errMsg(e: unknown): string {
  if (e instanceof z.ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

const generateSchema = z.object({
  tenantId: z.string().uuid(),
  reportId: z.string().min(1),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  currency: z.string().max(8).optional().nullable(),
  procedureType: z.string().max(120).optional().nullable(),
  attributionSource: z.string().max(80).optional().nullable(),
  campaign: z.string().max(200).optional().nullable(),
  arRisk: z.string().max(40).optional().nullable(),
  snapshotStatus: z
    .enum(["all", "paid_in_full", "outstanding"])
    .optional()
    .nullable(),
});

type GenerateInput = z.infer<typeof generateSchema>;

async function assertReportAccess(
  tenantId: string,
  reportId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertFiTenantPortalAccess(tenantId);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }

  const def = getReportDefinition(reportId);
  if (!def) return { ok: false, error: "Unknown report." };
  if (!def.generateEnabled) {
    return { ok: false, error: "This report is not available for generate yet." };
  }

  try {
    await assertStaffModuleAccess(tenantId, "analytics_os", "read");
  } catch {
    // Portal members with Finances access may still generate financial reports.
  }

  if (def.requiredModules.includes("financial_os")) {
    try {
      await assertStaffModuleAccess(tenantId, "financial_os", "read");
    } catch {
      // Match Expenses page: portal membership is enough when module grant is missing.
    }
  }

  return { ok: true };
}

function filtersFromBody(parsed: GenerateInput): ReportGenerateFilters {
  return {
    procedureType: parsed.procedureType,
    attributionSource: parsed.attributionSource,
    campaign: parsed.campaign,
    arRisk: parsed.arRisk,
    snapshotStatus: parsed.snapshotStatus,
  };
}

async function runGenerator(
  reportId: ReportId,
  input: {
    tenantId: string;
    periodStart?: string | null;
    periodEnd?: string | null;
    currency?: string | null;
  } & ReportGenerateFilters
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

export async function generateReportAction(
  body: unknown
): Promise<{ ok: true; result: ReportGenerateResult } | { ok: false; error: string }> {
  try {
    const parsed = generateSchema.parse(body);
    const reportId = parsed.reportId.trim();
    if (!isReportId(reportId)) return { ok: false, error: "Unknown report." };

    const access = await assertReportAccess(parsed.tenantId, reportId);
    if (!access.ok) return access;

    const result = await runGenerator(reportId, {
      tenantId: parsed.tenantId,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      currency: parsed.currency,
      ...filtersFromBody(parsed),
    });
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export type ReportExportFile = { filename: string; csv: string; label?: string };

export async function exportReportCsvAction(
  body: unknown
): Promise<
  | { ok: true; filename: string; csv: string; files?: ReportExportFile[] }
  | { ok: false; error: string }
> {
  try {
    const parsed = generateSchema.parse(body);
    const reportId = parsed.reportId.trim();
    if (!isReportId(reportId)) return { ok: false, error: "Unknown report." };

    const access = await assertReportAccess(parsed.tenantId, reportId);
    if (!access.ok) return access;

    if (reportId === "expense_export_pack") {
      const pack = await buildExpenseExportPackFiles({
        tenantId: parsed.tenantId,
        periodStart: parsed.periodStart,
        periodEnd: parsed.periodEnd,
      });
      const primary = pack.files[0];
      if (!primary) return { ok: false, error: "No export files produced." };
      return {
        ok: true,
        filename: primary.filename,
        csv: primary.csv,
        files: pack.files,
      };
    }

    const result = await runGenerator(reportId, {
      tenantId: parsed.tenantId,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      currency: parsed.currency,
      ...filtersFromBody(parsed),
    });
    const csv = reportResultToCsv(result);
    const filename = reportCsvFilename(result.reportId, result.periodStart, result.periodEnd);
    return { ok: true, filename, csv };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
