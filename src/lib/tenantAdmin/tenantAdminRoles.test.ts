import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  tenantAdminRoleAllowsBookingsBoardNav,
  tenantAdminRoleAllowsPaymentMutation,
} from "@/src/lib/tenantAdmin/tenantAdminRoles";

describe("tenantAdminRoleAllowsBookingsBoardNav", () => {
  it("F-PILOT-18: finance_admin can open PatientOS (not redirect to Surgery /cases)", () => {
    assert.equal(tenantAdminRoleAllowsBookingsBoardNav("finance_admin"), true);
    assert.equal(tenantAdminRoleAllowsBookingsBoardNav("clinic_admin"), true);
    assert.equal(tenantAdminRoleAllowsBookingsBoardNav("operations_admin"), true);
    assert.equal(tenantAdminRoleAllowsBookingsBoardNav("dashboard_viewer"), false);
    assert.equal(tenantAdminRoleAllowsBookingsBoardNav(null), false);
  });
});

describe("tenantAdminRoleAllowsPaymentMutation", () => {
  it("MD-03: finance_admin and clinic_admin may mutate Money; ops/viewer may not", () => {
    assert.equal(tenantAdminRoleAllowsPaymentMutation("finance_admin"), true);
    assert.equal(tenantAdminRoleAllowsPaymentMutation("clinic_admin"), true);
    assert.equal(tenantAdminRoleAllowsPaymentMutation("operations_admin"), false);
    assert.equal(tenantAdminRoleAllowsPaymentMutation("dashboard_viewer"), false);
    assert.equal(tenantAdminRoleAllowsPaymentMutation("data_safety_admin"), false);
    assert.equal(tenantAdminRoleAllowsPaymentMutation(null), false);
  });
});
