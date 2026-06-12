import "server-only";

import { classifyHairRestorationImageWithOpenAi, HLI_IMAGE_CLASSIFIER_VERSION } from "./openAiHairImageClassifier.server";
import { hairImageClassificationNotConfiguredResult, isOpenAiApiKeyConfigured } from "./classifyClinicalHairImageFallback";
import type { FiAiImageClassificationResult } from "./types";

export type ClassifyClinicalHairImageOutcome = {
  result: FiAiImageClassificationResult;
  classifierVersion: string;
  usedOpenAi: boolean;
};

/**
 * Shared entry: classify from a model-ready image URL (typically a short-lived signed URL).
 * Never logs the URL or raw storage paths.
 */
export async function classifyClinicalHairImageFromModelUrl(params: {
  imageUrlForModel: string;
}): Promise<ClassifyClinicalHairImageOutcome> {
  if (!isOpenAiApiKeyConfigured()) {
    return {
      result: hairImageClassificationNotConfiguredResult(),
      classifierVersion: HLI_IMAGE_CLASSIFIER_VERSION,
      usedOpenAi: false,
    };
  }
  const { result, model } = await classifyHairRestorationImageWithOpenAi(params);
  return {
    result,
    classifierVersion: `${HLI_IMAGE_CLASSIFIER_VERSION};model=${model}`,
    usedOpenAi: true,
  };
}
