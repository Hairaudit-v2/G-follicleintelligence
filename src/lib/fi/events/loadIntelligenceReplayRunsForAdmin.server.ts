import "server-only";

import { assertFiPlatformAdminSystemAccess } from "@/src/lib/fiOs/fiOsPlatformSystemGate.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { FiIntelligenceReplayRunRow } from "./intelligenceReplayRunTypes";

export type LoadIntelligenceReplayRunsForAdminResult = {
  rows: FiIntelligenceReplayRunRow[];
  error?: string;
};

/**
 * Recent governed replay runs for FI platform system UI (service role + platform admin gate).
 */
export async function loadIntelligenceReplayRunsForAdmin(opts?: {
  limit?: number;
}): Promise<LoadIntelligenceReplayRunsForAdminResult> {
  await assertFiPlatformAdminSystemAccess();
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100);

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_intelligence_replay_runs")
    .select(
      "id, requested_by, approved_by, approval_status, replay_mode, event_name, source, status_filter, privacy_level, since, until, correlation_id, limit_count, candidate_count, processed_count, failed_count, warning_count, summary, warnings, created_at, approved_at, completed_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { rows: [], error: error.message };
  }

  return { rows: (data ?? []) as FiIntelligenceReplayRunRow[] };
}
