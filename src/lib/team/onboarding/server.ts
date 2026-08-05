/**
 * Server entry for Team onboarding loaders and mutations.
 * Prefer this barrel for pages and server actions.
 * Client code must not import this module — use `@/src/lib/team/onboarding`
 * for pure types / projections / centre helpers.
 *
 * Cycle break (B2.2c): invitation send/load → pinSetup;
 * pinLayer complete → invitationAccept. No mutual server imports.
 * Dual-table repair stays on `@/src/lib/workforce/staffTenantLinkRepair.server`.
 */

import "server-only";

export {
  loadOnboardingPageModel,
  expireStaleOnboardingInvitations,
  newOnboardingToken,
  ONBOARDING_FI_CLINICS_SELECT,
  mapOnboardingClinicOption,
} from "@/src/lib/team/onboarding/onboardingPage.server";

export {
  sendOnboardingInvite,
  resendOnboardingInvite,
  loadOnboardingInviteByToken,
  copyOnboardingInviteLink,
  type SendOnboardingInviteResult,
} from "@/src/lib/team/onboarding/onboardingInvitation.server";

export { acceptOnboardingInvitation } from "@/src/lib/team/onboarding/onboardingInvitationAccept.server";

export {
  createOnboardingPinSetupToken,
  loadPinSetupByToken,
} from "@/src/lib/team/onboarding/onboardingPinSetup.server";

export {
  completeOnboardingPinSetup,
  loadOnboardingPinSetupStatus,
} from "@/src/lib/team/onboarding/onboardingPinLayer.server";

export {
  loadOnboardingChecklist,
  markOnboardingTrainingComplete,
  syncOnboardingChecklistFromState,
} from "@/src/lib/team/onboarding/onboardingChecklist.server";

export { createOnboardingStaffMember } from "@/src/lib/team/onboarding/onboardingStaffCreate.server";
