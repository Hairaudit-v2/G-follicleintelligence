/**
 * Derive onboarding attention reasons from identity + onboarding-domain facts.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import type {
  StaffOnboardingAttentionReason,
  StaffOnboardingLoginAccessStatus,
  StaffOnboardingStatus,
} from "@/src/lib/team/onboarding/types";

export type OnboardingAttentionFacts = {
  onboardingInviteStatus: "none" | "pending" | "accepted" | "expired" | "revoked";
  onboardingStatus: StaffOnboardingStatus;
  loginAccessStatus: StaffOnboardingLoginAccessStatus;
};

export function deriveStaffOnboardingAttentionReasons(
  identity: StaffIdentity,
  facts: OnboardingAttentionFacts
): StaffOnboardingAttentionReason[] {
  const reasons: StaffOnboardingAttentionReason[] = [];
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

  if (facts.onboardingInviteStatus === "expired") {
    reasons.push("onboarding_invite_expired");
  }

  if (
    facts.onboardingStatus === "completed" &&
    (facts.loginAccessStatus === "not_started" || facts.loginAccessStatus === "invite_pending")
  ) {
    reasons.push("login_access_outstanding");
  }

  if (
    facts.loginAccessStatus === "active" &&
    facts.onboardingStatus !== "completed" &&
    facts.onboardingStatus !== "cancelled"
  ) {
    reasons.push("login_active_onboarding_incomplete");
  }

  return reasons;
}
