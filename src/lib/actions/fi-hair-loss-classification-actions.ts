"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertCrmTenantWriteAllowed,
  CrmAccessError,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import { classifyFiOsPatientImageHairLossAndPersist } from "@/src/lib/hair-intelligence/hairLossClassification/adapters/fiOsHairLossClassification.server";
import { hairLossClassificationReviewBodySchema } from "@/src/lib/hair-intelligence/hairLossClassification/classificationReviewValidation";
import {
  clampHairLossConfidence,
  normalizeClassificationGradeForSystem,
  normalizeHieHairLossClassificationSystem,
  normalizeHieHairLossPatternType,
  normalizeHieSexClassification,
} from "@/src/lib/hair-intelligence/hairLossClassification/enumValidation";
import { updateHairIntelligenceHairLossClassificationReview } from "@/src/lib/hair-intelligence/hairLossClassification/persistHairLossClassification.server";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidatePatientTwin(tenantId: string, patientId: string) {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  revalidatePath(`/fi-admin/${tid}/patients/${pid}/twin`);
  revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
}

export async function classifyPatientHairLossAction(
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

    await classifyFiOsPatientImageHairLossAndPersist({
      tenantId: tid,
      patientImageId: iid,
      client: supabase,
    });
    revalidatePatientTwin(tid, pid);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateHairLossClassificationReviewAction(
  tenantId: string,
  patientId: string,
  classificationId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = hairLossClassificationReviewBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    const cid = classificationId.trim();
    const supabase = supabaseAdmin();

    const { data: row, error } = await supabase
      .from("hair_intelligence_hair_loss_classifications")
      .select("*")
      .eq("id", cid)
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Classification not found for this patient.");

    const x = row as Record<string, unknown>;
    const fiUserId = await tryResolveFiUserIdForTenant(tid, undefined);
    const now = new Date().toISOString();

    const system = normalizeHieHairLossClassificationSystem(
      parsed.classification_system ?? x.classification_system
    );
    const pattern = normalizeHieHairLossPatternType(parsed.pattern_type ?? x.pattern_type);
    const gradeRaw = parsed.classification_grade ?? x.classification_grade;
    const grade = normalizeClassificationGradeForSystem(system, gradeRaw);

    const merged = {
      classification_system: system,
      pattern_type: pattern,
      classification_grade: grade,
      confidence_score:
        parsed.confidence_score !== undefined
          ? clampHairLossConfidence(parsed.confidence_score)
          : clampHairLossConfidence(Number(x.confidence_score ?? 0)),
      frontal_loss_score:
        parsed.frontal_loss_score !== undefined
          ? parsed.frontal_loss_score
          : (x.frontal_loss_score as number | null),
      temporal_recession_score:
        parsed.temporal_recession_score !== undefined
          ? parsed.temporal_recession_score
          : (x.temporal_recession_score as number | null),
      mid_scalp_score:
        parsed.mid_scalp_score !== undefined
          ? parsed.mid_scalp_score
          : (x.mid_scalp_score as number | null),
      crown_loss_score:
        parsed.crown_loss_score !== undefined
          ? parsed.crown_loss_score
          : (x.crown_loss_score as number | null),
      diffuse_thinning_score:
        parsed.diffuse_thinning_score !== undefined
          ? parsed.diffuse_thinning_score
          : (x.diffuse_thinning_score as number | null),
      retrograde_pattern_detected:
        parsed.retrograde_pattern_detected !== undefined
          ? parsed.retrograde_pattern_detected
          : Boolean(x.retrograde_pattern_detected),
      suspected_scarring_pattern:
        parsed.suspected_scarring_pattern !== undefined
          ? parsed.suspected_scarring_pattern
          : Boolean(x.suspected_scarring_pattern),
      sex_classification:
        parsed.sex_classification !== undefined && parsed.sex_classification !== null
          ? normalizeHieSexClassification(parsed.sex_classification)
          : x.sex_classification != null
            ? normalizeHieSexClassification(x.sex_classification)
            : null,
      age_estimate_range:
        parsed.age_estimate_range !== undefined
          ? parsed.age_estimate_range
          : (x.age_estimate_range as string | null),
      ai_notes: parsed.ai_notes !== undefined ? parsed.ai_notes : (x.ai_notes as string | null),
      review_status: parsed.review_status,
      reviewed_by_user_id: fiUserId,
      reviewed_at: now,
    };

    await updateHairIntelligenceHairLossClassificationReview(
      {
        id: cid,
        tenantId: tid,
        patch: merged,
      },
      supabase
    );

    revalidatePatientTwin(tid, pid);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
