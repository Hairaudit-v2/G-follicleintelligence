import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { isRosterIdentityTargetUncertain } from "@/src/lib/team/roster";
import { resolveStaffIdentity } from "@/src/lib/team/identity/server";
import type { StaffIdentity } from "@/src/lib/team/identity/types";

export const ROSTER_IDENTITY_TARGET_UNCERTAIN =
  "Staff identity requires reconciliation before this roster action can run.";

/**
 * Reject ambiguous / cross-tenant / invalid identity targets for new roster
 * mutations. Scheduling-only remains allowed (current eligibility decides).
 */
export function assertUsableRosterIdentityTarget(
  identity: StaffIdentity | null
): StaffIdentity {
  if (!identity) {
    throw new Error(ROSTER_IDENTITY_TARGET_UNCERTAIN);
  }
  if (!identity.staffId?.trim()) {
    throw new Error(ROSTER_IDENTITY_TARGET_UNCERTAIN);
  }
  if (isRosterIdentityTargetUncertain(identity)) {
    throw new Error(ROSTER_IDENTITY_TARGET_UNCERTAIN);
  }
  if (identity.integrity.linkStatus === "lifecycle_only") {
    throw new Error(ROSTER_IDENTITY_TARGET_UNCERTAIN);
  }
  return identity;
}

export async function assertEligibleRosterIdentityTarget(
  tenantId: string,
  staffId: string,
  client?: SupabaseClient
): Promise<StaffIdentity> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffId, "staffId");
  const identity = await resolveStaffIdentity(
    { tenantId: tid, by: "staffId", staffId: sid },
    { client }
  );
  return assertUsableRosterIdentityTarget(identity);
}
