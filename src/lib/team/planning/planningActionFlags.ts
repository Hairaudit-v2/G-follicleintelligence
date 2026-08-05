/**
 * Planning identity action flags — identity + domain readiness only.
 * Does not re-evaluate roster competency or credential math.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import type { PlanningProjectionFacts } from "@/src/lib/team/planning/types";

export function isPlanningIdentityTargetUncertain(identity: StaffIdentity): boolean {
  const { linkStatus } = identity.integrity;
  return (
    linkStatus === "ambiguous" ||
    linkStatus === "cross_tenant_mismatch" ||
    linkStatus === "invalid"
  );
}

export type PlanningActionFlags = {
  canAssignToProcedure: boolean;
  canAddToPlan: boolean;
  canResolveIdentity: boolean;
};

export function derivePlanningActionFlags(
  identity: StaffIdentity,
  facts: Pick<
    PlanningProjectionFacts,
    "domainSchedulable" | "rosterReady" | "clinicalReady"
  >
): PlanningActionFlags {
  const uncertain = isPlanningIdentityTargetUncertain(identity);
  const hasScheduling = Boolean(identity.staffId?.trim());

  if (uncertain) {
    return {
      canAssignToProcedure: false,
      canAddToPlan: false,
      canResolveIdentity: true,
    };
  }

  // Lifecycle-only: future capacity only — never invent as schedulable resource.
  if (!hasScheduling) {
    return {
      canAssignToProcedure: false,
      canAddToPlan: false,
      canResolveIdentity: identity.integrity.linkStatus === "lifecycle_only",
    };
  }

  const assignable =
    facts.domainSchedulable && facts.rosterReady && facts.clinicalReady;

  return {
    canAssignToProcedure: assignable,
    canAddToPlan: facts.domainSchedulable,
    canResolveIdentity: false,
  };
}
