/**
 * FI OS clinical hair image classifier hook — Phase 3F placeholder.
 *
 * Future phases wire this to the FI photo-protocol / ImagingOS pipeline.
 * The HairAudit internal endpoint calls this when available and safe.
 *
 * See: docs/hairaudit-phase-3f-fi-classifier-endpoint.md
 */

export type ClinicalHairImageClassifierInput = {
  canonical_photo_category: string;
  legacy_upload_type?: string;
  storage_bucket?: string;
  storage_path?: string;
  image_content_type?: string | null;
  image_size_bytes?: number | null;
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
  _env: NodeJS.ProcessEnv = process.env
): boolean {
  return false;
}

/**
 * Classify a clinical hair image using FI OS model infrastructure.
 * Returns null when the classifier is not available (Phase 3F default).
 */
export async function classifyClinicalHairImageFromModelUrl(
  _input: ClinicalHairImageClassifierInput,
  _env: NodeJS.ProcessEnv = process.env
): Promise<ClinicalHairImageClassifierResult | null> {
  return null;
}
