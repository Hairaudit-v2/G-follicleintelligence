import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { isComplianceIdentityTargetUncertain } from "@/src/lib/team/compliance";
import { resolveStaffIdentity } from "@/src/lib/team/identity/server";
import type { StaffIdentity } from "@/src/lib/team/identity/types";

export const COMPLIANCE_IDENTITY_TARGET_UNCERTAIN =
  "Staff identity requires reconciliation before this compliance action can run.";

/**
 * Reject ambiguous / invalid / cross-tenant targets for credential mutations.
 * Lifecycle-only remains allowed (valid first-class compliance subject).
 * Scheduling-only without lifecycle is rejected (no credential subject).
 */
export function assertUsableComplianceIdentityTarget(
  identity: StaffIdentity | null
): StaffIdentity {
  if (!identity) {
    throw new Error(COMPLIANCE_IDENTITY_TARGET_UNCERTAIN);
  }
  if (!identity.staffMemberId?.trim()) {
    throw new Error(COMPLIANCE_IDENTITY_TARGET_UNCERTAIN);
  }
  if (isComplianceIdentityTargetUncertain(identity)) {
    throw new Error(COMPLIANCE_IDENTITY_TARGET_UNCERTAIN);
  }
  return identity;
}

export async function assertEligibleComplianceIdentityTarget(
  tenantId: string,
  staffMemberId: string,
  client?: SupabaseClient
): Promise<StaffIdentity> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const mid = assertNonEmptyUuid(staffMemberId, "staffMemberId");
  const identity = await resolveStaffIdentity(
    { tenantId: tid, by: "staffMemberId", staffMemberId: mid },
    { client }
  );
  return assertUsableComplianceIdentityTarget(identity);
}
