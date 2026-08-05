/**
 * Bridge StaffOnboardingEntry into the legacy Onboarding Centre row action fields.
 * Avoid importing .server modules — keeps team/onboarding pure for client-safe type use.
 */

import type {
  StaffOnboardingAttentionReason,
  StaffOnboardingEntry,
} from "@/src/lib/team/onboarding/types";

export type OnboardingCentreActionFlags = {
  canSendInvite: boolean;
  canResendInvite: boolean;
  canCopyInviteLink: boolean;
  attentionReasons: StaffOnboardingAttentionReason[];
};

/**
 * Overlay identity-safe action flags from the onboarding projection onto centre-row fields.
 * Checklist / invite label fields stay sourced from existing onboarding-centre computation.
 */
export function applyStaffOnboardingEntryFlags(
  entry: StaffOnboardingEntry
): OnboardingCentreActionFlags {
  return {
    canSendInvite: entry.actions.canSendOnboardingInvite,
    canResendInvite: entry.actions.canResendOnboardingInvite,
    canCopyInviteLink: entry.actions.canCopyOnboardingInviteLink,
    attentionReasons: entry.attentionReasons,
  };
}
