import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessWorkforceTab,
  canAccessWorkforceTabForTeamNav,
  canEnterTeamWorkspace,
  listSatisfiedStaffCapabilities,
  staffCapabilitySatisfies,
} from "@/src/lib/staffAccess/staffCapabilityCore";
import {
  computeEffectiveAccess,
  type StaffAccessGrantInput,
} from "@/src/lib/staffAccess/staffAccessCore";
import { normalizeStaffRoleKey } from "@/src/lib/staffAccess/staffAccessRegistry";

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

test("operations_admin tenant backend role maps to manager staff access", () => {
  const roleKey = normalizeStaffRoleKey("operations_admin");
  assert.equal(roleKey, "manager");
  const access = computeEffectiveAccess({ roleKey, grants: [] });
  assert.equal(canEnterTeamWorkspace(access), true);
  assert.equal(staffCapabilitySatisfies(access, "roster.manage"), true);
});

test("receptionist without override cannot manage roster", () => {
  const access = computeEffectiveAccess({ roleKey: "reception", grants: [] });
  assert.equal(staffCapabilitySatisfies(access, "roster.manage"), false);
  assert.equal(canEnterTeamWorkspace(access), false);
  assert.equal(canAccessWorkforceTab(access, "roster", "read"), false);
  assert.equal(canAccessWorkforceTab(access, "identity", "read"), false);
});

test("receptionist with roster tab grant receives roster.manage only", () => {
  const access = computeEffectiveAccess({
    roleKey: "reception",
    grants: [
      grant({ moduleKey: "workforce_os", tabKey: "roster", accessLevel: "edit" }),
    ],
  });

  assert.equal(staffCapabilitySatisfies(access, "roster.manage"), true);
  assert.equal(staffCapabilitySatisfies(access, "roster.standard_hours.manage"), true);
  assert.equal(staffCapabilitySatisfies(access, "team.identity.manage"), false);
  assert.equal(canEnterTeamWorkspace(access), true);
  assert.equal(canAccessWorkforceTab(access, "roster", "edit"), true);
  assert.equal(canAccessWorkforceTab(access, "identity", "read"), false);
  assert.deepEqual(listSatisfiedStaffCapabilities(access), [
    "roster.manage",
    "roster.standard_hours.manage",
  ]);
});

test("manager template retains full workforce module edit", () => {
  const access = computeEffectiveAccess({ roleKey: "manager", grants: [] });
  assert.equal(staffCapabilitySatisfies(access, "roster.manage"), true);
  assert.equal(staffCapabilitySatisfies(access, "team.identity.manage"), true);
  assert.equal(canAccessWorkforceTab(access, "identity", "edit"), true);
});

test("manager module edit does not grant team nav tabs without hrOsFullNav", () => {
  const access = computeEffectiveAccess({ roleKey: "manager", grants: [] });
  assert.equal(canAccessWorkforceTabForTeamNav(access, "identity", "read", { hrOsFullNav: false }), false);
  assert.equal(canAccessWorkforceTabForTeamNav(access, "onboarding", "read", { hrOsFullNav: false }), false);
  assert.equal(canAccessWorkforceTabForTeamNav(access, "identity", "read", { hrOsFullNav: true }), true);
});

test("receptionist roster tab grant satisfies team nav roster without module edit blanket", () => {
  const access = computeEffectiveAccess({
    roleKey: "reception",
    grants: [grant({ moduleKey: "workforce_os", tabKey: "roster", accessLevel: "edit" })],
  });
  assert.equal(canAccessWorkforceTabForTeamNav(access, "roster", "read", { hrOsFullNav: false }), true);
  assert.equal(canAccessWorkforceTabForTeamNav(access, "identity", "read", { hrOsFullNav: false }), false);
});

test("explicit identity tab grant required for sensitive tabs without module edit", () => {
  const access = computeEffectiveAccess({
    roleKey: "reception",
    grants: [
      grant({ moduleKey: "workforce_os", tabKey: "roster", accessLevel: "edit" }),
      grant({ moduleKey: "workforce_os", tabKey: "identity", accessLevel: "read" }),
    ],
  });

  assert.equal(canAccessWorkforceTab(access, "roster", "edit"), true);
  assert.equal(canAccessWorkforceTab(access, "identity", "read"), true);
  assert.equal(staffCapabilitySatisfies(access, "team.identity.manage"), false);
});

test("platform admin role template satisfies all capabilities", () => {
  const access = computeEffectiveAccess({ roleKey: "platform_admin", grants: [] });
  for (const cap of [
    "roster.manage",
    "team.identity.manage",
    "team.onboarding.manage",
  ] as const) {
    assert.equal(staffCapabilitySatisfies(access, cap), true, cap);
  }
});
