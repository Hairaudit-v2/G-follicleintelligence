/**
 * Pure projection: StaffIdentity + onboarding-domain facts → StaffOnboardingEntry.
 *
 * Preserves the distinction between onboarding progress and login access.
 * Does not activate login access when onboarding completes.
 */

import type { StaffAccessStatus, StaffIdentity } from "@/src/lib/team/identity/types";
import {
  deriveStaffOnboardingActionFlags,
  type OnboardingDomainActionFacts,
} from "@/src/lib/team/onboarding/onboardingActionFlags";
import { deriveStaffOnboardingAttentionReasons } from "@/src/lib/team/onboarding/onboardingAttentionReasons";
import type {
  StaffOnboardingEntry,
  StaffOnboardingLoginAccessStatus,
  StaffOnboardingStatus,
} from "@/src/lib/team/onboarding/types";

export type OnboardingChecklistFacts = {
  accountCreated: boolean;
  pinChosen: boolean;
  permissionsAssigned: boolean;
  trainingPending: boolean;
};

export type StaffOnboardingProjectionFacts = OnboardingDomainActionFacts & {
  onboardingInviteId: string | null;
  onboardingInviteStatus: "none" | "pending" | "accepted" | "expired" | "revoked";
  onboardingInviteExpiresAt: string | null;
  checklist: OnboardingChecklistFacts;
  systemAccessRevoked: boolean;
  /** When true, treat as cancelled onboarding history (no auto-delete). */
  onboardingCancelled?: boolean;
};

const CHECKLIST_LABELS = {
  accountCreated: "Account created",
  pinChosen: "PIN chosen",
  permissionsAssigned: "Permissions assigned",
  trainingComplete: "Training complete",
} as const;

export function mapIdentityAccessToLoginAccessStatus(
  accessStatus: StaffAccessStatus
): StaffOnboardingLoginAccessStatus {
  if (accessStatus === "login_active") return "active";
  if (accessStatus === "invite_pending") return "invite_pending";
  if (accessStatus === "suspended") return "suspended";
  if (accessStatus === "revoked") return "revoked";
  return "not_started";
}

export function summariseOnboardingChecklist(checklist: OnboardingChecklistFacts): {
  completed: number;
  total: number;
  blockingItems: string[];
} {
  const items: { done: boolean; label: string }[] = [
    { done: checklist.accountCreated, label: CHECKLIST_LABELS.accountCreated },
    { done: checklist.pinChosen, label: CHECKLIST_LABELS.pinChosen },
    { done: checklist.permissionsAssigned, label: CHECKLIST_LABELS.permissionsAssigned },
    { done: !checklist.trainingPending, label: CHECKLIST_LABELS.trainingComplete },
  ];
  const blockingItems = items.filter((i) => !i.done).map((i) => i.label);
  return {
    completed: items.length - blockingItems.length,
    total: items.length,
    blockingItems,
  };
}

export function deriveStaffOnboardingStatus(input: {
  inviteStatus: "none" | "pending" | "accepted" | "expired" | "revoked";
  checklist: OnboardingChecklistFacts;
  systemAccessRevoked: boolean;
  identityUncertain: boolean;
  onboardingCancelled?: boolean;
}): StaffOnboardingStatus {
  if (input.onboardingCancelled || input.systemAccessRevoked) return "cancelled";
  if (input.identityUncertain) return "blocked";

  const summary = summariseOnboardingChecklist(input.checklist);
  if (summary.completed === summary.total) return "completed";

  // Staff creation stamps accountCreated=true; that alone is not "in progress".
  const progressedBeyondCreate =
    input.checklist.pinChosen ||
    input.checklist.permissionsAssigned ||
    !input.checklist.trainingPending;

  if (input.inviteStatus === "accepted") return "in_progress";
  if (
    (input.inviteStatus === "pending" || input.inviteStatus === "expired") &&
    !progressedBeyondCreate
  ) {
    return "invited";
  }
  if (progressedBeyondCreate || input.inviteStatus === "pending" || input.inviteStatus === "expired") {
    return "in_progress";
  }
  if (summary.completed > 0) return "in_progress";
  return "not_invited";
}

export function projectStaffOnboardingEntry(
  identity: StaffIdentity,
  facts: StaffOnboardingProjectionFacts
): StaffOnboardingEntry {
  const identityUncertain =
    identity.integrity.linkStatus === "ambiguous" ||
    identity.integrity.linkStatus === "cross_tenant_mismatch" ||
    identity.integrity.linkStatus === "invalid";

  const onboardingStatus = deriveStaffOnboardingStatus({
    inviteStatus: facts.onboardingInviteStatus,
    checklist: facts.checklist,
    systemAccessRevoked: facts.systemAccessRevoked,
    identityUncertain,
    onboardingCancelled: facts.onboardingCancelled,
  });

  const loginAccessStatus = mapIdentityAccessToLoginAccessStatus(identity.accessStatus);
  const checklist = summariseOnboardingChecklist(facts.checklist);
  const actions = deriveStaffOnboardingActionFlags(identity, {
    ...facts,
    onboardingStatus,
  });

  return {
    identity: {
      personId: identity.personKey,
      staffId: identity.staffId,
      staffMemberId: identity.staffMemberId,
      userId: identity.userId,
      integrity: identity.integrity,
    },
    onboardingStatus,
    checklist,
    onboardingInvite: {
      id: facts.onboardingInviteId,
      status: facts.onboardingInviteStatus,
      expiresAt: facts.onboardingInviteExpiresAt,
    },
    loginAccessStatus,
    attentionReasons: deriveStaffOnboardingAttentionReasons(identity, {
      onboardingInviteStatus: facts.onboardingInviteStatus,
      onboardingStatus,
      loginAccessStatus,
    }),
    actions,
  };
}
