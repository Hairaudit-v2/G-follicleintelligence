import assert from "node:assert/strict";
import test from "node:test";

import {
  authLoginStatusLabel,
  canReceiveLoginInvite,
  isArchivedStaff,
  isDepartedStaff,
  nextResendInvitationTimestamps,
  resolveAuthLoginStatus,
  resolveInviteStatus,
  STAFF_LOGIN_INVITE_EXPIRY_DAYS,
} from "@/src/lib/workforce/staffAccessCentreCore";

test("active staff without login can receive invite", () => {
  const authStatus = resolveAuthLoginStatus({
    systemAccessRevoked: false,
    employmentStatus: "active",
    fiUserId: null,
    authUserId: null,
    authEmailConfirmed: false,
    authHasSignedIn: false,
  });
  assert.equal(authStatus, "no_login");
  assert.equal(
    canReceiveLoginInvite({
      archivedAt: null,
      employmentStatus: "active",
      email: "alex@clinic.com",
      systemAccessRevoked: false,
      authLoginStatus: authStatus,
    }),
    true
  );
});

test("active staff with login shows Login Active", () => {
  const authStatus = resolveAuthLoginStatus({
    systemAccessRevoked: false,
    employmentStatus: "active",
    fiUserId: "user-1",
    authUserId: "auth-1",
    authEmailConfirmed: true,
    authHasSignedIn: false,
  });
  assert.equal(authStatus, "login_active");
  assert.equal(authLoginStatusLabel(authStatus), "Login Active");
  assert.equal(
    canReceiveLoginInvite({
      archivedAt: null,
      employmentStatus: "active",
      email: "alex@clinic.com",
      systemAccessRevoked: false,
      authLoginStatus: authStatus,
    }),
    false
  );
});

test("departed staff cannot receive invite", () => {
  for (const status of ["terminated", "resigned", "contract_ended"] as const) {
    assert.equal(isDepartedStaff(status), true);
    const authStatus = resolveAuthLoginStatus({
      systemAccessRevoked: false,
      employmentStatus: status,
      fiUserId: null,
      authUserId: null,
      authEmailConfirmed: false,
      authHasSignedIn: false,
    });
    assert.equal(
      canReceiveLoginInvite({
        archivedAt: null,
        employmentStatus: status,
        email: "alex@clinic.com",
        systemAccessRevoked: false,
        authLoginStatus: authStatus,
      }),
      false
    );
  }
});

test("archived staff cannot receive invite", () => {
  assert.equal(isArchivedStaff("2026-01-01T00:00:00.000Z"), true);
  const authStatus = resolveAuthLoginStatus({
    systemAccessRevoked: false,
    employmentStatus: "active",
    fiUserId: null,
    authUserId: null,
    authEmailConfirmed: false,
    authHasSignedIn: false,
  });
  assert.equal(
    canReceiveLoginInvite({
      archivedAt: archivedS(),
      employmentStatus: "active",
      email: "alex@clinic.com",
      systemAccessRevoked: false,
      authLoginStatus: authStatus,
    }),
    false
  );
});

function archivedS(): string {
  return "2026-01-01T00:00:00.000Z";
}

test("resend updates invitation timestamp", () => {
  const now = new Date("2026-07-02T12:00:00.000Z");
  const next = nextResendInvitationTimestamps(now);
  assert.equal(next.invitedAt, now.toISOString());
  assert.equal(next.updatedAt, now.toISOString());
  const expectedExpiry = new Date(
    now.getTime() + STAFF_LOGIN_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  assert.equal(next.expiresAt, expectedExpiry);
});

test("resolveInviteStatus marks expired pending invites", () => {
  assert.equal(
    resolveInviteStatus({
      invitationStatus: "pending",
      expiresAt: "2020-01-01T00:00:00.000Z",
      now: new Date("2026-01-01T00:00:00.000Z"),
    }),
    "expired"
  );
});

test("resolveAuthLoginStatus: invite pending when auth linked but not confirmed", () => {
  const status = resolveAuthLoginStatus({
    systemAccessRevoked: false,
    employmentStatus: "active",
    fiUserId: "user-1",
    authUserId: "auth-1",
    authEmailConfirmed: false,
    authHasSignedIn: false,
  });
  assert.equal(status, "invite_pending");
});
