import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { hairLossClassificationNotConfiguredResult } from "./classifyHairLossFallback";
import {
  HIE_HAIR_LOSS_CLASSIFIER_VERSION,
  classifyHairLossWithOpenAi,
  isHairLossOpenAiConfigured,
} from "./openAiHairLossClassifier.server";
import { insertHairIntelligenceHairLossClassificationRow } from "./persistHairLossClassification.server";
import type {
  HairIntelligenceHairLossClassificationInsert,
  HairLossClassificationModelResult,
} from "./types";

export type ClassifyHairLossFromModelUrlOutcome = {
  result: HairLossClassificationModelResult;
  classifierVersion: string;
  usedOpenAi: boolean;
};

/**
 * Classify from a model-ready URL (short-lived signed URL from Supabase service role).
 * Never pass durable public bucket URLs.
 */
export async function classifyHairLossFromModelUrl(params: {
  imageUrlForModel: string;
}): Promise<ClassifyHairLossFromModelUrlOutcome> {
  if (!isHairLossOpenAiConfigured()) {
    return {
      result: hairLossClassificationNotConfiguredResult(),
      classifierVersion: HIE_HAIR_LOSS_CLASSIFIER_VERSION,
      usedOpenAi: false,
    };
  }
  const { result, model } = await classifyHairLossWithOpenAi(params);
  return {
    result,
    classifierVersion: `${HIE_HAIR_LOSS_CLASSIFIER_VERSION};model=${model}`,
    usedOpenAi: true,
  };
}

export type ClassifyPersistHairLossParams = HairIntelligenceHairLossClassificationInsert & {
  imageUrlForModel: string;
};

export type ClassifyPersistHairLossOutcome = ClassifyHairLossFromModelUrlOutcome & {
  persisted: { id: string };
};

/**
 * Run vision classification and persist one row to the shared ledger.
 */
export async function classifyAndPersistHairLossClassification(
  params: ClassifyPersistHairLossParams,
  client?: SupabaseClient
): Promise<ClassifyPersistHairLossOutcome> {
  const { imageUrlForModel, ...row } = params;
  const { result, classifierVersion, usedOpenAi } = await classifyHairLossFromModelUrl({
    imageUrlForModel,
  });
  const persisted = await insertHairIntelligenceHairLossClassificationRow(
    {
      ...row,
      classification_system: result.classification_system,
      pattern_type: result.pattern_type,
      classification_grade: result.classification_grade,
      confidence_score: result.confidence_score,
      frontal_loss_score: result.frontal_loss_score,
      temporal_recession_score: result.temporal_recession_score,
      mid_scalp_score: result.mid_scalp_score,
      crown_loss_score: result.crown_loss_score,
      diffuse_thinning_score: result.diffuse_thinning_score,
      retrograde_pattern_detected: result.retrograde_pattern_detected,
      suspected_scarring_pattern: result.suspected_scarring_pattern,
      sex_classification: result.sex_classification,
      age_estimate_range: row.age_estimate_range,
      ai_notes: result.notes?.trim() ? result.notes.trim().slice(0, 8000) : null,
      classifier_version: classifierVersion,
    },
    client
  );
  return { result, classifierVersion, usedOpenAi, persisted };
}
