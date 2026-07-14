import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { isReportId, type ReportId } from "@/src/lib/reports/reportCatalog";
import {
  periodFromPreset,
  type ExpensePeriodPreset,
} from "@/src/lib/financialOs/expenses/expensePeriodCore";
import { runReportGenerator } from "@/src/lib/reports/reportGenerate.server";
import type { ReportGenerateFilters } from "@/src/lib/reports/reportFilters";
import type { ReportGenerateResult } from "@/src/lib/reports/reportTypes";
import type {
  FiReportRunRow,
  FiReportScheduleRow,
  ReportRunListItem,
  ReportRunSource,
} from "@/src/lib/reports/reportRunTypes";

function client(c?: SupabaseClient): SupabaseClient {
  return c ?? supabaseAdmin();
}

function mapRunRow(raw: Record<string, unknown>): FiReportRunRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    report_id: String(raw.report_id),
    title: String(raw.title),
    period_start: String(raw.period_start).slice(0, 10),
    period_end: String(raw.period_end).slice(0, 10),
    params:
      raw.params && typeof raw.params === "object" && !Array.isArray(raw.params)
        ? (raw.params as Record<string, unknown>)
        : {},
    result_json:
      raw.result_json && typeof raw.result_json === "object" && !Array.isArray(raw.result_json)
        ? (raw.result_json as ReportGenerateResult)
        : {},
    status: String(raw.status ?? "completed") as FiReportRunRow["status"],
    source: String(raw.source ?? "manual") as ReportRunSource,
    created_by_fi_user_id:
      raw.created_by_fi_user_id != null ? String(raw.created_by_fi_user_id) : null,
    created_at: String(raw.created_at ?? ""),
    completed_at: raw.completed_at != null ? String(raw.completed_at) : null,
  };
}

function mapScheduleRow(raw: Record<string, unknown>): FiReportScheduleRow {
  const preset = String(raw.period_preset ?? "30d");
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    report_id: String(raw.report_id),
    period_preset: preset === "90d" || preset === "ytd" || preset === "30d" ? preset : "30d",
    filters:
      raw.filters && typeof raw.filters === "object" && !Array.isArray(raw.filters)
        ? (raw.filters as Record<string, unknown>)
        : {},
    is_active: Boolean(raw.is_active ?? true),
    last_run_at: raw.last_run_at != null ? String(raw.last_run_at) : null,
    last_run_id: raw.last_run_id != null ? String(raw.last_run_id) : null,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

export async function insertReportRun(input: {
  tenantId: string;
  result: ReportGenerateResult;
  params?: Record<string, unknown>;
  source?: ReportRunSource;
  createdByFiUserId?: string | null;
  supabase?: SupabaseClient;
}): Promise<FiReportRunRow> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const db = client(input.supabase);
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("fi_report_runs")
    .insert({
      tenant_id: tid,
      report_id: input.result.reportId,
      title: input.result.title,
      period_start: input.result.periodStart,
      period_end: input.result.periodEnd,
      params: input.params ?? {},
      result_json: input.result,
      status: "completed",
      source: input.source ?? "manual",
      created_by_fi_user_id: input.createdByFiUserId ?? null,
      created_at: now,
      completed_at: now,
    })
    .select("*")
    .single();
  if (error) {
    if (error.message.includes("does not exist")) {
      throw new Error(
        "Report runs table is not available yet. Apply migration fi_report_runs_and_schedules."
      );
    }
    throw new Error(error.message);
  }
  return mapRunRow(data as Record<string, unknown>);
}

export async function listReportRunsForTenant(
  tenantId: string,
  options?: { limit?: number; reportId?: string | null; supabase?: SupabaseClient }
): Promise<ReportRunListItem[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const db = client(options?.supabase);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
  let q = db
    .from("fi_report_runs")
    .select("id, report_id, title, period_start, period_end, source, status, created_at")
    .eq("tenant_id", tid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (options?.reportId?.trim()) q = q.eq("report_id", options.reportId.trim());
  const { data, error } = await q;
  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id),
      report_id: String(r.report_id),
      title: String(r.title),
      period_start: String(r.period_start).slice(0, 10),
      period_end: String(r.period_end).slice(0, 10),
      source: String(r.source ?? "manual") as ReportRunSource,
      status: String(r.status ?? "completed") as ReportRunListItem["status"],
      created_at: String(r.created_at ?? ""),
    };
  });
}

export async function loadReportRunById(
  tenantId: string,
  runId: string,
  supabase?: SupabaseClient
): Promise<FiReportRunRow | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const id = assertNonEmptyUuid(runId, "runId");
  const db = client(supabase);
  const { data, error } = await db
    .from("fi_report_runs")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (error.message.includes("does not exist")) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return mapRunRow(data as Record<string, unknown>);
}

