/**
 * Optional generate filters for Phase 2 report library (pure types + helpers).
 */

import type { ReportId } from "@/src/lib/reports/reportCatalog";

export type ReportGenerateFilters = {
  procedureType?: string | null;
  attributionSource?: string | null;
  campaign?: string | null;
  arRisk?: string | null;
  snapshotStatus?: "all" | "paid_in_full" | "outstanding" | null;
};

export type ReportFilterField =
  | "procedureType"
  | "attributionSource"
  | "campaign"
  | "arRisk"
  | "snapshotStatus";

/** Which filter controls apply per report. */
export function reportFilterFields(reportId: ReportId): readonly ReportFilterField[] {
  switch (reportId) {
    case "surgery_gross_margin":
      return ["procedureType", "snapshotStatus"];
    case "revenue_attribution_summary":
      return ["attributionSource", "campaign", "procedureType"];
    case "ar_aging_summary":
      return ["arRisk"];
    default:
      return [];
  }
}

export function hasReportFilters(reportId: ReportId): boolean {
  return reportFilterFields(reportId).length > 0;
}

export type ReportFilterOptions = {
  procedureTypes: string[];
  attributionSources: string[];
  campaigns: string[];
};

export const AR_RISK_OPTIONS = [
  { value: "all", label: "All risk levels" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export const SNAPSHOT_STATUS_OPTIONS = [
  { value: "all", label: "All snapshots" },
  { value: "paid_in_full", label: "Paid in full" },
  { value: "outstanding", label: "Outstanding balance" },
] as const;

const PERIOD_STORAGE_KEY = "fi.reports.library.period";

export function readStoredReportPeriod(): { from: string; to: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PERIOD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { from?: string; to?: string };
    const from = parsed.from?.trim().slice(0, 10) ?? "";
    const to = parsed.to?.trim().slice(0, 10) ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
    return { from, to };
  } catch {
    return null;
  }
}

export function writeStoredReportPeriod(from: string, to: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PERIOD_STORAGE_KEY,
      JSON.stringify({ from: from.slice(0, 10), to: to.slice(0, 10) })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/** Build live operational deep-link with period (+ FinOS query prefixes where known). */
export function buildReportLiveHrefWithPeriod(
  tenantId: string,
  livePathSuffix: string | undefined,
  period: { from: string; to: string },
  reportId?: ReportId
): string | null {
  if (!livePathSuffix) return null;
  const tid = tenantId.trim();
  if (!tid) return null;
  const base = `/fi-admin/${tid}/${livePathSuffix.replace(/^\/+/, "")}`;
  const qs = new URLSearchParams();

  // Expenses surfaces use from/to
  if (livePathSuffix.startsWith("financial/expenses")) {
    if (period.from) qs.set("from", period.from);
    if (period.to) qs.set("to", period.to);
  }

  // Command centre / surgery economics use se_*
  if (reportId === "surgery_gross_margin" && livePathSuffix.startsWith("financial-os")) {
    if (period.from) qs.set("se_from", period.from);
    if (period.to) qs.set("se_to", period.to);
  }

  // Revenue attribution uses ra_*
  if (reportId === "revenue_attribution_summary" && livePathSuffix.startsWith("financial-os")) {
    if (period.from) qs.set("ra_from", period.from);
    if (period.to) qs.set("ra_to", period.to);
  }

  const q = qs.toString();
  return q ? `${base}?${q}` : base;
}
