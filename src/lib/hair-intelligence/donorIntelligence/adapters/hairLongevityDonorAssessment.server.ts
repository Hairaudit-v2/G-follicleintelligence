import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { assessDonor } from "../assessDonor.server";
import type { DonorAssessmentModelResult } from "../types";

export type HairLongevityDonorAssessmentParams = {
  image_url_for_model: string;
  source_record_id: string | null;
  tenant_id: string | null;
  patient_id: string | null;
  case_id: string | null;
  image_classification_id: string | null;
  hair_loss_classification_id: string | null;
  client?: SupabaseClient;
};

export type HairLongevityDonorAssessmentResult = {
  result: DonorAssessmentModelResult;
  assessorVersion: string;
  usedOpenAi: boolean;
  persistedId: string;
};

/**
 * HLI: diagnostic intake / progress donor review using shared assessor only.
 */
export async function assessHairLongevityDonorAndPersist(
  params: HairLongevityDonorAssessmentParams
): Promise<HairLongevityDonorAssessmentResult> {
  const { result, assessorVersion, usedOpenAi, persisted } = await assessDonor({
      source_system: "hair_longevity",
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
