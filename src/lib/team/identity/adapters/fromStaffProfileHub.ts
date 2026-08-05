/**
 * Profile-hub compatibility: map StaffIdentity into hub overview inputs.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import { STAFF_IDENTITY_UNUSABLE_LINK_STATUSES } from "@/src/lib/team/identity/constants";

export type StaffProfileHubIdentityGate = {
  /** When false, callers must skip fi_staff-dependent intelligence / leave loads. */
  mayUseSchedulingProjection: boolean;
  staffId: string | null;
  staffMemberId: string | null;
  displayName: string;
  employmentStatus: string;
  email: string | null;
  linkStatus: StaffIdentity["integrity"]["linkStatus"];
};

/**
 * Gate for staffProfileHub — behaviour-neutral on happy paths; blocks
 * cross-tenant / invalid identities from silently driving scheduling loads.
 */
export function toStaffProfileHubIdentityGate(
  identity: StaffIdentity | null,
  fallback: {
    staffMemberId: string;
    fiStaffId: string | null;
    staffName: string;
    employmentStatus: string;
    email: string | null;
  }
): StaffProfileHubIdentityGate {
  if (!identity) {
    return {
      mayUseSchedulingProjection: Boolean(fallback.fiStaffId),
      staffId: fallback.fiStaffId,
      staffMemberId: fallback.staffMemberId,
      displayName: fallback.staffName,
      employmentStatus: fallback.employmentStatus,
      email: fallback.email,
      linkStatus: fallback.fiStaffId ? "linked" : "lifecycle_only",
    };
  }

  const unusable = STAFF_IDENTITY_UNUSABLE_LINK_STATUSES.has(identity.integrity.linkStatus);
  return {
    mayUseSchedulingProjection: !unusable && Boolean(identity.staffId),
    staffId: identity.staffId,
    staffMemberId: identity.staffMemberId ?? fallback.staffMemberId,
    displayName: identity.displayName || fallback.staffName,
    employmentStatus: identity.employmentStatus || fallback.employmentStatus,
    email: identity.email ?? fallback.email,
    linkStatus: identity.integrity.linkStatus,
  };
}
