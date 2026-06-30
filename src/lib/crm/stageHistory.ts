import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiCrmLeadStageHistoryRow } from "./types";
import { assertNonEmptyUuid } from "./validation";

export type AppendCrmLeadStageHistoryParams = {
  tenantId: string;
  leadId: string;
  fromStageId: string | null;
  toStageId: string;
  changedBy?: string | null;
  reason?: string | null;
  source?: string;
  fiTimelineEventId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function appendCrmLeadStageHistory(
  params: AppendCrmLeadStageHistoryParams,
  client?: SupabaseClient
): Promise<FiCrmLeadStageHistoryRow> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = assertNonEmptyUuid(params.tenantId, "tenantId");
  const leadId = assertNonEmptyUuid(params.leadId, "leadId");
  const toStageId = assertNonEmptyUuid(params.toStageId, "toStageId");
  const source = (params.source ?? "user").trim() || "user";

  const metadata =
    params.metadata && typeof params.metadata === "object" && !Array.isArray(params.metadata)
      ? params.metadata
      : {};

  const { data, error } = await supabase
    .from("fi_crm_lead_stage_history")
    .insert({
      tenant_id: tenantId,
      lead_id: leadId,
      from_stage_id: params.fromStageId == null ? null : params.fromStageId.trim() || null,
      to_stage_id: toStageId,
      changed_by: params.changedBy?.trim() || null,
      reason: params.reason?.trim() || null,
      source,
      fi_timeline_event_id: params.fiTimelineEventId?.trim() || null,
      metadata,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    lead_id: String(row.lead_id),
    from_stage_id: row.from_stage_id != null ? String(row.from_stage_id) : null,
    to_stage_id: String(row.to_stage_id),
    changed_at: String(row.changed_at),
    changed_by: row.changed_by != null ? String(row.changed_by) : null,
    reason: row.reason != null ? String(row.reason) : null,
    source: String(row.source),
    fi_timeline_event_id:
      row.fi_timeline_event_id != null ? String(row.fi_timeline_event_id) : null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
  };
}

export async function loadCrmLeadStageHistory(
  tenantId: string,
  leadId: string,
  client?: SupabaseClient
): Promise<FiCrmLeadStageHistoryRow[]> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const lid = assertNonEmptyUuid(leadId, "leadId");

  const { data, error } = await supabase
    .from("fi_crm_lead_stage_history")
    .select("*")
    .eq("tenant_id", tid)
    .eq("lead_id", lid)
    .order("changed_at", { ascending: false });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    lead_id: String(row.lead_id),
    from_stage_id: row.from_stage_id != null ? String(row.from_stage_id) : null,
    to_stage_id: String(row.to_stage_id),
    changed_at: String(row.changed_at),
    changed_by: row.changed_by != null ? String(row.changed_by) : null,
    reason: row.reason != null ? String(row.reason) : null,
    source: String(row.source),
    fi_timeline_event_id:
      row.fi_timeline_event_id != null ? String(row.fi_timeline_event_id) : null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
  }));
}
