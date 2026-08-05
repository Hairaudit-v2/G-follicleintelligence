import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStaffDirectoryPrimaryActionHref,
  resolveOnboardingCentreActions,
  resolveStaffAccessCentreActions,
  resolveStaffUnifiedStatus,
  staffDirectoryLifecycleGuidance,
} from "@/src/lib/workforce/staffLifecycleUxCore";

test("Staff Directory primary action routes to the Team onboarding tab", () => {
  // A2: onboarding retired from /hr-os into the canonical /team tab.
  assert.equal(
    buildStaffDirectoryPrimaryActionHref("/fi-admin/tenant-1"),
    "/fi-admin/tenant-1/team/onboarding"
  );
});

test("Staff Profile unified status includes access, onboarding, and readiness dimensions", () => {
  const status = resolveStaffUnifiedStatus({
    employmentStatus: "pending_onboarding",
    archivedAt: null,
    systemAccessRevoked: false,
    onboardingInviteStatus: "pending",
    authLoginStatus: "no_login",
    inviteStatus: "none",
    pinStatus: "not_set",
    readinessScore: 42,
    complianceLabel: "Due soon",
    onboardingChecklistComplete: false,
  });

  assert.equal(status.operationalState, "pending_onboarding");
  assert.equal(status.loginLabel, "No Login");
  assert.equal(status.readinessLabel, "Readiness 42%");
  assert.equal(status.complianceLabel, "Due soon");
  assert.equal(status.isAccessSuspended, false);
});

test("Staff Action Menu: pending onboarding staff show Resend invite", () => {
  const actions = resolveOnboardingCentreActions({
    email: "new@clinic.com",
    systemAccessRevoked: false,
    employmentStatus: "pending_onboarding",
    inviteStatus: "pending",
    hasInviteUrl: true,
  });

  assert.ok(actions.some((a) => a.id === "resend_onboarding_invite"));
  assert.ok(!actions.some((a) => a.id === "reset_pin"));
});

test("Staff Action Menu: accepted login staff show Reset PIN not Resend invite", () => {
  const actions = resolveStaffAccessCentreActions({
    canSendInvite: false,
    canResendInvite: false,
    canCopyInviteLink: false,
    canResetPin: true,
    canSuspendAccess: true,
    canRevokeAccess: true,
    authLoginStatus: "login_active",
    systemAccessRevoked: false,
  });

  assert.ok(actions.some((a) => a.id === "reset_pin"));
  assert.ok(!actions.some((a) => a.id === "resend_login_invite"));
  assert.ok(!actions.some((a) => a.id === "send_login_invite"));
});

test("Staff Action Menu: suspended staff show reactivation guidance not normal invite actions", () => {
  const onboardingActions = resolveOnboardingCentreActions({
    email: "staff@clinic.com",
    systemAccessRevoked: true,
    employmentStatus: "suspended",
    inviteStatus: "pending",
    hasInviteUrl: true,
  });
  assert.ok(onboardingActions.some((a) => a.guidance?.includes("suspended")));
  assert.ok(!onboardingActions.some((a) => a.id === "resend_onboarding_invite"));

  const accessActions = resolveStaffAccessCentreActions({
    canSendInvite: true,
    canResendInvite: true,
    canCopyInviteLink: true,
    canResetPin: true,
    canSuspendAccess: false,
    canRevokeAccess: true,
    authLoginStatus: "suspended",
    systemAccessRevoked: false,
  });
  assert.ok(accessActions.some((a) => a.guidance?.includes("suspended")));
  assert.ok(!accessActions.some((a) => a.id === "resend_login_invite"));
});

test("staffDirectoryLifecycleGuidance includes onboarding and access copy", () => {
  const copy = staffDirectoryLifecycleGuidance();
  assert.match(copy.body, /Onboarding/i);
  assert.match(copy.body, /Staff Access/i);
  assert.match(copy.emptyState, /Onboarding Centre/i);
});
