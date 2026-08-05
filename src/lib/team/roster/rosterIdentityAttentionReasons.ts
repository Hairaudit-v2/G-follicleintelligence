/**
 * Derive roster attention reasons from identity integrity.
 * Does not invent competency / leave / clinic eligibility reasons.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import type { RosterStaffAttentionReason } from "@/src/lib/team/roster/types";

const EMPLOYMENT_BLOCKS_NEW_ASSIGNMENT = new Set([
  "inactive",
  "on_leave",
  "pending_onboarding",
  "suspended",
  "terminated",
  "resigned",
  "contract_ended",
  "contract_expired",
  "merged",
]);

export function deriveRosterIdentityAttentionReasons(
  identity: StaffIdentity
): RosterStaffAttentionReason[] {
  const reasons: RosterStaffAttentionReason[] = [];
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
  }

  if (
    identity.archivedAt ||
    EMPLOYMENT_BLOCKS_NEW_ASSIGNMENT.has(identity.employmentStatus)
  ) {
    reasons.push("employment_blocks_new_assignment");
  }

  return reasons;
}
