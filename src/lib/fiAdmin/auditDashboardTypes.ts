/** Shared types for AuditOS dashboard read model (safe for client + server). */

export type AuditQueueItem = {
  report_id: string;
  case_id: string;
  version: number;
  report_status: string;
  created_at: string;
  patient: { full_name: string; email: string } | null;
};

export type AuditDashboardKpis = {
  draft_reports: number;
  changes_required_reports: number;
  released_reports: number;
  pending_reviews: number;
  oldest_queue_created_at: string | null;
};

export type AuditActivityRow = {
  id: string;
  report_id: string;
  case_id: string;
  status: string;
  note: string | null;
  created_at: string;
};

export type AuditPipelineModelRuns = {
  queued: number;
  running: number;
  failed: number;
  complete: number;
};

export type AuditPipelineSnapshot = {
  model_runs: AuditPipelineModelRuns;
  scorecards_total: number;
};

export type AuditDashboardSnapshot = {
  kpis: AuditDashboardKpis;
  queue: AuditQueueItem[];
  recent_audit_activity: AuditActivityRow[];
  pipeline: AuditPipelineSnapshot;
};
