import assert from "node:assert/strict";
import test from "node:test";

import { buildStaffProfileHref } from "@/src/lib/workforce/staffLifecycleCopy";
import {
  buildStaffProfileOverviewModel,
  resolveStaffLifecycleBlockers,
  resolveStaffProfileActions,
} from "@/src/lib/workforce/staffProfileHubCore";
import {
  resolveOnboardingCentreActions,
  resolveStaffAccessCentreActions,
  resolveStaffUnifiedStatus,
} from "@/src/lib/workforce/staffLifecycleUxCore";

const TENANT = "tenant-abc";

test("buildStaffProfileHref points to WorkforceOS staff profile hub", () => {
  assert.equal(
    buildStaffProfileHref(TENANT, "staff-1"),
    "/fi-admin/tenant-abc/workforce-os/staff/staff-1"
  );
});

test("Staff Profile Overview unified status includes access, PIN, onboarding, readiness and eligibility", () => {
  const overview = buildStaffProfileOverviewModel({
    tenantId: TENANT,
    employmentStatus: "pending_onboarding",
    archivedAt: null,
    email: "new@clinic.com",
    systemAccessRevoked: false,
    onboardingInviteStatus: "pending",
    hasOnboardingInviteUrl: true,
    checklist: {
      accountCreated: true,
      pinChosen: false,
      permissionsAssigned: false,
      trainingPending: true,
    },
    accessRow: {
      authLoginStatus: "no_login",
      inviteStatus: "none",
      pinStatus: "Not set",
      canSendInvite: true,
      canResendInvite: false,
      canCopyInviteLink: false,
      canResetPin: false,
      canSuspendAccess: false,
      canRevokeAccess: false,
    },
    workforceIntelligence: {
      readinessScore: 42,
      readinessBand: "operational_warning",
      readinessBandLabel: "Developing",
      complianceStatus: "missing",
      trainingRequiredCount: 2,
      trainingProgressLabel: "2 required",
      nextShiftLabel: null,
      surgeryReady: false,
    },
    identityAuditRow: {
      workspaceProfileStatus: "missing",
      loginStatus: "missing_user",
      pinStatus: "missing",
      onboardingStatus: "pending",
      issues: ["Missing fi_staff link"],
    },
    pinStatus: "Not set",
  });

  assert.equal(overview.unifiedStatus.operationalState, "pending_onboarding");
  assert.equal(overview.unifiedStatus.loginLabel, "No Login");
  assert.equal(overview.unifiedStatus.readinessLabel, "Readiness 42%");
  assert.equal(overview.unifiedStatus.onboardingLabel, "Onboarding invite pending");
  assert.equal(overview.unifiedStatus.identityLinkLabel, "Identity link missing");
  assert.ok(overview.blockers.some((b) => b.id === "invite_pending"));
  assert.ok(overview.blockers.some((b) => b.id === "missing_identity_link"));
  assert.ok(overview.blockers.some((b) => b.id === "training_incomplete"));
  assert.ok(overview.blockers.some((b) => b.id === "missing_documents"));
});

test("Pending onboarding staff show Resend/Open Staff Access action, not Reset PIN as primary", () => {
  const actions = resolveStaffProfileActions({
    tenantId: TENANT,
    employmentStatus: "pending_onboarding",
    email: "new@clinic.com",
    systemAccessRevoked: false,
    onboardingInviteStatus: "pending",
    hasOnboardingInviteUrl: true,
    checklist: {
      accountCreated: false,
      pinChosen: false,
      permissionsAssigned: false,
      trainingPending: true,
    },
    accessRow: {
      authLoginStatus: "no_login",
      inviteStatus: "none",
      pinStatus: "Not set",
      canSendInvite: true,
      canResendInvite: false,
      canCopyInviteLink: false,
      canResetPin: false,
      canSuspendAccess: false,
      canRevokeAccess: false,
    },
  });

  assert.ok(actions.some((a) => a.id === "resend_onboarding_invite"));
  assert.ok(!actions.some((a) => a.id === "reset_pin" && a.priority === "primary"));
});

