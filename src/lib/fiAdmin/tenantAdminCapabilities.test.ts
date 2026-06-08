import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ALL_TENANT_ADMIN_CAPABILITIES,
  capabilitiesForTenantAdminRole,
  crmOperatorCapabilityPreset,
  FI_TENANT_ADMIN_CAPABILITIES,
  hasTenantAdminCapability,
} from "./tenantAdminCapabilities";

test("FI_TENANT_ADMIN_CAPABILITIES: fixed eight capabilities", () => {
  assert.equal(FI_TENANT_ADMIN_CAPABILITIES.length, 8);
});

test("clinic_admin has every capability", () => {
  const caps = capabilitiesForTenantAdminRole("clinic_admin");
  for (const c of FI_TENANT_ADMIN_CAPABILITIES) {
    assert.equal(caps.has(c), true, c);
  }
  assert.equal(caps.size, ALL_TENANT_ADMIN_CAPABILITIES.size);
});

test("finance_admin: tax/finance and reports; not admin users or security audit", () => {
  const caps = capabilitiesForTenantAdminRole("finance_admin");
  assert.equal(hasTenantAdminCapability(caps, "view_finance"), true);
  assert.equal(hasTenantAdminCapability(caps, "manage_finance_settings"), true);
  assert.equal(hasTenantAdminCapability(caps, "manage_admin_users"), false);
  assert.equal(hasTenantAdminCapability(caps, "view_security_audit"), false);
  assert.equal(hasTenantAdminCapability(caps, "manage_operations"), false);
});

test("operations_admin: operations + dashboards; not finance or admin users", () => {
  const caps = capabilitiesForTenantAdminRole("operations_admin");
  assert.equal(hasTenantAdminCapability(caps, "manage_operations"), true);
  assert.equal(hasTenantAdminCapability(caps, "manage_finance_settings"), false);
  assert.equal(hasTenantAdminCapability(caps, "manage_admin_users"), false);
});

test("dashboard_viewer: dashboards and read-only reports only", () => {
  const caps = capabilitiesForTenantAdminRole("dashboard_viewer");
  assert.equal(hasTenantAdminCapability(caps, "view_dashboards"), true);
  assert.equal(hasTenantAdminCapability(caps, "view_read_only_reports"), true);
  assert.equal(hasTenantAdminCapability(caps, "manage_clinic_settings"), false);
  assert.equal(hasTenantAdminCapability(caps, "manage_finance_settings"), false);
  assert.equal(hasTenantAdminCapability(caps, "manage_admin_users"), false);
});

test("data_safety_admin: security audit; not finance or admin users", () => {
  const caps = capabilitiesForTenantAdminRole("data_safety_admin");
  assert.equal(hasTenantAdminCapability(caps, "view_security_audit"), true);
  assert.equal(hasTenantAdminCapability(caps, "manage_finance_settings"), false);
  assert.equal(hasTenantAdminCapability(caps, "manage_admin_users"), false);
});

test("crmOperatorCapabilityPreset matches operations_admin finance/admin exclusions", () => {
  const crm = crmOperatorCapabilityPreset();
  const ops = capabilitiesForTenantAdminRole("operations_admin");
  assert.deepEqual(Array.from(crm).sort(), Array.from(ops).sort());
  assert.equal(crm.has("manage_admin_users"), false);
});
