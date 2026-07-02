import type { EvolvedStaffRecord } from "./iiohrStaffHrLinkReconciliationTypes";
import { normaliseStaffEmail } from "./iiohrStaffHrLinkReconciliationCore";
import {
  isStaffArchived,
  isStaffHrLinkedForReconciliation,
} from "./hrReconciliationEligibleCore";
import type {
  HrReconciliationSuggestion,
  StaffEmploymentStatus,
  StaffIdentitySource,
  StaffMemberLifecycleRow,
  StaffProfileEditInput,
} from "./staffLifecycleTypes";
import {
  IIOHR_MANAGED_IDENTITY_SOURCES,
  OPERATIONALLY_INELIGIBLE_EMPLOYMENT_STATUSES,
  SCHEDULING_EXCLUDED_EMPLOYMENT_STATUSES,
  STAFF_EMPLOYMENT_STATUSES,
} from "./staffLifecycleTypes";

export const EXTERNALLY_LOCKED_PROFILE_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "employment_status",
  "role_code",
] as const;

export type ExternallyLockedProfileField = (typeof EXTERNALLY_LOCKED_PROFILE_FIELDS)[number];

export function isExternallyManagedStaff(row: Pick<StaffMemberLifecycleRow, "identity_source" | "source_system">): boolean {
  if (IIOHR_MANAGED_IDENTITY_SOURCES.has(row.identity_source)) return true;
  return row.source_system === "iiohr_evolved_hr";
}

export function resolveEditableProfileFields(
  row: Pick<StaffMemberLifecycleRow, "identity_source" | "source_system">
): {
  locked: readonly ExternallyLockedProfileField[];
  editable: (keyof StaffProfileEditInput)[];
} {
  if (isExternallyManagedStaff(row)) {
    return {
      locked: EXTERNALLY_LOCKED_PROFILE_FIELDS,
      editable: ["notes", "timezone", "internal_tags", "clinic_id", "professional_title", "phone", "employment_type"],
    };
  }
  return {
    locked: [],
    editable: [
      "first_name",
      "last_name",
      "professional_title",
      "email",
      "phone",
      "role_code",
      "employment_type",
      "employment_status",
      "timezone",
      "clinic_id",
      "notes",
      "internal_tags",
    ],
  };
}

export function filterProfilePatchForSource(
  row: Pick<StaffMemberLifecycleRow, "identity_source" | "source_system">,
  patch: StaffProfileEditInput
): StaffProfileEditInput {
  const { editable } = resolveEditableProfileFields(row);
  const out: StaffProfileEditInput = {};
  for (const key of editable) {
    if (key in patch) {
      (out as Record<string, unknown>)[key] = patch[key];
    }
  }
  return out;
}

export function parseStaffEmploymentStatus(raw: unknown): StaffEmploymentStatus {
  const value = String(raw ?? "active").trim().toLowerCase();
  if ((STAFF_EMPLOYMENT_STATUSES as readonly string[]).includes(value)) {
    return value as StaffEmploymentStatus;
  }
  return "active";
}

export function parseStaffIdentitySource(raw: unknown): StaffIdentitySource {
  const value = String(raw ?? "local").trim().toLowerCase();
  if (value === "iiohr_evolved_hr") return "iiohr_evolved_hr";
  if (value === "academy_sync") return "academy_sync";
  if (value === "manual_import") return "manual_import";
  if (value === "future_external_system") return "future_external_system";
  return "local";
}

export function splitFullName(fullName: string): { first_name: string; last_name: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { first_name: "", last_name: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0]!, last_name: "" };
  return { first_name: parts[0]!, last_name: parts.slice(1).join(" ") };
}

export function composeFullName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ").trim();
}

export function isOperationallyIneligible(status: StaffEmploymentStatus): boolean {
  return OPERATIONALLY_INELIGIBLE_EMPLOYMENT_STATUSES.has(status);
}

export function isSchedulingExcluded(status: StaffEmploymentStatus): boolean {
  return SCHEDULING_EXCLUDED_EMPLOYMENT_STATUSES.has(status);
}

export function shouldDeactivateOnEmploymentChange(
  status: StaffEmploymentStatus,
  archiveFromActive?: boolean
): boolean {
  if (archiveFromActive) return true;
  return isOperationallyIneligible(status) || status === "inactive";
}

