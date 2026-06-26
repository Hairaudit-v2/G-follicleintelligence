import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessTab,
  canApproveModule,
  canEditModule,
  canViewModule,
  computeEffectiveAccess,
  getModuleAccess,
  getVisibleStaffNavigation,
  moduleSatisfies,
  type StaffAccessGrantInput,
} from "@/src/lib/staffAccess/staffAccessCore";
import { STAFF_ACCESS_MODULE_KEYS } from "@/src/lib/staffAccess/staffAccessRegistry";

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

test("doctor default access (role template, no grants)", () => {
  const access = computeEffectiveAccess({ roleKey: "doctor", grants: [] });
  assert.equal(canViewModule(access, "patient_os"), true);
  assert.equal(canEditModule(access, "patient_os"), true);
  assert.equal(canApproveModule(access, "surgery_os"), true);
  assert.equal(canViewModule(access, "clinic_os"), true);
  // Doctor has none of these by default.
  assert.equal(canViewModule(access, "financial_os"), false);
  assert.equal(canViewModule(access, "analytics_os"), false);
  assert.equal(canViewModule(access, "investor_dashboard"), false);
  assert.equal(canViewModule(access, "audit_os"), false);
});

test("doctor + investor dashboard grant: sees more than a plain doctor", () => {
  const access = computeEffectiveAccess({
    roleKey: "doctor",
    grants: [
      grant({ moduleKey: "investor_dashboard", accessLevel: "read" }),
      grant({ moduleKey: "analytics_os", accessLevel: "read" }),
      grant({ moduleKey: "financial_os", accessLevel: "read" }),
    ],
  });
  // Core role is unchanged…
  assert.equal(canEditModule(access, "patient_os"), true);
  assert.equal(canApproveModule(access, "surgery_os"), true);
  // …but the optional grants are now visible.
  assert.equal(canViewModule(access, "investor_dashboard"), true);
  assert.equal(canViewModule(access, "analytics_os"), true);
  assert.equal(canViewModule(access, "financial_os"), true);
  assert.equal(getModuleAccess(access, "investor_dashboard").source, "grant");
});

test("nurse assigned-case-only scope", () => {
  const access = computeEffectiveAccess({ roleKey: "nurse", grants: [] });
  const patient = getModuleAccess(access, "patient_os");
  assert.equal(patient.level, "edit");
  assert.equal(patient.scope, "assigned");
  assert.equal(getModuleAccess(access, "surgery_os").scope, "assigned");
  assert.equal(canViewModule(access, "financial_os"), false);
});

test("receptionist has no financial access", () => {
  const access = computeEffectiveAccess({ roleKey: "reception", grants: [] });
  assert.equal(canViewModule(access, "financial_os"), false);
  assert.equal(canViewModule(access, "investor_dashboard"), false);
  // Reception still operates the front desk.
  assert.equal(canEditModule(access, "lead_flow"), true);
  assert.equal(canEditModule(access, "clinic_os"), true);
});

test("owner has full tenant access", () => {
  const access = computeEffectiveAccess({ roleKey: "owner", grants: [] });
  for (const module of STAFF_ACCESS_MODULE_KEYS) {
    assert.equal(canViewModule(access, module), true, `owner should view ${module}`);
    assert.equal(canApproveModule(access, module), true, `owner should approve ${module}`);
  }
});

test("revoked grant no longer applies", () => {
  const access = computeEffectiveAccess({
    roleKey: "doctor",
    grants: [
      grant({ moduleKey: "financial_os", accessLevel: "read", revokedAt: "2026-06-01T00:00:00Z" }),
    ],
  });
  assert.equal(canViewModule(access, "financial_os"), false);
});

test("explicit grant overrides role template (raises and lowers)", () => {
  // Raise: doctor normally has no analytics; grant gives edit.
  const raised = computeEffectiveAccess({
    roleKey: "doctor",
    grants: [grant({ moduleKey: "analytics_os", accessLevel: "edit" })],
  });
  assert.equal(canEditModule(raised, "analytics_os"), true);

  // Lower: doctor normally edits patient_os; an explicit `none` grant suppresses it.
  const lowered = computeEffectiveAccess({
    roleKey: "doctor",
    grants: [grant({ moduleKey: "patient_os", accessLevel: "none" })],
  });
  assert.equal(canViewModule(lowered, "patient_os"), false);
  assert.equal(getModuleAccess(lowered, "patient_os").source, "grant");
});

test("hidden navigation excludes blocked modules", () => {
  const access = computeEffectiveAccess({ roleKey: "investor", grants: [] });
  const nav = getVisibleStaffNavigation(access).map((m) => m.module);
  assert.deepEqual(nav.sort(), ["analytics_os", "financial_os", "investor_dashboard"].sort());
  assert.equal(nav.includes("patient_os"), false);
  assert.equal(nav.includes("surgery_os"), false);
});

test("server guard decision blocks direct URL access (moduleSatisfies)", () => {
  // A receptionist hitting the FinancialOS URL directly.
  const access = computeEffectiveAccess({ roleKey: "reception", grants: [] });
  assert.equal(moduleSatisfies(access, "financial_os", "read"), false);
  // Same person on a module they hold.
  assert.equal(moduleSatisfies(access, "lead_flow", "edit"), true);
  // Approve gate denies an editor.
  const doctor = computeEffectiveAccess({ roleKey: "doctor", grants: [] });
  assert.equal(moduleSatisfies(doctor, "patient_os", "approve"), false);
  assert.equal(moduleSatisfies(doctor, "surgery_os", "approve"), true);
});

test("admin override grants everything regardless of role/grants", () => {
  const access = computeEffectiveAccess({
    roleKey: "reception",
    grants: [grant({ moduleKey: "patient_os", accessLevel: "none" })],
    isAdminOverride: true,
  });
  for (const module of STAFF_ACCESS_MODULE_KEYS) {
    assert.equal(canApproveModule(access, module), true, `override should approve ${module}`);
  }
  assert.equal(getModuleAccess(access, "patient_os").source, "override");
});

test("tab grant makes a tab reachable and is honoured by canAccessTab", () => {
  const access = computeEffectiveAccess({
    roleKey: "investor",
    grants: [grant({ moduleKey: "analytics_os", tabKey: "cohorts", accessLevel: "edit" })],
  });
  assert.equal(canAccessTab(access, "analytics_os", "cohorts", "edit"), true);
  // A tab without an explicit grant inherits the module level (read for investor).
  assert.equal(canAccessTab(access, "analytics_os", "overview", "read"), true);
  assert.equal(canAccessTab(access, "analytics_os", "overview", "edit"), false);
});
