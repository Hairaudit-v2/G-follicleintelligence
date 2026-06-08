import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { pathologyAiInterpretationJsonSchema } from "./pathologyAiInterpretationSchema";
import type { PathologyAiInterpretationRow } from "./pathologyAiInterpretationTypes";

function mapUnknownArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function mapPathologyAiInterpretationRow(row: Record<string, unknown>): PathologyAiInterpretationRow {
  const parsed = pathologyAiInterpretationJsonSchema.parse(row.interpretation_json);
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    patient_id: String(row.patient_id),
    pathology_result_id: String(row.pathology_result_id),
    status: String(row.status) as PathologyAiInterpretationRow["status"],
    model_name: row.model_name != null ? String(row.model_name) : null,
    interpretation_json: parsed,
    doctor_summary: row.doctor_summary != null ? String(row.doctor_summary) : null,
    patient_friendly_summary: row.patient_friendly_summary != null ? String(row.patient_friendly_summary) : null,
    clinical_flags: mapUnknownArray(row.clinical_flags),
    treatment_recommendations: mapUnknownArray(row.treatment_recommendations),
    surgical_readiness_score:
      row.surgical_readiness_score != null && Number.isFinite(Number(row.surgical_readiness_score))
        ? Number(row.surgical_readiness_score)
        : null,
    hair_loss_relevance_score:
      row.hair_loss_relevance_score != null && Number.isFinite(Number(row.hair_loss_relevance_score))
        ? Number(row.hair_loss_relevance_score)
        : null,
    reviewed_by_user_id: row.reviewed_by_user_id != null ? String(row.reviewed_by_user_id) : null,
    reviewed_at: row.reviewed_at != null ? String(row.reviewed_at) : null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function loadLatestPathologyAiInterpretation(
  tenantId: string,
  patientId: string,
  resultId: string,
  client?: SupabaseClient
): Promise<PathologyAiInterpretationRow | null> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_pathology_ai_interpretations")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("patient_id", patientId.trim())
    .eq("pathology_result_id", resultId.trim())
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPathologyAiInterpretationRow(data as Record<string, unknown>) : null;
}

export async function loadLatestPatientPathologyAiInterpretation(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<PathologyAiInterpretationRow | null> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_pathology_ai_interpretations")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("patient_id", patientId.trim())
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPathologyAiInterpretationRow(data as Record<string, unknown>) : null;
}
