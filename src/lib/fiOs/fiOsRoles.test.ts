import assert from "node:assert/strict";
import { test } from "node:test";

import { isFiOsCrossTenantDirectoryRole, isFiOsRoleString, normalizeFiOsRole } from "./fiOsRoles";

test("normalizeFiOsRole lowercases", () => {
  assert.equal(normalizeFiOsRole("FI_ADMIN"), "fi_admin");
});

test("isFiOsCrossTenantDirectoryRole", () => {
  assert.equal(isFiOsCrossTenantDirectoryRole("fi_platform_admin"), true);
  assert.equal(isFiOsCrossTenantDirectoryRole("fi_admin"), true);
  assert.equal(isFiOsCrossTenantDirectoryRole("fi_auditor"), true);
  assert.equal(isFiOsCrossTenantDirectoryRole("fi_doctor"), false);
});

test("isFiOsRoleString", () => {
  assert.equal(isFiOsRoleString("fi_platform_admin"), true);
  assert.equal(isFiOsRoleString("fi_consultant"), true);
  assert.equal(isFiOsRoleString("invalid"), false);
});
