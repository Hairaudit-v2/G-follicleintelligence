import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeHieRecipientReviewStatus } from "./enumValidation";
import type { HairIntelligenceRecipientCandidacyReviewInsert } from "./types";

export async function insertHairIntelligenceRecipientCandidacyReviewRow(
  row: HairIntelligenceRecipientCandidacyReviewInsert,
  client?: SupabaseClient
): Promise<{ id: string }> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("hair_intelligence_recipient_candidacy_reviews")
    .insert({
      source_system: row.source_system,
      source_record_id: row.source_record_id,
      tenant_id: row.tenant_id,
      patient_id: row.patient_id,
      case_id: row.case_id,
      hair_loss_classification_id: row.hair_loss_classification_id,
      donor_assessment_id: row.donor_assessment_id,
      recipient_image_classification_id: row.recipient_image_classification_id,
      progression_velocity: row.progression_velocity,
      recipient_quality_rating: row.recipient_quality_rating,
      confidence_score: row.confidence_score,
      diffuse_thinning_risk: row.diffuse_thinning_risk,
      shock_loss_risk: row.shock_loss_risk,
      density_expectation_risk: row.density_expectation_risk,
      medication_stabilisation_needed: row.medication_stabilisation_needed,
      pathology_review_recommended: row.pathology_review_recommended,
      surgical_timing_risk: row.surgical_timing_risk,
      patient_expectation_risk: row.patient_expectation_risk,
      documentation_gap_detected: row.documentation_gap_detected,
      candidacy_summary: row.candidacy_summary,
      review_topics: row.review_topics,
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

export async function updateHairIntelligenceRecipientCandidacyReview(
  params: {
    id: string;
    tenantId: string;
    patch: {
      recipient_quality_rating?: string;
      confidence_score?: number;
      diffuse_thinning_risk?: string | null;
      shock_loss_risk?: string | null;
      density_expectation_risk?: string | null;
      medication_stabilisation_needed?: boolean;
      pathology_review_recommended?: boolean;
      surgical_timing_risk?: string | null;
      patient_expectation_risk?: string | null;
      documentation_gap_detected?: boolean;
      candidacy_summary?: string | null;
      review_topics?: string[];
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
  const reviewStatus = normalizeHieRecipientReviewStatus(params.patch.review_status);
  const { error } = await supabase
    .from("hair_intelligence_recipient_candidacy_reviews")
    .update({
      recipient_quality_rating: params.patch.recipient_quality_rating,
      confidence_score: params.patch.confidence_score,
      diffuse_thinning_risk: params.patch.diffuse_thinning_risk,
      shock_loss_risk: params.patch.shock_loss_risk,
      density_expectation_risk: params.patch.density_expectation_risk,
      medication_stabilisation_needed: params.patch.medication_stabilisation_needed,
      pathology_review_recommended: params.patch.pathology_review_recommended,
      surgical_timing_risk: params.patch.surgical_timing_risk,
      patient_expectation_risk: params.patch.patient_expectation_risk,
      documentation_gap_detected: params.patch.documentation_gap_detected,
      candidacy_summary: params.patch.candidacy_summary,
      review_topics: params.patch.review_topics,
      ai_notes: params.patch.ai_notes,
      review_status: reviewStatus,
      reviewed_by_user_id: params.patch.reviewed_by_user_id,
      reviewed_at: params.patch.reviewed_at,
    })
    .eq("id", params.id.trim())
    .eq("tenant_id", tid);
  if (error) throw new Error(error.message);
}
