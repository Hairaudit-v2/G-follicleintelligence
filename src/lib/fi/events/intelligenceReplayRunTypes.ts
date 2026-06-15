import type { IntelligenceEventLogReplayFilters } from "./intelligenceEventLogReplayTypes";

export type FiIntelligenceReplayRunApprovalStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "cancelled"
  | "completed"
  | "failed";

/** Stored on replay run rows; includes reserved `dispatch_future` (not executable in Stage 15). */
export type FiIntelligenceReplayRunMode = "dry_run" | "validate_only" | "enqueue_shadow" | "dispatch_future";

export type FiIntelligenceReplayRunRow = {
  id: string;
  requested_by: string | null;
  approved_by: string | null;
  approval_status: FiIntelligenceReplayRunApprovalStatus;
  replay_mode: FiIntelligenceReplayRunMode;
  event_name: string | null;
  source: string | null;
  status_filter: string | null;
  privacy_level: string | null;
  since: string | null;
  until: string | null;
  correlation_id: string | null;
  limit_count: number;
  candidate_count: number;
  processed_count: number;
  failed_count: number;
  warning_count: number;
  summary: Record<string, unknown>;
  warnings: string[];
  created_at: string;
  approved_at: string | null;
  completed_at: string | null;
};

export function filtersFromReplayRunRow(row: FiIntelligenceReplayRunRow): IntelligenceEventLogReplayFilters {
  return {
    ...(row.event_name ? { event_name: row.event_name } : {}),
    ...(row.source ? { source: row.source } : {}),
    ...(row.status_filter ? { status: row.status_filter } : {}),
    ...(row.privacy_level ? { privacy_level: row.privacy_level } : {}),
    ...(row.since ? { since: row.since } : {}),
    ...(row.until ? { until: row.until } : {}),
    ...(row.correlation_id ? { correlation_id: row.correlation_id } : {}),
    limit: row.limit_count,
  };
}
