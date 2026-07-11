import assert from "node:assert/strict";
import test from "node:test";

import { buildTeamSidebarSubItems } from "@/src/lib/fiOs/team/teamWorkspaceCore";
import {
  computeEffectiveAccess,
  computeStaffAccessNavFeatureOverrides,
  type StaffAccessGrantInput,
} from "@/src/lib/staffAccess/staffAccessCore";
import {
  isTeamTabSegmentAllowed,
  resolveTeamWorkspaceTabAccess,
} from "@/src/lib/staffAccess/staffTeamAccessCore";

const tenantId = "t-capability-override-1";

function grant(
  partial: Partial<StaffAccessGrantInput> & { moduleKey: string }
): StaffAccessGrantInput {
  return {
    tabKey: null,
    accessLevel: "read",
    scope: "tenant",
    revokedAt: null,
    ...partial,
  };
}

test("receptionist with roster.manage sees Team/Roster nav only", () => {
  const access = computeEffectiveAccess({
    roleKey: "reception",
    grants: [
      grant({ moduleKey: "workforce_os", tabKey: "roster", accessLevel: "edit" }),
    ],
  });

  const tabAccess = resolveTeamWorkspaceTabAccess(access, { hrOsFullNav: false });
  assert.deepEqual(tabAccess.visibleTabIds, ["staff", "roster"]);
  assert.equal(tabAccess.canManageRoster, true);
  assert.equal(tabAccess.canManageIdentity, false);

  const subs = buildTeamSidebarSubItems(tenantId, {
    visibleTabIds: tabAccess.visibleTabIds,
  });
  const labels = subs.map((s) => s.label);
  assert.ok(labels.some((l) => l === "Roster"));
  assert.ok(!labels.some((l) => l === "Identity & access"));
  assert.ok(!labels.some((l) => /identity audit/i.test(l)));
});

test("receptionist with roster.view only sees roster tab but cannot manage", () => {
  const access = computeEffectiveAccess({
    roleKey: "reception",
    grants: [
      grant({ moduleKey: "workforce_os", tabKey: "roster", accessLevel: "read" }),
    ],
  });
  const tabAccess = resolveTeamWorkspaceTabAccess(access, { hrOsFullNav: false });
  assert.ok(tabAccess.visibleTabIds.includes("roster"));
  assert.equal(tabAccess.canManageRoster, false);
  assert.equal(tabAccess.canManageStandardHours, false);
  assert.equal(isTeamTabSegmentAllowed(access, "identity", { hrOsFullNav: false }), false);
});

test("receptionist with roster.manage enables staff nav feature override", () => {
  const access = computeEffectiveAccess({
    roleKey: "reception",
    grants: [
      grant({ moduleKey: "workforce_os", tabKey: "roster", accessLevel: "edit" }),
    ],
  });
  const overrides = computeStaffAccessNavFeatureOverrides(access);
  assert.equal(overrides.staff, undefined);
});

test("receptionist without override keeps staff nav blocked", () => {
  const access = computeEffectiveAccess({ roleKey: "reception", grants: [] });
  const overrides = computeStaffAccessNavFeatureOverrides(access);
  assert.equal(overrides.staff, false);
});

test("receptionist with roster.manage cannot access identity tab segment", () => {
  const access = computeEffectiveAccess({
    roleKey: "reception",
    grants: [
      grant({ moduleKey: "workforce_os", tabKey: "roster", accessLevel: "edit" }),
    ],
  });
  assert.equal(isTeamTabSegmentAllowed(access, "roster", { hrOsFullNav: false }), true);
  assert.equal(isTeamTabSegmentAllowed(access, "identity", { hrOsFullNav: false }), false);
});

test("manager without hrOsFullNav sees staff, roster, and identity tabs", () => {
  const access = computeEffectiveAccess({ roleKey: "manager", grants: [] });
  const tabAccess = resolveTeamWorkspaceTabAccess(access, { hrOsFullNav: false });
  assert.deepEqual(tabAccess.visibleTabIds, ["staff", "roster", "identity"]);
  assert.ok(!tabAccess.visibleTabIds.includes("overview"));
  assert.ok(!tabAccess.visibleTabIds.includes("onboarding"));
  assert.equal(tabAccess.canManageRoster, true);
  assert.equal(tabAccess.canManageIdentity, true);
  assert.equal(isTeamTabSegmentAllowed(access, "overview", { hrOsFullNav: false }), false);
  assert.equal(isTeamTabSegmentAllowed(access, "roster", { hrOsFullNav: false }), true);
  assert.equal(isTeamTabSegmentAllowed(access, "identity", { hrOsFullNav: false }), true);
});

test("manager hrOsFullNav retains full team tab set", () => {
  const access = computeEffectiveAccess({ roleKey: "manager", grants: [] });
  const tabAccess = resolveTeamWorkspaceTabAccess(access, { hrOsFullNav: true });
  assert.ok(tabAccess.visibleTabIds.includes("roster"));
  assert.ok(tabAccess.visibleTabIds.includes("identity"));
  assert.ok(tabAccess.visibleTabIds.includes("onboarding"));
  assert.equal(tabAccess.canManageRoster, true);
});

test("platform admin template retains manage capabilities", () => {
  const access = computeEffectiveAccess({ roleKey: "platform_admin", grants: [] });
  const tabAccess = resolveTeamWorkspaceTabAccess(access, { hrOsFullNav: true });
  assert.equal(tabAccess.canManageRoster, true);
  assert.equal(tabAccess.canManageIdentity, true);
});
