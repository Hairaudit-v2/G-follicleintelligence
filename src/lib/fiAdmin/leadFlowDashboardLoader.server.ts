import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadConsultationConversionBoardPayload } from "@/src/lib/consultations/consultationConversionBoardLoader.server";
import type { ConsultationConversionKpis } from "@/src/lib/consultations/consultationConversionBoardModel";
import { enrichCrmKanbanCards } from "@/src/lib/crm/crmKanbanExtras.server";
import { loadCrmShellPipelineStages } from "@/src/lib/crm/crmShellLoaders";
import { loadCrmLeadsShellPage } from "@/src/lib/crm/leadList";
import type { FiImportBatchRow } from "@/src/lib/crm/hubspotImport/hubspotImportBatchLoad.server";
import type { CrmKanbanLeadCard, FiCrmActivityEventRow, FiCrmPipelineStageRow } from "@/src/lib/crm/types";
import {
  DEFAULT_STALE_LEAD_STAGE_DAYS,
  loadTenantOperationalDashboard,
  type CrmPipelineLeadVolumePayload,
  type StaleLeadItem,
  type TaskDueItem,
  type TenantActionCentre,
  type TenantClinicToday,
  type TenantLaunchControl,
  type TenantQuickStats,
} from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

export type LeadFlowActivityRow = {
  id: string;
  leadId: string | null;
  activityKind: string;
  title: string | null;
  occurredAt: string;
};

export type LeadFlowHubspotDiagnostics = {
  latestBatch: FiImportBatchRow | null;
  stagingRowCount: number;
  duplicateEmailCount: number;
  duplicatePhoneCount: number;
  duplicateRecordIdCount: number;
};

export type LeadFlowDashboardPayload = {
  staleLeads: StaleLeadItem[];
  tasksDue: TaskDueItem[];
  quickStats: TenantQuickStats;
  actionCentre: TenantActionCentre;
  launchControl: TenantLaunchControl;
  clinicToday: TenantClinicToday;
  crmPipelineLeadVolume: CrmPipelineLeadVolumePayload;
  crmPipelineStages: FiCrmPipelineStageRow[];
  conversionKpis: ConsultationConversionKpis;
  conversionLostCount: number;
  enrichedLeads: CrmKanbanLeadCard[];
  recentActivity: LeadFlowActivityRow[];
  hubspotImport: LeadFlowHubspotDiagnostics;
  staleLeadThresholdDays: number;
};

const ENRICHED_LEAD_LIMIT = 120;
const RECENT_ACTIVITY_LIMIT = 14;

function mapActivityRow(row: Record<string, unknown>): LeadFlowActivityRow {
  return {
    id: String(row.id),
    leadId: row.lead_id != null ? String(row.lead_id) : null,
    activityKind: String(row.activity_kind),
    title: row.title != null ? String(row.title) : null,
    occurredAt: String(row.occurred_at),
  };
}

async function loadRecentLeadFlowActivity(tenantId: string, limit = RECENT_ACTIVITY_LIMIT): Promise<LeadFlowActivityRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_crm_activity_events")
    .select("id, lead_id, activity_kind, title, occurred_at")
    .eq("tenant_id", tenantId.trim())
    .not("lead_id", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapActivityRow(row as Record<string, unknown>));
}

function readDryRunDuplicateCounts(report: unknown): {
  duplicateEmailCount: number;
  duplicatePhoneCount: number;
  duplicateRecordIdCount: number;
} {
  if (!report || typeof report !== "object") {
    return { duplicateEmailCount: 0, duplicatePhoneCount: 0, duplicateRecordIdCount: 0 };
  }
  const o = report as Record<string, unknown>;
  return {
    duplicateEmailCount: Array.isArray(o.duplicateEmailsInFile) ? o.duplicateEmailsInFile.length : 0,
    duplicatePhoneCount: Array.isArray(o.duplicatePhonesInFile) ? o.duplicatePhonesInFile.length : 0,
    duplicateRecordIdCount: Array.isArray(o.duplicateRecordIdsInFile) ? o.duplicateRecordIdsInFile.length : 0,
  };
}

async function loadHubspotImportDiagnostics(tenantId: string): Promise<LeadFlowHubspotDiagnostics> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();

  const { data: batch, error } = await supabase
    .from("fi_import_batches")
    .select(
      "id, tenant_id, status, dry_run_passed, dry_run_at, dry_run_report, imported_at, rolled_back_at, row_count, imported_row_count, created_at, metadata"
    )
    .eq("tenant_id", tid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!batch) {
    return {
      latestBatch: null,
      stagingRowCount: 0,
      duplicateEmailCount: 0,
      duplicatePhoneCount: 0,
      duplicateRecordIdCount: 0,
    };
  }

  const batchRow = batch as FiImportBatchRow;
  const dup = readDryRunDuplicateCounts(batchRow.dry_run_report);

  const { count, error: countErr } = await supabase
    .from("stg_hubspot_contacts_imports")
    .select("id", { count: "exact", head: true })
    .eq("import_batch_id", batchRow.id);
  if (countErr) throw new Error(countErr.message);

  return {
    latestBatch: batchRow,
    stagingRowCount: count ?? 0,
    ...dup,
  };
}

async function loadEnrichedActiveLeads(tenantId: string): Promise<CrmKanbanLeadCard[]> {
  const page = await loadCrmLeadsShellPage(tenantId, {
    view: "list",
    stageId: null,
    status: "open",
    priority: null,
    ownerUserId: null,
    searchRaw: "",
    searchPattern: null,
    sort: "updated_at_desc",
    page: 1,
    pageSize: ENRICHED_LEAD_LIMIT,
    updatedAtMin: null,
    updatedAtMax: null,
  });
  return enrichCrmKanbanCards(tenantId, page.items);
}

/**
 * Tenant-scoped LeadFlow workspace payload — composes existing operational, CRM, and conversion loaders.
 */
export async function loadLeadFlowDashboardPayload(
  tenantId: string,
  options?: { staleLeadStageDays?: number }
): Promise<LeadFlowDashboardPayload> {
  const tid = tenantId.trim();
  const staleLeadThresholdDays = options?.staleLeadStageDays ?? DEFAULT_STALE_LEAD_STAGE_DAYS;

  const [operational, conversion, stages, enrichedLeads, recentActivity, hubspotImport] = await Promise.all([
    loadTenantOperationalDashboard(tid, { staleLeadStageDays: staleLeadThresholdDays }),
    loadConsultationConversionBoardPayload(tid),
    loadCrmShellPipelineStages(tid),
    loadEnrichedActiveLeads(tid),
    loadRecentLeadFlowActivity(tid),
    loadHubspotImportDiagnostics(tid),
  ]);

  return {
    staleLeads: operational.staleLeads,
    tasksDue: operational.tasksDue,
    quickStats: operational.quickStats,
    actionCentre: operational.actionCentre,
    launchControl: operational.launchControl,
    clinicToday: operational.clinicToday,
    crmPipelineLeadVolume: operational.crmPipelineLeadVolume,
    crmPipelineStages: stages,
    conversionKpis: conversion.kpis,
    conversionLostCount: conversion.columns.lost.length,
    enrichedLeads,
    recentActivity,
    hubspotImport,
    staleLeadThresholdDays,
  };
}

/** Re-export for diagnostics panels that need raw activity shape. */
export type { FiCrmActivityEventRow };
