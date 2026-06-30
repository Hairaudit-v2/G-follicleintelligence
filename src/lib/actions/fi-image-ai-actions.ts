"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertCrmTenantWriteAllowed,
  CrmAccessError,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import { tryResolveViewerStaffIdForTenant } from "@/src/lib/fi-os/featureAccess.server";
import { classifyFiPatientImageAndPersist } from "@/src/lib/hair-intelligence/imageClassification/adapters/fiOsPatientImageClassification.server";
import {
  buildFiPatientImageStorageRef,
  classificationResultToHliInsert,
  inferClinicalUseContextForFiPatientImage,
  insertHliImageClassificationRow,
} from "@/src/lib/hair-intelligence/imageClassification/persistHliClassification.server";
import {
  clampConfidence,
  normalizeFiAiHairState,
  normalizeFiAiImageCategory,
  normalizeFiAiShaveState,
  normalizeFiAiSurgeryStage,
} from "@/src/lib/hair-intelligence/imageClassification/enumValidation";
import type { FiAiImageClassificationResult } from "@/src/lib/imaging/aiImageClassificationTypes";
import { fiImageAiReviewBodySchema } from "@/src/lib/imaging/fiImageAiReviewValidation";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidatePatientImageRoutes(tenantId: string, patientId: string) {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  revalidatePath(`/fi-admin/${tid}/patients/${pid}/twin`);
  revalidatePath(`/fi-admin/${tid}/patients/${pid}`);
  revalidatePath(`/fi-admin/${tid}/patients/${pid}/imaging`);
}

export async function classifyPatientImageAction(
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

    await classifyFiPatientImageAndPersist({
      tenantId: tid,
      patientImageId: iid,
      client: supabase,
    });
    revalidatePatientImageRoutes(tid, pid);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updatePatientImageClassificationReviewAction(
  tenantId: string,
  patientId: string,
  patientImageId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = fiImageAiReviewBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });
    const tid = tenantId.trim();
    const pid = patientId.trim();
    const iid = patientImageId.trim();
    const supabase = supabaseAdmin();

    const { data: img, error: imgErr } = await supabase
      .from("fi_patient_images")
      .select("*")
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .eq("id", iid)
      .eq("image_status", "active")
      .maybeSingle();
    if (imgErr) throw new Error(imgErr.message);
    if (!img) throw new Error("Image not found for this patient.");

    const x = img as Record<string, unknown>;
    const bucket = String(x.storage_bucket ?? "patient-images");
    const path = String(x.storage_path ?? "");
    const caseId = x.case_id != null ? String(x.case_id) : null;
    const consultationId = x.consultation_id != null ? String(x.consultation_id) : null;

    const fiUserId = await tryResolveFiUserIdForTenant(tid, undefined);
    const staffId = fiUserId ? await tryResolveViewerStaffIdForTenant(tid, fiUserId) : null;

    const now = new Date().toISOString();

    const merged: FiAiImageClassificationResult = {
      category: normalizeFiAiImageCategory(parsed.ai_image_category ?? x.ai_image_category),
      categoryConfidence: clampConfidence(x.ai_image_category_confidence ?? 0),
      hairState: normalizeFiAiHairState(parsed.ai_hair_state ?? x.ai_hair_state),
      shaveState: normalizeFiAiShaveState(parsed.ai_shave_state ?? x.ai_shave_state),
      surgeryStage: normalizeFiAiSurgeryStage(parsed.ai_surgery_stage ?? x.ai_surgery_stage),
      notes:
        parsed.ai_image_ai_notes !== undefined
          ? (parsed.ai_image_ai_notes ?? "").trim().slice(0, 8000)
          : String(x.ai_image_ai_notes ?? "")
              .trim()
              .slice(0, 8000),
    };

    const { error: upErr } = await supabase
      .from("fi_patient_images")
      .update({
        ai_image_category: merged.category,
        ai_hair_state: merged.hairState,
        ai_shave_state: merged.shaveState,
        ai_surgery_stage: merged.surgeryStage,
        ai_image_ai_notes: merged.notes || null,
        ai_image_review_status: parsed.ai_image_review_status,
        ai_image_reviewed_by_staff_id: staffId,
        ai_image_reviewed_at: now,
        updated_at: now,
      })
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .eq("id", iid);
    if (upErr) throw new Error(upErr.message);

    const storageRef = buildFiPatientImageStorageRef(bucket, path);
    const clinicalContext = inferClinicalUseContextForFiPatientImage({
      case_id: caseId,
      consultation_id: consultationId,
    });

    await insertHliImageClassificationRow(
      classificationResultToHliInsert({
        sourceSystem: "fi_os",
        sourceRecordId: iid,
        tenantId: tid,
        patientId: pid,
        caseId: caseId,
        storageRef,
        clinicalUseContext: clinicalContext,
        result: merged,
        classifierVersion: String(x.ai_image_classifier_version ?? "staff_review"),
        reviewStatus: parsed.ai_image_review_status,
        reviewedByUserId: fiUserId,
        reviewedAt: now,
      }),
      supabase
    );

    revalidatePatientImageRoutes(tid, pid);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
