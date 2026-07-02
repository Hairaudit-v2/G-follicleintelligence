import { isAffirmative } from "@/src/lib/env/zod-helpers";

export type PathologyExtractionEnvSlice = Partial<Record<"PATHOLOGY_EXTRACTION_ENABLED", string>>;

/** When true, pathology PDF extraction jobs invoke the provider (still stub until OCR wired). */
export function isPathologyExtractionEnabledFromEnv(
  env: PathologyExtractionEnvSlice = process.env as PathologyExtractionEnvSlice
): boolean {
  return isAffirmative(env.PATHOLOGY_EXTRACTION_ENABLED);
}
