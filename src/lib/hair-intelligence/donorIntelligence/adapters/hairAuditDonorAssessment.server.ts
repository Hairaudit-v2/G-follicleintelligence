import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { assessDonor } from "../assessDonor.server";
import type { DonorAssessmentModelResult } from "../types";

export type HairAuditDonorAssessmentParams = {
  image_url_for_model: string;
  source_record_id: string | null;
  tenant_id: string | null;
  patient_id: string | null;
  case_id: string | null;
  image_classification_id: string | null;
  hair_loss_classification_id: string | null;
  client?: SupabaseClient;
};

export type HairAuditDonorAssessmentResult = {
  result: DonorAssessmentModelResult;
  assessorVersion: string;
  usedOpenAi: boolean;
  persistedId: string;
};

/**
 * HairAudit: classify donor from a pre-authorised model URL; no duplicated vision wiring.
 */
export async function assessHairAuditDonorAndPersist(
  params: HairAuditDonorAssessmentParams
): Promise<HairAuditDonorAssessmentResult> {
  const { result, assessorVersion, usedOpenAi, persisted } = await assessDonor({
    source_system: "hairaudit",
    source_record_id: params.source_record_id,
    tenant_id: params.tenant_id,
    patient_id: params.patient_id,
    case_id: params.case_id,
    image_classification_id: params.image_classification_id,
    hair_loss_classification_id: params.hair_loss_classification_id,
    image_url_for_model: params.image_url_for_model,
    client: params.client,
  });
  return { result, assessorVersion, usedOpenAi, persistedId: persisted.id };
}
