"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertCrmTenantWriteAllowed,
  CrmAccessError,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import { assessFiOsPatientRecipientAndPersist } from "@/src/lib/hair-intelligence/recipientCandidacy/adapters/fiOsRecipientAssessment.server";
import { recipientAssessmentReviewBodySchema } from "@/src/lib/hair-intelligence/recipientCandidacy/recipientAssessmentReviewValidation";
import {
  clampRecipientConfidence,
  normalizeHieRecipientQualityRating,
  normalizeHieRecipientRiskLevel,
  normalizeHieRecipientSurgicalTimingRisk,
} from "@/src/lib/hair-intelligence/recipientCandidacy/enumValidation";
import { updateHairIntelligenceRecipientCandidacyReview } from "@/src/lib/hair-intelligence/recipientCandidacy/persistRecipientAssessment.server";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidatePatientTwinAndImaging(tenantId: string, patientId: string) {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  revalidatePath(`/fi-admin/${tid}/patients/${pid}/twin`);
  revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
  revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
}

export async function assessPatientRecipientCandidacyAction(
  tenantId: string,
  patientId: string,
  patientImageId: string,
  body?: { adminKey?: string | null } | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const adminKey = body && typeof body === "object" ? body.adminKey : undefined;
    await assertCrmTenantWriteAllowed({
      tenantId,
      adminKey: adminKey ?? undefined,
      request: undefined,
    });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    const iid = patientImageId.trim();

    const supabase = supabaseAdmin();
    const { data: row, error } = await supabase
      .from("fi_patient_images")
      .select("id")
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .eq("id", iid)
      .eq("image_status", "active")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Image not found for this patient.");

    await assessFiOsPatientRecipientAndPersist({
      tenantId: tid,
      patientImageId: iid,
      client: supabase,
    });
    revalidatePatientTwinAndImaging(tid, pid);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateRecipientAssessmentReviewAction(
  tenantId: string,
  patientId: string,
  reviewId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = recipientAssessmentReviewBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    const rid = reviewId.trim();
    const supabase = supabaseAdmin();

    const { data: row, error } = await supabase
      .from("hair_intelligence_recipient_candidacy_reviews")
      .select("*")
      .eq("id", rid)
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Recipient candidacy review not found for this patient.");

    const x = row as Record<string, unknown>;
    const fiUserId = await tryResolveFiUserIdForTenant(tid, undefined);
    const now = new Date().toISOString();

    const existingTopics = Array.isArray(x.review_topics)
      ? (x.review_topics as unknown[]).filter((t): t is string => typeof t === "string")
      : [];

    const merged = {
      recipient_quality_rating: normalizeHieRecipientQualityRating(
        parsed.recipient_quality_rating ?? x.recipient_quality_rating
      ),
      confidence_score:
        parsed.confidence_score !== undefined
          ? clampRecipientConfidence(parsed.confidence_score)
          : clampRecipientConfidence(Number(x.confidence_score ?? 0)),
      diffuse_thinning_risk:
        parsed.diffuse_thinning_risk !== undefined
          ? normalizeHieRecipientRiskLevel(parsed.diffuse_thinning_risk)
          : normalizeHieRecipientRiskLevel(x.diffuse_thinning_risk),
      shock_loss_risk:
        parsed.shock_loss_risk !== undefined
          ? normalizeHieRecipientRiskLevel(parsed.shock_loss_risk)
          : normalizeHieRecipientRiskLevel(x.shock_loss_risk),
      density_expectation_risk:
        parsed.density_expectation_risk !== undefined
          ? normalizeHieRecipientRiskLevel(parsed.density_expectation_risk)
          : normalizeHieRecipientRiskLevel(x.density_expectation_risk),
      surgical_timing_risk:
        parsed.surgical_timing_risk !== undefined
          ? normalizeHieRecipientSurgicalTimingRisk(parsed.surgical_timing_risk)
          : normalizeHieRecipientSurgicalTimingRisk(x.surgical_timing_risk),
      patient_expectation_risk:
        parsed.patient_expectation_risk !== undefined
          ? normalizeHieRecipientRiskLevel(parsed.patient_expectation_risk)
          : normalizeHieRecipientRiskLevel(x.patient_expectation_risk),
      medication_stabilisation_needed:
        parsed.medication_stabilisation_needed !== undefined
          ? parsed.medication_stabilisation_needed
          : Boolean(x.medication_stabilisation_needed),
      pathology_review_recommended:
        parsed.pathology_review_recommended !== undefined
          ? parsed.pathology_review_recommended
          : Boolean(x.pathology_review_recommended),
      documentation_gap_detected:
        parsed.documentation_gap_detected !== undefined
          ? parsed.documentation_gap_detected
          : Boolean(x.documentation_gap_detected),
      candidacy_summary:
        parsed.candidacy_summary !== undefined
          ? parsed.candidacy_summary
          : (x.candidacy_summary as string | null),
      ai_notes: parsed.ai_notes !== undefined ? parsed.ai_notes : (x.ai_notes as string | null),
      review_topics: parsed.review_topics !== undefined ? parsed.review_topics : existingTopics,
      review_status: parsed.review_status,
      reviewed_by_user_id: fiUserId,
      reviewed_at: now,
    };

    await updateHairIntelligenceRecipientCandidacyReview(
      {
        id: rid,
        tenantId: tid,
        patch: merged,
      },
      supabase
    );

    revalidatePatientTwinAndImaging(tid, pid);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
