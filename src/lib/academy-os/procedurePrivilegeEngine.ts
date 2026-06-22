/**
 * AcademyOS Phase C — pure procedure privilege evaluation engine.
 */

import type {
  FiProcedurePrivilegeRequirementRow,
  FiStaffProcedurePrivilegeRow,
  PrivilegeEligibilityStatus,
  PrivilegeLevel,
  PrivilegeStatus,
  PrivilegeWarningCode,
  ProcedurePrivilegeEligibilityResult,
} from "./procedurePrivilegeTypes";
import {
  comparePrivilegeLevels,
  doesPrivilegeLevelSatisfy,
  isPrivilegeStatus,
} from "./procedurePrivilegeTypes";

const MS_DAY = 86_400_000;
const EXPIRING_SOON_DAYS = 30;
const REVIEW_DUE_SOON_DAYS = 14;

export type ResolvePrivilegeStatusInput = {
  privilegeStatus: PrivilegeStatus;
  expiresAt: string | null;
  at?: Date;
};

export type FindMatchingProcedurePrivilegeInput = {
  privileges: FiStaffProcedurePrivilegeRow[];
  procedureKey: string;
  clinicId?: string | null;
  minimumLevel?: PrivilegeLevel;
  at?: Date;
};

export type EvaluateProcedurePrivilegeEligibilityInput = {
  privileges: FiStaffProcedurePrivilegeRow[];
  procedureKey: string;
  minimumLevel: PrivilegeLevel;
  clinicId?: string | null;
  blockPendingReview?: boolean;
  at?: Date;
};

export type EvaluateRoleProcedureRequirementsInput = {
  privileges: FiStaffProcedurePrivilegeRow[];
  requirements: FiProcedurePrivilegeRequirementRow[];
  assignedRole: string;
  clinicId?: string | null;
  blockPendingReview?: boolean;
  at?: Date;
};

export type StaffProcedurePrivilegeSummary = {
  activeCount: number;
  pendingReviewCount: number;
  suspendedCount: number;
  expiredCount: number;
  expiringSoonCount: number;
  byProcedure: Record<string, FiStaffProcedurePrivilegeRow[]>;
};

