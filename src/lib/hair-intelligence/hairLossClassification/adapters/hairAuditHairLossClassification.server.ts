import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyAndPersistHairLossClassification } from "../classifyHairLoss.server";
import type { HairLossClassificationModelResult } from "../types";

export type HairAuditHairLossClassificationParams = {
  /** Short-lived signed URL from HairAudit storage pipeline (never a public URL). */
  imageUrlForModel: string;
  sourceRecordId: string | null;
  tenantId: string | null;
  patientId: string | null;
  caseId: string | null;
  imageClassificationId: string | null;
  client?: SupabaseClient;
};

export type HairAuditHairLossClassificationResult = {
  result: HairLossClassificationModelResult;
  classifierVersion: string;
  usedOpenAi: boolean;
  persistedId: string;
};

/**
 * HairAudit foundation: classify from a pre-authorised model URL and persist to the shared ledger.
 * Future Stage 9x: compare baseline vs follow-up rows for the same audit case.
 */
export async function classifyHairAuditHairLossAndPersist(
  params: HairAuditHairLossClassificationParams
): Promise<HairAuditHairLossClassificationResult> {
  const { result, classifierVersion, usedOpenAi, persisted } =
    await classifyAndPersistHairLossClassification(
      {
        source_system: "hairaudit",
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
      },
      params.client
    );
  return { result, classifierVersion, usedOpenAi, persistedId: persisted.id };
}
