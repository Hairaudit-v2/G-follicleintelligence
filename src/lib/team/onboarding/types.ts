/**
 * Onboarding-domain projection of Team staff identity (FI-TEAM-COHESION-B1.3).
 * Onboarding owns checklist / invite presentation; identity owns linkage truth.
 * Login access status is observed here but must remain distinct from onboarding progress.
 */

import type { StaffIdentityIntegrity } from "@/src/lib/team/identity/types";

export type StaffOnboardingAttentionReason =
  | "identity_link_incomplete"
  | "scheduling_record_missing"
  | "lifecycle_record_missing"
  | "identity_requires_reconciliation"
  | "cross_tenant_mismatch"
  | "identity_invalid"
  | "onboarding_invite_expired"
  | "login_access_outstanding"
  | "login_active_onboarding_incomplete";

export type StaffOnboardingStatus =
  | "not_invited"
  | "invited"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";

/** Coarse login/access band — distinct from onboarding invite status. */
export type StaffOnboardingLoginAccessStatus =
  | "not_started"
  | "invite_pending"
  | "active"
  | "suspended"
  | "revoked";

export type StaffOnboardingIdentitySummary = {
  /** Alias of StaffIdentity.personKey for onboarding consumers. */
  personId: string;
  staffId: string | null;
  staffMemberId: string | null;
  userId: string | null;
  integrity: StaffIdentityIntegrity;
};

export type StaffOnboardingEntry = {
  identity: StaffOnboardingIdentitySummary;

  onboardingStatus: StaffOnboardingStatus;

  checklist: {
    completed: number;
    total: number;
    blockingItems: string[];
  };

  onboardingInvite: {
    id: string | null;
    status: "none" | "pending" | "accepted" | "expired" | "revoked";
    expiresAt: string | null;
  };

  loginAccessStatus: StaffOnboardingLoginAccessStatus;

  attentionReasons: StaffOnboardingAttentionReason[];

  actions: {
    canResendOnboardingInvite: boolean;
    canCancelOnboarding: boolean;
    canContinueSetup: boolean;
    canCreateSchedulingRecord: boolean;
    canRepairIdentityLink: boolean;
    /** Existing centre actions — gated by identity when uncertain. */
    canSendOnboardingInvite: boolean;
    canCopyOnboardingInviteLink: boolean;
  };
};

export const STAFF_ONBOARDING_ATTENTION_LABELS: Record<StaffOnboardingAttentionReason, string> = {
  identity_link_incomplete: "Identity link incomplete",
  scheduling_record_missing: "Scheduling record missing",
  lifecycle_record_missing: "Lifecycle record missing",
  identity_requires_reconciliation: "Identity requires reconciliation",
  cross_tenant_mismatch: "Cross-tenant identity mismatch",
  identity_invalid: "Identity invalid",
  onboarding_invite_expired: "Onboarding invite expired",
  login_access_outstanding: "Login access not invited yet",
  login_active_onboarding_incomplete: "Login active while onboarding incomplete",
};
