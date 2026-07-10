import type { ReportGenerateResult } from "@/src/lib/reports/reportTypes";

export type ReportRunSource = "manual" | "schedule" | "cron";
export type ReportRunStatus = "pending" | "completed" | "failed";

export type FiReportRunRow = {
  id: string;
  tenant_id: string;
  report_id: string;
  title: string;
  period_start: string;
  period_end: string;
  params: Record<string, unknown>;
  result_json: ReportGenerateResult | Record<string, unknown>;
  status: ReportRunStatus;
  source: ReportRunSource;
  created_by_fi_user_id: string | null;
  created_at: string;
  completed_at: string | null;
};

export type FiReportScheduleRow = {
  id: string;
  tenant_id: string;
  report_id: string;
  period_preset: "30d" | "90d" | "ytd";
  filters: Record<string, unknown>;
  is_active: boolean;
  last_run_at: string | null;
  last_run_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ReportRunListItem = {
  id: string;
  report_id: string;
  title: string;
  period_start: string;
  period_end: string;
  source: ReportRunSource;
  status: ReportRunStatus;
  created_at: string;
};
