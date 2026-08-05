/**
 * Staff Profile Hub composition tests (FI-TEAM-COHESION-B1.6).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { projectStaffAccessEntry } from "@/src/lib/team/access";
import { projectStaffComplianceEntry } from "@/src/lib/team/compliance";
import type { StaffIdentity } from "@/src/lib/team/identity/types";
import { projectStaffOnboardingEntry } from "@/src/lib/team/onboarding";
import {
  composeStaffProfileHubModel,
  deriveStaffProfileActionFlags,
  deriveStaffProfileAttentionReasons,
  isStaffProfileIdentityReadOnly,
  toStaffProfileOverviewModel,
} from "@/src/lib/team/profile";
import { projectRosterStaffEntry } from "@/src/lib/team/roster";

function identity(overrides: Partial<StaffIdentity> = {}): StaffIdentity {
  const base: StaffIdentity = {
    tenantId: "11111111-1111-1111-1111-111111111111",
    personKey: "sm:44444444-4444-4444-4444-444444444444",
    staffId: "33333333-3333-3333-3333-333333333333",
    staffMemberId: "44444444-4444-4444-4444-444444444444",
    userId: "55555555-5555-5555-5555-555555555555",
    displayName: "Ada Lovelace",
    email: "ada@example.com",
    employmentStatus: "active",
    accessStatus: "login_active",
    readinessStatus: "ready",
    archivedAt: null,
    hrLinked: false,
    primaryClinicId: "clinic-1",
    clinicIds: ["clinic-1"],
    roles: ["nurse"],
    capabilities: [],
    integrity: {
      linkStatus: "linked",
      hasSchedulingRecord: true,
      hasLifecycleRecord: true,
      hasAuthIdentity: true,
      warnings: [],
    },
  };
  return {
    ...base,
    ...overrides,
    integrity: {
      ...base.integrity,
      ...(overrides.integrity ?? {}),
    },
  };
}

const accessFacts = {
  authLoginStatus: "login_active" as const,
  inviteStatus: "accepted" as const,
  loginInviteId: null,
  loginInviteExpiresAt: null,
  canSendInvite: false,
  canResendInvite: false,
  canSuspendAccess: true,
  canRevokeAccess: true,
};

const onboardingFacts = {
  onboardingInviteId: "inv-1",
  onboardingInviteStatus: "accepted" as const,
  onboardingInviteExpiresAt: null,
  checklist: {
    accountCreated: true,
    pinChosen: true,
    permissionsAssigned: true,
    trainingPending: false,
  },
  systemAccessRevoked: false,
  canSendInvite: false,
  canResendInvite: false,
  canCopyInviteLink: false,
  canCancelOnboarding: false,
};

test("linked identity produces all expected profile sections", () => {
  const id = identity();
  const access = projectStaffAccessEntry(id, accessFacts);
  const onboarding = projectStaffOnboardingEntry(id, onboardingFacts);
  const roster = projectRosterStaffEntry(id, {
    domainEligible: true,
    schedulingActive: true,
  });
  const compliance = projectStaffComplianceEntry(id, {
    credentials: [],
    certifications: [],
    canUpload: true,
    canVerify: true,
    canReject: true,
    canRequestReplacement: true,
  });

  const profile = composeStaffProfileHubModel({
    identity: id,
    access,
    onboarding,
    roster,
    compliance,
  });

  assert.equal(profile.directory?.displayName, "Ada Lovelace");
  assert.ok(profile.access);
  assert.ok(profile.onboarding);
  assert.ok(profile.roster);
  assert.ok(profile.compliance);
  assert.equal(profile.overview.accessStatus, "login_active");
  assert.equal(profile.overview.onboardingStatus, "completed");
  assert.equal(profile.actions.identity.readOnly, false);
});

test("scheduling-only profile remains accessible with identity attention", () => {
  const id = identity({
    staffMemberId: null,
    personKey: "fs:33333333-3333-3333-3333-333333333333",
    employmentStatus: "active",
    accessStatus: "no_login",
    readinessStatus: "watch",
    integrity: {
      linkStatus: "scheduling_only",
      hasSchedulingRecord: true,
      hasLifecycleRecord: false,
      hasAuthIdentity: false,
      warnings: [{ code: "missing_lifecycle_record", message: "No lifecycle record" }],
    },
  });

  const roster = projectRosterStaffEntry(id, {
    domainEligible: true,
    schedulingActive: true,
  });
  const profile = composeStaffProfileHubModel({
    identity: id,
    access: projectStaffAccessEntry(id, {
      ...accessFacts,
      authLoginStatus: "no_login",
      inviteStatus: "none",
      canSuspendAccess: false,
      canRevokeAccess: false,
    }),
    onboarding: null,
    roster,
    compliance: null,
  });

  assert.ok(profile.roster);
  assert.equal(profile.onboarding, null);
  assert.equal(profile.compliance, null);
  assert.ok(
    profile.attentionReasons.some(
      (r) => r.source === "identity" && r.code === "lifecycle_record_missing"
    )
  );
  assert.equal(profile.actions.identity.readOnly, false);
});

test("lifecycle-only profile shows onboarding/access/compliance but no invented roster", () => {
  const id = identity({
    staffId: null,
    personKey: "sm:44444444-4444-4444-4444-444444444444",
    employmentStatus: "pending_onboarding",
    accessStatus: "no_login",
    readinessStatus: "watch",
    integrity: {
      linkStatus: "lifecycle_only",
      hasSchedulingRecord: false,
      hasLifecycleRecord: true,
      hasAuthIdentity: false,
      warnings: [{ code: "missing_scheduling_record", message: "No scheduling record" }],
    },
  });

  const roster = projectRosterStaffEntry(id, {
    domainEligible: false,
    schedulingActive: false,
  });
  assert.equal(roster, null);

  const profile = composeStaffProfileHubModel({
    identity: id,
    access: projectStaffAccessEntry(id, {
      ...accessFacts,
      authLoginStatus: "no_login",
      inviteStatus: "none",
      canSendInvite: true,
      canSuspendAccess: false,
      canRevokeAccess: false,
    }),
    onboarding: projectStaffOnboardingEntry(id, {
      ...onboardingFacts,
      onboardingInviteStatus: "none",
      onboardingInviteId: null,
      checklist: {
        accountCreated: true,
        pinChosen: false,
        permissionsAssigned: false,
        trainingPending: true,
      },
      canSendInvite: true,
    }),
    roster: null,
    compliance: projectStaffComplianceEntry(id, {
      credentials: [],
      certifications: [],
      canUpload: true,
      canVerify: true,
      canReject: true,
      canRequestReplacement: true,
    }),
  });

  assert.equal(profile.roster, null);
  assert.ok(profile.onboarding);
  assert.ok(profile.access);
  assert.ok(profile.compliance);
  assert.equal(profile.actions.identity.canCreateSchedulingRecord, true);
});

test("ambiguous identity is read-only and suppresses unsafe domain actions", () => {
  const id = identity({
    integrity: {
      linkStatus: "ambiguous",
      hasSchedulingRecord: true,
      hasLifecycleRecord: true,
      hasAuthIdentity: true,
      warnings: [{ code: "multiple_lifecycle_candidates", message: "Ambiguous" }],
    },
  });

  assert.equal(isStaffProfileIdentityReadOnly(id), true);
  assert.equal(deriveStaffProfileActionFlags(id).identity.readOnly, true);

  const access = projectStaffAccessEntry(id, {
    ...accessFacts,
    canSuspendAccess: true,
    canRevokeAccess: true,
  });
  assert.equal(access.canSuspend, false);
  assert.equal(access.canRevoke, false);

  const profile = composeStaffProfileHubModel({
    identity: id,
    access,
    onboarding: projectStaffOnboardingEntry(id, {
      ...onboardingFacts,
      canSendInvite: true,
      canResendInvite: true,
    }),
    roster: projectRosterStaffEntry(id, { domainEligible: true, schedulingActive: true }),
    compliance: projectStaffComplianceEntry(id, {
      credentials: [],
      certifications: [],
      canUpload: true,
      canVerify: true,
      canReject: true,
      canRequestReplacement: true,
    }),
  });

  assert.equal(profile.actions.identity.readOnly, true);
  assert.equal(profile.onboarding?.actions.canSendOnboardingInvite, false);
  assert.equal(profile.compliance?.actions.canUploadCredential, false);
  assert.equal(profile.roster?.actions.canBeRostered, false);
});

test("domain attention reasons retain source and severity", () => {
  const id = identity({
    integrity: {
      linkStatus: "lifecycle_only",
      hasSchedulingRecord: false,
      hasLifecycleRecord: true,
      hasAuthIdentity: false,
      warnings: [],
    },
    staffId: null,
    accessStatus: "no_login",
  });

  const reasons = deriveStaffProfileAttentionReasons({
    identity: id,
    access: projectStaffAccessEntry(id, {
      ...accessFacts,
      authLoginStatus: "no_login",
      canSendInvite: false,
      canSuspendAccess: false,
      canRevokeAccess: false,
    }),
    onboarding: projectStaffOnboardingEntry(id, {
      ...onboardingFacts,
      onboardingInviteStatus: "expired",
      canResendInvite: true,
    }),
    roster: null,
    compliance: projectStaffComplianceEntry(id, {
      credentials: [
        {
          id: "c1",
          staffMemberId: id.staffMemberId!,
          credentialType: "ahpra",
          credentialKey: "ahpra",
          displayName: "AHPRA",
          issuingBody: null,
          credentialNumber: null,
          issuedAt: null,
          expiresAt: "2020-01-01",
          status: "expired",
          reminderSent: false,
          blocksClinicalWork: true,
        },
      ],
      certifications: [],
      canUpload: true,
      canVerify: true,
      canReject: true,
      canRequestReplacement: true,
    }),
  });

  const identityReason = reasons.find((r) => r.source === "identity");
  const onboardingReason = reasons.find((r) => r.source === "onboarding");
  const complianceReason = reasons.find(
    (r) => r.source === "compliance" && r.code === "credentials_expired"
  );

  assert.ok(identityReason);
  assert.equal(identityReason?.severity, "warning");
  assert.ok(onboardingReason);
  assert.equal(onboardingReason?.source, "onboarding");
  assert.ok(complianceReason);
  assert.equal(complianceReason?.severity, "blocking");
  assert.equal(complianceReason?.source, "compliance");
});

test("overview adapter preserves employment vs login access distinction", () => {
  const id = identity({
    employmentStatus: "active",
    accessStatus: "suspended",
  });
  const access = projectStaffAccessEntry(id, {
    ...accessFacts,
    authLoginStatus: "suspended",
    canSuspendAccess: false,
  });
  const profile = composeStaffProfileHubModel({
    identity: id,
    access,
    onboarding: projectStaffOnboardingEntry(id, onboardingFacts),
    roster: projectRosterStaffEntry(id, { domainEligible: true, schedulingActive: true }),
    compliance: null,
  });

  const overview = toStaffProfileOverviewModel({
    profile,
    tenantId: id.tenantId,
    checklist: onboardingFacts.checklist,
    systemAccessRevoked: true,
    pinStatus: "Active",
    loginInviteStatus: "accepted",
    viewerCanManageAccess: true,
    viewerCanManageOnboarding: true,
  });

  assert.match(overview.unifiedStatus.employmentLabel, /active/i);
  assert.equal(overview.unifiedStatus.isAccessSuspended, true);
  assert.equal(overview.unifiedStatus.loginStatus, "suspended");
  assert.ok(overview.domainActions?.access);
  assert.equal(overview.domainActions?.access?.canSuspend, false);
  assert.equal(overview.domainActions?.identity?.readOnly, false);
});

test("profile module does not import identity/internal or raw dual-table joins", () => {
  const files = [
    "src/lib/team/profile/types.ts",
    "src/lib/team/profile/staffProfileAttentionReasons.ts",
    "src/lib/team/profile/staffProfileActionFlags.ts",
    "src/lib/team/profile/projectStaffProfileOverview.ts",
    "src/lib/team/profile/loadStaffProfileHub.server.ts",
    "src/lib/team/profile/index.ts",
    "src/lib/team/profile/server.ts",
    "src/lib/workforce/staffProfileHub.server.ts",
  ];

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(src, /team\/identity\/internal/);
    assert.doesNotMatch(src, /workforceIdentityLinks/);
  }

  const loader = readFileSync("src/lib/team/profile/loadStaffProfileHub.server.ts", "utf8");
  assert.match(loader, /resolveStaffIdentity/);
  assert.match(loader, /projectStaffAccessEntry/);
  assert.match(loader, /projectStaffOnboardingEntry/);
  assert.match(loader, /projectRosterStaffEntry/);
  assert.match(loader, /projectStaffComplianceEntry/);
  assert.match(loader, /Query budget/);

  const compat = readFileSync("src/lib/workforce/staffProfileHub.server.ts", "utf8");
  assert.match(compat, /loadStaffProfileHubBundle/);
  assert.doesNotMatch(compat, /runStaffIdentityReadinessAuditForMember/);
  assert.doesNotMatch(compat, /toStaffProfileHubIdentityGate/);
});