test("Accepted staff with missing PIN shows Reset PIN guidance via access actions", () => {
  const accessActions = resolveStaffAccessCentreActions({
    canSendInvite: false,
    canResendInvite: false,
    canCopyInviteLink: false,
    canResetPin: true,
    canSuspendAccess: true,
    canRevokeAccess: true,
    authLoginStatus: "login_active",
    systemAccessRevoked: false,
  });

  assert.ok(accessActions.some((a) => a.id === "reset_pin"));
  assert.ok(!accessActions.some((a) => a.id === "resend_login_invite"));
});

test("Suspended staff show reactivation guidance and do not show normal resend action", () => {
  const onboardingActions = resolveOnboardingCentreActions({
    email: "staff@clinic.com",
    systemAccessRevoked: true,
    employmentStatus: "suspended",
    inviteStatus: "pending",
    hasInviteUrl: true,
  });
  assert.ok(onboardingActions.some((a) => a.guidance?.includes("suspended")));
  assert.ok(!onboardingActions.some((a) => a.id === "resend_onboarding_invite"));

  const profileActions = resolveStaffProfileActions({
    tenantId: TENANT,
    employmentStatus: "suspended",
    email: "staff@clinic.com",
    systemAccessRevoked: true,
    onboardingInviteStatus: "pending",
    hasOnboardingInviteUrl: true,
    checklist: {
      accountCreated: true,
      pinChosen: false,
      permissionsAssigned: true,
      trainingPending: false,
    },
    accessRow: {
      authLoginStatus: "suspended",
      inviteStatus: "pending",
      pinStatus: "Not set",
      canSendInvite: false,
      canResendInvite: false,
      canCopyInviteLink: false,
      canResetPin: false,
      canSuspendAccess: false,
      canRevokeAccess: true,
    },
  });

  assert.ok(profileActions.some((a) => a.guidance?.includes("suspended")));
});

test("Blocker links route to correct lifecycle centres", () => {
  const blockers = resolveStaffLifecycleBlockers({
    tenantId: TENANT,
    employmentStatus: "pending_onboarding",
    systemAccessRevoked: false,
    onboardingInviteStatus: "none",
    accessRow: {
      authLoginStatus: "no_login",
      inviteStatus: "none",
      pinStatus: "Not set",
      canSendInvite: true,
      canResendInvite: false,
      canCopyInviteLink: false,
      canResetPin: false,
      canSuspendAccess: false,
      canRevokeAccess: false,
    },
    checklist: {
      accountCreated: false,
      pinChosen: false,
      permissionsAssigned: false,
      trainingPending: true,
    },
    workforceIntelligence: null,
    identityAuditRow: {
      workspaceProfileStatus: "missing",
      loginStatus: "missing_user",
      pinStatus: "missing",
      onboardingStatus: "pending",
      issues: [],
    },
  });

  const onboardingBlocker = blockers.find((b) => b.id === "invite_not_sent");
  assert.ok(onboardingBlocker?.href.includes("/hr-os/onboarding"));

  const identityBlocker = blockers.find((b) => b.id === "missing_identity_link");
  assert.ok(identityBlocker?.href.includes("/staff-identity-audit"));

  const trainingBlocker = blockers.find((b) => b.id === "training_incomplete");
  assert.ok(trainingBlocker?.href.includes("/hr-os/onboarding"));
});

test("resolveStaffUnifiedStatus preserves access suspended semantics", () => {
  const status = resolveStaffUnifiedStatus({
    employmentStatus: "active",
    archivedAt: null,
    systemAccessRevoked: true,
    authLoginStatus: "suspended",
    inviteStatus: "accepted",
    pinStatus: "Active",
    readinessScore: 90,
  });

  assert.equal(status.isAccessSuspended, true);
});
