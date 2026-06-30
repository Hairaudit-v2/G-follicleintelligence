/**
 * Stage 13: policy gate for durable intelligence event log inserts (off by default; production forced off).
 */

export type PersistentEventLogEnvOptions = {
  env?: Record<string, string | undefined>;
  nodeEnv?: string;
};

/**
 * Returns true only when `FI_INTELLIGENCE_EVENT_LOG_PERSIST_ENABLED === "1"` **and**
 * `NODE_ENV !== "production"`.
 *
 * Production persistence remains disabled until a future documented policy stage; tests may
 * override `nodeEnv` / `env` via {@link PersistentEventLogEnvOptions}.
 */
export function isFiIntelligenceEventLogPersistEnabled(
  options?: PersistentEventLogEnvOptions
): boolean {
  const env = options?.env ?? (process.env as Record<string, string | undefined>);
  const nodeEnv = options?.nodeEnv ?? env.NODE_ENV ?? "";
  if (nodeEnv === "production") return false;
  return env.FI_INTELLIGENCE_EVENT_LOG_PERSIST_ENABLED === "1";
}
