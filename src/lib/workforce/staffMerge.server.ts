import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  WORKFORCE_PHASE_1C_AUDIT_EVENTS,
  WORKFORCE_PHASE_1C_AUDIT_SOURCE,
} from "@/src/lib/workforce/workforcePhase1cAudit";

export type MergeStaffRecordsResult = {
  ok: boolean;
  movedIdentityLinks: number;
  archivedSourceFiStaff: boolean;
};

async function insertWorkforceAudit(
  supabase: SupabaseClient,
  row: {
    tenant_id: string;
    staff_member_id: string;
    event_type: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.from("fi_staff_member_audit_events").insert({
    tenant_id: row.tenant_id,
    staff_member_id: row.staff_member_id,
    event_type: row.event_type,
    source: WORKFORCE_PHASE_1C_AUDIT_SOURCE,
    metadata: row.metadata ?? {},
  });
  if (error) throw new Error(error.message);
}

/**
 * Transaction-safe staff merge via Postgres RPC `workforce_merge_staff_members`.
 * Archives source member (employment_status=merged); never hard-deletes.
 */
export async function mergeStaffRecords(input: {
  tenantId: string;
  sourceStaffId: string;
  targetStaffId: string;
  mergedBy?: string | null;
  client?: SupabaseClient;
}): Promise<MergeStaffRecordsResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const sourceStaffId = assertNonEmptyUuid(input.sourceStaffId, "sourceStaffId");
  const targetStaffId = assertNonEmptyUuid(input.targetStaffId, "targetStaffId");
  if (sourceStaffId === targetStaffId) {
    throw new Error("Source and target staff members must differ.");
  }

  const supabase = input.client ?? supabaseAdmin();

  const { data, error } = await supabase.rpc("workforce_merge_staff_members", {
    p_tenant_id: tid,
    p_source_staff_member_id: sourceStaffId,
    p_target_staff_member_id: targetStaffId,
    p_merged_by: input.mergedBy ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  const payload =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};

  await insertWorkforceAudit(supabase, {
    tenant_id: tid,
    staff_member_id: sourceStaffId,
    event_type: WORKFORCE_PHASE_1C_AUDIT_EVENTS.STAFF_MERGED,
    metadata: {
      source_staff_member_id: sourceStaffId,
      target_staff_member_id: targetStaffId,
      merged_by: input.mergedBy ?? null,
      rpc_result: payload,
    },
  });

  await insertWorkforceAudit(supabase, {
    tenant_id: tid,
    staff_member_id: targetStaffId,
    event_type: WORKFORCE_PHASE_1C_AUDIT_EVENTS.STAFF_MERGED,
    metadata: {
      role: "merge_target",
      source_staff_member_id: sourceStaffId,
      merged_by: input.mergedBy ?? null,
    },
  });

  return {
    ok: Boolean(payload.ok ?? true),
    movedIdentityLinks: Number(payload.moved_identity_links ?? 0),
    archivedSourceFiStaff: Boolean(payload.archived_source_fi_staff ?? false),
  };
}