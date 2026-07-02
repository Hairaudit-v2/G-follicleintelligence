import type { PathologyPdfExtractionOutput } from "./pathologyExtractionProviderTypes";
import {
  FI_PATHOLOGY_STUB_PROVIDER_ID,
  normalizePathologyExtractionProviderId,
  type PathologyExtractionProviderId,
} from "./pathologyExtractionProviderTypes";

export type PathologyExtractionProviderEnvSlice = Partial<
  Record<
    | "PATHOLOGY_EXTRACTION_PROVIDER"
    | "PATHOLOGY_EXTRACTION_MIN_OCR_CONFIDENCE"
    | "OPENAI_API_KEY"
    | "OPENAI_PATHOLOGY_EXTRACTION_MODEL"
    | "OPENAI_CLINICAL_NOTE_MODEL"
    | "AWS_ACCESS_KEY_ID"
    | "AWS_SECRET_ACCESS_KEY"
    | "AWS_REGION"
    | "GOOGLE_CLOUD_VISION_API_KEY"
    | "GOOGLE_APPLICATION_CREDENTIALS_JSON",
    string
  >
>;

export interface PathologyExtractionProviderAdapter {
  readonly providerId: PathologyExtractionProviderId;
  isConfigured(env?: PathologyExtractionProviderEnvSlice): boolean;
  extractFromPdf(
    pdfBytes: Uint8Array,
    env?: PathologyExtractionProviderEnvSlice
  ): Promise<PathologyPdfExtractionOutput>;
}

/** Resolve configured provider id from env — defaults to stub for local/test. */
export function resolvePathologyExtractionProviderIdFromEnv(
  env: PathologyExtractionProviderEnvSlice = process.env as PathologyExtractionProviderEnvSlice
): PathologyExtractionProviderId {
  return (
    normalizePathologyExtractionProviderId(env.PATHOLOGY_EXTRACTION_PROVIDER) ??
    FI_PATHOLOGY_STUB_PROVIDER_ID
  );
}

export function readPathologyExtractionMinOcrConfidenceFromEnv(
  env: PathologyExtractionProviderEnvSlice = process.env as PathologyExtractionProviderEnvSlice
): number {
  const raw = env.PATHOLOGY_EXTRACTION_MIN_OCR_CONFIDENCE?.trim();
  if (!raw) return 0.55;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0.55;
  return Math.min(1, Math.max(0, n));
}

export function isOpenAiPathologyExtractionConfigured(
  env: PathologyExtractionProviderEnvSlice = process.env as PathologyExtractionProviderEnvSlice
): boolean {
  return Boolean(env.OPENAI_API_KEY?.trim());
}

export function isAwsTextractPathologyExtractionConfigured(
  env: PathologyExtractionProviderEnvSlice = process.env as PathologyExtractionProviderEnvSlice
): boolean {
  return Boolean(
    env.AWS_ACCESS_KEY_ID?.trim() &&
      env.AWS_SECRET_ACCESS_KEY?.trim() &&
      env.AWS_REGION?.trim()
  );
}

export function isGoogleVisionPathologyExtractionConfigured(
  env: PathologyExtractionProviderEnvSlice = process.env as PathologyExtractionProviderEnvSlice
): boolean {
  return Boolean(
    env.GOOGLE_CLOUD_VISION_API_KEY?.trim() || env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim()
  );
}
