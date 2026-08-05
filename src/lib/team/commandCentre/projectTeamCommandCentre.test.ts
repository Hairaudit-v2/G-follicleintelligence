/**
 * Team Command Centre composition tests (FI-TEAM-COHESION-B1.7).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { projectStaffAccessEntry } from "@/src/lib/team/access";
import { projectStaffComplianceEntry } from "@/src/lib/team/compliance";
import type { StaffIdentity } from "@/src/lib/team/identity/types";
import { projectStaffOnboardingEntry } from "@/src/lib/team/onboarding";
import { projectRosterStaffEntry } from "@/src/lib/team/roster";
import {
  buildCommandCentreDomainHrefs,
  composeAttentionQueue,
  composeCommandCentreKpis,
  dedupeIdentitiesByPersonKey,
  deriveCommandCentreActionFlags,
  isCommandCentreIdentityUnsafe,
  isInWorkforceHeadcount,
  projectCommandCentreStaffSummary,
} from "@/src/lib/team/commandCentre";
import { STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST } from "@/src/lib/team/identity/staffIdentityDualTableAllowlist";
import { mapTeamAttentionToLegacyQueue } from "@/src/lib/team/commandCentre/adaptCommandCentrePage";
import { WORKFORCE_COMMAND_CENTRE_KPI_SOURCE_SNAPSHOT } from "@/src/lib/workforce/workforceCommandCentreCore";

const TENANT = "11111111-1111-1111-1111-111111111111";

function identity(overrides: Partial<StaffIdentity> = {}): StaffIdentity {
  const base: StaffIdentity = {
    tenantId: TENANT,
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

function composeOne(id: StaffIdentity) {
  const hrefs = buildCommandCentreDomainHrefs(TENANT);
  return projectCommandCentreStaffSummary({
    identity: id,
    access: projectStaffAccessEntry(id, accessFacts),
    onboarding: projectStaffOnboardingEntry(id, onboardingFacts),
    roster: projectRosterStaffEntry(id, {
      domainEligible: true,
      schedulingActive: true,
    }),
    compliance: projectStaffComplianceEntry(id, {
      credentials: [],
      certifications: [],
      canUpload: true,
      canVerify: true,
      canReject: true,
      canRequestReplacement: true,
    }),
    hrefs,
  });
}

test("linked staff produce equivalent domain summaries without inventing sections", () => {
  const summary = composeOne(identity());
  assert.equal(summary.identity.personKey, "sm:44444444-4444-4444-4444-444444444444");
  assert.ok(summary.directory);
  assert.ok(summary.access);
  assert.ok(summary.onboarding);
  assert.ok(summary.roster);
  assert.ok(summary.compliance);
  assert.equal(summary.readinessStatus, "ready");
});

test("scheduling-only staff remain visible with lifecycle attention", () => {
  const id = identity({
    personKey: "fs:33333333-3333-3333-3333-333333333333",
    staffMemberId: null,
    integrity: {
      linkStatus: "scheduling_only",
      hasSchedulingRecord: true,
      hasLifecycleRecord: false,
      hasAuthIdentity: true,
      warnings: [],
    },
  });
  const hrefs = buildCommandCentreDomainHrefs(TENANT);
  const summary = projectCommandCentreStaffSummary({
    identity: id,
    access: null,
    onboarding: null,
    roster: projectRosterStaffEntry(id, {
      domainEligible: false,
      schedulingActive: true,
    }),
    compliance: null,
    hrefs,
  });
  assert.ok(isInWorkforceHeadcount(summary));
  assert.ok(summary.roster);
  assert.equal(summary.onboarding, null);
  assert.ok(
    summary.attentionReasons.some((r) => r.code === "lifecycle_record_missing")
  );
});

test("lifecycle-only onboarding records appear in the attention queue", () => {
  const id = identity({
    personKey: "sm:66666666-6666-6666-6666-666666666666",
    staffId: null,
    staffMemberId: "66666666-6666-6666-6666-666666666666",
    employmentStatus: "pending_onboarding",
    accessStatus: "invite_pending",
    readinessStatus: "watch",
    integrity: {
      linkStatus: "lifecycle_only",
      hasSchedulingRecord: false,
      hasLifecycleRecord: true,
      hasAuthIdentity: false,
      warnings: [],
    },
  });
  const hrefs = buildCommandCentreDomainHrefs(TENANT);
  const summary = projectCommandCentreStaffSummary({
    identity: id,
    access: projectStaffAccessEntry(id, {
      ...accessFacts,
      authLoginStatus: "invite_pending",
      inviteStatus: "pending",
      canSendInvite: false,
      canResendInvite: true,
      canSuspendAccess: false,
      canRevokeAccess: false,
    }),
    onboarding: projectStaffOnboardingEntry(id, {
      ...onboardingFacts,
      onboardingInviteStatus: "pending",
      checklist: {
        accountCreated: false,
        pinChosen: false,
        permissionsAssigned: false,
        trainingPending: true,
      },
      canResendInvite: true,
      canSendInvite: false,
      canCopyInviteLink: true,
    }),
    roster: null,
    compliance: projectStaffComplianceEntry(id, {
      credentials: [],
      certifications: [],
      canUpload: false,
      canVerify: false,
      canReject: false,
      canRequestReplacement: false,
    }),
    hrefs,
  });

  assert.equal(summary.roster, null);
  assert.ok(summary.onboarding);
  const queue = composeAttentionQueue({
    staff: [summary],
    identitiesByPersonKey: new Map([[id.personKey, id]]),
  });
  assert.ok(queue.some((q) => q.source === "onboarding" || q.source === "identity"));
  assert.ok(queue.some((q) => q.personKey === id.personKey));
});

test("ambiguous identities create reconciliation attention and suppress unsafe actions", () => {
  const id = identity({
    integrity: {
      linkStatus: "ambiguous",
      hasSchedulingRecord: true,
      hasLifecycleRecord: true,
      hasAuthIdentity: true,
      warnings: [],
    },
  });
  const summary = composeOne(id);
  assert.ok(
    summary.attentionReasons.some((r) => r.code === "identity_requires_reconciliation")
  );
  assert.equal(isCommandCentreIdentityUnsafe(id), true);
  assert.equal(deriveCommandCentreActionFlags(id).suppressUnsafeActions, true);

  const queue = composeAttentionQueue({
    staff: [summary],
    identitiesByPersonKey: new Map([[id.personKey, id]]),
  });
  const recon = queue.find((q) => q.reasonCode === "identity_requires_reconciliation");
  assert.ok(recon);
  assert.equal(recon?.actionAllowed, false);
});

test("cross-tenant identities cannot produce normal action links and are excluded from headcount", () => {
  const id = identity({
    integrity: {
      linkStatus: "cross_tenant_mismatch",
      hasSchedulingRecord: true,
      hasLifecycleRecord: true,
      hasAuthIdentity: true,
      warnings: [],
    },
  });
  const summary = composeOne(id);
  assert.equal(isInWorkforceHeadcount(summary), false);
  assert.ok(summary.attentionReasons.some((r) => r.code === "cross_tenant_mismatch"));

  const queue = composeAttentionQueue({
    staff: [summary],
    identitiesByPersonKey: new Map([[id.personKey, id]]),
  });
  const item = queue.find((q) => q.reasonCode === "cross_tenant_mismatch");
  assert.ok(item);
  assert.equal(item?.actionAllowed, false);
});

test("attention source and severity are preserved from profile contract", () => {
  const id = identity();
  const summary = composeOne(id);
  // Force a compliance attention via expired-style reason by crafting compliance entry
  // with empty credentials — attention may be empty; use identity missing auth fixture.
  const missingAuth = identity({
    integrity: {
      linkStatus: "linked",
      hasSchedulingRecord: true,
      hasLifecycleRecord: true,
      hasAuthIdentity: false,
      warnings: [],
    },
  });
  const summary2 = composeOne(missingAuth);
  const missing = summary2.attentionReasons.find((r) => r.code === "missing_auth_identity");
  assert.ok(missing);
  assert.equal(missing?.source, "identity");
  assert.equal(missing?.severity, "info");
  assert.ok(summary.identity);
});

test("KPI parity: headcount excludes terminated and cross-tenant; no dual-id duplicates", () => {
  const linked = identity();
  const terminated = identity({
    personKey: "sm:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    staffMemberId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    employmentStatus: "terminated",
  });
  const cross = identity({
    personKey: "sm:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    staffMemberId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    integrity: {
      linkStatus: "cross_tenant_mismatch",
      hasSchedulingRecord: true,
      hasLifecycleRecord: true,
      hasAuthIdentity: true,
      warnings: [],
    },
  });
  const dualSamePerson = [
    linked,
    identity({
      // Same person resolved under both keys previously — same personKey after normalise
      personKey: linked.personKey,
    }),
  ];
  assert.equal(dedupeIdentitiesByPersonKey(dualSamePerson).length, 1);

  const staff = [linked, terminated, cross].map(composeOne);
  const kpis = composeCommandCentreKpis(staff);
  assert.equal(kpis.totalStaff, 1);
  assert.equal(kpis.crossTenantIntegrityIssues, 1);
  assert.equal(kpis.activeStaff, 1);
});

test("deep links use canonical Team destinations", () => {
  const hrefs = buildCommandCentreDomainHrefs(TENANT);
  assert.match(hrefs.access, /\/team\/identity$/);
  assert.match(hrefs.onboarding, /\/team\/onboarding$/);
  assert.match(hrefs.roster, /\/team\/roster/);
  assert.match(hrefs.compliance, /\/team\/compliance$/);
  assert.match(hrefs.identityAudit, /identity-audit/);
  const profile = hrefs.profileFor({
    staffId: "33333333-3333-3333-3333-333333333333",
    staffMemberId: "44444444-4444-4444-4444-444444444444",
  });
  assert.ok(profile);
  assert.match(profile!, /\/workforce-os\/staff\/44444444/);

  const legacy = mapTeamAttentionToLegacyQueue(
    [
      {
        personKey: "sm:1",
        displayName: "Ada",
        source: "access",
        reasonCode: "missing_auth_identity",
        severity: "info",
        label: "No auth user linked yet",
        href: hrefs.access,
        actionAllowed: true,
      },
    ],
    TENANT
  );
  assert.equal(legacy[0]?.href, hrefs.access);
  assert.match(legacy[0]?.title ?? "", /Ada:/);
});

test("KPI source snapshot documents behaviour-neutral replacements", () => {
  assert.equal(WORKFORCE_COMMAND_CENTRE_KPI_SOURCE_SNAPSHOT.totalStaff.definitionChanges, false);
  assert.equal(
    WORKFORCE_COMMAND_CENTRE_KPI_SOURCE_SNAPSHOT.openRecruitment.definitionChanges,
    false
  );
});

test("architecture: commandCentre loader uses batch identity + domain projects; no profile N+1", () => {
  const loader = readFileSync(
    "src/lib/team/commandCentre/loadTeamCommandCentre.server.ts",
    "utf8"
  );
  assert.match(loader, /resolveStaffIdentities/);
  assert.match(loader, /projectStaffAccessEntry|projectStaffOnboardingEntry/);
  assert.match(loader, /projectRosterStaffEntry/);
  assert.match(loader, /projectStaffComplianceEntry/);
  assert.doesNotMatch(loader, /loadStaffProfileHub/);
  assert.doesNotMatch(loader, /identity\/internal/);

  const page = readFileSync(
    "src/lib/workforce/workforceCommandCentrePage.server.ts",
    "utf8"
  );
  assert.match(page, /loadTeamCommandCentre/);
  assert.match(page, /adaptTeamCommandCentreToPageData/);
  assert.doesNotMatch(page, /loadWorkforceOsDirectoryPage/);
  assert.doesNotMatch(page, /resolveCanonicalStaffLifecycleStatus/);
});

test("architecture: dual-table allowlist continues to shrink after B2.2c onboarding move", () => {
  assert.equal(STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST.length, 12);
  assert.ok(
    !(STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST as readonly string[]).includes(
      "src/lib/workforce/identityReconciliation.server.ts"
    )
  );
  assert.ok(
    !(STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST as readonly string[]).includes(
      "src/lib/fiOs/fiOsAuthDisplay.server.ts"
    )
  );
  assert.ok(
    !(STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST as readonly string[]).includes(
      "src/lib/workforce/staffAccessAccept.server.ts"
    )
  );
  assert.ok(
    !(STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST as readonly string[]).includes(
      "src/lib/workforce/staffAccessPinLayer.server.ts"
    )
  );
  assert.ok(
    !(STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST as readonly string[]).includes(
      "src/lib/workforce/onboarding/onboardingInvitation.server.ts"
    )
  );
  assert.ok(
    (STAFF_IDENTITY_DUAL_TABLE_ALLOWLIST as readonly string[]).includes(
      "src/lib/workforce/staffTenantLinkRepair.server.ts"
    )
  );
});
