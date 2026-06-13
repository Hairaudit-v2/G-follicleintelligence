import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeHieConsultationReviewStatus } from "./enumValidation";
import type { HairIntelligenceConsultationChecklistInsert } from "./types";

export async function insertHairIntelligenceConsultationChecklistRow(
  row: HairIntelligenceConsultationChecklistInsert,
  client?: SupabaseClient
): Promise<{ id: string }> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("hair_intelligence_consultation_checklists")
    .insert({
      source_system: row.source_system,
      source_record_id: row.source_record_id,
      tenant_id: row.tenant_id,
      patient_id: row.patient_id,
      case_id: row.case_id,
      hair_loss_classification_id: row.hair_loss_classification_id,
      donor_assessment_id: row.donor_assessment_id,
      recipient_review_id: row.recipient_review_id,
      confidence_score: row.confidence_score,
      checklist_status: row.checklist_status,
      priority_level: row.priority_level,
      medication_discussion_required: row.medication_discussion_required,
      stabilisation_discussion_required: row.stabilisation_discussion_required,
      donor_preservation_discussion_required: row.donor_preservation_discussion_required,
      expectation_management_required: row.expectation_management_required,
      consent_complexity_level: row.consent_complexity_level,
      documentation_required: row.documentation_required,
      follow_up_required: row.follow_up_required,
      delay_recommended: row.delay_recommended,
      consultation_summary: row.consultation_summary,
      checklist_items: row.checklist_items,
      risk_flags: row.risk_flags,
      ai_notes: row.ai_notes,
      review_status: row.review_status,
      reviewed_by_user_id: row.reviewed_by_user_id,
      reviewed_at: row.reviewed_at,
      generator_version: row.generator_version,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: String((data as { id: string }).id) };
}

export async function updateHairIntelligenceConsultationChecklistReview(
  params: {
    id: string;
    tenantId: string;
    patch: {
      priority_level?: string;
      medication_discussion_required?: boolean;
      stabilisation_discussion_required?: boolean;
      donor_preservation_discussion_required?: boolean;
      expectation_management_required?: boolean;
      consent_complexity_level?: string | null;
      documentation_required?: boolean;
      follow_up_required?: boolean;
      delay_recommended?: boolean;
      consultation_summary?: string | null;
      checklist_items?: string[];
      risk_flags?: string[];
      ai_notes?: string | null;
      checklist_status?: string;
      review_status: string;
      reviewed_by_user_id: string | null;
      reviewed_at: string;
      confidence_score?: number;
    };
  },
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  const reviewStatus = normalizeHieConsultationReviewStatus(params.patch.review_status);
  const { error } = await supabase
    .from("hair_intelligence_consultation_checklists")
    .update({
      priority_level: params.patch.priority_level,
      medication_discussion_required: params.patch.medication_discussion_required,
      stabilisation_discussion_required: params.patch.stabilisation_discussion_required,
      donor_preservation_discussion_required: params.patch.donor_preservation_discussion_required,
      expectation_management_required: params.patch.expectation_management_required,
      consent_complexity_level: params.patch.consent_complexity_level,
      documentation_required: params.patch.documentation_required,
      follow_up_required: params.patch.follow_up_required,
      delay_recommended: params.patch.delay_recommended,
      consultation_summary: params.patch.consultation_summary,
      checklist_items: params.patch.checklist_items,
      risk_flags: params.patch.risk_flags,
      ai_notes: params.patch.ai_notes,
      checklist_status: params.patch.checklist_status,
      confidence_score: params.patch.confidence_score,
      review_status: reviewStatus,
      reviewed_by_user_id: params.patch.reviewed_by_user_id,
      reviewed_at: params.patch.reviewed_at,
    })
    .eq("id", params.id.trim())
    .eq("tenant_id", tid);
  if (error) throw new Error(error.message);
}
