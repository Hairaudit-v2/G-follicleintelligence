import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type {
  IntelligenceEventLogReplayCandidate,
  IntelligenceEventLogReplayFilters,
  IntelligenceEventLogReplayOrder,
} from "./intelligenceEventLogReplayTypes";

export type LoadIntelligenceEventReplayCandidatesOptions = {
  filters: IntelligenceEventLogReplayFilters;
  env?: Record<string, string | undefined>;
  nodeEnv?: string;
  /** Unit tests: inject mock client. */
  supabaseClientForTests?: SupabaseClient;
  /**
   * **Trusted operator CLI only** (service role in shell). Skips {@link assertFiPlatformAdminSystemAccess}.
   * Never set from web request handlers.
   */
  omitPlatformAdminAssertForOperatorCli?: boolean;
};

export type LoadIntelligenceEventReplayCandidatesResult = {
  candidates: IntelligenceEventLogReplayCandidate[];
  limit_effective: number;
  error?: string;
};

const SELECT =
  "id, event_name, source, source_event_id, correlation_id, privacy_level, delivery_mode, status, payload_summary, warnings, error_message, occurred_at, created_at";

/** Exported for unit tests — clamps to 1..500 inclusive. */
export function clampIntelligenceEventLogReplayLimit(raw: number | undefined): number {
  const n = raw === undefined ? 50 : raw;
  return Math.min(Math.max(Math.trunc(n), 1), 500);
}

/**
 * Load sanitized replay candidates from `fi_intelligence_event_logs` using the Supabase service role.
 * Defense in depth: asserts FI platform system admin unless `omitPlatformAdminAssertForOperatorCli` for local CLI.
 */
export async function loadIntelligenceEventReplayCandidates(
  options: LoadIntelligenceEventReplayCandidatesOptions
): Promise<LoadIntelligenceEventReplayCandidatesResult> {
  if (!options.omitPlatformAdminAssertForOperatorCli) {
    const { assertFiPlatformAdminSystemAccess } =
      await import("@/src/lib/fiOs/fiOsPlatformSystemGate.server");
    await assertFiPlatformAdminSystemAccess();
  }

  const limit_effective = clampIntelligenceEventLogReplayLimit(options.filters.limit);
  const order: IntelligenceEventLogReplayOrder = options.filters.order ?? "newest_first";
  const ascending = order === "oldest_first";

  const supabase = options.supabaseClientForTests ?? supabaseAdmin();

  let q = supabase.from("fi_intelligence_event_logs").select(SELECT);

  const f = options.filters;
  if (f.event_name) q = q.eq("event_name", f.event_name);
  if (f.source) q = q.eq("source", f.source);
  if (f.status) q = q.eq("status", f.status);
  if (f.privacy_level) q = q.eq("privacy_level", f.privacy_level);
  if (f.correlation_id) q = q.eq("correlation_id", f.correlation_id);
  if (f.since) q = q.gte("created_at", f.since);
  if (f.until) q = q.lte("created_at", f.until);

  q = q.order("created_at", { ascending }).limit(limit_effective);

  const { data, error } = await q;

  if (error) {
    return { candidates: [], limit_effective, error: error.message };
  }

  return {
    candidates: (data ?? []) as IntelligenceEventLogReplayCandidate[],
    limit_effective,
  };
}
