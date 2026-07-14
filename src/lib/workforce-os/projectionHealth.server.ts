import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import {
  buildHrProjectionHealth,
  countMissingStaffProjections,
  countStaleStaffProjections,
  type HrProjectionHealth,
} from "./projectionHealthCore";

const WORKFORCE_PROJECTION_SYNC_SOURCE = "workforce_projection";

async function loadLastProjectionSyncRun(
  tenantId: string,
  client: SupabaseClient
): Promise<{ finishedAt: string | null; syncedCount: number | null }> {
  const { data, error } = await client
    .from("fi_staff_sync_runs")
    .select("finished_at, linked_count, created_count, metadata")
    .eq("tenant_id", tenantId)
    .eq("source_system", WORKFORCE_PROJECTION_SYNC_SOURCE)
    .eq("status", "success")
    .order("finished_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as
    | {
        finished_at?: string | null;
        linked_count?: number | null;
        created_count?: number | null;
        metadata?: Record<string, unknown> | null;
      }
    | undefined;
  if (!row) return { finishedAt: null, syncedCount: null };

  const metadataCount = Number(row.metadata?.synced_count ?? NaN);
  const syncedCount = Number.isFinite(metadataCount)
    ? Math.floor(metadataCount)
    : Number(row.linked_count ?? row.created_count ?? 0);

  return {
    finishedAt: row.finished_at ?? null,
    syncedCount: Number.isFinite(syncedCount) ? syncedCount : null,
  };
}

/** Read-only projection health for a tenant — does not repair or sync. */
export async function loadTenantHrProjectionHealth(
  tenantId: string,
  client?: SupabaseClient
): Promise<HrProjectionHealth> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();

  const [staffResult, memberResult, lastSync] = await Promise.all([
    supabase.from("fi_staff").select("id, updated_at").eq("tenant_id", tid),
    supabase
      .from("fi_staff_members")
      .select("fi_staff_id, updated_at")
      .eq("tenant_id", tid)
      .is("merged_into", null),
    loadLastProjectionSyncRun(tid, supabase),
  ]);

  if (staffResult.error) throw new Error(staffResult.error.message);
  if (memberResult.error) throw new Error(memberResult.error.message);

  const fiStaffRows = (staffResult.data ?? []) as { id: string; updated_at: string }[];
  const memberRows = (memberResult.data ?? []) as {
    fi_staff_id: string | null;
    updated_at: string;
  }[];

  const fiStaffIds = fiStaffRows.map((row) => String(row.id));
  const linkedFiStaffIds = memberRows
    .map((row) => (row.fi_staff_id != null ? String(row.fi_staff_id) : null))
    .filter(Boolean) as string[];

  const fiStaffUpdatedAtById: Record<string, string> = {};
  for (const row of fiStaffRows) {
    fiStaffUpdatedAtById[String(row.id)] = String(row.updated_at);
  }

  const missingProjectionCount = countMissingStaffProjections({
    fiStaffIds,
    linkedFiStaffIds,
  });
  const staleProjectionCount = countStaleStaffProjections({
    fiStaffUpdatedAtById,
    memberRows,
  });

  return buildHrProjectionHealth({
    operationalFiStaffCount: fiStaffIds.length,
    linkedProjectionCount: linkedFiStaffIds.length,
    missingProjectionCount,
    staleProjectionCount,
    lastProjectionSyncAt: lastSync.finishedAt,
    lastProjectionSyncCount: lastSync.syncedCount,
  });
}

export async function recordWorkforceProjectionSyncRun(input: {
  tenantId: string;
  syncedCount: number;
  syncedAt: string;
  client?: SupabaseClient;
}): Promise<void> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();
  const { error } = await supabase.from("fi_staff_sync_runs").insert({
    tenant_id: tid,
    source_system: WORKFORCE_PROJECTION_SYNC_SOURCE,
    mode: "repair",
    status: "success",
    linked_count: input.syncedCount,
    finished_at: input.syncedAt,
    started_at: input.syncedAt,
    metadata: { synced_count: input.syncedCount, reason: "explicit_projection_sync" },
  });
  if (error) throw new Error(error.message);
}
