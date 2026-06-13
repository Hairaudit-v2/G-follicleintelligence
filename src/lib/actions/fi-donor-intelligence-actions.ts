"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertCrmTenantWriteAllowed,
  CrmAccessError,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import { assessFiOsPatientDonorAndPersist } from "@/src/lib/hair-intelligence/donorIntelligence/adapters/fiOsDonorAssessment.server";
import { donorAssessmentReviewBodySchema } from "@/src/lib/hair-intelligence/donorIntelligence/donorAssessmentReviewValidation";
import {
  clampDonorConfidence,
  normalizeHieDonorDensityBand,
  normalizeHieDonorQualityRating,
  normalizeHieDonorRegion,
  normalizeHieDonorRiskLevel,
  normalizeHieExtractionCautionLevel,
  normalizeHieLifetimeGraftBudgetBand,
  normalizeHieSafeDonorCapacityBand,
} from "@/src/lib/hair-intelligence/donorIntelligence/enumValidation";
import { updateHairIntelligenceDonorAssessmentReview } from "@/src/lib/hair-intelligence/donorIntelligence/persistDonorAssessment.server";

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

export async function assessPatientDonorImageAction(
  tenantId: string,
  patientId: string,
  patientImageId: string,
  body?: { adminKey?: string | null } | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const adminKey = body && typeof body === "object" ? body.adminKey : undefined;
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: adminKey ?? undefined, request: undefined });
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

    await assessFiOsPatientDonorAndPersist({ tenantId: tid, patientImageId: iid, client: supabase });
    revalidatePatientTwinAndImaging(tid, pid);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateDonorAssessmentReviewAction(
  tenantId: string,
  patientId: string,
  assessmentId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = donorAssessmentReviewBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    const aid = assessmentId.trim();
    const supabase = supabaseAdmin();

    const { data: row, error } = await supabase
      .from("hair_intelligence_donor_assessments")
      .select("*")
      .eq("id", aid)
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Donor assessment not found for this patient.");

    const x = row as Record<string, unknown>;
    const fiUserId = await tryResolveFiUserIdForTenant(tid, undefined);
    const now = new Date().toISOString();

    const merged = {
      donor_region: normalizeHieDonorRegion(parsed.donor_region ?? x.donor_region),
      donor_quality_rating: normalizeHieDonorQualityRating(parsed.donor_quality_rating ?? x.donor_quality_rating),
      confidence_score:
        parsed.confidence_score !== undefined
          ? clampDonorConfidence(parsed.confidence_score)
          : clampDonorConfidence(Number(x.confidence_score ?? 0)),
      estimated_density_band:
        parsed.estimated_density_band !== undefined
          ? normalizeHieDonorDensityBand(parsed.estimated_density_band)
          : normalizeHieDonorDensityBand(x.estimated_density_band),
      miniaturisation_risk:
        parsed.miniaturisation_risk !== undefined
          ? normalizeHieDonorRiskLevel(parsed.miniaturisation_risk)
          : normalizeHieDonorRiskLevel(x.miniaturisation_risk),
      retrograde_risk:
        parsed.retrograde_risk !== undefined
          ? normalizeHieDonorRiskLevel(parsed.retrograde_risk)
          : normalizeHieDonorRiskLevel(x.retrograde_risk),
      overharvesting_risk:
        parsed.overharvesting_risk !== undefined
          ? normalizeHieDonorRiskLevel(parsed.overharvesting_risk)
          : normalizeHieDonorRiskLevel(x.overharvesting_risk),
      safe_donor_capacity_band:
        parsed.safe_donor_capacity_band !== undefined
          ? normalizeHieSafeDonorCapacityBand(parsed.safe_donor_capacity_band)
          : normalizeHieSafeDonorCapacityBand(x.safe_donor_capacity_band),
      lifetime_graft_budget_band:
        parsed.lifetime_graft_budget_band !== undefined
          ? normalizeHieLifetimeGraftBudgetBand(parsed.lifetime_graft_budget_band)
          : normalizeHieLifetimeGraftBudgetBand(x.lifetime_graft_budget_band),
      extraction_caution_level:
        parsed.extraction_caution_level !== undefined
          ? normalizeHieExtractionCautionLevel(parsed.extraction_caution_level)
          : normalizeHieExtractionCautionLevel(x.extraction_caution_level),
      clinical_observations:
        parsed.clinical_observations !== undefined ? parsed.clinical_observations : (x.clinical_observations as string | null),
      ai_notes: parsed.ai_notes !== undefined ? parsed.ai_notes : (x.ai_notes as string | null),
      review_status: parsed.review_status,
      reviewed_by_user_id: fiUserId,
      reviewed_at: now,
    };

    await updateHairIntelligenceDonorAssessmentReview(
      {
        id: aid,
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
