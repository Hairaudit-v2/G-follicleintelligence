import assert from "node:assert/strict";
import test from "node:test";

import { resolveOnboardingInvitationStatus } from "@/src/lib/team/onboarding/onboardingInviteStatusCore";

test("resolveOnboardingInvitationStatus: accepted stays accepted", () => {
  assert.equal(
    resolveOnboardingInvitationStatus("accepted", "2099-01-01T00:00:00.000Z"),
    "accepted"
  );
});

test("resolveOnboardingInvitationStatus: revoked maps to expired for invitee flows", () => {
  assert.equal(
    resolveOnboardingInvitationStatus("revoked", "2099-01-01T00:00:00.000Z"),
    "expired"
  );
});

test("resolveOnboardingInvitationStatus: past expires_at is expired", () => {
  assert.equal(
    resolveOnboardingInvitationStatus("sent", "2000-01-01T00:00:00.000Z"),
    "expired"
  );
});

test("resolveOnboardingInvitationStatus: sent/pending within window is pending", () => {
  assert.equal(
    resolveOnboardingInvitationStatus("sent", "2099-01-01T00:00:00.000Z"),
    "pending"
  );
  assert.equal(
    resolveOnboardingInvitationStatus("pending", "2099-01-01T00:00:00.000Z"),
    "pending"
  );
});
