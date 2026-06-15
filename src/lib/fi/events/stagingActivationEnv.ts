/**
 * Stage 17: environment gates for staging-only intelligence replay activation.
 */

import { canExecuteGovernedReplayRun } from "./governedReplayEnv";
import { STAGING_INTELLIGENCE_ACTIVATION_ALLOWED_EVENT } from "./stagingActivationAllowlist";

export type StagingActivationEnvOptions = {
  env?: Record<string, string | undefined>;
  nodeEnv?: string;
};

function resolveEnv(options?: StagingActivationEnvOptions): Record<string, string | undefined> {
  return options?.env ?? (typeof process !== "undefined" ? (process.env as Record<string, string | undefined>) : {});
}

function resolveNodeEnv(options?: StagingActivationEnvOptions): string {
  const env = resolveEnv(options);
  return options?.nodeEnv ?? env.NODE_ENV ?? "";
}

/**
 * Staging intelligence replay activation is enabled only when non-production,
 * governed replay is on, staging activation flag is on, and the staging allowed-event
 * env var matches the single fixed allow-list value (explicit operator contract).
 */
export function isStagingIntelligenceActivationEnabled(options?: StagingActivationEnvOptions): boolean {
  const nodeEnv = resolveNodeEnv(options);
  if (nodeEnv === "production") {
    return false;
  }
  const env = resolveEnv(options);
  if (!canExecuteGovernedReplayRun({ env, nodeEnv })) {
    return false;
  }
  if (env.FI_INTELLIGENCE_STAGING_ACTIVATION_ENABLED !== "1") {
    return false;
  }
  if (env.FI_INTELLIGENCE_STAGING_ALLOWED_EVENT !== STAGING_INTELLIGENCE_ACTIVATION_ALLOWED_EVENT) {
    return false;
  }
  return true;
}

/** Human-readable rollback lines returned with staging replay CLI / wrapper results. */
export const STAGING_INTELLIGENCE_REPLAY_ROLLBACK_INSTRUCTIONS: readonly string[] = [
  "Set FI_INTELLIGENCE_STAGING_ACTIVATION_ENABLED=0 or unset it.",
  "Set FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED=0 or unset it to block governed execute paths.",
  "Set FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED=0 or unset it to stop shadow enqueue into the process-local queue.",
  "Inspect fi_intelligence_replay_runs and fi_intelligence_event_logs for the test window.",
  "Restart the process to clear any in-memory internal bus queue state if needed.",
] as const;
