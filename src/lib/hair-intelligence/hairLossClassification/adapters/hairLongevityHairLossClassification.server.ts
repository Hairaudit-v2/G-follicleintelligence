import "server-only";

import { classifyAndPersistHairLossClassification } from "../classifyHairLoss.server";
import type { HairLossClassificationModelResult } from "../types";

export type HairLongevityHairLossClassificationParams = {
  /** Short-lived signed URL from HLI intake storage (never a public URL). */
  imageUrlForModel: string;
  sourceRecordId: string | null;
  tenantId: string | null;
  patientId: string | null;
  caseId: string | null;
  imageClassificationId: string | null;
};

export type HairLongevityHairLossClassificationResult = {
  result: HairLossClassificationModelResult;
  classifierVersion: string;
  usedOpenAi: boolean;
  persistedId: string;
};

/**
 * HLI foundation: when intake images exist, call this with a service-role signed URL.
 * No UI in Stage 9A; wires into HLI intake workers in a later milestone.
 */
export async function classifyHairLongevityHairLossAndPersist(
  params: HairLongevityHairLossClassificationParams
): Promise<HairLongevityHairLossClassificationResult> {
  const { result, classifierVersion, usedOpenAi, persisted } =
    await classifyAndPersistHairLossClassification({
      source_system: "hair_longevity",
      source_record_id: params.sourceRecordId,
      tenant_id: params.tenantId,
      patient_id: params.patientId,
      case_id: params.caseId,
      image_classification_id: params.imageClassificationId,
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
      imageUrlForModel: params.imageUrlForModel,
    });
  return { result, classifierVersion, usedOpenAi, persistedId: persisted.id };
}
