/**
 * Pure projection: StaffIdentity + readiness facts → PlanningStaffEntry.
 * Lifecycle-only never becomes a schedulable resource.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import { derivePlanningActionFlags } from "@/src/lib/team/planning/planningActionFlags";
import { derivePlanningIdentityAttentionReasons } from "@/src/lib/team/planning/planningAttentionReasons";
import type {
  PlanningCapacityStatus,
  PlanningProjectionFacts,
  PlanningStaffEntry,
} from "@/src/lib/team/planning/types";

function resolveCapacityStatus(facts: PlanningProjectionFacts): PlanningCapacityStatus {
  if (!facts.domainSchedulable || !facts.rosterReady) return "unavailable";
  if (!facts.clinicalReady) return "limited";
  return "available";
}

export function projectPlanningStaffEntry(
  identity: StaffIdentity,
  facts: PlanningProjectionFacts
): PlanningStaffEntry {
  const hasScheduling = Boolean(identity.staffId?.trim());
  const schedulable = hasScheduling && facts.domainSchedulable;
  const blockers = [
    ...(facts.clinicalBlockers ?? []),
    ...identity.integrity.warnings.map((w) => w.message),
  ];

  return {
    identity: {
      personId: identity.personKey,
      staffId: identity.staffId,
      staffMemberId: identity.staffMemberId,
      userId: identity.userId,
      displayName: identity.displayName,
      integrity: identity.integrity,
    },
    availability: {
      schedulable,
      clinicIds: identity.clinicIds,
    },
    readiness: {
      rosterReady: hasScheduling && facts.rosterReady,
      clinicalReady: facts.clinicalReady,
      status: identity.readinessStatus,
      blockers,
    },
    planning: {
      eligibleRoleIds: facts.eligibleRoleIds ?? [],
      procedureCapabilities: facts.procedureCapabilities ?? [],
      capacityStatus: resolveCapacityStatus({
        ...facts,
        domainSchedulable: schedulable,
      }),
    },
    attentionReasons: derivePlanningIdentityAttentionReasons(identity, {
      ...facts,
      domainSchedulable: schedulable,
    }),
    actions: derivePlanningActionFlags(identity, {
      domainSchedulable: schedulable,
      rosterReady: facts.rosterReady,
      clinicalReady: facts.clinicalReady,
    }),
  };
}
