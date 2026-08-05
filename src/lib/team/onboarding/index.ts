/**
 * Public Team onboarding API — pure types, projection helpers, and hire-invite
 * status helpers.
 *
 * Server loaders & mutations: `@/src/lib/team/onboarding/server`
 * Hire invite ≠ login invite (collision C9) — login tokens live under team/access.
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

export type {
  OnboardingChecklistState,
  OnboardingClinicOption,
  OnboardingEmploymentType,
  OnboardingInvitationStatus,
  OnboardingInvitePageModel,
  OnboardingPageModel,
  OnboardingPinSetupStatus,
  OnboardingStaffRow,
  CreateOnboardingStaffInput,
} from "@/src/lib/team/onboarding/onboardingTypes";

export {
  ONBOARDING_EMPLOYMENT_TYPES,
  ONBOARDING_EMPLOYMENT_TYPE_LABELS,
  ONBOARDING_INVITATION_STATUSES,
  ONBOARDING_INVITE_EXPIRY_DAYS,
  ONBOARDING_PIN_SETUP_STATUSES,
} from "@/src/lib/team/onboarding/onboardingTypes";

export { resolveOnboardingInvitationStatus } from "@/src/lib/team/onboarding/onboardingInviteStatusCore";

export type { OnboardingInviteDisplayStatus } from "@/src/lib/team/onboarding/onboardingCentreCore";

export {
  canCopyOnboardingInviteLink,
  canResendOnboardingInvite,
  canSendOnboardingInvite,
  mapOnboardingInviteDisplayStatus,
  onboardingInviteStatusLabel,
} from "@/src/lib/team/onboarding/onboardingCentreCore";

export {
  buildOnboardingInviteUrl,
  tryBuildOnboardingInviteUrl,
} from "@/src/lib/team/onboarding/onboardingInviteUrlCore";

export {
  ONBOARDING_AUDIT_SOURCE,
  ONBOARDING_STAFF_SOURCE,
  buildOnboardingInboundIdentity,
  evaluateOnboardingStaffCreation,
  resolveOnboardingStaffCreationDecision,
  type OnboardingStaffCreationDecision,
} from "@/src/lib/team/onboarding/onboardingStaffCreateCore";
