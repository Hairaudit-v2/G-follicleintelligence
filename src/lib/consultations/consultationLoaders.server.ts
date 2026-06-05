import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { ConsultationRow, ConsultationStatus, ConsultationTypeId } from "./consultationTypes";

function mapRow(raw: Record<string, unknown>): ConsultationRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    person_id: raw.person_id == null ? null : String(raw.person_id),
    patient_id: raw.patient_id == null ? null : String(raw.patient_id),
    lead_id: raw.lead_id == null ? null : String(raw.lead_id),
    case_id: raw.case_id == null ? null : String(raw.case_id),
    consultation_type: raw.consultation_type as ConsultationTypeId,
    status: raw.status as ConsultationStatus,
    consultant_name: raw.consultant_name == null ? null : String(raw.consultant_name),
    consultation_date: raw.consultation_date == null ? null : String(raw.consultation_date),
    structured_data: (raw.structured_data && typeof raw.structured_data === "object"
      ? (raw.structured_data as Record<string, unknown>)
      : {}) as Record<string, unknown>,
    live_notes: raw.live_notes == null ? null : String(raw.live_notes),
    recommendation_notes: raw.recommendation_notes == null ? null : String(raw.recommendation_notes),
    quote_data:
      raw.quote_data && typeof raw.quote_data === "object" ? (raw.quote_data as Record<string, unknown>) : {},
    created_by: raw.created_by == null ? null : String(raw.created_by),
    updated_by: raw.updated_by == null ? null : String(raw.updated_by),
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
    archived_at: raw.archived_at == null ? null : String(raw.archived_at),
  };
}

export async function loadConsultationForTenant(
  tenantId: string,
  consultationId: string
): Promise<ConsultationRow | null> {
  const tid = tenantId.trim();
  const cid = consultationId.trim();
  if (!tid || !cid) return null;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_consultations")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", cid)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object") return null;
  return mapRow(data as Record<string, unknown>);
}

export type ListConsultationsOptions = {
  limit?: number;
  offset?: number;
  status?: ConsultationStatus;
};

export async function listConsultationsForTenant(
  tenantId: string,
  options: ListConsultationsOptions = {}
): Promise<ConsultationRow[]> {
  const tid = tenantId.trim();
  if (!tid) return [];

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);

  const supabase = supabaseAdmin();
  let q = supabase.from("fi_consultations").select("*").eq("tenant_id", tid).order("created_at", { ascending: false });

  if (options.status) {
    q = q.eq("status", options.status);
  }

  const { data, error } = await q.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapRow(row as Record<string, unknown>));
}
