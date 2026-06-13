import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeHieDonorReviewStatus } from "./enumValidation";
import type { HairIntelligenceDonorAssessmentInsert } from "./types";

export async function insertHairIntelligenceDonorAssessmentRow(
  row: HairIntelligenceDonorAssessmentInsert,
  client?: SupabaseClient
): Promise<{ id: string }> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("hair_intelligence_donor_assessments")
    .insert({
      source_system: row.source_system,
      source_record_id: row.source_record_id,
      tenant_id: row.tenant_id,
      patient_id: row.patient_id,
      case_id: row.case_id,
      image_classification_id: row.image_classification_id,
      hair_loss_classification_id: row.hair_loss_classification_id,
      donor_region: row.donor_region,
      donor_quality_rating: row.donor_quality_rating,
      confidence_score: row.confidence_score,
      estimated_density_band: row.estimated_density_band,
      miniaturisation_risk: row.miniaturisation_risk,
      retrograde_risk: row.retrograde_risk,
      overharvesting_risk: row.overharvesting_risk,
      safe_donor_capacity_band: row.safe_donor_capacity_band,
      lifetime_graft_budget_band: row.lifetime_graft_budget_band,
      extraction_caution_level: row.extraction_caution_level,
      clinical_observations: row.clinical_observations,
      ai_notes: row.ai_notes,
      review_status: row.review_status,
      reviewed_by_user_id: row.reviewed_by_user_id,
      reviewed_at: row.reviewed_at,
      assessor_version: row.assessor_version,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: String((data as { id: string }).id) };
}

export async function updateHairIntelligenceDonorAssessmentReview(
  params: {
    id: string;
    tenantId: string;
    patch: {
      donor_region?: string;
      donor_quality_rating?: string;
      confidence_score?: number;
      estimated_density_band?: string | null;
      miniaturisation_risk?: string | null;
      retrograde_risk?: string | null;
      overharvesting_risk?: string | null;
      safe_donor_capacity_band?: string | null;
      lifetime_graft_budget_band?: string | null;
      extraction_caution_level?: string | null;
      clinical_observations?: string | null;
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
  const reviewStatus = normalizeHieDonorReviewStatus(params.patch.review_status);
  const { error } = await supabase
    .from("hair_intelligence_donor_assessments")
    .update({
      donor_region: params.patch.donor_region,
      donor_quality_rating: params.patch.donor_quality_rating,
      confidence_score: params.patch.confidence_score,
      estimated_density_band: params.patch.estimated_density_band,
      miniaturisation_risk: params.patch.miniaturisation_risk,
      retrograde_risk: params.patch.retrograde_risk,
      overharvesting_risk: params.patch.overharvesting_risk,
      safe_donor_capacity_band: params.patch.safe_donor_capacity_band,
      lifetime_graft_budget_band: params.patch.lifetime_graft_budget_band,
      extraction_caution_level: params.patch.extraction_caution_level,
      clinical_observations: params.patch.clinical_observations,
      ai_notes: params.patch.ai_notes,
      review_status: reviewStatus,
      reviewed_by_user_id: params.patch.reviewed_by_user_id,
      reviewed_at: params.patch.reviewed_at,
    })
    .eq("id", params.id.trim())
    .eq("tenant_id", tid);
  if (error) throw new Error(error.message);
}
