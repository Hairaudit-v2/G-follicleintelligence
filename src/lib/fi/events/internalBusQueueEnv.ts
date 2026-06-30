/**
 * Stage 12: env gates for in-memory internal bus queue and queue observability (dev/test only).
 */

export type InternalBusQueueEnvOptions = {
  /**
   * Env snapshot for tests; may omit keys. When omitted, `process.env` is used.
   * Use `nodeEnv` to override `NODE_ENV` without mutating `process.env`.
   */
  env?: Record<string, string | undefined>;
  /** Override NODE_ENV for unit tests. */
  nodeEnv?: string;
};

/**
 * In-memory internal bus queue (Stage 12) is enabled only when
 * `FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED === "1"` **and** `NODE_ENV !== "production"`.
 * Production is always off until an explicit future policy stage changes this contract.
 */
export function isInternalIntelligenceInternalBusQueueEnabled(
  options?: InternalBusQueueEnvOptions
): boolean {
  const env = options?.env ?? (process.env as Record<string, string | undefined>);
  const nodeEnv = options?.nodeEnv ?? env.NODE_ENV ?? "";
  if (nodeEnv === "production") return false;
  return env.FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED === "1";
}

/**
 * Queue observability mapping (Stage 12) defaults off. When `"1"`, callers may build
 * in-memory `IntelligenceEventLogRecord`-like rows for enqueue/drain outcomes.
 * Also forced off in production for the same safety posture as the queue itself.
 */
export function isInternalIntelligenceInternalBusObservabilityEnabled(
  options?: InternalBusQueueEnvOptions
): boolean {
  const env = options?.env ?? (process.env as Record<string, string | undefined>);
  const nodeEnv = options?.nodeEnv ?? env.NODE_ENV ?? "";
  if (nodeEnv === "production") return false;
  return env.FI_INTELLIGENCE_INTERNAL_BUS_OBSERVABILITY_ENABLED === "1";
}
