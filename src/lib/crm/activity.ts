import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiCrmActivityEventRow } from "./types";

export type AppendCrmActivityEventParams = {
  tenantId: string;
  leadId: string;
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
  const leadId = params.leadId.trim();
  const activityKind = params.activityKind.trim();
  if (!activityKind) throw new Error("activityKind is required.");

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
      patient_id: params.patientId?.trim() || null,
      case_id: params.caseId?.trim() || null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    lead_id: String(row.lead_id),
    activity_kind: String(row.activity_kind),
    title: row.title != null ? String(row.title) : null,
    detail:
      row.detail && typeof row.detail === "object" && !Array.isArray(row.detail)
        ? (row.detail as Record<string, unknown>)
        : {},
    occurred_at: String(row.occurred_at),
    created_at: String(row.created_at),
    fi_timeline_event_id: row.fi_timeline_event_id != null ? String(row.fi_timeline_event_id) : null,
    patient_id: row.patient_id != null ? String(row.patient_id) : null,
    case_id: row.case_id != null ? String(row.case_id) : null,
  };
}
