import assert from "node:assert/strict";
import test from "node:test";

import { buildStaffProfileHref } from "@/src/lib/workforce/staffLifecycleCopy";
import {
  buildStaffProfileOverviewModel,
  resolveStaffLifecycleBlockers,
  resolveStaffProfileActionMenu,
  resolveStaffProfileActions,
} from "@/src/lib/workforce/staffProfileHubCore";
import {
  resolveOnboardingCentreActions,
  resolveStaffAccessCentreActions,
  resolveStaffUnifiedStatus,
} from "@/src/lib/workforce/staffLifecycleUxCore";

const TENANT = "tenant-abc";
const STAFF_MEMBER = "staff-member-1";

const baseActionContext = {
  tenantId: TENANT,
  staffMemberId: STAFF_MEMBER,
  viewerCanManageAccess: true,
  viewerCanManageOnboarding: true,
  viewerCanManageReadiness: true,
  viewerCanViewIdentityAudit: true,
};

test("buildStaffProfileHref points to WorkforceOS staff profile hub", () => {
  assert.equal(
    buildStaffProfileHref(TENANT, "staff-1"),
    "/fi-admin/tenant-abc/workforce-os/staff/staff-1"
  );
});

test("Staff Profile Overview unified status includes access, PIN, onboarding, readiness and eligibility", () => {
  const overview = buildStaffProfileOverviewModel({
    tenantId: TENANT,
    staffMemberId: STAFF_MEMBER,
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
  assert.ok(overview.actionMenu.primaryAction);
  assert.equal(overview.actionMenu.primaryAction?.id, "resend_onboarding_invite");
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

  // A2: blockers deep-link to canonical /team destinations, not retired routes.
  const onboardingBlocker = blockers.find((b) => b.id === "invite_not_sent");
  assert.ok(onboardingBlocker?.href.includes("/team/onboarding"));

  const identityBlocker = blockers.find((b) => b.id === "missing_identity_link");
  assert.ok(identityBlocker?.href.includes("/team/admin/identity-audit"));

  const trainingBlocker = blockers.find((b) => b.id === "training_incomplete");
  assert.ok(trainingBlocker?.href.includes("/team/onboarding"));
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

test("Action menu: no invite shows Send invite or Open Staff Access as primary", () => {
  const menu = resolveStaffProfileActionMenu({
    tenantId: TENANT,
    staffMemberId: STAFF_MEMBER,
    employmentStatus: "active",
    email: "staff@clinic.com",
    systemAccessRevoked: false,
    onboardingInviteStatus: "accepted",
    hasOnboardingInviteUrl: false,
    checklist: {
      accountCreated: true,
      pinChosen: true,
      permissionsAssigned: true,
      trainingPending: false,
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
    blockers: [],
    actionContext: baseActionContext,
  });

  assert.ok(
    menu.primaryAction?.id === "send_login_invite" ||
      menu.primaryAction?.id === "open_access_centre"
  );
});

test("Action menu: accepted login with PIN ready promotes Reset PIN as primary", () => {
  const menu = resolveStaffProfileActionMenu({
    tenantId: TENANT,
    staffMemberId: STAFF_MEMBER,
    employmentStatus: "active",
    email: "staff@clinic.com",
    systemAccessRevoked: false,
    onboardingInviteStatus: "accepted",
    hasOnboardingInviteUrl: false,
    checklist: {
      accountCreated: true,
      pinChosen: true,
      permissionsAssigned: true,
      trainingPending: false,
    },
    accessRow: {
      authLoginStatus: "login_active",
      inviteStatus: "accepted",
      pinStatus: "Active",
      canSendInvite: false,
      canResendInvite: false,
      canCopyInviteLink: false,
      canResetPin: true,
      canSuspendAccess: true,
      canRevokeAccess: true,
    },
    blockers: [],
    actionContext: baseActionContext,
  });

  assert.equal(menu.primaryAction?.id, "reset_pin");
  assert.ok(!menu.actions.some((a) => a.id === "resend_login_invite"));
});

test("Action menu: non-admin viewer disables management actions with reason", () => {
  const menu = resolveStaffProfileActionMenu({
    tenantId: TENANT,
    staffMemberId: STAFF_MEMBER,
    employmentStatus: "active",
    email: "staff@clinic.com",
    systemAccessRevoked: false,
    onboardingInviteStatus: "accepted",
    hasOnboardingInviteUrl: false,
    checklist: {
      accountCreated: true,
      pinChosen: false,
      permissionsAssigned: true,
      trainingPending: false,
    },
    accessRow: {
      authLoginStatus: "login_active",
      inviteStatus: "accepted",
      pinStatus: "Active",
      canSendInvite: false,
      canResendInvite: false,
      canCopyInviteLink: false,
      canResetPin: true,
      canSuspendAccess: true,
      canRevokeAccess: true,
    },
    blockers: [],
    actionContext: {
      ...baseActionContext,
      viewerCanManageAccess: false,
      viewerCanManageOnboarding: false,
    },
  });

  const resetPin = menu.actions.find((a) => a.id === "reset_pin");
  assert.equal(resetPin?.disabled, true);
  assert.match(resetPin?.disabledReason ?? "", /Only admins can reset staff PIN access/i);
});

test("Action menu: missing documents adds compliance link in readiness", () => {
  const menu = resolveStaffProfileActionMenu({
    tenantId: TENANT,
    staffMemberId: STAFF_MEMBER,
    employmentStatus: "active",
    email: "staff@clinic.com",
    systemAccessRevoked: false,
    onboardingInviteStatus: "accepted",
    hasOnboardingInviteUrl: false,
    checklist: {
      accountCreated: true,
      pinChosen: true,
      permissionsAssigned: true,
      trainingPending: true,
    },
    accessRow: {
      authLoginStatus: "login_active",
      inviteStatus: "accepted",
      pinStatus: "Active",
      canSendInvite: false,
      canResendInvite: false,
      canCopyInviteLink: false,
      canResetPin: true,
      canSuspendAccess: true,
      canRevokeAccess: true,
    },
    blockers: [
      {
        id: "missing_documents",
        label: "Missing documents",
        description: "Required compliance documents are missing or expired.",
        href: "/fi-admin/tenant-abc/hr-os/onboarding#compliance",
      },
    ],
    actionContext: baseActionContext,
  });

  assert.ok(menu.actions.some((a) => a.id === "open_documents"));
  assert.ok(menu.actions.some((a) => a.id === "assign_training"));
});

test("Action menu: dangerous actions include confirmation copy", () => {
  const menu = resolveStaffProfileActionMenu({
    tenantId: TENANT,
    staffMemberId: STAFF_MEMBER,
    employmentStatus: "active",
    email: "staff@clinic.com",
    systemAccessRevoked: false,
    onboardingInviteStatus: "accepted",
    hasOnboardingInviteUrl: false,
    checklist: {
      accountCreated: true,
      pinChosen: true,
      permissionsAssigned: true,
      trainingPending: false,
    },
    accessRow: {
      authLoginStatus: "login_active",
      inviteStatus: "accepted",
      pinStatus: "Active",
      canSendInvite: false,
      canResendInvite: false,
      canCopyInviteLink: false,
      canResetPin: true,
      canSuspendAccess: true,
      canRevokeAccess: true,
    },
    blockers: [],
    actionContext: baseActionContext,
  });

  const suspend = menu.actions.find((a) => a.id === "suspend_access");
  const revoke = menu.actions.find((a) => a.id === "revoke_access");
  assert.ok(suspend?.confirmTitle);
  assert.ok(revoke?.confirmTitle);
  assert.equal(suspend?.actionKind, "danger");
});

test("staff on maternity leave shows leave status instead of roster eligible", () => {
  const maternityBlock = {
    id: "block-1",
    block_type: "maternity_leave" as const,
    starts_at: "2026-07-01T00:00:00.000Z",
    ends_at: "2026-12-31T23:59:59.999Z",
    status: "active",
    reason: "maternity_leave",
  };

  const overview = buildStaffProfileOverviewModel({
    tenantId: TENANT,
    staffMemberId: STAFF_MEMBER,
    fiStaffId: "fi-staff-1",
    staffName: "Anita Katherine Cottee",
    employmentStatus: "on_leave",
    archivedAt: null,
    email: "anita@clinic.com",
    systemAccessRevoked: false,
    onboardingInviteStatus: "accepted",
    hasOnboardingInviteUrl: false,
    checklist: {
      accountCreated: true,
      pinChosen: false,
      permissionsAssigned: true,
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
      complianceStatus: "current",
      trainingRequiredCount: 2,
      trainingProgressLabel: "2 required",
      nextShiftLabel: "Mon 8 Jul · 09:00",
      surgeryReady: false,
    },
    identityAuditRow: null,
    leaveContext: {
      availabilityBlocks: [maternityBlock],
      futureShifts: [
        {
          id: "shift-1",
          starts_at: "2026-09-01T09:00:00.000Z",
          ends_at: "2026-09-01T17:00:00.000Z",
          status: "scheduled",
        },
      ],
    },
  });

  assert.match(overview.unifiedStatus.employmentLabel, /maternity leave until/i);
  assert.equal(overview.unifiedStatus.rosterLabel, "On maternity leave");
  assert.equal(overview.unifiedStatus.trainingLabel, null);
  assert.ok(overview.blockers.some((b) => b.id === "future_shifts_during_leave"));
  assert.ok(overview.actionMenu.actions.some((a) => a.id === "manage_leave"));
  const rosterStage = overview.progressStages.find((s) => s.id === "roster_eligible");
  assert.equal(rosterStage?.label, "On maternity leave");
  assert.equal(rosterStage?.status, "blocked");
});
