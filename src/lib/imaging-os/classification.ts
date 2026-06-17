/**
 * ImagingOS — image category classification contract (Phase IM-1).
 * Stub classifier only; no AI provider calls.
 */

import {
  confidenceBandForScore,
  mapExternalCategoryToCanonical,
  type CanonicalHairImageCategory,
} from "./categories";

export type ClassificationStatus = "classified" | "dry_run" | "failed" | "not_evaluated";

export const IMAGING_OS_STUB_MODEL_PROVIDER = "imaging-os-stub" as const;
export const IMAGING_OS_STUB_MODEL_VERSION = "imaging-os-stub-v1" as const;

export type ImageClassificationResult = {
  classification_status: ClassificationStatus;
  canonical_photo_category: CanonicalHairImageCategory;
  confidence: number;
  model_provider: string;
  model_version: string;
  notes: string;
};

export type ClassifyImageCategoryStubInput = {
  external_category: string;
  legacy_upload_type?: string | null;
  /** Optional deterministic seed (e.g. HairAudit idempotency key). */
  idempotency_key?: string;
};

/** Deterministic stub confidence in [0.5, 0.7] from idempotency key or external category. */
export function stubConfidenceFromSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return 0.5 + (hash % 21) / 100;
}

/**
 * Stub classification — maps external labels to canonical categories without AI.
 */
export function classifyImageCategoryStub(input: ClassifyImageCategoryStubInput): ImageClassificationResult {
  const mapping = mapExternalCategoryToCanonical(input.external_category, input.legacy_upload_type);
  const seed = input.idempotency_key?.trim() || input.external_category;
  const confidence = stubConfidenceFromSeed(seed);
  const band = confidenceBandForScore(confidence);

  const notes = mapping.matched
    ? `Stub classification (${band} confidence) via ${mapping.source}`
    : `Stub classification (${band} confidence); unknown external category mapped to other`;

  return {
    classification_status: "dry_run",
    canonical_photo_category: mapping.canonical,
    confidence,
    model_provider: IMAGING_OS_STUB_MODEL_PROVIDER,
    model_version: IMAGING_OS_STUB_MODEL_VERSION,
    notes,
  };
}
