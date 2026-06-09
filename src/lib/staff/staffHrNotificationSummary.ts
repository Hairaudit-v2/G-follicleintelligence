/**
 * Safe read model for IIOHR HR portal notifications from `fi_staff_source_ids.metadata`.
 * FI is not the HR system of record — only bounded, non-sensitive snapshot fields are surfaced.
 */

import {
  HR_PORTAL_SOURCE_SYSTEM_PRIORITY,
  isAllowedHrPortalUrl,
} from "@/src/lib/staff/myHrPortalSelection";
import { normalizeFiStaffSourceSystem } from "@/src/lib/staff/staffSourceIdsNormalize";

/** Metadata keys read for HR notification UI (allowlist only). */
export const STAFF_HR_NOTIFICATION_METADATA_KEYS = [
  "onboarding_status",
  "onboarding_completed_at",
  "required_documents_missing_count",
  "training_required_count",
  "certificates_outstanding_count",
  "hr_profile_url",
  "last_synced_at",
] as const;

/** Keys that must never be forwarded into UI summaries (defence in depth). */
export const STAFF_HR_SENSITIVE_METADATA_KEYS = [
  "bank",
  "bank_details",
  "tfn",
  "taxfilenumber",
  "tax_file_number",
  "tax_details",
  "super",
  "super_details",
  "dob",
  "date_of_birth",
  "address",
  "home_address",
  "pay_rate",
  "rate",
  "salary",
  "tax_information",
] as const;

export type StaffHrNotificationVariant = "no_link" | "outstanding" | "complete" | "stale";

export type StaffHrOnboardingStatus = "complete" | "incomplete" | "unknown";

export type StaffHrNotificationSummary = {
  hasHrLink: boolean;
  source_system: string | null;
  variant: StaffHrNotificationVariant;
  badgeLabel: string;
  shortLabel: string;
  outstandingTaskCount: number;
  onboardingStatus: StaffHrOnboardingStatus;
  onboarding_completed_at: string | null;
  required_documents_missing_count: number | null;
  training_required_count: number | null;
  certificates_outstanding_count: number | null;
  last_synced_at: string | null;
  isSyncStale: boolean;
  hr_portal_url: string | null;
  alerts: string[];
};

export type StaffHrNotificationSourceRow = {
  source_system: string;
  source_staff_id?: string;
  source_url?: string | null;
  metadata: Record<string, unknown> | null | undefined;
};

/** Days without sync before showing a stale warning (when HR link exists). */
export const STAFF_HR_SYNC_STALE_DAYS = 14;

const COMPLETE_ONBOARDING_STATUSES = new Set([
  "complete",
  "completed",
  "ready",
  "done",
  "onboarding_complete",
]);

const INCOMPLETE_ONBOARDING_STATUSES = new Set([
  "incomplete",
  "pending",
  "in_progress",
  "not_started",
  "required",
  "onboarding_incomplete",
  "contract_incomplete",
]);

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  const n = Number(String(v));
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

