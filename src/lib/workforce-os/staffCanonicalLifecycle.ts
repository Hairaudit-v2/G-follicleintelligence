/**
 * Canonical staff lifecycle resolver (pure, no I/O).
 *
 * One place that combines the two staff status sources —
 * scheduling `is_active` (directory / roster flag) and
 * lifecycle `employment_status` / `archived_at` (WorkforceOS HR) —
 * into a single canonical status. Staff Directory, Workforce
 * Command Centre, roster eligibility, and readiness surfaces must derive
 * "active" from this resolver rather than reading `is_active` directly, so a
 * terminated-but-not-deactivated record can never present as Active.
 *
 * Roster eligibility (B1.4) now obtains lifecycle fields via
 * `resolveStaffIdentities` rather than ad hoc dual-table joins; this helper
 * remains the pure status combiner for directory / command-centre signals.
 */

import {
  isOperationallyIneligible,
  parseStaffEmploymentStatus,
} from "@/src/lib/workforce-os/staffLifecycleCore";
import type { StaffEmploymentStatus } from "@/src/lib/workforce-os/staffLifecycleTypes";

export type CanonicalStaffLifecycleStatus =
  | "active"
  | "pending_onboarding"
  | "on_leave"
  | "suspended"
  | "inactive"
  | "terminated"
  | "archived";

export type StaffLifecycleSignal = {
  /** Scheduling record active flag. */
  isActive: boolean;
  /** Lifecycle employment status — null/undefined when no HR row exists. */
  employmentStatus?: string | null;
  /** Lifecycle archive timestamp. */
  archivedAt?: string | null;
};

function isArchivedSignal(archivedAt: string | null | undefined): boolean {
  return archivedAt != null && String(archivedAt).trim() !== "";
}

/**
 * Resolve the canonical lifecycle status for a staff record.
 *
 * Precedence (most terminal wins):
 * 1. terminated/resigned/contract_ended/contract_expired → `terminated`
 * 2. `archived_at` set → `archived`
 * 3. suspended → `suspended`; on_leave → `on_leave`; pending_onboarding → `pending_onboarding`
 * 4. employment_status inactive/merged OR `is_active === false` → `inactive`
 * 5. otherwise → `active`
 *
 * When no HR lifecycle row exists, `is_active` alone decides active/inactive.
 */
export function resolveCanonicalStaffLifecycleStatus(
  signal: StaffLifecycleSignal
): CanonicalStaffLifecycleStatus {
  const hasEmploymentStatus =
    signal.employmentStatus != null && String(signal.employmentStatus).trim() !== "";
  const employmentStatus: StaffEmploymentStatus = hasEmploymentStatus
    ? parseStaffEmploymentStatus(signal.employmentStatus)
    : signal.isActive
      ? "active"
      : "inactive";

  if (isOperationallyIneligible(employmentStatus) || employmentStatus === "contract_expired") {
    return "terminated";
  }
  if (isArchivedSignal(signal.archivedAt)) {
    return "archived";
  }
  if (employmentStatus === "suspended") return "suspended";
  if (employmentStatus === "on_leave") return "on_leave";
  if (employmentStatus === "pending_onboarding") return "pending_onboarding";
  if (employmentStatus === "inactive" || employmentStatus === "merged" || !signal.isActive) {
    return "inactive";
  }
  return "active";
}

/** True only when the record is operationally active (the only status the UI may label "Active"). */
export function isCanonicalStaffLifecycleActive(status: CanonicalStaffLifecycleStatus): boolean {
  return status === "active";
}

export function resolveStaffLifecycleIsActive(signal: StaffLifecycleSignal): boolean {
  return isCanonicalStaffLifecycleActive(resolveCanonicalStaffLifecycleStatus(signal));
}

export const CANONICAL_STAFF_LIFECYCLE_LABELS: Record<CanonicalStaffLifecycleStatus, string> = {
  active: "Active",
  pending_onboarding: "Pending onboarding",
  on_leave: "On leave",
  suspended: "Suspended",
  inactive: "Inactive",
  terminated: "Terminated",
  archived: "Archived",
};

export function canonicalStaffLifecycleLabel(status: CanonicalStaffLifecycleStatus): string {
  return CANONICAL_STAFF_LIFECYCLE_LABELS[status] ?? "Inactive";
}

/** Status pill tone classes shared by directory/command-centre chips. */
export function canonicalStaffLifecyclePillClass(status: CanonicalStaffLifecycleStatus): string {
  switch (status) {
    case "active":
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25";
    case "pending_onboarding":
      return "bg-cyan-500/15 text-cyan-300 ring-cyan-500/25";
    case "on_leave":
      return "bg-amber-500/15 text-amber-200 ring-amber-500/25";
    case "suspended":
      return "bg-rose-500/15 text-rose-200 ring-rose-500/25";
    case "terminated":
      return "bg-rose-500/15 text-rose-300 ring-rose-500/25";
    case "archived":
    case "inactive":
    default:
      return "bg-slate-500/15 text-slate-400 ring-slate-500/20";
  }
}

