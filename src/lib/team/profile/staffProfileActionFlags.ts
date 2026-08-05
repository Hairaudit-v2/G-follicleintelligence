/**
 * Profile action flags — identity gate only.
 * Access / onboarding / compliance / roster actions come from their domain entries.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import type { StaffProfileActionFlags } from "@/src/lib/team/profile/types";

export function isStaffProfileIdentityReadOnly(identity: StaffIdentity): boolean {
  const { linkStatus } = identity.integrity;
  return (
    linkStatus === "ambiguous" ||
    linkStatus === "cross_tenant_mismatch" ||
    linkStatus === "invalid"
  );
}

/**
 * Compose profile-level identity action flags from StaffIdentity.
 * Does not decide access invite / onboarding / compliance / roster eligibility.
 */
export function deriveStaffProfileActionFlags(identity: StaffIdentity): StaffProfileActionFlags {
  const readOnly = isStaffProfileIdentityReadOnly(identity);
  const { linkStatus } = identity.integrity;

  return {
    identity: {
      readOnly,
      canCreateSchedulingRecord:
        !readOnly && linkStatus === "lifecycle_only" && Boolean(identity.staffMemberId),
      canRepairIdentityLink:
        !readOnly &&
        (linkStatus === "lifecycle_only" ||
          linkStatus === "scheduling_only" ||
          (linkStatus === "linked" && !identity.integrity.hasAuthIdentity)),
    },
  };
}
