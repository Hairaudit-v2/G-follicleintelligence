import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeFiAiImageReviewStatus } from "./enumValidation";
import type {
  FiAiImageClassificationResult,
  HliImageClassificationInsert,
  HliSourceSystem,
} from "./types";

export async function insertHliImageClassificationRow(
  row: HliImageClassificationInsert,
  client?: SupabaseClient
): Promise<{ id: string }> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("hli_image_classifications")
    .insert({
      source_system: row.source_system,
      source_record_id: row.source_record_id,
      tenant_id: row.tenant_id,
      patient_id: row.patient_id,
      case_id: row.case_id,
      image_url_or_storage_path: row.image_url_or_storage_path,
      image_category: row.image_category,
      hair_state: row.hair_state,
      shave_state: row.shave_state,
      surgery_stage: row.surgery_stage,
      clinical_use_context: row.clinical_use_context,
      confidence: row.confidence,
      classifier_version: row.classifier_version,
      review_status: row.review_status,
      reviewed_by_user_id: row.reviewed_by_user_id,
      reviewed_at: row.reviewed_at,
      notes: row.notes,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: String((data as { id: string }).id) };
}

export function buildFiPatientImageStorageRef(bucket: string, path: string): string {
  return `${bucket.trim()}:${path.trim()}`;
}

export function inferClinicalUseContextForFiPatientImage(row: {
  case_id: string | null;
  consultation_id: string | null;
}): HliImageClassificationInsert["clinical_use_context"] {
  if (row.case_id) return "surgery";
  if (row.consultation_id) return "consultation";
  return "unknown";
}

export function classificationResultToHliInsert(params: {
  sourceSystem: HliSourceSystem;
  sourceRecordId: string;
  tenantId: string | null;
  patientId: string | null;
  caseId: string | null;
  storageRef: string;
  clinicalUseContext: HliImageClassificationInsert["clinical_use_context"];
  result: FiAiImageClassificationResult;
  classifierVersion: string | null;
  reviewStatus?: string | null;
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
}): HliImageClassificationInsert {
  return {
    source_system: params.sourceSystem,
    source_record_id: params.sourceRecordId,
    tenant_id: params.tenantId,
    patient_id: params.patientId,
    case_id: params.caseId,
    image_url_or_storage_path: params.storageRef,
    image_category: params.result.category,
    hair_state: params.result.hairState,
    shave_state: params.result.shaveState,
    surgery_stage: params.result.surgeryStage,
    clinical_use_context: params.clinicalUseContext,
    confidence: params.result.categoryConfidence,
    classifier_version: params.classifierVersion,
    review_status: normalizeFiAiImageReviewStatus(params.reviewStatus ?? "pending"),
    reviewed_by_user_id: params.reviewedByUserId ?? null,
    reviewed_at: params.reviewedAt ?? null,
    notes: params.result.notes?.trim() ? params.result.notes.trim().slice(0, 8000) : null,
  };
}
