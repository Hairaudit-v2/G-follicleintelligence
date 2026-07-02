import { isAffirmative } from "@/src/lib/env/zod-helpers";

export type FiPerfEnvSlice = Partial<
  Record<"FI_PERF_DIAGNOSTICS_ENABLED" | "FI_LOADER_PERF_SPANS", string>
>;

export function isFiPerfDiagnosticsEnabled(
  env: FiPerfEnvSlice = process.env as FiPerfEnvSlice
): boolean {
  return (
    isAffirmative(env.FI_PERF_DIAGNOSTICS_ENABLED) || isAffirmative(env.FI_LOADER_PERF_SPANS)
  );
}