export function resolveIdentitySourceBadge(source: StaffIdentitySource): {
  label: string;
  tone: "iiohr" | "local" | "academy" | "import" | "external";
} {
  switch (source) {
    case "iiohr_evolved_hr":
      return { label: "Managed by IIOHR", tone: "iiohr" };
    case "academy_sync":
      return { label: "Academy Linked", tone: "academy" };
    case "manual_import":
      return { label: "Manual Import", tone: "import" };
    case "future_external_system":
      return { label: "External System", tone: "external" };
    default:
      return { label: "Local Workforce Record", tone: "local" };
  }
}

/** Simple token overlap name similarity — suggestion only, never auto-link. */
export function nameSimilarityScore(a: string, b: string): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  const tokensA = new Set(norm(a));
  const tokensB = new Set(norm(b));
  if (!tokensA.size || !tokensB.size) return 0;
  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap += 1;
  }
  return Math.round((overlap / Math.max(tokensA.size, tokensB.size)) * 100);
}

export type BuildReconciliationSuggestionsInput = {
  staffMembers: StaffMemberLifecycleRow[];
  evolvedStaffRecords: EvolvedStaffRecord[];
};

export function buildReconciliationSuggestions(
  input: BuildReconciliationSuggestionsInput
): HrReconciliationSuggestion[] {
  const suggestions: HrReconciliationSuggestion[] = [];
  const feedByEmail = new Map<string, EvolvedStaffRecord>();
  const claimedIiohrIds = new Set<string>();

  for (const row of input.staffMembers) {
    if (isStaffArchived(row)) continue;
    if (isStaffHrLinkedForReconciliation(row)) continue;
    if (isOperationallyIneligible(row.employment_status)) continue;
    const emailKey = normaliseStaffEmail(row.email);
    if (!emailKey) {
      suggestions.push({
        staffMemberId: row.id,
        fiStaffId: row.fi_staff_id,
        fiOsStaffName: row.full_name,
        fiOsEmail: row.email,
        suggestedIiohrRecord: null,
        confidenceScore: 0,
        matchType: "none",
        canAutoApprove: false,
      });
      continue;
    }

    if (!feedByEmail.has(emailKey)) {
      const match = input.evolvedStaffRecords.find(
        (r) => normaliseStaffEmail(r.email) === emailKey
      );
      if (match) feedByEmail.set(emailKey, match);
    }

    const exactMatch = feedByEmail.get(emailKey);
    if (exactMatch?.id && !claimedIiohrIds.has(String(exactMatch.id))) {
      claimedIiohrIds.add(String(exactMatch.id));
      suggestions.push({
        staffMemberId: row.id,
        fiStaffId: row.fi_staff_id,
        fiOsStaffName: row.full_name,
        fiOsEmail: row.email,
        suggestedIiohrRecord: {
          id: String(exactMatch.id),
          full_name: exactMatch.full_name != null ? String(exactMatch.full_name) : null,
          email: exactMatch.email != null ? String(exactMatch.email) : null,
        },
        confidenceScore: 100,
        matchType: "exact_email",
        canAutoApprove: true,
      });
      continue;
    }

    let best: EvolvedStaffRecord | null = null;
    let bestScore = 0;
    for (const record of input.evolvedStaffRecords) {
      const recordId = String(record.id ?? "").trim();
      if (!recordId || claimedIiohrIds.has(recordId)) continue;
      const score = nameSimilarityScore(row.full_name, String(record.full_name ?? ""));
      if (score > bestScore && score >= 60) {
        bestScore = score;
        best = record;
      }
    }

    suggestions.push({
      staffMemberId: row.id,
      fiStaffId: row.fi_staff_id,
      fiOsStaffName: row.full_name,
      fiOsEmail: row.email,
      suggestedIiohrRecord: best
        ? {
            id: String(best.id),
            full_name: best.full_name != null ? String(best.full_name) : null,
            email: best.email != null ? String(best.email) : null,
          }
        : null,
      confidenceScore: bestScore,
      matchType: best ? "name_suggestion" : "none",
      canAutoApprove: false,
    });
  }

  return suggestions;
}
