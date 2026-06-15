import type { IntelligenceEventEnvelope } from "@follicle/intelligence-core";
import {
  parseIntelligenceEventEnvelope,
  type IntelligenceEventDeliveryMode,
  type IntelligenceEventName,
  type IntelligenceEventPrivacyLevel,
  type IntelligenceSystemSource,
} from "@follicle/intelligence-core";

import type { SupabaseClient } from "@supabase/supabase-js";

import { enqueueInternalIntelligenceEvent } from "./internalBusQueue";
import { isInternalIntelligenceInternalBusQueueEnabled } from "./internalBusQueueEnv";
import { loadIntelligenceEventReplayCandidates } from "./loadIntelligenceEventReplayCandidates.server";
import type {
  IntelligenceEventLogReplayCandidate,
  IntelligenceEventLogReplayFilters,
  IntelligenceEventLogReplayMode,
  IntelligenceEventLogReplaySummary,
  IntelligenceEventLogReplayWarning,
} from "./intelligenceEventLogReplayTypes";

export type ReplayIntelligenceEventLogsOptions = {
  mode: IntelligenceEventLogReplayMode;
  filters: IntelligenceEventLogReplayFilters;
  env?: Record<string, string | undefined>;
  nodeEnv?: string;
  supabaseClientForTests?: SupabaseClient;
  omitPlatformAdminAssertForOperatorCli?: boolean;
};

export type ReplayIntelligenceEventLogsResult = {
  summary: IntelligenceEventLogReplaySummary;
  warnings: IntelligenceEventLogReplayWarning[];
  load_error?: string;
};

const SOURCES = new Set<string>(["fi_os", "hli", "hairaudit", "iiohr", "external"]);
const DELIVERY_MODES = new Set<string>(["sync_http", "async_queue", "batch_file", "internal_only"]);
const PRIVACY_LEVELS = new Set<string>([
  "operational_clinical",
  "pseudonymous_analytics",
  "aggregate_only",
  "internal_debug",
]);

function schemaVersionFromSummary(ps: Record<string, unknown>): number {
  const v = ps.schema_version;
  return typeof v === "number" && Number.isFinite(v) && v >= 1 ? v : 1;
}

/**
 * Builds a strict bus envelope from persisted log metadata only — payload is a non-clinical replay marker
 * (no raw payload reconstruction from `payload_summary`).
 */
export function buildShadowReplayEnvelopeFromCandidate(
  c: IntelligenceEventLogReplayCandidate
): { envelope: IntelligenceEventEnvelope } | { error: string } {
  if (!SOURCES.has(c.source)) {
    return { error: `invalid source ${JSON.stringify(c.source)}` };
  }
  if (!DELIVERY_MODES.has(c.delivery_mode)) {
    return { error: `invalid delivery_mode ${JSON.stringify(c.delivery_mode)}` };
  }
  if (!PRIVACY_LEVELS.has(c.privacy_level)) {
    return { error: `invalid privacy_level ${JSON.stringify(c.privacy_level)}` };
  }

  const emitted_at = (c.occurred_at && c.occurred_at.trim()) || c.created_at;
  const envelope: IntelligenceEventEnvelope = {
    schema_version: schemaVersionFromSummary(c.payload_summary),
    emitted_at,
    source: c.source as IntelligenceSystemSource,
    event_name: c.event_name as IntelligenceEventName,
    delivery_mode: c.delivery_mode as IntelligenceEventDeliveryMode,
    privacy_level: c.privacy_level as IntelligenceEventPrivacyLevel,
    ...(c.correlation_id ? { correlation_id: c.correlation_id } : {}),
    ...(c.source_event_id ? { event_id: c.source_event_id } : {}),
    payload: {
      _stage14_replay_shadow: true,
      fi_intelligence_event_log_id: c.id,
    },
  };

  const parsed = parseIntelligenceEventEnvelope(envelope);
  if (!parsed.ok) {
    return { error: parsed.error };
  }
  return { envelope: parsed.envelope };
}

/**
 * Stage 14 replay runner — never invokes FI ingest handlers or downstream systems directly.
 * `enqueue_shadow` only pushes to the Stage 12 in-memory queue when enabled and non-production.
 */
export async function replayIntelligenceEventLogs(
  options: ReplayIntelligenceEventLogsOptions
): Promise<ReplayIntelligenceEventLogsResult> {
  const env = options.env ?? (process.env as Record<string, string | undefined>);
  const nodeEnv = options.nodeEnv ?? env.NODE_ENV ?? "";

  const warnings: IntelligenceEventLogReplayWarning[] = [];
  const { candidates, error: load_error } = await loadIntelligenceEventReplayCandidates({
    filters: options.filters,
    env,
    nodeEnv,
    supabaseClientForTests: options.supabaseClientForTests,
    omitPlatformAdminAssertForOperatorCli: options.omitPlatformAdminAssertForOperatorCli,
  });

  if (load_error) {
    return {
      summary: {
        mode: options.mode,
        candidates_total: 0,
        candidates_loaded: 0,
      },
      warnings,
      load_error,
    };
  }

  const baseSummary: IntelligenceEventLogReplaySummary = {
    mode: options.mode,
    candidates_total: candidates.length,
    candidates_loaded: candidates.length,
  };

  if (options.mode === "dry_run") {
    return { summary: baseSummary, warnings };
  }

  if (options.mode === "validate_only") {
    let validated_ok = 0;
    let validated_failed = 0;
    for (const c of candidates) {
      const built = buildShadowReplayEnvelopeFromCandidate(c);
      if ("error" in built) {
        validated_failed += 1;
        warnings.push({
          code: "validate_parse_failed",
          message: built.error,
          intelligence_event_log_id: c.id,
        });
        continue;
      }
      validated_ok += 1;
    }
    return {
      summary: {
        ...baseSummary,
        validated_ok,
        validated_failed,
      },
      warnings,
    };
  }

  // enqueue_shadow
  let shadow_enqueued = 0;
  let shadow_skipped_disabled = 0;
  let shadow_skipped_other = 0;

  const queueOn = isInternalIntelligenceInternalBusQueueEnabled({ env, nodeEnv });
  if (!queueOn) {
    shadow_skipped_disabled += candidates.length;
    warnings.push({
      code: "enqueue_shadow_skipped",
      message:
        "enqueue_shadow blocked: FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED is not 1 or NODE_ENV is production.",
    });
    return {
      summary: {
        ...baseSummary,
        shadow_enqueued,
        shadow_skipped_disabled,
        shadow_skipped_other,
      },
      warnings,
    };
  }

  for (const c of candidates) {
    const built = buildShadowReplayEnvelopeFromCandidate(c);
    if ("error" in built) {
      shadow_skipped_other += 1;
      warnings.push({
        code: "enqueue_skipped_invalid_shape",
        message: built.error,
        intelligence_event_log_id: c.id,
      });
      continue;
    }

    const r = await enqueueInternalIntelligenceEvent(built.envelope, {
      env,
      nodeEnv,
      skipIntelligenceEventLogPersist: true,
    });
    if (r.status === "enqueued") {
      shadow_enqueued += 1;
    } else {
      shadow_skipped_disabled += 1;
    }
  }

  return {
    summary: {
      ...baseSummary,
      shadow_enqueued,
      shadow_skipped_disabled,
      shadow_skipped_other,
    },
    warnings,
  };
}
