/**
 * B1.2 — access projection preserves identity attention without changing access rules.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  applyStaffAccessEntryFlags,
  projectStaffAccessEntry,
} from "@/src/lib/team/access";
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
    employmentStatus: "active",
    accessStatus: "login_active",
    readinessStatus: "ready",
    archivedAt: null,
    hrLinked: false,
    primaryClinicId: null,
    clinicIds: [],
    roles: ["nurse"],
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

test("applyStaffAccessEntryFlags bridges projection into centre action fields", () => {
  const entry = projectStaffAccessEntry(identity(), {
    authLoginStatus: "login_active",
    inviteStatus: "accepted",
    loginInviteId: "inv-1",
    loginInviteExpiresAt: null,
    canSendInvite: false,
    canResendInvite: false,
    canSuspendAccess: true,
    canRevokeAccess: true,
  });
  assert.deepEqual(applyStaffAccessEntryFlags(entry), {
    canSendInvite: false,
    canResendInvite: false,
    canSuspendAccess: true,
    canRevokeAccess: true,
    attentionReasons: [],
  });
});

test("uncertain identity bridge zeros destructive and invite flags", () => {
  const entry = projectStaffAccessEntry(
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
      authLoginStatus: "login_active",
      inviteStatus: "accepted",
      loginInviteId: null,
      loginInviteExpiresAt: null,
      canSendInvite: true,
      canResendInvite: true,
      canSuspendAccess: true,
      canRevokeAccess: true,
    }
  );
  const flags = applyStaffAccessEntryFlags(entry);
  assert.equal(flags.canSendInvite, false);
  assert.equal(flags.canRevokeAccess, false);
  assert.equal(flags.canSuspendAccess, false);
  assert.deepEqual(flags.attentionReasons, ["identity_requires_reconciliation"]);
});