export async function listActiveReportSchedules(options?: {
  tenantId?: string | null;
  limit?: number;
  supabase?: SupabaseClient;
}): Promise<FiReportScheduleRow[]> {
  const db = client(options?.supabase);
  const limit = Math.min(500, Math.max(1, options?.limit ?? 100));
  let q = db
    .from("fi_report_schedules")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (options?.tenantId?.trim()) q = q.eq("tenant_id", options.tenantId.trim());
  const { data, error } = await q;
  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => mapScheduleRow(r as Record<string, unknown>));
}

export async function upsertReportSchedule(input: {
  tenantId: string;
  reportId: ReportId;
  periodPreset: ExpensePeriodPreset;
  filters?: ReportGenerateFilters;
  isActive?: boolean;
  supabase?: SupabaseClient;
}): Promise<FiReportScheduleRow> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  if (!isReportId(input.reportId)) throw new Error("Unknown report.");
  const db = client(input.supabase);
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("fi_report_schedules")
    .upsert(
      {
        tenant_id: tid,
        report_id: input.reportId,
        period_preset: input.periodPreset,
        filters: (input.filters ?? {}) as Record<string, unknown>,
        is_active: input.isActive ?? true,
        updated_at: now,
      },
      { onConflict: "tenant_id,report_id" }
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapScheduleRow(data as Record<string, unknown>);
}

export async function runScheduledReport(
  schedule: FiReportScheduleRow,
  options?: { dryRun?: boolean; supabase?: SupabaseClient }
): Promise<{ scheduleId: string; runId: string | null; dryRun: boolean; title: string }> {
  const db = client(options?.supabase);
  if (!isReportId(schedule.report_id)) {
    throw new Error(`Unknown scheduled report_id: ${schedule.report_id}`);
  }
  const { period_start, period_end } = periodFromPreset(schedule.period_preset);
  const filters = schedule.filters as ReportGenerateFilters;
  if (options?.dryRun) {
    return {
      scheduleId: schedule.id,
      runId: null,
      dryRun: true,
      title: schedule.report_id,
    };
  }

  const result = await runReportGenerator(schedule.report_id, {
    tenantId: schedule.tenant_id,
    periodStart: period_start,
    periodEnd: period_end,
    procedureType: typeof filters.procedureType === "string" ? filters.procedureType : null,
    attributionSource:
      typeof filters.attributionSource === "string" ? filters.attributionSource : null,
    campaign: typeof filters.campaign === "string" ? filters.campaign : null,
    arRisk: typeof filters.arRisk === "string" ? filters.arRisk : null,
    snapshotStatus:
      filters.snapshotStatus === "paid_in_full" ||
      filters.snapshotStatus === "outstanding" ||
      filters.snapshotStatus === "all"
        ? filters.snapshotStatus
        : null,
  });

  const run = await insertReportRun({
    tenantId: schedule.tenant_id,
    result,
    params: {
      period_preset: schedule.period_preset,
      filters: schedule.filters,
      schedule_id: schedule.id,
    },
    source: "schedule",
    supabase: db,
  });

  const now = new Date().toISOString();
  await db
    .from("fi_report_schedules")
    .update({ last_run_at: now, last_run_id: run.id, updated_at: now })
    .eq("id", schedule.id)
    .eq("tenant_id", schedule.tenant_id);

  return {
    scheduleId: schedule.id,
    runId: run.id,
    dryRun: false,
    title: result.title,
  };
}

export async function processActiveReportSchedules(options?: {
  tenantId?: string | null;
  dryRun?: boolean;
  limit?: number;
  supabase?: SupabaseClient;
}): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  dryRun: boolean;
  results: Array<{ scheduleId: string; runId: string | null; title: string; error?: string }>;
}> {
  const schedules = await listActiveReportSchedules({
    tenantId: options?.tenantId,
    limit: options?.limit ?? 100,
    supabase: options?.supabase,
  });
  const results: Array<{
    scheduleId: string;
    runId: string | null;
    title: string;
    error?: string;
  }> = [];
  let succeeded = 0;
  let failed = 0;

  for (const schedule of schedules) {
    try {
      const r = await runScheduledReport(schedule, {
        dryRun: options?.dryRun,
        supabase: options?.supabase,
      });
      results.push({ scheduleId: r.scheduleId, runId: r.runId, title: r.title });
      succeeded += 1;
    } catch (e) {
      failed += 1;
      results.push({
        scheduleId: schedule.id,
        runId: null,
        title: schedule.report_id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    processed: schedules.length,
    succeeded,
    failed,
    dryRun: Boolean(options?.dryRun),
    results,
  };
}
