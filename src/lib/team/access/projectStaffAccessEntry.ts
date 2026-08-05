/**
 * Pure projection: StaffIdentity + access-domain facts → StaffAccessEntry.
 *
 * Does not infer action eligibility solely from identity integrity.
 * Existing invite / PIN / suspend / revoke rules remain authoritative;
 * uncertain identity targets only suppress destructive UI flags.
 */

import { isDepartedStaff } from "@/src/lib/workforce/staffAccessCentreCore";
import type { StaffAuthLoginStatus } from "@/src/lib/workforce/staffAccessCentreCore";
import type { StaffIdentity } from "@/src/lib/team/identity/types";
import type {
  StaffAccessAttentionReason,
  StaffAccessEntry,
  StaffAccessEntryStatus,
} from "@/src/lib/team/access/types";

export type StaffAccessProjectionFacts = {
  authLoginStatus: StaffAuthLoginStatus;
  inviteStatus: "none" | "pending" | "accepted" | "expired" | "revoked";
  loginInviteId: string | null;
  loginInviteExpiresAt: string | null;
  canSendInvite: boolean;
  canResendInvite: boolean;
  canSuspendAccess: boolean;
  canRevokeAccess: boolean;
};

function isIdentityTargetUncertain(identity: StaffIdentity): boolean {
  const { linkStatus } = identity.integrity;
  return (
    linkStatus === "ambiguous" ||
    linkStatus === "cross_tenant_mismatch" ||
    linkStatus === "invalid"
  );
}

export function mapAuthLoginToAccessEntryStatus(
  authLoginStatus: StaffAuthLoginStatus
): StaffAccessEntryStatus {
  if (authLoginStatus === "login_active") return "active";
  if (authLoginStatus === "invite_pending") return "invite_pending";
  if (authLoginStatus === "suspended") return "suspended";
  if (authLoginStatus === "revoked") return "revoked";
  return "not_invited";
}

export function deriveStaffAccessAttentionReasons(
  identity: StaffIdentity,
  facts: Pick<StaffAccessProjectionFacts, "authLoginStatus">
): StaffAccessAttentionReason[] {
  const reasons: StaffAccessAttentionReason[] = [];
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
    linkStatus === "linked" &&
    !identity.integrity.hasAuthIdentity &&
    facts.authLoginStatus !== "revoked"
  ) {
    reasons.push("missing_auth_identity");
  }

  if (
    isDepartedStaff(identity.employmentStatus) &&
    (facts.authLoginStatus === "login_active" || facts.authLoginStatus === "invite_pending")
  ) {
    reasons.push("terminated_with_active_access");
  }

  return reasons;
}

/**
 * Project access entry. When identity target is uncertain, destructive action
 * flags are forced off — invite/resend eligibility still follow access facts
 * except where integrity blocks a safe scheduling target.
 */
export function projectStaffAccessEntry(
  identity: StaffIdentity,
  facts: StaffAccessProjectionFacts
): StaffAccessEntry {
  const uncertain = isIdentityTargetUncertain(identity);

  return {
    identity: {
      personId: identity.personKey,
      staffId: identity.staffId,
      staffMemberId: identity.staffMemberId,
      userId: identity.userId,
      integrity: identity.integrity,
    },
    accessStatus: mapAuthLoginToAccessEntryStatus(facts.authLoginStatus),
    loginInviteId: facts.loginInviteId,
    loginInviteExpiresAt: facts.loginInviteExpiresAt,
    // Access-domain facts remain authoritative; uncertain targets only suppress actions.
    canInvite: uncertain ? false : facts.canSendInvite,
    canResend: uncertain ? false : facts.canResendInvite,
    canSuspend: uncertain ? false : facts.canSuspendAccess,
    canRevoke: uncertain ? false : facts.canRevokeAccess,
    attentionReasons: deriveStaffAccessAttentionReasons(identity, facts),
  };
}
