import assert from "node:assert/strict";
import { test } from "node:test";

import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "./platformTenantProvisionGate";

test("platform tenant provisioning: allows fi_platform_admin only", () => {
  assert.equal(isFiOsRoleAllowedForPlatformTenantProvisioning("fi_platform_admin"), true);
});

test("platform tenant provisioning: rejects fi_admin (not platform admin)", () => {
  assert.equal(isFiOsRoleAllowedForPlatformTenantProvisioning("fi_admin"), false);
});

test("platform tenant provisioning: rejects fi_auditor", () => {
  assert.equal(isFiOsRoleAllowedForPlatformTenantProvisioning("fi_auditor"), false);
});

test("platform tenant provisioning: rejects clinical OS roles", () => {
  assert.equal(isFiOsRoleAllowedForPlatformTenantProvisioning("fi_doctor"), false);
  assert.equal(isFiOsRoleAllowedForPlatformTenantProvisioning("fi_clinic_admin"), false);
});

test("platform tenant provisioning: rejects null / empty", () => {
  assert.equal(isFiOsRoleAllowedForPlatformTenantProvisioning(null), false);
  assert.equal(isFiOsRoleAllowedForPlatformTenantProvisioning(""), false);
});
