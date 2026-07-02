import { isAffirmative } from "@/src/lib/env/zod-helpers";

export type ProcedureDayEnvSlice = Partial<Record<"FI_PROCEDURE_DAY_ENABLED", string>>;

/** Pure env read — default false when unset (production-safe). */
export function isFiProcedureDayEnabledFromEnv(
  env: ProcedureDayEnvSlice = process.env as ProcedureDayEnvSlice
): boolean {
  return isAffirmative(env.FI_PROCEDURE_DAY_ENABLED);
}