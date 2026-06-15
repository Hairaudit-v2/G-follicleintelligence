import "server-only";

import { assertFiPlatformAdminSystemAccess } from "@/src/lib/fiOs/fiOsPlatformSystemGate.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { isFiIntelligenceEventLogPersistEnabled } from "./persistentEventLogEnv";

export type FiIntelligenceEventLogRow = {
  id: string;
  event_name: string;
  source: string;
  source_event_id: string | null;
  correlation_id: string | null;
  privacy_level: string;
  delivery_mode: string;
  status: string;
  payload_summary: Record<string, unknown>;
  warnings: string[];
  error_message: string | null;
  occurred_at: string | null;
  created_at: string;
};

export type LoadIntelligenceEventLogsForAdminResult = {
  persistFlagSet: boolean;
  persistEffective: boolean;
  rows: FiIntelligenceEventLogRow[];
  error?: string;
};

/**
 * Latest intelligence event log rows for FI platform system UI. Uses the Supabase service role
 * after {@link assertFiPlatformAdminSystemAccess} (layout already enforces; this repeats for defense in depth).
 */
export async function loadIntelligenceEventLogsForAdmin(opts?: {
  limit?: number;
}): Promise<LoadIntelligenceEventLogsForAdminResult> {
  await assertFiPlatformAdminSystemAccess();
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
  const env = process.env as Record<string, string | undefined>;
  const persistFlagSet = env.FI_INTELLIGENCE_EVENT_LOG_PERSIST_ENABLED === "1";
  const persistEffective = isFiIntelligenceEventLogPersistEnabled({ env, nodeEnv: env.NODE_ENV });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_intelligence_event_logs")
    .select(
      "id, event_name, source, source_event_id, correlation_id, privacy_level, delivery_mode, status, payload_summary, warnings, error_message, occurred_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { persistFlagSet, persistEffective, rows: [], error: error.message };
  }

  return {
    persistFlagSet,
    persistEffective,
    rows: (data ?? []) as FiIntelligenceEventLogRow[],
  };
}
