import { isAffirmative } from "@/src/lib/env/zod-helpers";

export type PathologyExtractionEnvSlice = Partial<
  Record<
    | "PATHOLOGY_EXTRACTION_ENABLED"
    | "PATHOLOGY_AUTO_DRAFT_ENABLED"
    | "PATHOLOGY_EXTRACTION_PROVIDER"
    | "PATHOLOGY_EXTRACTION_MIN_OCR_CONFIDENCE",
    string
  >
>;

/** When true, pathology PDF extraction jobs invoke the provider after inbox upload. */
export function isPathologyExtractionEnabledFromEnv(
  env: PathologyExtractionEnvSlice = process.env as PathologyExtractionEnvSlice
): boolean {
  return isAffirmative(env.PATHOLOGY_EXTRACTION_ENABLED);
}

/** When true, matched inbound documents auto-create draft results from extracted markers. */
export function isPathologyAutoDraftEnabledFromEnv(
  env: PathologyExtractionEnvSlice = process.env as PathologyExtractionEnvSlice
): boolean {
  return isAffirmative(env.PATHOLOGY_AUTO_DRAFT_ENABLED);
}
