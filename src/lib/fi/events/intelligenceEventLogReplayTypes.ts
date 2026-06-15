/**
 * Stage 14: intelligence event log replay tooling — types only (safe defaults live in runner + CLI).
 */

export type IntelligenceEventLogReplayOrder = "newest_first" | "oldest_first";

export type IntelligenceEventLogReplayFilters = {
  event_name?: string;
  source?: string;
  status?: string;
  privacy_level?: string;
  /** ISO-8601; filters `created_at` >= since */
  since?: string;
  /** ISO-8601; filters `created_at` <= until */
  until?: string;
  correlation_id?: string;
  /**
   * Max rows to read (clamped 1–500 server-side).
   * Default 50 when omitted in loaders.
   */
  limit?: number;
  order?: IntelligenceEventLogReplayOrder;
};

export type IntelligenceEventLogReplayMode = "dry_run" | "validate_only" | "enqueue_shadow";

/**
 * Sanitized replay candidate: only what was stored in `fi_intelligence_event_logs` (no raw payload reconstruction).
 */
export type IntelligenceEventLogReplayCandidate = {
  id: string;
  event_name: string;
  source: string;
  source_event_id: string | null;
  correlation_id: string | null;
  privacy_level: string;
  delivery_mode: string;
  status: string;
  /** Sanitized JSON persisted at write time — structural metadata only. */
  payload_summary: Record<string, unknown>;
  warnings: string[];
  error_message: string | null;
  occurred_at: string | null;
  created_at: string;
};

export type IntelligenceEventLogReplayWarning = {
  code: string;
  message: string;
  intelligence_event_log_id?: string;
};

export type IntelligenceEventLogReplaySummary = {
  mode: IntelligenceEventLogReplayMode;
  candidates_total: number;
  /** Rows returned from the log query after filters. */
  candidates_loaded: number;
  /** `validate_only`: envelopes that passed {@link parseIntelligenceEventEnvelope}. */
  validated_ok?: number;
  /** `validate_only`: rows that could not be parsed into a strict envelope. */
  validated_failed?: number;
  /** `enqueue_shadow`: items passed to in-memory enqueue (queue may still skip if disabled). */
  shadow_enqueued?: number;
  /** `enqueue_shadow`: enqueueInternalIntelligenceEvent returned skipped_disabled. */
  shadow_skipped_disabled?: number;
  /** `enqueue_shadow`: not attempted (blocked policy / invalid shape). */
  shadow_skipped_other?: number;
};
