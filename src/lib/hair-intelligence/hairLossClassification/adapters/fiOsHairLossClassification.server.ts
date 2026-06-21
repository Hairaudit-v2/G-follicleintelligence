import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createPatientImageSignedUrls } from "@/src/lib/patientImages/patientImagesServer";
import { classifyAndPersistHairLossClassification } from "../classifyHairLoss.server";
import type { HairLossClassificationModelResult } from "../types";
import { publishAuditEvent } from "@/src/lib/analytics-os/analyticsModulePublishers";

export type ClassifyFiOsPatientImageHairLossParams = {
  tenantId: string;
  patientImageId: string;
  client?: SupabaseClient;
};

export type ClassifyFiOsPatientImageHairLossResult = {
  result: HairLossClassificationModelResult;
  classifierVersion: string;
  usedOpenAi: boolean;
  persistedId: string;
};

async function latestImageClassificationIdForFiPatientImage(
  supabase: SupabaseClient,
  patientImageId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("hli_image_classifications")
    .select("id")
    .eq("source_system", "fi_os")
    .eq("source_record_id", patientImageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return String((data as { id: string }).id);
}

/**
 * FI OS: tenant-safe image load, signed URL for model only, persist shared hair loss classification.
 * Does not write to fi_patient_images.
 */
export async function classifyFiOsPatientImageHairLossAndPersist(
  params: ClassifyFiOsPatientImageHairLossParams
): Promise<ClassifyFiOsPatientImageHairLossResult> {
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

  const patientId = mapped.patient_id != null ? String(mapped.patient_id) : null;
  const caseId = mapped.case_id != null ? String(mapped.case_id) : null;
  const imageClassificationId = await latestImageClassificationIdForFiPatientImage(supabase, iid);

  const { result, classifierVersion, usedOpenAi, persisted } = await classifyAndPersistHairLossClassification(
    {
      source_system: "fi_os",
      source_record_id: iid,
      tenant_id: tid,
      patient_id: patientId,
      case_id: caseId,
      image_classification_id: imageClassificationId,
      classification_system: "custom",
      pattern_type: "unknown",
      classification_grade: "unknown",
      confidence_score: 0,
      frontal_loss_score: null,
      temporal_recession_score: null,
      mid_scalp_score: null,
      crown_loss_score: null,
      diffuse_thinning_score: null,
      retrograde_pattern_detected: false,
      suspected_scarring_pattern: false,
      sex_classification: null,
      age_estimate_range: null,
      ai_notes: null,
      review_status: "pending",
      reviewed_by_user_id: null,
      reviewed_at: null,
      classifier_version: null,
      imageUrlForModel: signed.url,
    },
    supabase
  );

  void publishAuditEvent({
    tenantId: tid,
    eventType: "concern_classification_completed",
    entityId: iid,
    entityType: "image",
    eventMetadata: {
      patient_id: patientId,
      case_id: caseId,
      classification_grade: result.classification_grade,
      pattern_type: result.pattern_type,
      concern_band: result.classification_grade,
    },
  });

  return { result, classifierVersion, usedOpenAi, persistedId: persisted.id };
}
