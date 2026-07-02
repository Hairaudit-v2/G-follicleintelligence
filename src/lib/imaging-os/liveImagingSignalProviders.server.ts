import "server-only";

import { isOpenAiApiKeyConfigured } from "@/src/lib/hair-intelligence/imageClassification/classifyClinicalHairImageFallback";
import { resolveHairauditClassifierMode } from "@/src/lib/security/hairauditClassifierAuth";
import type { OutcomeSignalProvider } from "./imagingOutcomeSignalsCore";

export type LiveImagingSignalProviderContext = {
  providerName: OutcomeSignalProvider;
  providerAvailable: boolean;
};

export function resolveLiveImagingSignalProvider(
  env: Record<string, string | undefined> = process.env
): LiveImagingSignalProviderContext {
  const mode = resolveHairauditClassifierMode(env as NodeJS.ProcessEnv);
  if (mode === "stub") {
    return { providerName: "stub", providerAvailable: true };
  }
  if (isOpenAiApiKeyConfigured()) {
    return { providerName: "hli_vision", providerAvailable: true };
  }
  return { providerName: "unavailable", providerAvailable: false };
}