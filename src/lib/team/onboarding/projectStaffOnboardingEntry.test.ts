/**
 * Onboarding projection unit tests (FI-TEAM-COHESION-B1.3).
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import {
  deriveStaffOnboardingStatus,
  mapIdentityAccessToLoginAccessStatus,
  projectStaffOnboardingEntry,
  summariseOnboardingChecklist,
} from "@/src/lib/team/onboarding/projectStaffOnboardingEntry";

function identity(overrides: Partial<StaffIdentity> = {}): StaffIdentity {
  return {
    tenantId: "11111111-1111-1111-1111-111111111111",
    personKey: "sm:44444444-4444-4444-4444-444444444444",
    staffId: "33333333-3333-3333-3333-333333333333",
    staffMemberId: "44444444-4444-4444-4444-444444444444",
    userId: null,
    displayName: "Ada",
    email: "ada@example.com",
    employmentStatus: "pending_onboarding",
    accessStatus: "no_login",
    readinessStatus: "watch",
    archivedAt: null,
    hrLinked: false,
    primaryClinicId: null,
    clinicIds: [],
    roles: ["consultant"],
    capabilities: [],
    integrity: {
      linkStatus: "linked",
      hasSchedulingRecord: true,
      hasLifecycleRecord: true,
      hasAuthIdentity: false,
      warnings: [],
    },
    ...overrides,
  };
}

const baseFacts = {
  onboardingInviteId: null as string | null,
  onboardingInviteStatus: "none" as const,
  onboardingInviteExpiresAt: null as string | null,
  checklist: {
    accountCreated: true,
    pinChosen: false,
    permissionsAssigned: false,
    trainingPending: true,
  },
  systemAccessRevoked: false,
  canSendInvite: true,
  canResendInvite: false,
  canCopyInviteLink: false,
  canCancelOnboarding: false,
};

test("checklist summary counts blocking items without changing ordering labels", () => {
  assert.deepEqual(summariseOnboardingChecklist(baseFacts.checklist), {
    completed: 1,
    total: 4,
    blockingItems: ["PIN chosen", "Permissions assigned", "Training complete"],
  });
});

test("maps identity access onto loginAccessStatus without conflating onboarding invite", () => {
  assert.equal(mapIdentityAccessToLoginAccessStatus("no_login"), "not_started");
  assert.equal(mapIdentityAccessToLoginAccessStatus("invite_pending"), "invite_pending");
  assert.equal(mapIdentityAccessToLoginAccessStatus("login_active"), "active");
});

test("lifecycle_only is a valid onboarding state with scheduling attention", () => {
  const entry = projectStaffOnboardingEntry(
    identity({
      staffId: null,
      integrity: {
        linkStatus: "lifecycle_only",
        hasSchedulingRecord: false,
        hasLifecycleRecord: true,
        hasAuthIdentity: false,
        warnings: [],
      },
    }),
    {
      ...baseFacts,
      onboardingInviteStatus: "pending",
      onboardingInviteId: "inv-1",
      canSendInvite: false,
      canResendInvite: true,
    }
  );
  assert.equal(entry.onboardingStatus, "invited");
  assert.ok(entry.attentionReasons.includes("scheduling_record_missing"));
  assert.ok(entry.attentionReasons.includes("identity_link_incomplete"));
  assert.equal(entry.actions.canResendOnboardingInvite, true);
  assert.equal(entry.actions.canCreateSchedulingRecord, true);
  assert.equal(entry.loginAccessStatus, "not_started");
});

test("ambiguous identity blocks invite actions and surfaces reconciliation", () => {
  const entry = projectStaffOnboardingEntry(
    identity({
      integrity: {
        linkStatus: "ambiguous",
        hasSchedulingRecord: true,
        hasLifecycleRecord: true,
        hasAuthIdentity: true,
        warnings: [],
      },
    }),
    {
      ...baseFacts,
      canSendInvite: true,
      canResendInvite: true,
      canCopyInviteLink: true,
    }
  );
  assert.equal(entry.onboardingStatus, "blocked");
  assert.deepEqual(entry.attentionReasons, ["identity_requires_reconciliation"]);
  assert.equal(entry.actions.canSendOnboardingInvite, false);
  assert.equal(entry.actions.canResendOnboardingInvite, false);
  assert.equal(entry.actions.canCopyOnboardingInviteLink, false);
  assert.equal(entry.actions.canCreateSchedulingRecord, false);
});

test("onboarding completed with login not started is a separate outstanding access step", () => {
  const entry = projectStaffOnboardingEntry(identity({ accessStatus: "no_login" }), {
    ...baseFacts,
    checklist: {
      accountCreated: true,
      pinChosen: true,
      permissionsAssigned: true,
      trainingPending: false,
    },
    onboardingInviteStatus: "accepted",
    canSendInvite: false,
  });
  assert.equal(entry.onboardingStatus, "completed");
  assert.equal(entry.loginAccessStatus, "not_started");
  assert.ok(entry.attentionReasons.includes("login_access_outstanding"));
});

test("login active while onboarding incomplete is flagged without conflating processes", () => {
  const entry = projectStaffOnboardingEntry(
    identity({
      accessStatus: "login_active",
      userId: "u1",
      integrity: {
        linkStatus: "linked",
        hasSchedulingRecord: true,
        hasLifecycleRecord: true,
        hasAuthIdentity: true,
        warnings: [],
      },
    }),
    {
      ...baseFacts,
      onboardingInviteStatus: "accepted",
      canSendInvite: false,
    }
  );
  assert.equal(entry.loginAccessStatus, "active");
  assert.notEqual(entry.onboardingStatus, "completed");
  assert.ok(entry.attentionReasons.includes("login_active_onboarding_incomplete"));
});

test("expired invite preserves resend eligibility under domain facts", () => {
  const entry = projectStaffOnboardingEntry(identity(), {
    ...baseFacts,
    onboardingInviteStatus: "expired",
    onboardingInviteId: "inv-exp",
    canSendInvite: false,
    canResendInvite: true,
  });
  assert.equal(entry.onboardingStatus, "invited");
  assert.ok(entry.attentionReasons.includes("onboarding_invite_expired"));
  assert.equal(entry.actions.canResendOnboardingInvite, true);
});

test("cancelled / revoked access preserves history status without auto-deletion signals", () => {
  assert.equal(
    deriveStaffOnboardingStatus({
      inviteStatus: "pending",
      checklist: baseFacts.checklist,
      systemAccessRevoked: true,
      identityUncertain: false,
    }),
    "cancelled"
  );
});
