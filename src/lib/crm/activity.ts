import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiCrmActivityEventRow } from "./types";

export type AppendCrmActivityEventParams = {
  tenantId: string;
  /** Nullable for patient-native events (e.g. blood requests) when no lead anchor exists. */
  leadId?: string | null;
  activityKind: string;
  title?: string | null;
  detail?: Record<string, unknown> | null;
  occurredAt?: string | null;
  fiTimelineEventId?: string | null;
  patientId?: string | null;
  caseId?: string | null;
};

export async function appendCrmActivityEvent(
  params: AppendCrmActivityEventParams,
  client?: SupabaseClient
): Promise<FiCrmActivityEventRow> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = params.tenantId.trim();
  const leadIdRaw = params.leadId?.trim() ?? "";
  const leadId = leadIdRaw.length ? leadIdRaw : null;
  const patientId = params.patientId?.trim() ?? null;
  const activityKind = params.activityKind.trim();
  if (!activityKind) throw new Error("activityKind is required.");
  if (!leadId && !patientId) throw new Error("leadId or patientId is required.");

  const detail =
    params.detail && typeof params.detail === "object" && !Array.isArray(params.detail)
      ? params.detail
      : {};

  const { data, error } = await supabase
    .from("fi_crm_activity_events")
    .insert({
      tenant_id: tenantId,
      lead_id: leadId,
      activity_kind: activityKind,
      title: params.title?.trim() || null,
      detail,
      occurred_at: params.occurredAt?.trim() || new Date().toISOString(),
      fi_timeline_event_id: params.fiTimelineEventId?.trim() || null,
      patient_id: patientId,
      case_id: params.caseId?.trim() || null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapActivityRow(data as Record<string, unknown>);
}

function mapActivityRow(row: Record<string, unknown>): FiCrmActivityEventRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    lead_id: row.lead_id != null ? String(row.lead_id) : null,
    activity_kind: String(row.activity_kind),
    title: row.title != null ? String(row.title) : null,
    detail:
      row.detail && typeof row.detail === "object" && !Array.isArray(row.detail)
        ? (row.detail as Record<string, unknown>)
        : {},
    occurred_at: String(row.occurred_at),
    created_at: String(row.created_at),
    fi_timeline_event_id:
      row.fi_timeline_event_id != null ? String(row.fi_timeline_event_id) : null,
    patient_id: row.patient_id != null ? String(row.patient_id) : null,
    case_id: row.case_id != null ? String(row.case_id) : null,
  };
}

/**
 * Tenant-scoped activity timeline for a lead (newest first).
 */
export async function loadCrmActivityTimelineForLead(
  tenantId: string,
  leadId: string,
  opts?: { limit?: number; client?: SupabaseClient }
): Promise<FiCrmActivityEventRow[]> {
  const supabase: SupabaseClient = opts?.client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const lid = leadId.trim();
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500);

  const { data, error } = await supabase
    .from("fi_crm_activity_events")
    .select("*")
    .eq("tenant_id", tid)
    .eq("lead_id", lid)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapActivityRow);
}
