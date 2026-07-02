import { isAffirmative } from "@/src/lib/env/zod-helpers";

export type StaffUatEnvSlice = Partial<Record<"FI_STAFF_UAT_MODE_ENABLED", string>>;

/** When on, shows in-app UAT guides and feedback widgets (non-production friendly). */
export function isFiStaffUatModeEnabledFromEnv(
  env: StaffUatEnvSlice = process.env as StaffUatEnvSlice
): boolean {
  return isAffirmative(env.FI_STAFF_UAT_MODE_ENABLED);
}