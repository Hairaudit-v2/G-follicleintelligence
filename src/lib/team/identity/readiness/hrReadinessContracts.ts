/**
 * Identity HR readiness contracts — client-safe.
 *
 * Owns sync-staleness thresholds, HR readiness summary types, and neutral
 * onboarding / stale predicates. Does not own notification badges, portal
 * selection, or delivery loaders (see `@/src/lib/team/notifications`).
 */

import { normalizeFiStaffSourceSystem } from "@/src/lib/staff/staffSourceIdsNormalize";

/** Days without sync before HR/identity surfaces treat metadata sync as stale. */
export const STAFF_HR_SYNC_STALE_DAYS = 14;

/**
 * Source-system tiers that carry HR readiness metadata (first match wins).
 * Notifications portal selection must stay aligned with this order.
 */
export const HR_READINESS_SOURCE_SYSTEM_PRIORITY = ["iiohr_hr", "iiohr", "hr"] as const;

export type StaffHrOnboardingStatus = "complete" | "incomplete" | "unknown";

/**
 * Neutral HR readiness projection (no badge labels, portal URLs, or alerts).
 * Notification DTOs may extend this structurally.
 */
export type StaffHrReadinessSummary = {
  hasHrLink: boolean;
  source_system: string | null;
  onboardingStatus: StaffHrOnboardingStatus;
  onboarding_completed_at: string | null;
  required_documents_missing_count: number | null;
  training_required_count: number | null;
  certificates_outstanding_count: number | null;
  last_synced_at: string | null;
  isSyncStale: boolean;
  outstandingTaskCount: number;
};

export type StaffHrReadinessSourceRow = {
  source_system: string;
  metadata: Record<string, unknown> | null | undefined;
};

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

function isHrReadinessSourceSystem(sourceSystem: string): boolean {
  const norm = normalizeFiStaffSourceSystem(sourceSystem);
  return (HR_READINESS_SOURCE_SYSTEM_PRIORITY as readonly string[]).includes(norm);
}

function pickHrReadinessSourceRow(
  rows: StaffHrReadinessSourceRow[]
): StaffHrReadinessSourceRow | null {
  for (const sys of HR_READINESS_SOURCE_SYSTEM_PRIORITY) {
    const match = rows.find((r) => normalizeFiStaffSourceSystem(r.source_system) === sys);
    if (match) return match;
  }
  return null;
}

export function resolveHrOnboardingStatus(
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

/** True when last sync is missing, unparseable, or older than {@link STAFF_HR_SYNC_STALE_DAYS}. */
export function isHrSyncStale(lastSyncedAt: string | null, now: Date = new Date()): boolean {
  if (!lastSyncedAt) return true;
  const d = parseIsoDate(lastSyncedAt);
  if (!d) return true;
  const ageMs = now.getTime() - d.getTime();
  return ageMs > STAFF_HR_SYNC_STALE_DAYS * 86_400_000;
}

export function computeStaffHrOutstandingTaskCount(input: {
  onboardingStatus: StaffHrOnboardingStatus;
  required_documents_missing_count: number | null;
  training_required_count: number | null;
  certificates_outstanding_count: number | null;
}): number {
  const onboardingIncompleteCount = input.onboardingStatus === "incomplete" ? 1 : 0;
  return (
    (input.required_documents_missing_count ?? 0) +
    (input.training_required_count ?? 0) +
    (input.certificates_outstanding_count ?? 0) +
    onboardingIncompleteCount
  );
}

export function buildStaffHrReadinessNoLinkSummary(): StaffHrReadinessSummary {
  return {
    hasHrLink: false,
    source_system: null,
    onboardingStatus: "unknown",
    onboarding_completed_at: null,
    required_documents_missing_count: null,
    training_required_count: null,
    certificates_outstanding_count: null,
    last_synced_at: null,
    isSyncStale: false,
    outstandingTaskCount: 0,
  };
}

export type BuildStaffHrReadinessLinkedInput = {
  source_system: string;
  onboarding_status?: string | null;
  onboarding_completed_at?: string | null;
  required_documents_missing_count?: number | null;
  training_required_count?: number | null;
  certificates_outstanding_count?: number | null;
  last_synced_at?: string | null;
  now?: Date;
};

/** Build a linked readiness summary from already-parsed metadata fields. */
export function buildStaffHrReadinessLinkedSummary(
  input: BuildStaffHrReadinessLinkedInput
): StaffHrReadinessSummary {
  const now = input.now ?? new Date();
  const onboardingCompletedAt = input.onboarding_completed_at ?? null;
  const onboardingStatus = resolveHrOnboardingStatus(
    input.onboarding_status ?? null,
    onboardingCompletedAt
  );
  const docsMissing = input.required_documents_missing_count ?? null;
  const trainingRequired = input.training_required_count ?? null;
  const certsOutstanding = input.certificates_outstanding_count ?? null;
  const lastSyncedAt = input.last_synced_at ?? null;
  const outstandingTaskCount = computeStaffHrOutstandingTaskCount({
    onboardingStatus,
    required_documents_missing_count: docsMissing,
    training_required_count: trainingRequired,
    certificates_outstanding_count: certsOutstanding,
  });

  return {
    hasHrLink: true,
    source_system: input.source_system,
    onboardingStatus,
    onboarding_completed_at: onboardingCompletedAt,
    required_documents_missing_count: docsMissing,
    training_required_count: trainingRequired,
    certificates_outstanding_count: certsOutstanding,
    last_synced_at: lastSyncedAt,
    isSyncStale: isHrSyncStale(lastSyncedAt, now),
    outstandingTaskCount,
  };
}

/**
 * Pick the preferred HR readiness source row and project a neutral readiness summary.
 * Does not compose badge labels or portal URLs.
 */
export function pickStaffHrReadinessFromSourceRows(
  rows: StaffHrReadinessSourceRow[],
  now: Date = new Date()
): StaffHrReadinessSummary {
  const hrRows = rows.filter((r) => isHrReadinessSourceSystem(r.source_system));
  const picked = pickHrReadinessSourceRow(hrRows);
  if (!picked) return buildStaffHrReadinessNoLinkSummary();

  const md = picked.metadata ?? {};
  return buildStaffHrReadinessLinkedSummary({
    source_system: normalizeFiStaffSourceSystem(picked.source_system),
    onboarding_status: str(md.onboarding_status),
    onboarding_completed_at: str(md.onboarding_completed_at),
    required_documents_missing_count: num(md.required_documents_missing_count),
    training_required_count: num(md.training_required_count),
    certificates_outstanding_count: num(md.certificates_outstanding_count),
    last_synced_at: str(md.last_synced_at),
    now,
  });
}
