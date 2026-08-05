/**
 * Bridge procedure-staffing candidates through canonical identity integrity.
 * Does not change optimizer ranking policy — only gates unsafe assignments.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import { isPlanningIdentityTargetUncertain } from "@/src/lib/team/planning/planningActionFlags";

export type ProcedureStaffingIdentityGate = {
  staffId: string;
  canAssign: boolean;
  personKey: string | null;
  reason: string | null;
};

/**
 * Map optimizer candidate staffIds through a preloaded identity map.
 * Ambiguous / cross-tenant / invalid / lifecycle-only → cannot assign.
 */
export function gateProcedureStaffingCandidates(input: {
  candidateStaffIds: readonly string[];
  identitiesByStaffId: ReadonlyMap<string, StaffIdentity | null>;
  clinicalReadyByStaffId?: ReadonlyMap<string, boolean>;
}): ProcedureStaffingIdentityGate[] {
  return input.candidateStaffIds.map((staffId) => {
    const identity = input.identitiesByStaffId.get(staffId) ?? null;
    if (!identity) {
      return {
        staffId,
        canAssign: false,
        personKey: null,
        reason: "identity_not_resolved",
      };
    }
    if (isPlanningIdentityTargetUncertain(identity)) {
      return {
        staffId,
        canAssign: false,
        personKey: identity.personKey,
        reason: "identity_requires_reconciliation",
      };
    }
    if (!identity.staffId) {
      return {
        staffId,
        canAssign: false,
        personKey: identity.personKey,
        reason: "lifecycle_only_not_schedulable",
      };
    }
    if (input.clinicalReadyByStaffId?.get(staffId) === false) {
      return {
        staffId,
        canAssign: false,
        personKey: identity.personKey,
        reason: "clinical_readiness_blocked",
      };
    }
    return {
      staffId,
      canAssign: true,
      personKey: identity.personKey,
      reason: null,
    };
  });
}
