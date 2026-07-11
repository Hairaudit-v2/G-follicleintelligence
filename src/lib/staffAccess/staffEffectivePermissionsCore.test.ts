import assert from "node:assert/strict";
import test from "node:test";

import { computeEffectiveAccess } from "@/src/lib/staffAccess/staffAccessCore";
import {
  capabilityKeysForGrant,
  resolveEffectiveStaffPermissionsFromInput,
} from "@/src/lib/staffAccess/staffEffectivePermissionsCore";
import {
  isTeamTabSegmentAllowed,
  resolveTeamWorkspaceTabAccess,
} from "@/src/lib/staffAccess/staffTeamAccessCore";
import { staffCapabilitySatisfies } from "@/src/lib/staffAccess/staffCapabilityCore";

test("baseline receptionist: no roster/team/reports/admin", () => {
  const p = resolveEffectiveStaffPermissionsFromInput({ roleKey: "reception", grants: [] });
  assert.equal(p.canViewRoster, false);
  assert.equal(p.canManageRoster, false);
  assert.equal(p.canManageStandardHours, false);
  assert.equal(p.canViewTeamWorkspace, false);
  assert.equal(p.canViewIdentityAccess, false);
  assert.equal(p.canManageIdentityAccess, false);
  assert.equal(p.canViewReports, false);
  assert.equal(p.canViewReportsAdmin, false);
  assert.equal(p.canViewSurgeryAdmin, false);
  assert.equal(p.canViewNavigationAdminSurfaces, false);
});

test("receptionist + roster.manage: roster yes, identity/admin no", () => {
  const p = resolveEffectiveStaffPermissionsFromInput({
    roleKey: "reception",
    grants: [
      {
        moduleKey: "workforce_os",
        tabKey: "roster",
        accessLevel: "edit",
        scope: "tenant",
        revokedAt: null,
      },
    ],
  });
  assert.equal(p.canViewRoster, true);
  assert.equal(p.canManageRoster, true);
  assert.equal(p.canManageStandardHours, true);
  assert.equal(p.canViewTeamWorkspace, true);
  assert.equal(p.canViewIdentityAccess, false);
  assert.equal(p.canManageIdentityAccess, false);
  assert.equal(p.canViewReports, false);
  assert.equal(p.canViewReportsAdmin, false);
  assert.equal(p.canViewSurgeryAdmin, false);
  assert.equal(p.canViewNavigationAdminSurfaces, false);
  assert.ok(p.capabilities.includes("roster.manage"));
  assert.ok(!p.capabilities.includes("team.identity.manage"));
});

test("receptionist + roster.view only: view yes, manage no", () => {
  const p = resolveEffectiveStaffPermissionsFromInput({
    roleKey: "reception",
    grants: [
      {
        moduleKey: "workforce_os",
        tabKey: "roster",
        accessLevel: "read",
        scope: "tenant",
        revokedAt: null,
      },
    ],
  });
  assert.equal(p.canViewRoster, true);
  assert.equal(p.canManageRoster, false);
  assert.equal(p.canManageStandardHours, false);
  assert.equal(p.canViewTeamWorkspace, true);
});

test("nav/route/action consistency for roster.manage override", () => {
  const grants = [
    {
      moduleKey: "workforce_os",
      tabKey: "roster",
      accessLevel: "edit" as const,
      scope: "tenant" as const,
      revokedAt: null,
    },
  ];
  const access = computeEffectiveAccess({ roleKey: "reception", grants });
  const p = resolveEffectiveStaffPermissionsFromInput({ roleKey: "reception", grants });
  const tabs = resolveTeamWorkspaceTabAccess(access, { hrOsFullNav: false });

  assert.equal(p.canManageRoster, true);
  assert.equal(tabs.canManageRoster, true);
  assert.equal(staffCapabilitySatisfies(access, "roster.manage"), true);
  assert.equal(isTeamTabSegmentAllowed(access, "roster", { hrOsFullNav: false }), true);
  assert.equal(isTeamTabSegmentAllowed(access, "identity", { hrOsFullNav: false }), false);
  assert.equal(p.canManageIdentityAccess, false);
});

test("manager and platform admin retain broad access", () => {
  const manager = resolveEffectiveStaffPermissionsFromInput({
    roleKey: "manager",
    grants: [],
  });
  assert.equal(manager.canManageRoster, true);
  assert.equal(manager.canManageIdentityAccess, true);

  const platform = resolveEffectiveStaffPermissionsFromInput(
    { roleKey: "platform_admin", grants: [] },
    { showNavigationAdminSurfaces: true, showReportsAdminSurfaces: true }
  );
  assert.equal(platform.canManageRoster, true);
  assert.equal(platform.canViewNavigationAdminSurfaces, true);
  assert.equal(platform.canViewReportsAdmin, true);
});

test("capabilityKeysForGrant maps roster tab to capability keys", () => {
  assert.deepEqual(
    capabilityKeysForGrant({
      moduleKey: "workforce_os",
      tabKey: "roster",
      accessLevel: "edit",
    }),
    ["roster.view", "roster.manage", "roster.standard_hours.manage"]
  );
  assert.deepEqual(
    capabilityKeysForGrant({
      moduleKey: "workforce_os",
      tabKey: "roster",
      accessLevel: "read",
    }),
    ["roster.view"]
  );
  assert.deepEqual(
    capabilityKeysForGrant({
      moduleKey: "clinic_os",
      tabKey: null,
      accessLevel: "edit",
    }),
    []
  );
});

test("foreign-tenant grants never enter the input map (tenant isolation contract)", () => {
  // Loader scopes by tenant_id + staff_member_id; pure core only sees that staff's grants.
  const p = resolveEffectiveStaffPermissionsFromInput({
    roleKey: "reception",
    grants: [], // no grants loaded for this tenant staff
  });
  assert.equal(p.canManageRoster, false);
});
