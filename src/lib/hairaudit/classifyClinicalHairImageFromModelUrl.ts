/**
 * FI OS receiving-side HairAudit image classifier hook — Phase 3F + ImagingOS Phase 1 live wiring.
 *
 * See: docs/hairaudit-phase-3f-fi-classifier-endpoint.md
 */

import { isOpenAiApiKeyConfigured } from "@/src/lib/hair-intelligence/imageClassification/classifyClinicalHairImageFallback";
import { resolveHairauditClassifierMode } from "@/src/lib/security/hairauditClassifierAuth";

export type ClinicalHairImageClassifierInput = {
  canonical_photo_category: string;
  legacy_upload_type?: string;
  storage_bucket?: string;
  storage_path?: string;
  image_content_type?: string | null;
  image_size_bytes?: number | null;
  source_upload_id?: string;
  tenant_id?: string | null;
};

export type ClinicalHairImageClassifierResult = {
  category: string;
  canonical_photo_category: string;
  confidence: number;
  quality_status: string;
  protocol_status: string;
  classifier_version: string;
  notes: string;
};

/** Whether the FI OS clinical image classifier is wired and safe to invoke. */
export function isClinicalHairImageClassifierAvailable(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return resolveHairauditClassifierMode(env) === "live" && isOpenAiApiKeyConfigured();
}

/**
 * Classify a clinical hair image using FI OS / HLI model infrastructure.
 * Live implementation is server-only; returns null in non-server test contexts without dynamic import.
 */
export async function classifyClinicalHairImageFromModelUrl(
  input: ClinicalHairImageClassifierInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<ClinicalHairImageClassifierResult | null> {
  if (!isClinicalHairImageClassifierAvailable(env)) return null;

  try {
    const mod = await import("./classifyClinicalHairImageFromModelUrl.server");
    return mod.classifyClinicalHairImageFromModelUrlLive(input, env);
  } catch {
    return null;
  }
}