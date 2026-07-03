import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { HR_OS_ROUTE_REQUIRED_ROLES } from "@/src/lib/platform/entitlements/modules";
import {
  WORKFORCE_HR_MANAGE_DENIED_MESSAGE,
  WORKFORCE_HR_MANAGE_ROLES,
  workforceHrManageAllowedForRole,
} from "@/src/lib/workforce/workforceHrManageGateCore";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");

test("WORKFORCE_HR_MANAGE_ROLES matches HR_OS_ROUTE_REQUIRED_ROLES (includes manager)", () => {
  assert.deepEqual([...WORKFORCE_HR_MANAGE_ROLES], [...HR_OS_ROUTE_REQUIRED_ROLES]);
  assert.ok((WORKFORCE_HR_MANAGE_ROLES as readonly string[]).includes("manager"));
});

test("manager may manage Workforce HR operations when HR OS route access is granted", () => {
  assert.equal(workforceHrManageAllowedForRole("manager", false), true);
  assert.equal(workforceHrManageAllowedForRole("MANAGER", false), true);
});

test("member may not manage Workforce HR operations", () => {
  assert.equal(workforceHrManageAllowedForRole("member", false), false);
  assert.equal(workforceHrManageAllowedForRole("crm_operator", false), false);
});

test("platform admin preview bypasses fi_users role check", () => {
  assert.equal(workforceHrManageAllowedForRole("member", true), true);
});

test("denied message documents manager alongside HR manager", () => {
  assert.match(WORKFORCE_HR_MANAGE_DENIED_MESSAGE, /manager/i);
  assert.match(WORKFORCE_HR_MANAGE_DENIED_MESSAGE, /HR manager/i);
});

test("workforce-staff-access-actions has no export const action aliases", () => {
  const src = readFileSync(
    join(ROOT, "src/lib/actions/workforce-staff-access-actions.ts"),
    "utf8"
  );
  assert.equal(src.startsWith('"use server"'), true);
  assert.doesNotMatch(src, /export const \w+Action\s*=/);
});

test('fi-surgery-os-actions does not re-export runtime constants', () => {
  const src = readFileSync(join(ROOT, "lib/actions/fi-surgery-os-actions.ts"), "utf8");
  assert.equal(src.startsWith('"use server"'), true);
  assert.doesNotMatch(src, /^export \{[^}]+\};?\s*$/m);
  assert.doesNotMatch(src, /export \{ SURGERY_OS_/);
});