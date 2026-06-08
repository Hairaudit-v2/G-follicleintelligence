import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

export type CreateStaffSyncRunInput = {
  tenantId: string;
  sourceSystem?: string;
  mode: "preview" | "commit";
  receivedRows: number;
  metadata?: Record<string, unknown>;
};

export type FinishStaffSyncRunInput = {
  runId: string;
  tenantId: string;
  status: "success" | "failed";
  receivedRows: number;
  createdCount: number;
  updatedCount: number;
  linkedCount: number;
  skippedCount: number;
  warningCount: number;
  errorMessage?: string | null;
  metadataPatch?: Record<string, unknown>;
};

export async function createStaffSyncRun(input: CreateStaffSyncRunInput): Promise<{ id: string } | null> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const sys = (input.sourceSystem ?? "iiohr_hr").trim() || "iiohr_hr";
  const meta =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? input.metadata
      : {};
  const { data, error } = await supabaseAdmin()
    .from("fi_staff_sync_runs")
    .insert({
      tenant_id: tid,
      source_system: sys,
      mode: input.mode,
      status: "running",
      received_rows: input.receivedRows,
      metadata: meta,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[fi_staff_sync_runs] create failed:", error.message);
    return null;
  }
  const row = data as { id: string } | null;
  return row?.id ? { id: String(row.id) } : null;
}

export async function finishStaffSyncRun(input: FinishStaffSyncRunInput): Promise<void> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const rid = assertNonEmptyUuid(input.runId, "runId");
  const supabase = supabaseAdmin();

  let mergedMeta: Record<string, unknown> = {};
  const { data: existing, error: readErr } = await supabase
    .from("fi_staff_sync_runs")
    .select("metadata")
    .eq("id", rid)
    .eq("tenant_id", tid)
    .maybeSingle();
  if (!readErr && existing && typeof (existing as { metadata?: unknown }).metadata === "object") {
    const m = (existing as { metadata: unknown }).metadata;
    if (m && !Array.isArray(m)) mergedMeta = { ...(m as Record<string, unknown>) };
  }
  if (input.metadataPatch && typeof input.metadataPatch === "object" && !Array.isArray(input.metadataPatch)) {
    mergedMeta = { ...mergedMeta, ...input.metadataPatch };
  }

  const finishedAt = new Date().toISOString();
  const { error } = await supabase
    .from("fi_staff_sync_runs")
    .update({
      status: input.status,
      finished_at: finishedAt,
      received_rows: input.receivedRows,
      created_count: input.createdCount,
      updated_count: input.updatedCount,
      linked_count: input.linkedCount,
      skipped_count: input.skippedCount,
      warning_count: input.warningCount,
      error_message: input.errorMessage?.trim() || null,
      metadata: mergedMeta,
    })
    .eq("id", rid)
    .eq("tenant_id", tid);
  if (error) {
    console.error("[fi_staff_sync_runs] finish failed:", error.message);
  }
}

export type FiStaffSyncRunRow = {
  id: string;
  tenant_id: string;
  source_system: string;
  mode: string;
  status: string;
  received_rows: number;
  created_count: number | null;
  updated_count: number | null;
  linked_count: number | null;
  skipped_count: number | null;
  warning_count: number | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  metadata: Record<string, unknown>;
};

/** Last N sync runs for HR admin UI (tenant-scoped). */
export async function listRecentStaffSyncRunsForTenant(tenantId: string, limit = 5): Promise<FiStaffSyncRunRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const { data, error } = await supabaseAdmin()
    .from("fi_staff_sync_runs")
    .select(
      "id, tenant_id, source_system, mode, status, received_rows, created_count, updated_count, linked_count, skipped_count, warning_count, error_message, started_at, finished_at, metadata"
    )
    .eq("tenant_id", tid)
    .eq("source_system", "iiohr_hr")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[fi_staff_sync_runs] list failed:", error.message);
    return [];
  }
  return (data ?? []).map((r) => {
    const x = r as Record<string, unknown>;
    const md = x.metadata;
    return {
      id: String(x.id),
      tenant_id: String(x.tenant_id),
      source_system: String(x.source_system ?? "iiohr_hr"),
      mode: String(x.mode ?? ""),
      status: String(x.status ?? ""),
      received_rows: Number(x.received_rows ?? 0),
      created_count: x.created_count != null ? Number(x.created_count) : null,
      updated_count: x.updated_count != null ? Number(x.updated_count) : null,
      linked_count: x.linked_count != null ? Number(x.linked_count) : null,
      skipped_count: x.skipped_count != null ? Number(x.skipped_count) : null,
      warning_count: x.warning_count != null ? Number(x.warning_count) : null,
      error_message: x.error_message != null ? String(x.error_message) : null,
      started_at: String(x.started_at ?? ""),
      finished_at: x.finished_at != null ? String(x.finished_at) : null,
      metadata: md && typeof md === "object" && !Array.isArray(md) ? (md as Record<string, unknown>) : {},
    };
  });
}
