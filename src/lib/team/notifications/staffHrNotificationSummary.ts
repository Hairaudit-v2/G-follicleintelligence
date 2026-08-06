/**
 * Safe read model for IIOHR HR portal notifications from `fi_staff_source_ids.metadata`.
 * FI is not the HR system of record — only bounded, non-sensitive snapshot fields are surfaced.
 *
 * Readiness classification (staleness, onboarding, counts) lives in
 * `@/src/lib/team/identity` readiness contracts. This module owns notification
 * composition, portal URL selection, and badge/alert copy.
 */

import {
  buildStaffHrReadinessLinkedSummary,
  buildStaffHrReadinessNoLinkSummary,
  type StaffHrOnboardingStatus,
  type StaffHrReadinessSummary,
  STAFF_HR_SYNC_STALE_DAYS,
} from "@/src/lib/team/identity/readiness/hrReadinessContracts";
import {
  HR_PORTAL_SOURCE_SYSTEM_PRIORITY,
  isAllowedHrPortalUrl,
} from "@/src/lib/team/notifications/myHrPortalSelection";
import { normalizeFiStaffSourceSystem } from "@/src/lib/staff/staffSourceIdsNormalize";

/** Re-export for notification consumers that historically imported the threshold here. */
export { STAFF_HR_SYNC_STALE_DAYS };

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

export type { StaffHrOnboardingStatus };

export type StaffHrNotificationSummary = StaffHrReadinessSummary & {
  variant: StaffHrNotificationVariant;
  badgeLabel: string;
  shortLabel: string;
  hr_portal_url: string | null;
  alerts: string[];
};

export type StaffHrNotificationSourceRow = {
  source_system: string;
  source_staff_id?: string;
  source_url?: string | null;
  metadata: Record<string, unknown> | null | undefined;
};

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

function isHrSourceSystem(sourceSystem: string): boolean {
  const norm = normalizeFiStaffSourceSystem(sourceSystem);
  return (HR_PORTAL_SOURCE_SYSTEM_PRIORITY as readonly string[]).includes(norm);
}

function pickHrSourceRow(
  rows: StaffHrNotificationSourceRow[]
): StaffHrNotificationSourceRow | null {
  for (const sys of HR_PORTAL_SOURCE_SYSTEM_PRIORITY) {
    const match = rows.find((r) => normalizeFiStaffSourceSystem(r.source_system) === sys);
    if (match) return match;
  }
  return null;
}

function pickHrPortalUrl(
  row: StaffHrNotificationSourceRow,
  metadata: Record<string, unknown>
): string | null {
  const fromMeta = str(metadata.hr_profile_url);
  if (fromMeta && isAllowedHrPortalUrl(fromMeta)) return fromMeta;
  const fromRow = row.source_url != null ? String(row.source_url).trim() : "";
  return isAllowedHrPortalUrl(fromRow) ? fromRow : null;
}

function composeNotificationPresentation(
  readiness: StaffHrReadinessSummary,
  hrPortalUrl: string | null
): Pick<
  StaffHrNotificationSummary,
  "variant" | "badgeLabel" | "shortLabel" | "hr_portal_url" | "alerts"
> {
  if (!readiness.hasHrLink) {
    return {
      variant: "no_link",
      badgeLabel: "No HR link",
      shortLabel: "No HR link",
      hr_portal_url: null,
      alerts: [],
    };
  }

  const docsMissing = readiness.required_documents_missing_count;
  const trainingRequired = readiness.training_required_count;
  const certsOutstanding = readiness.certificates_outstanding_count;
  const onboardingStatus = readiness.onboardingStatus;
  const outstandingTaskCount = readiness.outstandingTaskCount;

  const alerts: string[] = [];
  if (docsMissing != null && docsMissing > 0) alerts.push("HR information required");
  if (trainingRequired != null && trainingRequired > 0) alerts.push("Training required");
  if (onboardingStatus === "incomplete") alerts.push("Contract/onboarding incomplete");
  if (certsOutstanding != null && certsOutstanding > 0) alerts.push("Certificates outstanding");

  const isComplete = outstandingTaskCount === 0 && onboardingStatus !== "incomplete";

  let variant: StaffHrNotificationVariant;
  let badgeLabel: string;
  let shortLabel: string;

  if (outstandingTaskCount > 0) {
    variant = "outstanding";
    if (
      trainingRequired != null &&
      trainingRequired > 0 &&
      outstandingTaskCount === trainingRequired
    ) {
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
    variant,
    badgeLabel,
    shortLabel,
    hr_portal_url: hrPortalUrl,
    alerts,
  };
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

export function staffHrNotificationSummaryHasSensitiveKeys(
  summary: StaffHrNotificationSummary
): boolean {
  const blob = JSON.stringify(summary).toLowerCase();
  return STAFF_HR_SENSITIVE_METADATA_KEYS.some((k) => blob.includes(k));
}

export function buildStaffHrNotificationNoLinkSummary(): StaffHrNotificationSummary {
  const readiness = buildStaffHrReadinessNoLinkSummary();
  return {
    ...readiness,
    ...composeNotificationPresentation(readiness, null),
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
  const readiness = buildStaffHrReadinessLinkedSummary({
    source_system: normalizeFiStaffSourceSystem(row.source_system),
    onboarding_status: str(safeMd.onboarding_status),
    onboarding_completed_at: str(safeMd.onboarding_completed_at),
    required_documents_missing_count: num(safeMd.required_documents_missing_count),
    training_required_count: num(safeMd.training_required_count),
    certificates_outstanding_count: num(safeMd.certificates_outstanding_count),
    last_synced_at: str(safeMd.last_synced_at),
    now,
  });
  const hrPortalUrl = pickHrPortalUrl(row, safeMd);
  return {
    ...readiness,
    ...composeNotificationPresentation(readiness, hrPortalUrl),
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
