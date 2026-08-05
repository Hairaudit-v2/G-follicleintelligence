/**
 * Public Team onboarding API — pure types and projection helpers.
 * Server loaders remain in `src/lib/workforce/onboarding/` until a later domain move;
 * they must import from this index (and identity/server), never from `team/identity/internal`.
 */

export type {
  StaffOnboardingAttentionReason,
  StaffOnboardingEntry,
  StaffOnboardingIdentitySummary,
  StaffOnboardingLoginAccessStatus,
  StaffOnboardingStatus,
} from "@/src/lib/team/onboarding/types";

export { STAFF_ONBOARDING_ATTENTION_LABELS } from "@/src/lib/team/onboarding/types";

export {
  deriveStaffOnboardingAttentionReasons,
  type OnboardingAttentionFacts,
} from "@/src/lib/team/onboarding/onboardingAttentionReasons";

export {
  deriveStaffOnboardingActionFlags,
  isOnboardingIdentityTargetUncertain,
  type OnboardingDomainActionFacts,
  type StaffOnboardingActionFlags,
} from "@/src/lib/team/onboarding/onboardingActionFlags";

export {
  deriveStaffOnboardingStatus,
  mapIdentityAccessToLoginAccessStatus,
  projectStaffOnboardingEntry,
  summariseOnboardingChecklist,
  type OnboardingChecklistFacts,
  type StaffOnboardingProjectionFacts,
} from "@/src/lib/team/onboarding/projectStaffOnboardingEntry";

export {
  applyStaffOnboardingEntryFlags,
  type OnboardingCentreActionFlags,
} from "@/src/lib/team/onboarding/toOnboardingCentreRow";
