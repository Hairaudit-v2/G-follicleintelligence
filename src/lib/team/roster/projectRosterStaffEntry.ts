/**
 * Pure projection: StaffIdentity → RosterStaffEntry.
 *
 * Requires identity.staffId — lifecycle-only people are not roster resources.
 * Domain eligibility is passed in so identity warnings never replace
 * competency / leave / clinic / employment evaluation results.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import { deriveRosterIdentityAttentionReasons } from "@/src/lib/team/roster/rosterIdentityAttentionReasons";
import { deriveRosterIdentityActionFlags } from "@/src/lib/team/roster/rosterIdentityEligibilityBridge";
import type { RosterStaffEntry } from "@/src/lib/team/roster/types";

export type RosterStaffProjectionFacts = {
  /** Result of existing roster eligibility evaluation for this staffId. */
  domainEligible: boolean;
  /** Scheduling is_active from fi_staff — authoritative for roster visibility. */
  schedulingActive: boolean;
  employmentStartDate?: string | null;
  employmentEndDate?: string | null;
};

export function projectRosterStaffEntry(
  identity: StaffIdentity,
  facts: RosterStaffProjectionFacts
): RosterStaffEntry | null {
  const staffId = identity.staffId?.trim() || null;
  if (!staffId) return null;

  const attentionReasons = deriveRosterIdentityAttentionReasons(identity);
  const actions = deriveRosterIdentityActionFlags(identity, facts.domainEligible);

  const readinessBlockers = identity.integrity.warnings.map((w) => w.message);

  return {
    identity: {
      personId: identity.personKey,
      staffId: identity.staffId,
      staffMemberId: identity.staffMemberId,
      userId: identity.userId,
      integrity: identity.integrity,
    },
    scheduling: {
      staffId,
      primaryClinicId: identity.primaryClinicId,
      clinicIds: identity.clinicIds,
      active: facts.schedulingActive,
    },
    employment: {
      status: identity.employmentStatus,
      startDate: facts.employmentStartDate ?? null,
      endDate: facts.employmentEndDate ?? null,
    },
    readiness: {
      status: identity.readinessStatus,
      blockers: readinessBlockers,
    },
    attentionReasons,
    actions,
  };
}
