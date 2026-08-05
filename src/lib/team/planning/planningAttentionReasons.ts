/**
 * Derive planning attention from identity + readiness facts.
 * Does not invent credential / leave / clinic eligibility reasons.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import type {
  PlanningIdentityAttentionReason,
  PlanningProjectionFacts,
} from "@/src/lib/team/planning/types";

export function derivePlanningIdentityAttentionReasons(
  identity: StaffIdentity,
  facts: PlanningProjectionFacts
): PlanningIdentityAttentionReason[] {
  const reasons: PlanningIdentityAttentionReason[] = [];
  const { linkStatus } = identity.integrity;

  if (linkStatus === "cross_tenant_mismatch") {
    reasons.push("cross_tenant_mismatch");
  } else if (linkStatus === "invalid") {
    reasons.push("identity_invalid");
  } else if (linkStatus === "ambiguous") {
    reasons.push("identity_requires_reconciliation");
  } else if (linkStatus === "scheduling_only") {
    reasons.push("lifecycle_record_missing");
    reasons.push("identity_link_incomplete");
  } else if (linkStatus === "lifecycle_only") {
    reasons.push("scheduling_record_missing");
    reasons.push("identity_link_incomplete");
    reasons.push("future_capacity_only");
  }

  if (!facts.domainSchedulable || !identity.staffId) {
    reasons.push("not_schedulable");
  }

  if (!facts.clinicalReady) {
    reasons.push("clinical_readiness_blocked");
  }

  return reasons;
}
