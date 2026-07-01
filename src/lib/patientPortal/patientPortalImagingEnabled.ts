import { isAffirmative, isProductionEnv } from "@/src/lib/env/zod-helpers";

/**
 * Gates patient portal imaging pages and uploads.
 * Production defaults to disabled unless FI_PORTAL_IMAGING_ENABLED is affirmative.
 * Non-production defaults to enabled unless explicitly set to false.
 */
export function isPatientPortalImagingEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  const raw = env.FI_PORTAL_IMAGING_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") return false;
  if (isAffirmative(env.FI_PORTAL_IMAGING_ENABLED)) return true;
  return !isProductionEnv(env as NodeJS.ProcessEnv);
}