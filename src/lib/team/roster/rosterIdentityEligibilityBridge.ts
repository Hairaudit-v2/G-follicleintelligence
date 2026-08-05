/**
 * Bridge StaffIdentity → roster eligibility member context without changing
 * evaluateRosterStaffEligibility policy.
 *
 * Scheduling-only (no lifecycle): leave employment_status unset so existing
 * resolveEmploymentStatusForRosterStaff falls back to is_active.
 * Ambiguous / invalid / cross-tenant: still supply lifecycle fields when present
 * for behavioural equivalence of historical eligibility evaluation; mutation
 * gates separately reject unsafe new assignments.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import type { RosterStaffMemberContext } from "@/src/lib/workforce-os/rosterEligibleStaffCore";

export function isRosterIdentityTargetUncertain(identity: StaffIdentity): boolean {
  const { linkStatus } = identity.integrity;
  return (
    linkStatus === "ambiguous" ||
    linkStatus === "cross_tenant_mismatch" ||
    linkStatus === "invalid"
  );
}

/**
 * Map identity → member-shaped context for buildRosterStaffEligibilityContext.
 * Returns null when identity has no lifecycle contribution (scheduling-only
 * or missing) so eligibility uses the existing is_active fallback.
 */
export function toRosterStaffMemberContext(
  identity: StaffIdentity | null
): RosterStaffMemberContext | null {
  if (!identity) return null;
  if (!identity.integrity.hasLifecycleRecord) return null;

  return {
    employment_status: identity.employmentStatus,
    archived_at: identity.archivedAt,
  };
}

export function indexRosterMemberContextByStaffId(
  identitiesByStaffId: ReadonlyMap<string, StaffIdentity | null>
): Map<string, RosterStaffMemberContext> {
  const out = new Map<string, RosterStaffMemberContext>();
  for (const [staffId, identity] of identitiesByStaffId) {
    const member = toRosterStaffMemberContext(identity);
    if (member) out.set(staffId, member);
  }
  return out;
}

export type RosterIdentityActionFlags = {
  canBeRostered: boolean;
  canEditAssignment: boolean;
  requiresReconciliation: boolean;
};

/**
 * New-assignment / edit flags. Domain eligibility remains authoritative for
 * canBeRostered when identity is safe; uncertain targets always suppress.
 */
export function deriveRosterIdentityActionFlags(
  identity: StaffIdentity,
  domainEligible: boolean
): RosterIdentityActionFlags {
  const uncertain = isRosterIdentityTargetUncertain(identity);
  const hasSchedulingId = Boolean(identity.staffId?.trim());

  if (!hasSchedulingId || identity.integrity.linkStatus === "lifecycle_only") {
    return {
      canBeRostered: false,
      canEditAssignment: false,
      requiresReconciliation: uncertain || identity.integrity.linkStatus === "lifecycle_only",
    };
  }

  if (uncertain) {
    return {
      canBeRostered: false,
      canEditAssignment: false,
      requiresReconciliation: true,
    };
  }

  return {
    canBeRostered: domainEligible,
    canEditAssignment: domainEligible,
    requiresReconciliation: false,
  };
}
