/**
 * Feature gate for Stage 11 internal bus shadow verification (dev/test only).
 */

export type InternalBusShadowEnvOptions = {
  /**
   * Env snapshot for tests; may omit keys. When omitted, `process.env` is used.
   * Use `nodeEnv` to override `NODE_ENV` without mutating `process.env`.
   */
  env?: Record<string, string | undefined>;
  /** Override NODE_ENV for unit tests. */
  nodeEnv?: string;
};

/**
 * When `true`, FI ingest may emit a single shadow `hairaudit.audit.completed` bus event
 * after successful `hairaudit.images.uploaded` handling (see Stage 11 docs).
 *
 * Rules: `FI_INTELLIGENCE_INTERNAL_BUS_SHADOW_ENABLED === "1"` and `NODE_ENV !== "production"`.
 * Defaults to `false` everywhere else (including production even if the flag is set).
 */
export function isInternalIntelligenceBusShadowEnabled(
  options?: InternalBusShadowEnvOptions
): boolean {
  const env = options?.env ?? (process.env as Record<string, string | undefined>);
  const nodeEnv = options?.nodeEnv ?? env.NODE_ENV ?? "";
  if (nodeEnv === "production") return false;
  return env.FI_INTELLIGENCE_INTERNAL_BUS_SHADOW_ENABLED === "1";
}
