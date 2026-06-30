import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  PatientTwinHairLossClassificationRow,
  PatientTwinHairLossSection,
} from "./patientTwinTypes";

function mapRow(x: Record<string, unknown>): PatientTwinHairLossClassificationRow {
  return {
    id: String(x.id),
    source_record_id: x.source_record_id != null ? String(x.source_record_id) : null,
    classification_system: String(x.classification_system ?? ""),
    pattern_type: String(x.pattern_type ?? ""),
    classification_grade: String(x.classification_grade ?? ""),
    confidence_score:
      typeof x.confidence_score === "number" ? x.confidence_score : Number(x.confidence_score ?? 0),
    frontal_loss_score: x.frontal_loss_score != null ? Number(x.frontal_loss_score) : null,
    temporal_recession_score:
      x.temporal_recession_score != null ? Number(x.temporal_recession_score) : null,
    mid_scalp_score: x.mid_scalp_score != null ? Number(x.mid_scalp_score) : null,
    crown_loss_score: x.crown_loss_score != null ? Number(x.crown_loss_score) : null,
    diffuse_thinning_score:
      x.diffuse_thinning_score != null ? Number(x.diffuse_thinning_score) : null,
    retrograde_pattern_detected: Boolean(x.retrograde_pattern_detected),
    suspected_scarring_pattern: Boolean(x.suspected_scarring_pattern),
    sex_classification: x.sex_classification != null ? String(x.sex_classification) : null,
    review_status: String(x.review_status ?? "pending"),
    ai_notes: x.ai_notes != null ? String(x.ai_notes) : null,
    created_at: String(x.created_at ?? ""),
  };
}

const RECENT_CAP = 5;

export async function loadPatientTwinHairLossSection(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<PatientTwinHairLossSection> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();

  const { data, error } = await supabase
    .from("hair_intelligence_hair_loss_classifications")
    .select("*")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .order("created_at", { ascending: false })
    .limit(RECENT_CAP);

  if (error) {
    const m = error.message ?? "";
    if (m.includes("does not exist") || m.includes("schema cache")) {
      return { latest: null, recent: [], recent_cap: RECENT_CAP };
    }
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const recent = rows.map(mapRow);
  return {
    latest: recent[0] ?? null,
    recent,
    recent_cap: RECENT_CAP,
  };
}
