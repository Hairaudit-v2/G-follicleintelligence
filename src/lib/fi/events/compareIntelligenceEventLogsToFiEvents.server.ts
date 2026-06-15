import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { clampIntelligenceEventLogReplayLimit } from "./loadIntelligenceEventReplayCandidates.server";

/** Contract: `fi_events` uses `source_system` (not `source`). */
export const FI_EVENTS_SOURCE_FIELD = "source_system" as const;

/** Contract: `fi_intelligence_event_logs` uses `source`. */
export const FI_INTELLIGENCE_EVENT_LOGS_SOURCE_FIELD = "source" as const;

/**
 * `fi_events` has no `correlation_id` column; this helper never reads `payload_json`, so
 * correlation overlap with producer events is not inferred here.
 */
export const FI_EVENTS_CORRELATION_FROM_PAYLOAD_DISABLED = true as const;

export type CompareIntelligenceEventLogsToFiEventsOptions = {
  /** ISO `created_at` lower bound for both tables (inclusive). */
  since?: string;
  /** ISO `created_at` upper bound for both tables (inclusive). */
  until?: string;
  /** Max rows read per table (clamped 1–500). Default 200. */
  limit?: number;
  supabaseClientForTests?: SupabaseClient;
  omitPlatformAdminAssertForOperatorCli?: boolean;
};

export type CompareIntelSampleRow = {
  id: string;
  event_name: string;
  source: string;
  status: string;
  correlation_id: string | null;
  source_event_id: string | null;
  created_at: string;
};

export type CompareFiEventSampleRow = {
  id: string;
  event_type: string;
  source_system: string;
  status: string;
  created_at: string;
};

export type CompareIntelligenceEventLogsToFiEventsResult = {
  summary: {
    [FI_EVENTS_SOURCE_FIELD]: typeof FI_EVENTS_SOURCE_FIELD;
    [FI_INTELLIGENCE_EVENT_LOGS_SOURCE_FIELD]: typeof FI_INTELLIGENCE_EVENT_LOGS_SOURCE_FIELD;
    fi_events_correlation_from_payload_disabled: typeof FI_EVENTS_CORRELATION_FROM_PAYLOAD_DISABLED;
    intelligence_rows_sampled: number;
    fi_events_rows_sampled: number;
    event_names_only_in_intelligence: string[];
    event_types_only_in_fi_events: string[];
    /** Distinct correlation ids seen on intelligence rows (no `fi_events` join — see contract flag). */
    correlation_ids_seen_in_intelligence_sample: string[];
    intelligence_source_event_ids_without_fi_events_row_sample: string[];
    counts_by_event_name_intel: Record<string, number>;
    counts_by_event_type_fi: Record<string, number>;
    counts_by_source_intel: Record<string, number>;
    counts_by_source_system_fi: Record<string, number>;
    counts_by_status_intel: Record<string, number>;
    counts_by_status_fi: Record<string, number>;
  };
  error?: string;
};

const SAMPLE_CAP = 20;

function capSample<T>(arr: T[]): T[] {
  return arr.slice(0, SAMPLE_CAP);
}

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

/** Pure summary builder for tests and for {@link compareIntelligenceEventLogsToFiEvents}. */
export function computeCompareIntelligenceLogsToFiEventsSummary(
  intelRows: CompareIntelSampleRow[],
  fiRows: CompareFiEventSampleRow[]
): CompareIntelligenceEventLogsToFiEventsResult["summary"] {
  const fiIds = new Set(fiRows.map((r) => r.id));
  const fiEventTypes = new Set(fiRows.map((r) => r.event_type));
  const intelEventNames = new Set(intelRows.map((r) => r.event_name));

  const counts_by_event_name_intel: Record<string, number> = {};
  const counts_by_event_type_fi: Record<string, number> = {};
  const counts_by_source_intel: Record<string, number> = {};
  const counts_by_source_system_fi: Record<string, number> = {};
  const counts_by_status_intel: Record<string, number> = {};
  const counts_by_status_fi: Record<string, number> = {};

  const correlations = new Set<string>();
  const missingFiForSourceEventId: string[] = [];

  for (const r of intelRows) {
    increment(counts_by_event_name_intel, r.event_name);
    increment(counts_by_source_intel, r.source);
    increment(counts_by_status_intel, r.status);
    if (r.correlation_id) correlations.add(r.correlation_id);
    if (r.source_event_id && !fiIds.has(r.source_event_id)) {
      missingFiForSourceEventId.push(r.source_event_id);
    }
  }

  for (const r of fiRows) {
    increment(counts_by_event_type_fi, r.event_type);
    increment(counts_by_source_system_fi, r.source_system);
    increment(counts_by_status_fi, r.status);
  }

  const event_names_only_in_intelligence = [...intelEventNames].filter((n) => !fiEventTypes.has(n));
  const event_types_only_in_fi_events = [...fiEventTypes].filter((t) => !intelEventNames.has(t));

  return {
    source_system: FI_EVENTS_SOURCE_FIELD,
    source: FI_INTELLIGENCE_EVENT_LOGS_SOURCE_FIELD,
    fi_events_correlation_from_payload_disabled: FI_EVENTS_CORRELATION_FROM_PAYLOAD_DISABLED,
    intelligence_rows_sampled: intelRows.length,
    fi_events_rows_sampled: fiRows.length,
    event_names_only_in_intelligence: capSample([...event_names_only_in_intelligence].sort()),
    event_types_only_in_fi_events: capSample([...event_types_only_in_fi_events].sort()),
    correlation_ids_seen_in_intelligence_sample: capSample([...correlations].sort()),
    intelligence_source_event_ids_without_fi_events_row_sample: capSample([...new Set(missingFiForSourceEventId)].sort()),
    counts_by_event_name_intel,
    counts_by_event_type_fi,
    counts_by_source_intel,
    counts_by_source_system_fi,
    counts_by_status_intel,
    counts_by_status_fi,
  };
}

