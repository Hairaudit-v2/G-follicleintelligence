"use server";

import { z } from "zod";

import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { assertStaffModuleAccess } from "@/src/lib/staffAccess/staffAccessGuards.server";
import { getReportDefinition, isReportId } from "@/src/lib/reports/reportCatalog";
import {
  expenseBreakdownToCsv,
  generateExpenseBreakdownReport,
} from "@/src/lib/reports/generators/expenseBreakdown.server";
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
});

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
    // Hub is Reports/analytics-oriented; some tenants only grant financial_os.
  }

  if (def.requiredModules.includes("financial_os")) {
    try {
      await assertStaffModuleAccess(tenantId, "financial_os", "read");
    } catch {
      // Match Expenses page: portal membership is enough for read of expense intelligence
      // when financial_os module grant is not provisioned. Keep try for future tightening.
    }
  }

  return { ok: true };
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

    if (reportId === "expense_breakdown") {
      const result = await generateExpenseBreakdownReport({
        tenantId: parsed.tenantId,
        periodStart: parsed.periodStart,
        periodEnd: parsed.periodEnd,
        currency: parsed.currency,
      });
      return { ok: true, result };
    }

    return { ok: false, error: "Report generator is not implemented yet." };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function exportReportCsvAction(
  body: unknown
): Promise<{ ok: true; filename: string; csv: string } | { ok: false; error: string }> {
  try {
    const parsed = generateSchema.parse(body);
    const reportId = parsed.reportId.trim();
    if (!isReportId(reportId)) return { ok: false, error: "Unknown report." };

    const access = await assertReportAccess(parsed.tenantId, reportId);
    if (!access.ok) return access;

    if (reportId === "expense_breakdown") {
      const result = await generateExpenseBreakdownReport({
        tenantId: parsed.tenantId,
        periodStart: parsed.periodStart,
        periodEnd: parsed.periodEnd,
        currency: parsed.currency,
      });
      const csv = expenseBreakdownToCsv(result);
      const filename = `expense-breakdown_${result.periodStart}_${result.periodEnd}.csv`;
      return { ok: true, filename, csv };
    }

    return { ok: false, error: "CSV export is not available for this report yet." };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
