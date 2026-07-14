import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { tenantAdminRoleAllowsBookingsBoardNav } from "@/src/lib/tenantAdmin/tenantAdminRoles";

describe("tenantAdminRoleAllowsBookingsBoardNav", () => {
  it("F-PILOT-18: finance_admin can open PatientOS (not redirect to Surgery /cases)", () => {
    assert.equal(tenantAdminRoleAllowsBookingsBoardNav("finance_admin"), true);
    assert.equal(tenantAdminRoleAllowsBookingsBoardNav("clinic_admin"), true);
    assert.equal(tenantAdminRoleAllowsBookingsBoardNav("operations_admin"), true);
    assert.equal(tenantAdminRoleAllowsBookingsBoardNav("dashboard_viewer"), false);
    assert.equal(tenantAdminRoleAllowsBookingsBoardNav(null), false);
  });
});
