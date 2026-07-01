import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { buildHrSyncRunCompletionPatch } from "@/src/lib/workforce/hrSyncAuditCore";
import type {
  FiHrSyncRunRow,
  HrSyncHealthSummary,
  HrSyncRunCounts,
  HrSyncRunStatus,
} from "@/src/lib/workforce/hrSyncAuditTypes";
import { loadIdentityLinksForTenant, loadStaffMembersForReconciliation } from "@/src/lib/workforce/identityReconciliation.server";
import { persistDuplicateCandidatesForTenant } from "@/src/lib/workforce/staffDuplicateDetection.server";

export type {
  FiHrSyncRunRow,
  HrSyncHealthSummary,
  HrSyncRunCounts,
  HrSyncRunStatus,
} from "@/src/lib/workforce/hrSyncAuditTypes";

function mapRunRow(raw: Record<string, unknown>): FiHrSyncRunRow {
  const warnings = raw.warnings;
  const errors = raw.errors;
  return {
    id: String(raw.id),
    tenantId: String(raw.tenant_id),
    runId: String(raw.run_id),
    sourceSystem: String(raw.source_system),
    startedAt: String(raw.started_at),
    completedAt: raw.completed_at != null ? String(raw.completed_at) : null,
    status: String(raw.status) as HrSyncRunStatus,
    recordsReceived: Number(raw.records_received ?? 0),
    recordsCreated: Number(raw.records_created ?? 0),
    recordsUpdated: Number(raw.records_updated ?? 0),
    recordsLinked: Number(raw.records_linked ?? 0),
    duplicatesDetected: Number(raw.duplicates_detected ?? 0),
    recordsSkipped: Number(raw.records_skipped ?? 0),
    warnings: Array.isArray(warnings)
      ? warnings.filter((w): w is string => typeof w === "string")
      : [],
    errors: Array.isArray(errors)
      ? errors.filter((e): e is string => typeof e === "string")
      : [],
  };
}

export async function startHrSyncRun(input: {
  tenantId: string;
  sourceSystem: string;
  runId?: string;
  client?: SupabaseClient;
}): Promise<{ id: string; runId: string }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const sourceSystem = input.sourceSystem.trim();
  if (!sourceSystem) throw new Error("sourceSystem is required.");
  const runId = input.runId?.trim() || randomUUID();
  const supabase = input.client ?? supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_hr_sync_runs")
    .insert({
      tenant_id: tid,
      run_id: runId,
      source_system: sourceSystem,
      status: "running",
    })
    .select("id, run_id")
    .single();
  if (error) throw new Error(error.message);
  return { id: String((data as { id: string }).id), runId };
}

export async function completeHrSyncRun(input: {
  runId: string;
  counts: HrSyncRunCounts;
  warnings?: string[];
  errors?: string[];
  status: HrSyncRunStatus;
  client?: SupabaseClient;
}): Promise<void> {
  const runId = input.runId.trim();
  if (!runId) throw new Error("runId is required.");
  const now = new Date().toISOString();
  const supabase = input.client ?? supabaseAdmin();
  const patch = buildHrSyncRunCompletionPatch({
    counts: input.counts,
    warnings: input.warnings,
    errors: input.errors,
    status: input.status,
    completedAt: now,
  });

  const { error } = await supabase.from("fi_hr_sync_runs").update(patch).eq("run_id", runId);
  if (error) throw new Error(error.message);
}

export async function loadLatestHrSyncRuns(
  tenantId: string,
  limit = 20,
  client?: SupabaseClient
): Promise<FiHrSyncRunRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_hr_sync_runs")
    .select("*")
    .eq("tenant_id", tid)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapRunRow);
}

export async function loadHrSyncHealthSummary(
  tenantId: string,
  client?: SupabaseClient
): Promise<HrSyncHealthSummary> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();

  const [runs, members, identityLinks, dupRes] = await Promise.all([
    loadLatestHrSyncRuns(tid, 1, supabase),
    loadStaffMembersForReconciliation(tid, supabase),
    loadIdentityLinksForTenant(tid, supabase),
    supabase
      .from("fi_staff_duplicate_candidates")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("status", "open"),
  ]);

  const latest = runs[0] ?? null;
  const linkedMemberIds = new Set(identityLinks.map((l) => l.staffMemberId));
  const unlinkedActive = members.filter(
    (m) => !m.archivedAt && !m.mergedInto && !linkedMemberIds.has(m.id)
  );

  return {
    lastSyncTime: latest?.completedAt ?? latest?.startedAt ?? null,
    lastStatus: latest?.status ?? null,
    recordsReceived: latest?.recordsReceived ?? 0,
    created: latest?.recordsCreated ?? 0,
    updated: latest?.recordsUpdated ?? 0,
    linked: latest?.recordsLinked ?? 0,
    skipped: latest?.recordsSkipped ?? 0,
    duplicatesDetected: latest?.duplicatesDetected ?? 0,
    warningCount: latest?.warnings.length ?? 0,
    errorCount: latest?.errors.length ?? 0,
    unlinkedActiveStaffCount: unlinkedActive.length,
    openDuplicateCandidatesCount: dupRes.count ?? 0,
  };
}

export async function runPostSyncDuplicateDetection(
  tenantId: string,
  client?: SupabaseClient
): Promise<number> {
  return persistDuplicateCandidatesForTenant(tenantId, client);
}