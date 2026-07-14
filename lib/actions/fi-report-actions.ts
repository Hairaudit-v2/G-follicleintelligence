"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { assertStaffModuleAccess } from "@/src/lib/staffAccess/staffAccessGuards.server";
import { periodFromPreset } from "@/src/lib/financialOs/expenses/expensePeriodCore";
import { getReportDefinition, isReportId, type ReportId } from "@/src/lib/reports/reportCatalog";
import { buildExpenseExportPackFiles } from "@/src/lib/reports/generators/expenseExportPack.server";
import { runReportGenerator } from "@/src/lib/reports/reportGenerate.server";
import type { ReportGenerateFilters } from "@/src/lib/reports/reportFilters";
import { reportCsvFilename, reportResultToCsv } from "@/src/lib/reports/reportCsv";
import type { ReportGenerateResult } from "@/src/lib/reports/reportTypes";
import {
  insertReportRun,
  listReportRunsForTenant,
  loadReportRunById,
  upsertReportSchedule,
} from "@/src/lib/reports/reportRuns.server";
import type { ReportRunListItem } from "@/src/lib/reports/reportRunTypes";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function errMsg(e: unknown): string {
  if (e instanceof z.ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

const generateSchema = z.object({
  tenantId: z.string().uuid(),
  reportId: z.string().min(1),
  periodStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  periodEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  currency: z.string().max(8).optional().nullable(),
  procedureType: z.string().max(120).optional().nullable(),
  attributionSource: z.string().max(80).optional().nullable(),
  campaign: z.string().max(200).optional().nullable(),
  arRisk: z.string().max(40).optional().nullable(),
  snapshotStatus: z.enum(["all", "paid_in_full", "outstanding"]).optional().nullable(),
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

async function resolveActorFiUserId(tenantId: string): Promise<string | null> {
  const authId = await resolveAuthUserId(null);
  if (!authId) return null;
  const { data } = await supabaseAdmin()
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("auth_user_id", authId)
    .maybeSingle();
  return data?.id != null ? String((data as { id: string }).id) : null;
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

    const result = await runReportGenerator(reportId, {
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

    const result = await runReportGenerator(reportId, {
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

const saveRunSchema = z.object({
  tenantId: z.string().uuid(),
  result: z.object({
    reportId: z.string().min(1),
    title: z.string().min(1),
    periodStart: z.string(),
    periodEnd: z.string(),
    generatedAt: z.string(),
    currency: z.string(),
    metrics: z.array(z.any()),
    table: z.any().nullable(),
    emptyMessage: z.string().optional(),
  }),
  params: z.record(z.unknown()).optional(),
});

export async function saveReportRunAction(
  body: unknown
): Promise<{ ok: true; runId: string } | { ok: false; error: string }> {
  try {
    const parsed = saveRunSchema.parse(body);
    const reportId = parsed.result.reportId;
    if (!isReportId(reportId)) return { ok: false, error: "Unknown report." };
    const access = await assertReportAccess(parsed.tenantId, reportId);
    if (!access.ok) return access;

    const actor = await resolveActorFiUserId(parsed.tenantId);
    const run = await insertReportRun({
      tenantId: parsed.tenantId,
      result: parsed.result as ReportGenerateResult,
      params: parsed.params ?? {},
      source: "manual",
      createdByFiUserId: actor,
    });
    revalidatePath(`/fi-admin/${parsed.tenantId}/reports/library`);
    return { ok: true, runId: run.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function listReportRunsAction(
  tenantId: string,
  limit = 20
): Promise<{ ok: true; runs: ReportRunListItem[] } | { ok: false; error: string }> {
  try {
    await assertFiTenantPortalAccess(tenantId);
    const runs = await listReportRunsForTenant(tenantId, { limit });
    return { ok: true, runs };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function loadReportRunAction(
  body: unknown
): Promise<
  { ok: true; result: ReportGenerateResult; runId: string } | { ok: false; error: string }
> {
  try {
    const parsed = z.object({ tenantId: z.string().uuid(), runId: z.string().uuid() }).parse(body);
    await assertFiTenantPortalAccess(parsed.tenantId);
    const run = await loadReportRunById(parsed.tenantId, parsed.runId);
    if (!run) return { ok: false, error: "Report run not found." };
    const result = run.result_json as ReportGenerateResult;
    if (!result?.reportId || !result?.title) {
      return { ok: false, error: "Report run payload is incomplete." };
    }
    return { ok: true, result, runId: run.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const scheduleSchema = z.object({
  tenantId: z.string().uuid(),
  reportId: z.string().min(1),
  periodPreset: z.enum(["30d", "90d", "ytd"]),
  isActive: z.boolean().optional(),
  procedureType: z.string().max(120).optional().nullable(),
  attributionSource: z.string().max(80).optional().nullable(),
  campaign: z.string().max(200).optional().nullable(),
  arRisk: z.string().max(40).optional().nullable(),
  snapshotStatus: z.enum(["all", "paid_in_full", "outstanding"]).optional().nullable(),
});

export async function upsertReportScheduleAction(
  body: unknown
): Promise<{ ok: true; scheduleId: string } | { ok: false; error: string }> {
  try {
    const parsed = scheduleSchema.parse(body);
    if (!isReportId(parsed.reportId)) return { ok: false, error: "Unknown report." };
    const access = await assertReportAccess(parsed.tenantId, parsed.reportId);
    if (!access.ok) return access;

    const schedule = await upsertReportSchedule({
      tenantId: parsed.tenantId,
      reportId: parsed.reportId as ReportId,
      periodPreset: parsed.periodPreset,
      isActive: parsed.isActive ?? true,
      filters: {
        procedureType: parsed.procedureType,
        attributionSource: parsed.attributionSource,
        campaign: parsed.campaign,
        arRisk: parsed.arRisk,
        snapshotStatus: parsed.snapshotStatus,
      },
    });
    revalidatePath(`/fi-admin/${parsed.tenantId}/reports/library`);
    return { ok: true, scheduleId: schedule.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Preview next period for a schedule preset (client helper via server for consistency). */
export async function previewSchedulePeriodAction(
  preset: "30d" | "90d" | "ytd"
): Promise<{ ok: true; periodStart: string; periodEnd: string } | { ok: false; error: string }> {
  try {
    const { period_start, period_end } = periodFromPreset(preset);
    return { ok: true, periodStart: period_start, periodEnd: period_end };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