function parseIso(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const t = Date.parse(raw.trim());
  return Number.isNaN(t) ? null : new Date(t);
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function daysUntil(date: Date, at: Date): number {
  return (date.getTime() - at.getTime()) / MS_DAY;
}

/** Resolves effective status considering expiry timestamps. */
export function resolvePrivilegeStatus(input: ResolvePrivilegeStatusInput): PrivilegeStatus {
  const at = input.at ?? new Date();
  const expires = parseIso(input.expiresAt);
  if (expires && expires.getTime() <= at.getTime()) {
    return "expired";
  }
  return input.privilegeStatus;
}

export function isPrivilegeActiveAtDate(
  privilege: Pick<FiStaffProcedurePrivilegeRow, "privilegeStatus" | "expiresAt">,
  at?: Date
): boolean {
  const status = resolvePrivilegeStatus({
    privilegeStatus: privilege.privilegeStatus,
    expiresAt: privilege.expiresAt,
    at,
  });
  return status === "active" || status === "pending_review";
}

function collectPrivilegeWarnings(
  privilege: FiStaffProcedurePrivilegeRow,
  usedTenantWideFallback: boolean,
  at: Date
): PrivilegeWarningCode[] {
  const warnings: PrivilegeWarningCode[] = [];
  const effectiveStatus = resolvePrivilegeStatus({
    privilegeStatus: privilege.privilegeStatus,
    expiresAt: privilege.expiresAt,
    at,
  });

  if (effectiveStatus === "active" && privilege.expiresAt) {
    const exp = parseIso(privilege.expiresAt);
    if (exp && daysUntil(exp, at) <= EXPIRING_SOON_DAYS && daysUntil(exp, at) >= 0) {
      warnings.push("privilege_expiring_soon");
    }
  }

  if (privilege.reviewDueAt) {
    const reviewDue = parseIso(privilege.reviewDueAt);
    if (reviewDue && daysUntil(reviewDue, at) <= REVIEW_DUE_SOON_DAYS) {
      warnings.push("review_due_soon");
    }
  }

  if (usedTenantWideFallback) {
    warnings.push("tenant_wide_fallback_used");
  }

  return warnings;
}

/**
 * Finds the best matching privilege for a procedure, preferring clinic-specific over tenant-wide.
 */
export function findMatchingProcedurePrivilege(
  input: FindMatchingProcedurePrivilegeInput
): { privilege: FiStaffProcedurePrivilegeRow | null; usedTenantWideFallback: boolean } {
  const at = input.at ?? new Date();
  const procedureKey = normalizeKey(input.procedureKey);
  const clinicId = input.clinicId?.trim() || null;
  const minimumLevel = input.minimumLevel;

  const candidates = input.privileges.filter((p) => normalizeKey(String(p.procedureKey)) === procedureKey);

  const clinicSpecific = clinicId
    ? candidates.filter((p) => p.clinicId?.trim() === clinicId)
    : [];
  const tenantWide = candidates.filter((p) => !p.clinicId?.trim());

  const ordered = clinicSpecific.length > 0 ? clinicSpecific : tenantWide;
  const usedTenantWideFallback = clinicId != null && clinicSpecific.length === 0 && tenantWide.length > 0;

  let best: FiStaffProcedurePrivilegeRow | null = null;

  for (const row of ordered) {
    if (!isPrivilegeActiveAtDate(row, at)) continue;
    if (minimumLevel && !doesPrivilegeLevelSatisfy(row.privilegeLevel, minimumLevel)) continue;
    if (!best || comparePrivilegeLevels(row.privilegeLevel, best.privilegeLevel) > 0) {
      best = row;
    }
  }

  if (!best && ordered.length > 0) {
    const sorted = [...ordered].sort((a, b) => comparePrivilegeLevels(b.privilegeLevel, a.privilegeLevel));
    return { privilege: sorted[0] ?? null, usedTenantWideFallback };
  }

  return { privilege: best, usedTenantWideFallback };
}

export function evaluateProcedurePrivilegeEligibility(
  input: EvaluateProcedurePrivilegeEligibilityInput
): ProcedurePrivilegeEligibilityResult {
  const at = input.at ?? new Date();
  const { privilege, usedTenantWideFallback } = findMatchingProcedurePrivilege({
    privileges: input.privileges,
    procedureKey: input.procedureKey,
    clinicId: input.clinicId,
    at,
  });

  const missingRequirements = [
    {
      requiredProcedureKey: input.procedureKey,
      minimumPrivilegeLevel: input.minimumLevel,
      assignedRole: "",
    },
  ];

  if (!privilege) {
    return {
      eligible: false,
      status: "missing_privilege",
      matchedPrivilege: null,
      missingRequirements,
      warnings: usedTenantWideFallback ? ["tenant_wide_fallback_used"] : [],
    };
  }

  const effectiveStatus = resolvePrivilegeStatus({
    privilegeStatus: privilege.privilegeStatus,
    expiresAt: privilege.expiresAt,
    at,
  });

  const warnings = collectPrivilegeWarnings(privilege, usedTenantWideFallback, at);

  if (effectiveStatus === "expired") {
    return {
      eligible: false,
      status: "expired",
      matchedPrivilege: privilege,
      missingRequirements,
      warnings,
    };
  }

  if (effectiveStatus === "suspended" || effectiveStatus === "revoked") {
    return {
      eligible: false,
      status: "suspended",
      matchedPrivilege: privilege,
      missingRequirements,
      warnings,
    };
  }

  if (effectiveStatus === "pending_review") {
    if (input.blockPendingReview) {
      return {
        eligible: false,
        status: "pending_review",
        matchedPrivilege: privilege,
        missingRequirements,
        warnings,
      };
    }
    warnings.push("review_due_soon");
  }

  if (!doesPrivilegeLevelSatisfy(privilege.privilegeLevel, input.minimumLevel)) {
    return {
      eligible: false,
      status: "insufficient_level",
      matchedPrivilege: privilege,
      missingRequirements,
      warnings,
    };
  }

  return {
    eligible: true,
    status: "eligible",
    matchedPrivilege: privilege,
    missingRequirements: [],
    warnings,
  };
}

/**
 * Evaluates role requirements. Multiple procedure rows for the same role are OR (any satisfies).
 */
export function evaluateRoleProcedureRequirements(
  input: EvaluateRoleProcedureRequirementsInput
): ProcedurePrivilegeEligibilityResult {
  const role = normalizeKey(input.assignedRole);
  const roleRequirements = input.requirements.filter(
    (r) => r.isActive && normalizeKey(r.assignedRole) === role
  );

  if (roleRequirements.length === 0) {
    return {
      eligible: true,
      status: "eligible",
      matchedPrivilege: null,
      missingRequirements: [],
      warnings: ["no_privilege_requirement_configured"],
    };
  }

  const evaluations = roleRequirements.map((req) =>
    evaluateProcedurePrivilegeEligibility({
      privileges: input.privileges,
      procedureKey: req.requiredProcedureKey,
      minimumLevel: req.minimumPrivilegeLevel,
      clinicId: input.clinicId,
      blockPendingReview: input.blockPendingReview,
      at: input.at,
    })
  );

  const satisfied = evaluations.find((e) => e.eligible);
  if (satisfied) {
    const warnings = [...new Set(evaluations.flatMap((e) => e.warnings))];
    return {
      eligible: true,
      status: "eligible",
      matchedPrivilege: satisfied.matchedPrivilege,
      missingRequirements: [],
      warnings,
    };
  }

  const primary = evaluations[0];
  const missingRequirements = roleRequirements.map((req) => ({
    requiredProcedureKey: req.requiredProcedureKey,
    minimumPrivilegeLevel: req.minimumPrivilegeLevel,
    assignedRole: req.assignedRole,
  }));

  const statusPriority: PrivilegeEligibilityStatus[] = [
    "suspended",
    "expired",
    "insufficient_level",
    "pending_review",
    "missing_privilege",
  ];

  let status: PrivilegeEligibilityStatus = "missing_privilege";
  for (const candidate of statusPriority) {
    if (evaluations.some((e) => e.status === candidate)) {
      status = candidate;
      break;
    }
  }

  return {
    eligible: false,
    status,
    matchedPrivilege: primary?.matchedPrivilege ?? null,
    missingRequirements,
    warnings: [...new Set(evaluations.flatMap((e) => e.warnings))],
  };
}

export function summarizeStaffProcedurePrivileges(
  privileges: FiStaffProcedurePrivilegeRow[],
  at?: Date
): StaffProcedurePrivilegeSummary {
  const ref = at ?? new Date();
  const summary: StaffProcedurePrivilegeSummary = {
    activeCount: 0,
    pendingReviewCount: 0,
    suspendedCount: 0,
    expiredCount: 0,
    expiringSoonCount: 0,
    byProcedure: {},
  };

  for (const row of privileges) {
    const key = normalizeKey(String(row.procedureKey));
    if (!summary.byProcedure[key]) summary.byProcedure[key] = [];
    summary.byProcedure[key].push(row);

    const effective = resolvePrivilegeStatus({
      privilegeStatus: row.privilegeStatus,
      expiresAt: row.expiresAt,
      at: ref,
    });

    if (isPrivilegeStatus(effective)) {
      switch (effective) {
        case "active":
          summary.activeCount++;
          if (row.expiresAt) {
            const exp = parseIso(row.expiresAt);
            if (exp && daysUntil(exp, ref) <= EXPIRING_SOON_DAYS && daysUntil(exp, ref) >= 0) {
              summary.expiringSoonCount++;
            }
          }
          break;
        case "pending_review":
          summary.pendingReviewCount++;
          break;
        case "suspended":
        case "revoked":
          summary.suspendedCount++;
          break;
        case "expired":
          summary.expiredCount++;
          break;
        default:
          break;
      }
    }
  }

  return summary;
}

export function buildProcedurePrivilegeEligibilitySnapshot(input: {
  eligibility: ProcedurePrivilegeEligibilityResult;
  assignedRole: string;
  eventType: string;
}): Record<string, unknown> {
  return {
    procedure_privilege_status: input.eligibility.status,
    required_procedure_keys: input.eligibility.missingRequirements.map((m) => m.requiredProcedureKey),
    matched_privileges: input.eligibility.matchedPrivilege
      ? [
          {
            id: input.eligibility.matchedPrivilege.id,
            procedure_key: input.eligibility.matchedPrivilege.procedureKey,
            privilege_level: input.eligibility.matchedPrivilege.privilegeLevel,
            privilege_status: input.eligibility.matchedPrivilege.privilegeStatus,
            clinic_id: input.eligibility.matchedPrivilege.clinicId,
          },
        ]
      : [],
    privilege_warnings: input.eligibility.warnings,
    assigned_role: input.assignedRole,
    event_type: input.eventType,
  };
}

export function formatMissingProcedurePrivilegeReason(
  eligibility: ProcedurePrivilegeEligibilityResult
): string | null {
  if (eligibility.eligible) return null;
  const first = eligibility.missingRequirements[0];
  if (!first) return "Missing procedure privilege";
  return `Missing procedure privilege: ${first.requiredProcedureKey}`;
}
