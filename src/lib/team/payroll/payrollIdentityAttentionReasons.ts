/**
 * Derive payroll attention from identity integrity + wage-setup facts.
 * Does not invent wage rates or approval policy.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import type {
  PayrollIdentityAttentionReason,
  PayrollWageProjectionFacts,
} from "@/src/lib/team/payroll/types";

const EMPLOYMENT_ENDED = new Set([
  "terminated",
  "resigned",
  "contract_ended",
  "contract_expired",
  "merged",
]);

export function derivePayrollIdentityAttentionReasons(
  identity: StaffIdentity,
  facts: Pick<
    PayrollWageProjectionFacts,
    "wageProfileId" | "historicalAttributionOnly" | "employmentEndDate"
  >
): PayrollIdentityAttentionReason[] {
  const reasons: PayrollIdentityAttentionReason[] = [];
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
    if (facts.historicalAttributionOnly) {
      reasons.push("historical_attribution_only");
    }
  } else if (linkStatus === "lifecycle_only") {
    reasons.push("scheduling_record_missing");
    reasons.push("identity_link_incomplete");
  }

  if (
    identity.archivedAt ||
    EMPLOYMENT_ENDED.has(identity.employmentStatus) ||
    Boolean(facts.employmentEndDate)
  ) {
    reasons.push("employment_ended");
  }

  if (!facts.wageProfileId && identity.staffMemberId) {
    reasons.push("missing_wage_profile");
  }

  return reasons;
}