// ---------------------------------------------------------------------------
// Duplicate identity handling
// ---------------------------------------------------------------------------

export type StaffDuplicateCandidate = {
  id: string;
  fullName: string | null;
  email?: string | null;
  createdAt?: string | null;
  lifecycleStatus: CanonicalStaffLifecycleStatus;
  /** Externally-managed/HR-linked records win canonical preference ties. */
  hrLinked?: boolean;
};

export type StaffDuplicateResolution = {
  /** Staff ids that are non-canonical duplicates of another record. */
  duplicateStaffIds: Set<string>;
  /** duplicate staff id → canonical staff id it duplicates. */
  canonicalIdByDuplicateId: Map<string, string>;
  /** Groups (canonical first) for surfacing warnings. */
  groups: Array<{ canonicalId: string; duplicateIds: string[] }>;
};

export function normalizeStaffIdentityName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeStaffIdentityEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

function canonicalPreferenceRank(candidate: StaffDuplicateCandidate): number {
  // Lower rank wins. Active beats everything; HR-linked breaks ties; then newest.
  let rank = 0;
  if (!isCanonicalStaffLifecycleActive(candidate.lifecycleStatus)) rank += 10;
  if (!candidate.hrLinked) rank += 1;
  return rank;
}

function createdAtMs(candidate: StaffDuplicateCandidate): number {
  const ms = Date.parse(candidate.createdAt ?? "");
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Group staff records that share a normalized display name or email and pick a
 * canonical record per group (prefer active, then HR-linked, then newest).
 * Never deletes or merges — purely a display/eligibility strategy.
 */
export function resolveStaffDuplicateGroups(
  candidates: readonly StaffDuplicateCandidate[]
): StaffDuplicateResolution {
  const groupKeys = new Map<string, string>(); // union-find lite: key → group root key
  const byGroup = new Map<string, StaffDuplicateCandidate[]>();

  const keyRoot = (key: string): string => {
    let root = key;
    while (groupKeys.get(root) !== undefined && groupKeys.get(root) !== root) {
      root = groupKeys.get(root)!;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = keyRoot(a);
    const rb = keyRoot(b);
    groupKeys.set(ra, ra);
    groupKeys.set(rb, ra);
  };

  for (const candidate of candidates) {
    const nameKey = normalizeStaffIdentityName(candidate.fullName)
      ? `name:${normalizeStaffIdentityName(candidate.fullName)}`
      : null;
    const emailKey = normalizeStaffIdentityEmail(candidate.email)
      ? `email:${normalizeStaffIdentityEmail(candidate.email)}`
      : null;
    const keys = [nameKey, emailKey].filter((k): k is string => k != null);
    if (!keys.length) continue;
    for (const key of keys) {
      if (!groupKeys.has(key)) groupKeys.set(key, keys[0]!);
    }
    if (keys.length === 2) union(keys[0]!, keys[1]!);
  }

  for (const candidate of candidates) {
    const nameKey = normalizeStaffIdentityName(candidate.fullName);
    const emailKey = normalizeStaffIdentityEmail(candidate.email);
    const key = nameKey ? `name:${nameKey}` : emailKey ? `email:${emailKey}` : null;
    if (!key) continue;
    const root = keyRoot(key);
    const list = byGroup.get(root) ?? [];
    list.push(candidate);
    byGroup.set(root, list);
  }

  const duplicateStaffIds = new Set<string>();
  const canonicalIdByDuplicateId = new Map<string, string>();
  const groups: Array<{ canonicalId: string; duplicateIds: string[] }> = [];

  for (const members of byGroup.values()) {
    if (members.length < 2) continue;
    const sorted = [...members].sort((a, b) => {
      const rankDiff = canonicalPreferenceRank(a) - canonicalPreferenceRank(b);
      if (rankDiff !== 0) return rankDiff;
      return createdAtMs(b) - createdAtMs(a);
    });
    const canonical = sorted[0]!;
    const duplicateIds: string[] = [];
    for (const member of sorted.slice(1)) {
      duplicateStaffIds.add(member.id);
      canonicalIdByDuplicateId.set(member.id, canonical.id);
      duplicateIds.push(member.id);
    }
    groups.push({ canonicalId: canonical.id, duplicateIds });
  }

  return { duplicateStaffIds, canonicalIdByDuplicateId, groups };
}
