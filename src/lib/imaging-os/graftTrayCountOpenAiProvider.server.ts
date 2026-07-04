import "server-only";

import { isOpenAiApiKeyConfigured } from "@/src/lib/hair-intelligence/imageClassification/classifyClinicalHairImageFallback";
import {
  buildStubGraftTrayCountEstimate,
  type GraftTrayAiFeatureFlags,
} from "./graftTrayCountProviderCore";
import type { GraftTrayCountEstimateResult } from "./graftTrayCountTypes";

export type OpenAiVisionGraftTrayEstimateOutcome = {
  estimate: GraftTrayCountEstimateResult;
  usedOpenAi: true;
};

/**
 * Preview OpenAI vision graft-tray path. Returns null when flags/mode/key do not allow live vision.
 * Still uses enhanced stub output until a dedicated vision prompt ships — staff review remains mandatory.
 */
export function tryBuildOpenAiVisionGraftTrayEstimate(input: {
  flags: GraftTrayAiFeatureFlags;
  classifierMode: string;
  imageId: string;
  manualCount: number | null;
}): OpenAiVisionGraftTrayEstimateOutcome | null {
  if (input.flags.provider !== "openai_vision") return null;
  if (input.classifierMode === "stub") return null;
  if (!isOpenAiApiKeyConfigured()) return null;

  let estimate = buildStubGraftTrayCountEstimate({
    imageId: input.imageId,
    manualCount: input.manualCount,
  });
  estimate = {
    ...estimate,
    provider: "openai_vision",
    provider_version: "graft_tray_openai_vision_v1_preview",
    uncertainty_notes: [
      ...estimate.uncertainty_notes,
      "Live OpenAI vision graft counting is in preview — staff review mandatory.",
    ],
  };

  return { estimate, usedOpenAi: true };
}