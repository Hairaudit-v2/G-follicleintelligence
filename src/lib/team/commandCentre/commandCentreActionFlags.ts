/**
 * Command Centre action eligibility — identity gate only.
 * Domain destructive flags come from access / onboarding / compliance / roster entries.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import { isStaffProfileIdentityReadOnly } from "@/src/lib/team/profile/staffProfileActionFlags";
import type { TeamCommandCentreActionFlags } from "@/src/lib/team/commandCentre/types";

export function isCommandCentreIdentityUnsafe(identity: StaffIdentity): boolean {
  return isStaffProfileIdentityReadOnly(identity);
}

/**
 * Compose CC-level action flags from identity integrity.
 * Ambiguous / cross-tenant / invalid identities suppress unsafe actions.
 */
export function deriveCommandCentreActionFlags(identity: StaffIdentity): TeamCommandCentreActionFlags {
  const unsafe = isCommandCentreIdentityUnsafe(identity);
  const { linkStatus } = identity.integrity;

  return {
    suppressUnsafeActions: unsafe,
    canOpenReconciliation:
      linkStatus === "ambiguous" ||
      linkStatus === "scheduling_only" ||
      linkStatus === "lifecycle_only" ||
      linkStatus === "cross_tenant_mismatch" ||
      (linkStatus === "linked" && !identity.integrity.hasAuthIdentity),
  };
}

export function isAttentionActionAllowed(identity: StaffIdentity): boolean {
  return !isCommandCentreIdentityUnsafe(identity);
}