/**
 * Read-only comparison between `fi_intelligence_event_logs` and `fi_events` metadata columns
 * (`payload_json` is never selected).
 */
export async function compareIntelligenceEventLogsToFiEvents(
  options: CompareIntelligenceEventLogsToFiEventsOptions
): Promise<CompareIntelligenceEventLogsToFiEventsResult> {
  if (!options.omitPlatformAdminAssertForOperatorCli) {
    const { assertFiPlatformAdminSystemAccess } = await import("@/src/lib/fiOs/fiOsPlatformSystemGate.server");
    await assertFiPlatformAdminSystemAccess();
  }

  const perTableLimit = clampIntelligenceEventLogReplayLimit(options.limit ?? 200);
  const supabase = options.supabaseClientForTests ?? supabaseAdmin();

  let iq = supabase
    .from("fi_intelligence_event_logs")
    .select("id, event_name, source, status, correlation_id, source_event_id, created_at")
    .order("created_at", { ascending: false })
    .limit(perTableLimit);

  if (options.since) iq = iq.gte("created_at", options.since);
  if (options.until) iq = iq.lte("created_at", options.until);

  let fq = supabase
    .from("fi_events")
    .select("id, event_type, source_system, status, created_at")
    .order("created_at", { ascending: false })
    .limit(perTableLimit);

  if (options.since) fq = fq.gte("created_at", options.since);
  if (options.until) fq = fq.lte("created_at", options.until);

  const [intelRes, fiRes] = await Promise.all([iq, fq]);

  if (intelRes.error) {
    return {
      summary: {
        source_system: FI_EVENTS_SOURCE_FIELD,
        source: FI_INTELLIGENCE_EVENT_LOGS_SOURCE_FIELD,
        fi_events_correlation_from_payload_disabled: FI_EVENTS_CORRELATION_FROM_PAYLOAD_DISABLED,
        intelligence_rows_sampled: 0,
        fi_events_rows_sampled: 0,
        event_names_only_in_intelligence: [],
        event_types_only_in_fi_events: [],
        correlation_ids_seen_in_intelligence_sample: [],
        intelligence_source_event_ids_without_fi_events_row_sample: [],
        counts_by_event_name_intel: {},
        counts_by_event_type_fi: {},
        counts_by_source_intel: {},
        counts_by_source_system_fi: {},
        counts_by_status_intel: {},
        counts_by_status_fi: {},
      },
      error: intelRes.error.message,
    };
  }

  if (fiRes.error) {
    return {
      summary: {
        source_system: FI_EVENTS_SOURCE_FIELD,
        source: FI_INTELLIGENCE_EVENT_LOGS_SOURCE_FIELD,
        fi_events_correlation_from_payload_disabled: FI_EVENTS_CORRELATION_FROM_PAYLOAD_DISABLED,
        intelligence_rows_sampled: 0,
        fi_events_rows_sampled: 0,
        event_names_only_in_intelligence: [],
        event_types_only_in_fi_events: [],
        correlation_ids_seen_in_intelligence_sample: [],
        intelligence_source_event_ids_without_fi_events_row_sample: [],
        counts_by_event_name_intel: {},
        counts_by_event_type_fi: {},
        counts_by_source_intel: {},
        counts_by_source_system_fi: {},
        counts_by_status_intel: {},
        counts_by_status_fi: {},
      },
      error: fiRes.error.message,
    };
  }

  const intelRows = (intelRes.data ?? []) as CompareIntelSampleRow[];
  const fiRows = (fiRes.data ?? []) as CompareFiEventSampleRow[];

  return {
    summary: computeCompareIntelligenceLogsToFiEventsSummary(intelRows, fiRows),
  };
}
