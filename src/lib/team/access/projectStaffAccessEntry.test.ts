/**
 * Access projection unit tests (FI-TEAM-COHESION-B1.2).
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { StaffIdentity } from "@/src/lib/team/identity/types";
import {
  deriveStaffAccessAttentionReasons,
  mapAuthLoginToAccessEntryStatus,
  projectStaffAccessEntry,
} from "@/src/lib/team/access/projectStaffAccessEntry";

function identity(overrides: Partial<StaffIdentity> = {}): StaffIdentity {
  return {
    tenantId: "11111111-1111-1111-1111-111111111111",
    personKey: "sm:44444444-4444-4444-4444-444444444444",
    staffId: "33333333-3333-3333-3333-333333333333",
    staffMemberId: "44444444-4444-4444-4444-444444444444",
    userId: null,
    displayName: "Ada",
    email: "ada@example.com",
    employmentStatus: "active",
    accessStatus: "no_login",
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
      hasAuthIdentity: false,
      warnings: [],
    },
    ...overrides,
  };
}

const baseFacts = {
  authLoginStatus: "no_login" as const,
  inviteStatus: "none" as const,
  loginInviteId: null,
  loginInviteExpiresAt: null,
  canSendInvite: true,
  canResendInvite: false,
  canSuspendAccess: true,
  canRevokeAccess: true,
};

test("maps auth login statuses onto access entry statuses", () => {
  assert.equal(mapAuthLoginToAccessEntryStatus("no_login"), "not_invited");
  assert.equal(mapAuthLoginToAccessEntryStatus("invite_pending"), "invite_pending");
  assert.equal(mapAuthLoginToAccessEntryStatus("login_active"), "active");
  assert.equal(mapAuthLoginToAccessEntryStatus("suspended"), "suspended");
  assert.equal(mapAuthLoginToAccessEntryStatus("revoked"), "revoked");
});

test("linked staff without auth gets missing_auth_identity attention", () => {
  const reasons = deriveStaffAccessAttentionReasons(identity(), {
    authLoginStatus: "no_login",
  });
  assert.ok(reasons.includes("missing_auth_identity"));
});

test("lifecycle_only surfaces scheduling missing + incomplete", () => {
  const entry = projectStaffAccessEntry(
    identity({
      staffId: null,
      personKey: "sm:44444444-4444-4444-4444-444444444444",
      readinessStatus: "watch",
      integrity: {
        linkStatus: "lifecycle_only",
        hasSchedulingRecord: false,
        hasLifecycleRecord: true,
        hasAuthIdentity: false,
        warnings: [],
      },
    }),
    baseFacts
  );
  assert.ok(entry.attentionReasons.includes("scheduling_record_missing"));
  assert.ok(entry.attentionReasons.includes("identity_link_incomplete"));
  assert.equal(entry.accessStatus, "not_invited");
});

test("ambiguous identity blocks invite and destructive flags without inventing eligibility", () => {
  const entry = projectStaffAccessEntry(
    identity({
      readinessStatus: "watch",
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
      authLoginStatus: "login_active",
      canSendInvite: true,
      canResendInvite: true,
      canSuspendAccess: true,
      canRevokeAccess: true,
    }
  );
  assert.deepEqual(entry.attentionReasons, ["identity_requires_reconciliation"]);
  assert.equal(entry.canInvite, false);
  assert.equal(entry.canResend, false);
  assert.equal(entry.canSuspend, false);
  assert.equal(entry.canRevoke, false);
});

test("terminated employment with active login is an attention condition", () => {
  const reasons = deriveStaffAccessAttentionReasons(
    identity({
      employmentStatus: "terminated",
      userId: "u1",
      integrity: {
        linkStatus: "linked",
        hasSchedulingRecord: true,
        hasLifecycleRecord: true,
        hasAuthIdentity: true,
        warnings: [],
      },
    }),
    { authLoginStatus: "login_active" }
  );
  assert.ok(reasons.includes("terminated_with_active_access"));
});

test("linked active staff preserves access-domain action flags", () => {
  const entry = projectStaffAccessEntry(
    identity({
      userId: "u1",
      accessStatus: "login_active",
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
      authLoginStatus: "login_active",
      canSendInvite: false,
      canResendInvite: false,
      canSuspendAccess: true,
      canRevokeAccess: true,
    }
  );
  assert.equal(entry.canInvite, false);
  assert.equal(entry.canSuspend, true);
  assert.equal(entry.canRevoke, true);
  assert.equal(entry.attentionReasons.length, 0);
});
