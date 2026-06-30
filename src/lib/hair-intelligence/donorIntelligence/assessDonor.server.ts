import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createPatientImageSignedUrls } from "@/src/lib/patientImages/patientImagesServer";
import { donorAssessmentNotConfiguredResult } from "./assessDonorFallback";
import {
  HIE_DONOR_ASSESSOR_VERSION,
  assessDonorWithOpenAi,
  isDonorAssessorOpenAiConfigured,
} from "./openAiDonorAssessor.server";
import { insertHairIntelligenceDonorAssessmentRow } from "./persistDonorAssessment.server";
import type {
  DonorAssessmentModelResult,
  HairIntelligenceDonorAssessmentInsert,
  HieDonorSourceSystem,
} from "./types";

export type AssessDonorParams = {
  source_system: HieDonorSourceSystem;
  source_record_id: string | null;
  tenant_id: string | null;
  patient_id: string | null;
  case_id: string | null;
  image_classification_id: string | null;
  hair_loss_classification_id: string | null;
  image_url_for_model?: string | null;
  patient_image_id?: string | null;
  client?: SupabaseClient;
};

async function resolveImageUrlForModel(params: AssessDonorParams): Promise<string | null> {
  const direct = params.image_url_for_model?.trim();
  if (direct) return direct;
  const tid = params.tenant_id?.trim();
  const iid = params.patient_image_id?.trim();
  if (!tid || !iid) return null;
  const supabase = params.client ?? supabaseAdmin();
  const { data: row, error } = await supabase
    .from("fi_patient_images")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", iid)
    .eq("image_status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return null;
  const mapped = row as Record<string, unknown>;
  const bucket = String(mapped.storage_bucket ?? "patient-images");
  const path = String(mapped.storage_path ?? "");
  if (!path) return null;
  const signedMap = await createPatientImageSignedUrls(
    [{ id: iid, storage_bucket: bucket, storage_path: path }],
    supabase
  );
  const signed = signedMap.get(iid);
  return signed?.url ?? null;
}

export type AssessDonorOutcome = {
  result: DonorAssessmentModelResult;
  assessorVersion: string;
  usedOpenAi: boolean;
  persisted: { id: string };
};

/**
 * Resolve image URL, run donor vision assessor (or fallback), validate via OpenAI path, persist one ledger row.
 */
export async function assessDonor(params: AssessDonorParams): Promise<AssessDonorOutcome> {
  const supabase = params.client ?? supabaseAdmin();
  const imageUrl = await resolveImageUrlForModel(params);
  let result: DonorAssessmentModelResult;
  let usedOpenAi = false;
  let assessorVersion: string = HIE_DONOR_ASSESSOR_VERSION;

  if (!imageUrl) {
    result = donorAssessmentNotConfiguredResult("no_image");
    assessorVersion = `${HIE_DONOR_ASSESSOR_VERSION};fallback=no_image`;
  } else if (!isDonorAssessorOpenAiConfigured()) {
    result = donorAssessmentNotConfiguredResult("no_api_key");
    assessorVersion = `${HIE_DONOR_ASSESSOR_VERSION};fallback=no_api_key`;
  } else {
    const { result: r, model } = await assessDonorWithOpenAi({ imageUrlForModel: imageUrl });
    result = r;
    usedOpenAi = true;
    assessorVersion = `${HIE_DONOR_ASSESSOR_VERSION};model=${model}`;
  }

  const row: HairIntelligenceDonorAssessmentInsert = {
    source_system: params.source_system,
    source_record_id: params.source_record_id,
    tenant_id: params.tenant_id,
    patient_id: params.patient_id,
    case_id: params.case_id,
    image_classification_id: params.image_classification_id,
    hair_loss_classification_id: params.hair_loss_classification_id,
    donor_region: result.donor_region,
    donor_quality_rating: result.donor_quality_rating,
    confidence_score: result.confidence_score,
    estimated_density_band: result.estimated_density_band,
    miniaturisation_risk: result.miniaturisation_risk,
    retrograde_risk: result.retrograde_risk,
    overharvesting_risk: result.overharvesting_risk,
    safe_donor_capacity_band: result.safe_donor_capacity_band,
    lifetime_graft_budget_band: result.lifetime_graft_budget_band,
    extraction_caution_level: result.extraction_caution_level,
    clinical_observations: result.clinical_observations.trim()
      ? result.clinical_observations
      : null,
    ai_notes: result.ai_notes.trim() ? result.ai_notes : null,
    review_status: "pending",
    reviewed_by_user_id: null,
    reviewed_at: null,
    assessor_version: assessorVersion,
  };

  const persisted = await insertHairIntelligenceDonorAssessmentRow(row, supabase);
  return { result, assessorVersion, usedOpenAi, persisted };
}
