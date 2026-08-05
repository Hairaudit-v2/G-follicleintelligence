/**
 * Identity-aware action gates for onboarding projections.
 * Existing invite / checklist rules remain authoritative; uncertain identities suppress unsafe flags.
 */

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import type { StaffOnboardingStatus } from "@/src/lib/team/onboarding/types";

export function isOnboardingIdentityTargetUncertain(identity: StaffIdentity): boolean {
  const { linkStatus } = identity.integrity;
  return (
    linkStatus === "ambiguous" ||
    linkStatus === "cross_tenant_mismatch" ||
    linkStatus === "invalid"
  );
}

export type OnboardingDomainActionFacts = {
  canSendInvite: boolean;
  canResendInvite: boolean;
  canCopyInviteLink: boolean;
  canCancelOnboarding: boolean;
  onboardingStatus: StaffOnboardingStatus;
};

export type StaffOnboardingActionFlags = {
  canResendOnboardingInvite: boolean;
  canCancelOnboarding: boolean;
  canContinueSetup: boolean;
  canCreateSchedulingRecord: boolean;
  canRepairIdentityLink: boolean;
  canSendOnboardingInvite: boolean;
  canCopyOnboardingInviteLink: boolean;
};

/**
 * Gate onboarding UI actions. Lifecycle-only (missing scheduling) remains a valid
 * onboarding state — invite flags still follow domain facts unless the target is uncertain.
 */
export function deriveStaffOnboardingActionFlags(
  identity: StaffIdentity,
  facts: OnboardingDomainActionFacts
): StaffOnboardingActionFlags {
  const uncertain = isOnboardingIdentityTargetUncertain(identity);
  const { linkStatus } = identity.integrity;
  const inFlight =
    facts.onboardingStatus === "invited" ||
    facts.onboardingStatus === "in_progress" ||
    facts.onboardingStatus === "not_invited";

  return {
    canSendOnboardingInvite: uncertain ? false : facts.canSendInvite,
    canResendOnboardingInvite: uncertain ? false : facts.canResendInvite,
    canCopyOnboardingInviteLink: uncertain ? false : facts.canCopyInviteLink,
    canCancelOnboarding: uncertain ? false : facts.canCancelOnboarding,
    canContinueSetup: uncertain
      ? false
      : inFlight && facts.onboardingStatus !== "completed" && facts.onboardingStatus !== "cancelled",
    canCreateSchedulingRecord:
      !uncertain && linkStatus === "lifecycle_only" && Boolean(identity.staffMemberId),
    canRepairIdentityLink:
      !uncertain &&
      (linkStatus === "lifecycle_only" ||
        (linkStatus === "linked" && !identity.integrity.hasAuthIdentity)),
  };
}
