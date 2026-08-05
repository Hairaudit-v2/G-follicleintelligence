import assert from "node:assert/strict";
import test from "node:test";

import {
  canCopyOnboardingInviteLink,
  canResendOnboardingInvite,
  canSendOnboardingInvite,
  mapOnboardingInviteDisplayStatus,
  onboardingInviteStatusLabel,
} from "@/src/lib/team/onboarding/onboardingCentreCore";

const base = {
  email: "alex@clinic.com",
  systemAccessRevoked: false,
  employmentStatus: "pending_onboarding",
};

test("mapOnboardingInviteDisplayStatus: sent maps to pending", () => {
  assert.equal(
    mapOnboardingInviteDisplayStatus({
      rawStatus: "sent",
      expiresAt: "2099-01-01T00:00:00.000Z",
      acceptedAt: null,
    }),
    "pending"
  );
});

test("mapOnboardingInviteDisplayStatus: accepted when accepted_at set", () => {
  assert.equal(
    mapOnboardingInviteDisplayStatus({
      rawStatus: "sent",
      expiresAt: "2099-01-01T00:00:00.000Z",
      acceptedAt: "2026-07-01T00:00:00.000Z",
    }),
    "accepted"
  );
});

test("mapOnboardingInviteDisplayStatus: expired when past expires_at", () => {
  assert.equal(
    mapOnboardingInviteDisplayStatus({
      rawStatus: "pending",
      expiresAt: "2020-01-01T00:00:00.000Z",
      acceptedAt: null,
      now: new Date("2026-01-01T00:00:00.000Z"),
    }),
    "expired"
  );
});

test("canSendOnboardingInvite: true when no invite yet", () => {
  assert.equal(canSendOnboardingInvite({ ...base, inviteStatus: "none" }), true);
});

test("canSendOnboardingInvite: false when invite pending", () => {
  assert.equal(canSendOnboardingInvite({ ...base, inviteStatus: "pending" }), false);
});

test("canResendOnboardingInvite: true for pending unaccepted invite", () => {
  assert.equal(canResendOnboardingInvite({ ...base, inviteStatus: "pending" }), true);
});

test("canResendOnboardingInvite: true for expired unaccepted invite", () => {
  assert.equal(canResendOnboardingInvite({ ...base, inviteStatus: "expired" }), true);
});

test("canResendOnboardingInvite: false for accepted invite", () => {
  assert.equal(canResendOnboardingInvite({ ...base, inviteStatus: "accepted" }), false);
});

test("canResendOnboardingInvite: false when access suspended", () => {
  assert.equal(
    canResendOnboardingInvite({
      ...base,
      systemAccessRevoked: true,
      inviteStatus: "pending",
    }),
    false
  );
  assert.equal(
    canResendOnboardingInvite({
      ...base,
      employmentStatus: "suspended",
      inviteStatus: "pending",
    }),
    false
  );
});

test("canCopyOnboardingInviteLink: true when pending and URL exists", () => {
  assert.equal(canCopyOnboardingInviteLink({ inviteStatus: "pending", hasInviteUrl: true }), true);
});

test("canCopyOnboardingInviteLink: false when accepted", () => {
  assert.equal(
    canCopyOnboardingInviteLink({ inviteStatus: "accepted", hasInviteUrl: true }),
    false
  );
});

test("onboardingInviteStatusLabel: readable labels", () => {
  assert.equal(onboardingInviteStatusLabel("pending"), "Invite Pending");
  assert.equal(onboardingInviteStatusLabel("accepted"), "Invite Accepted");
  assert.equal(onboardingInviteStatusLabel("none"), "No Invite");
});

test("resend hidden for accepted — send also false", () => {
  const accepted = { ...base, inviteStatus: "accepted" as const };
  assert.equal(canResendOnboardingInvite(accepted), false);
  assert.equal(canSendOnboardingInvite(accepted), false);
});

test("no duplicate staff path — resend eligibility does not require new staff row", () => {
  assert.equal(canResendOnboardingInvite({ ...base, inviteStatus: "pending" }), true);
  assert.equal(canSendOnboardingInvite({ ...base, inviteStatus: "pending" }), false);
});