function parseIsoDate(raw: unknown): Date | null {
  const s = str(raw);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

function isHrSourceSystem(sourceSystem: string): boolean {
  const norm = normalizeFiStaffSourceSystem(sourceSystem);
  return (HR_PORTAL_SOURCE_SYSTEM_PRIORITY as readonly string[]).includes(norm);
}

function pickHrSourceRow(rows: StaffHrNotificationSourceRow[]): StaffHrNotificationSourceRow | null {
  for (const sys of HR_PORTAL_SOURCE_SYSTEM_PRIORITY) {
    const match = rows.find((r) => normalizeFiStaffSourceSystem(r.source_system) === sys);
    if (match) return match;
  }
  return null;
}

function resolveOnboardingStatus(
  statusRaw: string | null,
  completedAt: string | null
): StaffHrOnboardingStatus {
  if (completedAt) return "complete";
  if (!statusRaw) return "unknown";
  const s = statusRaw.toLowerCase();
  if (COMPLETE_ONBOARDING_STATUSES.has(s)) return "complete";
  if (INCOMPLETE_ONBOARDING_STATUSES.has(s)) return "incomplete";
  return "unknown";
}

function isSyncStale(lastSyncedAt: string | null, now: Date): boolean {
  if (!lastSyncedAt) return true;
  const d = parseIsoDate(lastSyncedAt);
  if (!d) return true;
  const ageMs = now.getTime() - d.getTime();
  return ageMs > STAFF_HR_SYNC_STALE_DAYS * 86_400_000;
}

function pickHrPortalUrl(row: StaffHrNotificationSourceRow, metadata: Record<string, unknown>): string | null {
  const fromMeta = str(metadata.hr_profile_url);
  if (fromMeta && isAllowedHrPortalUrl(fromMeta)) return fromMeta;
  const fromRow = row.source_url != null ? String(row.source_url).trim() : "";
  return isAllowedHrPortalUrl(fromRow) ? fromRow : null;
}

/** Returns only allowlisted safe metadata fields (never sensitive HR payloads). */
export function extractSafeHrNotificationMetadata(
  metadata: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const md = metadata ?? {};
  const out: Record<string, unknown> = {};
  for (const key of STAFF_HR_NOTIFICATION_METADATA_KEYS) {
    if (key in md) out[key] = md[key];
  }
  return out;
}

export function staffHrNotificationSummaryHasSensitiveKeys(summary: StaffHrNotificationSummary): boolean {
  const blob = JSON.stringify(summary).toLowerCase();
  return STAFF_HR_SENSITIVE_METADATA_KEYS.some((k) => blob.includes(k));
}

export function buildStaffHrNotificationNoLinkSummary(): StaffHrNotificationSummary {
  return {
    hasHrLink: false,
    source_system: null,
    variant: "no_link",
    badgeLabel: "No HR link",
    shortLabel: "No HR link",
    outstandingTaskCount: 0,
    onboardingStatus: "unknown",
    onboarding_completed_at: null,
    required_documents_missing_count: null,
    training_required_count: null,
    certificates_outstanding_count: null,
    last_synced_at: null,
    isSyncStale: false,
    hr_portal_url: null,
    alerts: [],
  };
}

export function buildStaffHrNotificationSummary(
  row: StaffHrNotificationSourceRow,
  now: Date = new Date()
): StaffHrNotificationSummary {
  if (!isHrSourceSystem(row.source_system)) {
    return buildStaffHrNotificationNoLinkSummary();
  }

  const safeMd = extractSafeHrNotificationMetadata(row.metadata);
  const onboardingStatusRaw = str(safeMd.onboarding_status);
  const onboardingCompletedAt = str(safeMd.onboarding_completed_at);
  const docsMissing = num(safeMd.required_documents_missing_count);
  const trainingRequired = num(safeMd.training_required_count);
  const certsOutstanding = num(safeMd.certificates_outstanding_count);
  const lastSyncedAt = str(safeMd.last_synced_at);
  const hrPortalUrl = pickHrPortalUrl(row, safeMd);
  const onboardingStatus = resolveOnboardingStatus(onboardingStatusRaw, onboardingCompletedAt);

  const alerts: string[] = [];
  if (docsMissing != null && docsMissing > 0) alerts.push("HR information required");
  if (trainingRequired != null && trainingRequired > 0) alerts.push("Training required");
  if (onboardingStatus === "incomplete") alerts.push("Contract/onboarding incomplete");
  if (certsOutstanding != null && certsOutstanding > 0) alerts.push("Certificates outstanding");

  const onboardingIncompleteCount = onboardingStatus === "incomplete" ? 1 : 0;
  const outstandingTaskCount =
    (docsMissing ?? 0) + (trainingRequired ?? 0) + (certsOutstanding ?? 0) + onboardingIncompleteCount;

  const isStale = isSyncStale(lastSyncedAt, now);
  const isComplete = outstandingTaskCount === 0 && onboardingStatus !== "incomplete";

  let variant: StaffHrNotificationVariant;
  let badgeLabel: string;
  let shortLabel: string;

  if (outstandingTaskCount > 0) {
    variant = "outstanding";
    if (trainingRequired != null && trainingRequired > 0 && outstandingTaskCount === trainingRequired) {
      badgeLabel = "Training incomplete";
      shortLabel = "Training";
    } else if (outstandingTaskCount === 1 && alerts.length === 1) {
      badgeLabel = alerts[0]!;
      shortLabel = alerts[0]!.split(" ")[0] ?? "Outstanding";
    } else {
      badgeLabel = `${outstandingTaskCount} HR task${outstandingTaskCount === 1 ? "" : "s"} outstanding`;
      shortLabel = `${outstandingTaskCount} outstanding`;
    }
  } else if (isComplete) {
    variant = "complete";
    badgeLabel = onboardingStatus === "complete" ? "Onboarding complete" : "HR complete";
    shortLabel = "Complete";
  } else {
    variant = "outstanding";
    badgeLabel = "HR information required";
    shortLabel = "Review";
  }

  return {
    hasHrLink: true,
    source_system: normalizeFiStaffSourceSystem(row.source_system),
    variant,
    badgeLabel,
    shortLabel,
    outstandingTaskCount,
    onboardingStatus,
    onboarding_completed_at: onboardingCompletedAt,
    required_documents_missing_count: docsMissing,
    training_required_count: trainingRequired,
    certificates_outstanding_count: certsOutstanding,
    last_synced_at: lastSyncedAt,
    isSyncStale: isStale,
    hr_portal_url: hrPortalUrl,
    alerts,
  };
}

export function pickStaffHrNotificationFromSourceRows(
  rows: StaffHrNotificationSourceRow[],
  now: Date = new Date()
): StaffHrNotificationSummary {
  const hrRows = rows.filter((r) => isHrSourceSystem(r.source_system));
  const picked = pickHrSourceRow(hrRows);
  if (!picked) return buildStaffHrNotificationNoLinkSummary();
  return buildStaffHrNotificationSummary(picked, now);
}
