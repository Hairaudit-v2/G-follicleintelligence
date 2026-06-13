import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { assessRecipient } from "../assessRecipient.server";
import type { RecipientAssessmentModelResult } from "../types";

export type HairLongevityRecipientAssessmentParams = {
  image_url_for_model: string;
  source_record_id: string | null;
  tenant_id: string | null;
  patient_id: string | null;
  case_id: string | null;
  client?: SupabaseClient;
};

export type HairLongevityRecipientAssessmentResult = {
  result: RecipientAssessmentModelResult;
  assessorVersion: string;
  usedOpenAi: boolean;
  persistedId: string;
};

/**
 * HLI: intake / progress recipient review using shared assessor only.
 */
export async function assessHairLongevityRecipientAndPersist(
  params: HairLongevityRecipientAssessmentParams
): Promise<HairLongevityRecipientAssessmentResult> {
  const { result, assessorVersion, usedOpenAi, persisted } = await assessRecipient({
    source_system: "hair_longevity",
    source_record_id: params.source_record_id,
    tenant_id: params.tenant_id,
    patient_id: params.patient_id,
    case_id: params.case_id,
    image_url_for_model: params.image_url_for_model,
    client: params.client,
  });
  return { result, assessorVersion, usedOpenAi, persistedId: persisted.id };
}
