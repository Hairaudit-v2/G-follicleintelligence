import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createPatientImageSignedUrls } from "@/src/lib/patientImages/patientImagesServer";
import { classifyClinicalHairImageFromModelUrl } from "../classifyClinicalHairImage.server";
import type { FiAiImageClassificationResult } from "../types";
import {
  buildFiPatientImageStorageRef,
  classificationResultToHliInsert,
  inferClinicalUseContextForFiPatientImage,
  insertHliImageClassificationRow,
} from "../persistHliClassification.server";

export type ClassifyFiPatientImageParams = {
  tenantId: string;
  patientImageId: string;
  actorUserId?: string | null;
  client?: SupabaseClient;
};

export type ClassifyFiPatientImageResult = {
  result: FiAiImageClassificationResult;
  classifierVersion: string;
  usedOpenAi: boolean;
};

/**
 * FI OS adapter: tenant-safe load, signed URL for model only, persist `hli_image_classifications` + `fi_patient_images`.
 */
export async function classifyFiPatientImageAndPersist(params: ClassifyFiPatientImageParams): Promise<ClassifyFiPatientImageResult> {
  const supabase = params.client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  const iid = params.patientImageId.trim();

  const { data: row, error } = await supabase
    .from("fi_patient_images")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", iid)
    .eq("image_status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Patient image not found.");

  const mapped = row as Record<string, unknown>;
  const bucket = String(mapped.storage_bucket ?? "patient-images");
  const path = String(mapped.storage_path ?? "");
  if (!path) throw new Error("Image storage path missing.");

  const signedMap = await createPatientImageSignedUrls([{ id: iid, storage_bucket: bucket, storage_path: path }], supabase);
  const signed = signedMap.get(iid);
  if (!signed?.url) throw new Error("Could not create signed URL for classification.");

  const { result, classifierVersion, usedOpenAi } = await classifyClinicalHairImageFromModelUrl({
    imageUrlForModel: signed.url,
  });

  const patientId = mapped.patient_id != null ? String(mapped.patient_id) : null;
  const caseId = mapped.case_id != null ? String(mapped.case_id) : null;
  const consultationId = mapped.consultation_id != null ? String(mapped.consultation_id) : null;

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
      patientId,
      caseId,
      storageRef,
      clinicalUseContext: clinicalContext,
      result,
      classifierVersion,
      reviewStatus: "pending",
      reviewedByUserId: null,
      reviewedAt: null,
    }),
    supabase
  );

  const now = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("fi_patient_images")
    .update({
      ai_image_category: result.category,
      ai_image_category_confidence: result.categoryConfidence,
      ai_hair_state: result.hairState,
      ai_shave_state: result.shaveState,
      ai_surgery_stage: result.surgeryStage,
      ai_image_ai_notes: result.notes?.trim() ? result.notes.trim().slice(0, 8000) : null,
      ai_image_review_status: "pending",
      ai_image_reviewed_by_staff_id: null,
      ai_image_reviewed_at: null,
      ai_image_classified_at: now,
      ai_image_classifier_version: classifierVersion,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", iid);
  if (upErr) throw new Error(upErr.message);

  return { result, classifierVersion, usedOpenAi };
}
