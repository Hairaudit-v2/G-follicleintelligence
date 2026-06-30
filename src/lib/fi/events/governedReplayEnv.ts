/**
 * Stage 15: environment gates for governed replay / future dispatch (all off by default).
 */

export type GovernedReplayEnvOptions = {
  env?: Record<string, string | undefined>;
  nodeEnv?: string;
};

export function isFiIntelligenceGovernedReplayEnabled(options?: GovernedReplayEnvOptions): boolean {
  const env =
    options?.env ??
    (typeof process !== "undefined" ? (process.env as Record<string, string | undefined>) : {});
  return env.FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED === "1";
}

export function isFiIntelligenceGovernedDispatchEnabled(
  options?: GovernedReplayEnvOptions
): boolean {
  const env =
    options?.env ??
    (typeof process !== "undefined" ? (process.env as Record<string, string | undefined>) : {});
  return env.FI_INTELLIGENCE_GOVERNED_DISPATCH_ENABLED === "1";
}

function nodeEnv(options?: GovernedReplayEnvOptions): string {
  const env =
    options?.env ??
    (typeof process !== "undefined" ? (process.env as Record<string, string | undefined>) : {});
  return options?.nodeEnv ?? env.NODE_ENV ?? "";
}

/**
 * Stage 15 policy: `dispatch_future` is never runnable in production, and requires both governed flags when non-production.
 */
export function isDispatchFutureExecutionPolicyAllowed(
  options?: GovernedReplayEnvOptions
): boolean {
  const ne = nodeEnv(options);
  if (ne === "production") return false;
  return (
    isFiIntelligenceGovernedReplayEnabled(options) &&
    isFiIntelligenceGovernedDispatchEnabled(options)
  );
}

/**
 * Whether governed execute paths (CLI + service) may call Stage 14 replay for non-dispatch modes.
 */
export function canExecuteGovernedReplayRun(options?: GovernedReplayEnvOptions): boolean {
  return isFiIntelligenceGovernedReplayEnabled(options);
}
