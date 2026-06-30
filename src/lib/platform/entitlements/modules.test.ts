import assert from "node:assert/strict";
import { test } from "node:test";

import type { EntitlementAccessContext } from "./entitlementTypes";
import {
  canShowModuleNav,
  evaluateModuleAccess,
  isSubscriptionStatusEntitled,
  isTenantVerificationAllowed,
} from "./modules";

function baseContext(overrides: Partial<EntitlementAccessContext> = {}): EntitlementAccessContext {
  return {
    tenantExists: true,
    verificationStatus: "verified",
    subscriptionStatus: "active",
    moduleExists: true,
    moduleEnabled: true,
    allowedRoles: ["admin", "fi_admin", "owner", "tenant_backend"],
    userExists: true,
    userRole: "admin",
    ...overrides,
  };
}

test("enabled module + active billing = allowed", () => {
  const result = evaluateModuleAccess(baseContext());
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.userRole, "admin");
});

test("disabled module = denied", () => {
  const result = evaluateModuleAccess(baseContext({ moduleEnabled: false }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "module_disabled");
});

test("inactive billing = denied", () => {
  const result = evaluateModuleAccess(baseContext({ subscriptionStatus: "inactive" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "billing_inactive");
});

test("unverified tenant = denied", () => {
  const result = evaluateModuleAccess(baseContext({ verificationStatus: "unverified" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "tenant_unverified");
});

test("missing module = denied", () => {
  const result = evaluateModuleAccess(baseContext({ moduleExists: false }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "module_not_found");
});

test("missing user role = denied", () => {
  const result = evaluateModuleAccess(baseContext({ userRole: "member", allowedRoles: ["admin"] }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "role_not_allowed");
});

test("missing user = denied", () => {
  const result = evaluateModuleAccess(baseContext({ userExists: false, userRole: null }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "user_not_found");
});

test("enterprise_verified tenant = allowed", () => {
  const result = evaluateModuleAccess(baseContext({ verificationStatus: "enterprise_verified" }));
  assert.equal(result.ok, true);
  assert.equal(isTenantVerificationAllowed("enterprise_verified"), true);
});

test("trialing billing = allowed", () => {
  const result = evaluateModuleAccess(baseContext({ subscriptionStatus: "trialing" }));
  assert.equal(result.ok, true);
  assert.equal(isSubscriptionStatusEntitled("trialing"), true);
});

test("requiredRoles further restricts access", () => {
  const denied = evaluateModuleAccess(
    baseContext({ userRole: "crm_operator", allowedRoles: ["admin", "crm_operator"] }),
    {
      requiredRoles: ["admin"],
    }
  );
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.reason, "role_not_allowed");

  const allowed = evaluateModuleAccess(baseContext({ userRole: "admin" }), {
    requiredRoles: ["admin"],
  });
  assert.equal(allowed.ok, true);
});

test("canShowModuleNav respects client-safe entitlements", () => {
  const entitlements = {
    tenantId: "t1",
    userId: "u1",
    modules: {
      hr_os: { moduleCode: "hr_os", canAccess: true, showInNav: true },
      audit_os: { moduleCode: "audit_os", canAccess: false, showInNav: false },
    },
  };
  assert.equal(canShowModuleNav(entitlements, "hr_os"), true);
  assert.equal(canShowModuleNav(entitlements, "audit_os"), false);
  assert.equal(canShowModuleNav(entitlements, "missing_os"), false);
  assert.equal(canShowModuleNav(null, "hr_os"), false);
});
