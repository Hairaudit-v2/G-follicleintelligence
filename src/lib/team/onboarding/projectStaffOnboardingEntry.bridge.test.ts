/**
 * B1.3 — onboarding projection preserves identity attention without changing invite rules.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  applyStaffOnboardingEntryFlags,
  projectStaffOnboardingEntry,
} from "@/src/lib/team/onboarding";
import type { StaffIdentity } from "@/src/lib/team/identity/types";

function identity(overrides: Partial<StaffIdentity> = {}): StaffIdentity {
  return {
    tenantId: "11111111-1111-1111-1111-111111111111",
    personKey: "sm:44444444-4444-4444-4444-444444444444",
    staffId: "33333333-3333-3333-3333-333333333333",
    staffMemberId: "44444444-4444-4444-4444-444444444444",
    userId: "55555555-5555-5555-5555-555555555555",
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
      hasAuthIdentity: true,
      warnings: [],
    },
    ...overrides,
  };
}

test("applyStaffOnboardingEntryFlags bridges projection into centre action fields", () => {
  const entry = projectStaffOnboardingEntry(identity(), {
    onboardingInviteId: null,
    onboardingInviteStatus: "none",
    onboardingInviteExpiresAt: null,
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
  });
  assert.deepEqual(applyStaffOnboardingEntryFlags(entry), {
    canSendInvite: true,
    canResendInvite: false,
    canCopyInviteLink: false,
    attentionReasons: [],
  });
});

test("uncertain identity bridge zeros invite flags", () => {
  const entry = projectStaffOnboardingEntry(
    identity({
      integrity: {
        linkStatus: "cross_tenant_mismatch",
        hasSchedulingRecord: true,
        hasLifecycleRecord: true,
        hasAuthIdentity: true,
        warnings: [],
      },
    }),
    {
      onboardingInviteId: "inv-1",
      onboardingInviteStatus: "pending",
      onboardingInviteExpiresAt: null,
      checklist: {
        accountCreated: true,
        pinChosen: false,
        permissionsAssigned: false,
        trainingPending: true,
      },
      systemAccessRevoked: false,
      canSendInvite: true,
      canResendInvite: true,
      canCopyInviteLink: true,
      canCancelOnboarding: false,
    }
  );
  const flags = applyStaffOnboardingEntryFlags(entry);
  assert.equal(flags.canSendInvite, false);
  assert.equal(flags.canResendInvite, false);
  assert.equal(flags.canCopyInviteLink, false);
  assert.ok(flags.attentionReasons.includes("cross_tenant_mismatch"));
});
