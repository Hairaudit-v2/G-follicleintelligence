/**
 * Pure read models for FI Admin HR sync health dashboard (no secrets, no I/O).
 */

import type { FiStaffSyncRunRow } from "@/src/lib/staffImport/iiohrHrStaffSyncRuns.server";
import type { StaffHrNotificationSummary } from "@/src/lib/staff/staffHrNotificationSummary";
import { STAFF_HR_SYNC_STALE_DAYS } from "@/src/lib/staff/staffHrNotificationSummary";
import { canUseDevelopmentClinicFeaturesFromFiUserRole } from "@/src/lib/fiOs/developmentClinicAccess";

export type HrSyncEnvChecklistItem = {
  key: string;
  label: string;
  present: boolean;
  optional?: boolean;
};

export type HrSyncLatestRunSummary = {
  runId: string | null;
  status: string | null;
  mode: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  receivedRows: number;
  createdCount: number;
  updatedCount: number;
  linkedCount: number;
  skippedCount: number;
  warningCount: number;
  errorMessage: string | null;
  trigger: string | null;
};

export type HrSyncHealthVariant = "healthy" | "warning" | "danger";

export type HrSyncHealthOverview = {
  variant: HrSyncHealthVariant;
  title: string;
  message: string;
  lastSuccessfulSyncAt: string | null;
  lastAttemptedSyncAt: string | null;
  /** True when any linked staff member has metadata `last_synced_at` older than 14 days. */
  staffMetadataStale: boolean;
  staleStaffCount: number;
  staffWithIssuesCount: number;
};

export type HrStaffSyncIssueKind =
  | "no_hr_link"
  | "stale_hr_sync"
  | "missing_onboarding_status"
  | "invalid_hr_portal_url"
  | "training_count_unknown"
  | "documents_count_unknown";

export const HR_STAFF_SYNC_ISSUE_LABELS: Record<HrStaffSyncIssueKind, string> = {
  no_hr_link: "No HR link",
  stale_hr_sync: "Stale HR sync",
  missing_onboarding_status: "Missing onboarding status",
  invalid_hr_portal_url: "Invalid/missing HR portal URL",
  training_count_unknown: "Training count unknown",
  documents_count_unknown: "Documents count unknown",
};

export type HrStaffSyncIssueRow = {
  staffId: string;
  fullName: string;
  email: string | null;
  issues: HrStaffSyncIssueKind[];
};

const ENV_ITEMS: { key: string; label: string; optional?: boolean }[] = [
  { key: "IIOHR_HR_PERTH_STAFF_FEED_URL", label: "IIOHR HR Perth staff feed URL" },
  { key: "IIOHR_HR_PERTH_STAFF_FEED_KEY", label: "IIOHR HR Perth staff feed key", optional: true },
  { key: "FI_BASE_URL", label: "FI base URL" },
  { key: "IIOHR_HR_SYNC_SECRET", label: "IIOHR HR sync secret" },
  { key: "EVOLVED_PERTH_TENANT_ID", label: "Evolved Perth tenant id" },
  { key: "CRON_SECRET", label: "Cron secret (Vercel Bearer)" },
  { key: "FI_HR_SYNC_CRON_SECRET", label: "HR cron secret (optional alias)", optional: true },
];

