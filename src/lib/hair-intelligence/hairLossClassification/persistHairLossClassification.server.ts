import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeHieHairLossReviewStatus } from "./enumValidation";
import type { HairIntelligenceHairLossClassificationInsert } from "./types";

export async function insertHairIntelligenceHairLossClassificationRow(
  row: HairIntelligenceHairLossClassificationInsert,
  client?: SupabaseClient
): Promise<{ id: string }> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("hair_intelligence_hair_loss_classifications")
    .insert({
      source_system: row.source_system,
      source_record_id: row.source_record_id,
      tenant_id: row.tenant_id,
      patient_id: row.patient_id,
      case_id: row.case_id,
      image_classification_id: row.image_classification_id,
      classification_system: row.classification_system,
      pattern_type: row.pattern_type,
      classification_grade: row.classification_grade,
      confidence_score: row.confidence_score,
      frontal_loss_score: row.frontal_loss_score,
      temporal_recession_score: row.temporal_recession_score,
      mid_scalp_score: row.mid_scalp_score,
      crown_loss_score: row.crown_loss_score,
      diffuse_thinning_score: row.diffuse_thinning_score,
      retrograde_pattern_detected: row.retrograde_pattern_detected,
      suspected_scarring_pattern: row.suspected_scarring_pattern,
      sex_classification: row.sex_classification,
      age_estimate_range: row.age_estimate_range,
      ai_notes: row.ai_notes,
      review_status: row.review_status,
      reviewed_by_user_id: row.reviewed_by_user_id,
      reviewed_at: row.reviewed_at,
      classifier_version: row.classifier_version,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: String((data as { id: string }).id) };
}

export async function updateHairIntelligenceHairLossClassificationReview(
  params: {
    id: string;
    tenantId: string;
    patch: {
      classification_system?: string;
      pattern_type?: string;
      classification_grade?: string;
      confidence_score?: number;
      frontal_loss_score?: number | null;
      temporal_recession_score?: number | null;
      mid_scalp_score?: number | null;
      crown_loss_score?: number | null;
      diffuse_thinning_score?: number | null;
      retrograde_pattern_detected?: boolean;
      suspected_scarring_pattern?: boolean;
      sex_classification?: string | null;
      age_estimate_range?: string | null;
      ai_notes?: string | null;
      review_status: string;
      reviewed_by_user_id: string | null;
      reviewed_at: string;
    };
  },
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  const reviewStatus = normalizeHieHairLossReviewStatus(params.patch.review_status);
  const { error } = await supabase
    .from("hair_intelligence_hair_loss_classifications")
    .update({
      classification_system: params.patch.classification_system,
      pattern_type: params.patch.pattern_type,
      classification_grade: params.patch.classification_grade,
      confidence_score: params.patch.confidence_score,
      frontal_loss_score: params.patch.frontal_loss_score,
      temporal_recession_score: params.patch.temporal_recession_score,
      mid_scalp_score: params.patch.mid_scalp_score,
      crown_loss_score: params.patch.crown_loss_score,
      diffuse_thinning_score: params.patch.diffuse_thinning_score,
      retrograde_pattern_detected: params.patch.retrograde_pattern_detected,
      suspected_scarring_pattern: params.patch.suspected_scarring_pattern,
      sex_classification: params.patch.sex_classification,
      age_estimate_range: params.patch.age_estimate_range,
      ai_notes: params.patch.ai_notes,
      review_status: reviewStatus,
      reviewed_by_user_id: params.patch.reviewed_by_user_id,
      reviewed_at: params.patch.reviewed_at,
    })
    .eq("id", params.id.trim())
    .eq("tenant_id", tid);
  if (error) throw new Error(error.message);
}