function triggerOf(metadata: Record<string, unknown>): string | null {
  const t = metadata?.trigger;
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function buildHrSyncEnvironmentChecklist(getEnv: (key: string) => string | undefined): HrSyncEnvChecklistItem[] {
  return ENV_ITEMS.map(({ key, label, optional }) => ({
    key,
    label,
    optional,
    present: Boolean(getEnv(key)?.trim()),
  }));
}

export function allRequiredHrSyncEnvPresent(checklist: HrSyncEnvChecklistItem[]): boolean {
  return checklist.filter((i) => !i.optional).every((i) => i.present);
}

export function summarizeSyncRunRow(row: FiStaffSyncRunRow | null): HrSyncLatestRunSummary {
  if (!row) {
    return {
      runId: null,
      status: null,
      mode: null,
      startedAt: null,
      finishedAt: null,
      receivedRows: 0,
      createdCount: 0,
      updatedCount: 0,
      linkedCount: 0,
      skippedCount: 0,
      warningCount: 0,
      errorMessage: null,
      trigger: null,
    };
  }
  return {
    runId: row.id,
    status: row.status,
    mode: row.mode,
    startedAt: row.started_at || null,
    finishedAt: row.finished_at,
    receivedRows: row.received_rows,
    createdCount: row.created_count ?? 0,
    updatedCount: row.updated_count ?? 0,
    linkedCount: row.linked_count ?? 0,
    skippedCount: row.skipped_count ?? 0,
    warningCount: row.warning_count ?? 0,
    errorMessage: row.error_message ? truncate(row.error_message, 500) : null,
    trigger: triggerOf(row.metadata),
  };
}

export function pickLatestSuccessfulSyncRun(runs: FiStaffSyncRunRow[]): FiStaffSyncRunRow | null {
  for (const r of runs) {
    if (r.status === "success") return r;
  }
  return null;
}

export function detectStaffHrSyncIssues(input: {
  staffId: string;
  fullName: string;
  email: string | null;
  hr: StaffHrNotificationSummary;
}): HrStaffSyncIssueKind[] {
  const issues: HrStaffSyncIssueKind[] = [];
  const { hr } = input;

  if (!hr.hasHrLink) {
    issues.push("no_hr_link");
    return issues;
  }

  if (hr.isSyncStale) issues.push("stale_hr_sync");
  if (hr.onboardingStatus === "unknown") issues.push("missing_onboarding_status");
  if (!hr.hr_portal_url) issues.push("invalid_hr_portal_url");
  if (hr.training_required_count == null) issues.push("training_count_unknown");
  if (hr.required_documents_missing_count == null) issues.push("documents_count_unknown");

  return issues;
}

export function buildStaffHrSyncIssueRows(
  staff: Array<{ id: string; full_name: string; email: string | null; is_active: boolean }>,
  hrByStaffId: Record<string, StaffHrNotificationSummary>,
  opts?: { activeOnly?: boolean }
): HrStaffSyncIssueRow[] {
  const activeOnly = opts?.activeOnly !== false;
  const out: HrStaffSyncIssueRow[] = [];
  for (const s of staff) {
    if (activeOnly && !s.is_active) continue;
    const hr = hrByStaffId[s.id];
    if (!hr) continue;
    const issues = detectStaffHrSyncIssues({
      staffId: s.id,
      fullName: s.full_name,
      email: s.email,
      hr,
    });
    if (issues.length === 0) continue;
    out.push({
      staffId: s.id,
      fullName: s.full_name,
      email: s.email,
      issues,
    });
  }
  out.sort((a, b) => a.fullName.localeCompare(b.fullName));
  return out;
}

export function buildHrSyncHealthOverview(input: {
  runs: FiStaffSyncRunRow[];
  staffIssueRows: HrStaffSyncIssueRow[];
  envChecklist: HrSyncEnvChecklistItem[];
  now?: Date;
}): HrSyncHealthOverview {
  const latest = input.runs[0] ?? null;
  const latestSuccess = pickLatestSuccessfulSyncRun(input.runs);
  const staleStaffCount = input.staffIssueRows.filter((r) => r.issues.includes("stale_hr_sync")).length;
  const staffWithIssuesCount = input.staffIssueRows.length;
  const envOk = allRequiredHrSyncEnvPresent(input.envChecklist);

  const lastAttemptedSyncAt = latest?.started_at?.trim() || null;
  const lastSuccessfulSyncAt = latestSuccess
    ? (latestSuccess.finished_at?.trim() || latestSuccess.started_at?.trim() || null)
    : null;

  let variant: HrSyncHealthVariant = "healthy";
  let title = "HR sync is healthy";
  let message = "Latest sync runs and staff HR metadata look current.";

  if (!envOk) {
    variant = "warning";
    title = "Environment incomplete";
    message = "One or more required HR sync environment variables are missing on this deployment.";
  }

  if (latest?.status === "failed") {
    variant = "danger";
    title = "Latest sync attempt failed";
    message = latest.error_message?.trim() || "The most recent staff sync run did not succeed.";
  } else if (latest?.status === "running") {
    variant = "warning";
    title = "Sync in progress";
    message = "A staff sync run is still marked as running.";
  }

  const staffMetadataStale = staleStaffCount > 0;
  if (staffMetadataStale && variant === "healthy") {
    variant = "warning";
    title = "Staff HR metadata is stale";
    message = `${staleStaffCount} staff member${staleStaffCount === 1 ? "" : "s"} have HR sync metadata older than ${STAFF_HR_SYNC_STALE_DAYS} days. Run sync to refresh.`;
  }

  if (staffWithIssuesCount > 0 && variant === "healthy") {
    variant = "warning";
    title = "Staff HR issues detected";
    message = `${staffWithIssuesCount} active staff member${staffWithIssuesCount === 1 ? "" : "s"} need HR sync attention.`;
  }

  if (
    envOk &&
    latestSuccess &&
    !staffMetadataStale &&
    staffWithIssuesCount === 0 &&
    latest?.status === "success"
  ) {
    variant = "healthy";
    title = "HR sync is healthy";
    message = lastSuccessfulSyncAt
      ? `Last successful sync ${lastSuccessfulSyncAt}. Staff HR metadata is current.`
      : "Staff HR sync is current.";
  }

  return {
    variant,
    title,
    message,
    lastSuccessfulSyncAt,
    lastAttemptedSyncAt,
    staffMetadataStale,
    staleStaffCount,
    staffWithIssuesCount,
  };
}

/** Safe CSV export — operational fields only, never HR/payroll payloads. */
export function buildHrSyncIssuesCsvExport(rows: HrStaffSyncIssueRow[]): string {
  const header = ["staff_id", "full_name", "email", "issues"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const issues = r.issues.map((k) => HR_STAFF_SYNC_ISSUE_LABELS[k]).join("; ");
    lines.push(
      [r.staffId, r.fullName, r.email ?? "", issues]
        .map((cell) => {
          const s = String(cell ?? "");
          if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(",")
    );
  }
  return lines.join("\n");
}

/** Ensures CSV export never includes sensitive key names (defence in depth). */
export function hrSyncIssuesCsvIsSafe(csv: string): boolean {
  const lower = csv.toLowerCase();
  const blocked = ["bank", "tfn", "super", "pay_rate", "tax_details", "date_of_birth", "home_address"];
  return !blocked.some((k) => lower.includes(k));
}

/**
 * Pure gate mirror for HR sync health admin mutations (platform admin or clinic write operator).
 */
export function canPerformHrSyncHealthAdminAction(input: {
  userRole: string | null | undefined;
  isPlatformAdmin: boolean;
  hasValidAdminKey: boolean;
}): boolean {
  if (input.hasValidAdminKey || input.isPlatformAdmin) return true;
  return canUseDevelopmentClinicFeaturesFromFiUserRole(input.userRole);
}
