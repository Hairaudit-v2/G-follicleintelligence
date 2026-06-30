import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canUseDevelopmentClinicFeatures,
  canUseDevelopmentClinicFeaturesFromFiUserRole,
  isConfiguredDevelopmentAdminAuthUser,
} from "./developmentClinicAccess";

describe("developmentClinicAccess (pure)", () => {
  it("denies unauthenticated users", () => {
    assert.equal(
      canUseDevelopmentClinicFeatures({ isAuthenticated: false, fiUserRole: "fi_admin" }),
      false
    );
  });

  it("allows CRM mutation roles and owner during development", () => {
    for (const role of ["fi_admin", "admin", "crm_operator", "owner"] as const) {
      assert.equal(canUseDevelopmentClinicFeaturesFromFiUserRole(role), true, role);
    }
    assert.equal(canUseDevelopmentClinicFeaturesFromFiUserRole("member"), false);
  });

  it("allows tenant clinic_admin and operations_admin", () => {
    assert.equal(
      canUseDevelopmentClinicFeatures({
        isAuthenticated: true,
        fiUserRole: "tenant_backend",
        tenantAdminRole: "clinic_admin",
      }),
      true
    );
    assert.equal(
      canUseDevelopmentClinicFeatures({
        isAuthenticated: true,
        fiUserRole: "tenant_backend",
        tenantAdminRole: "operations_admin",
      }),
      true
    );
    assert.equal(
      canUseDevelopmentClinicFeatures({
        isAuthenticated: true,
        fiUserRole: "tenant_backend",
        tenantAdminRole: "dashboard_viewer",
      }),
      false
    );
  });

  it("allows fi_platform_admin os role without fi_users row", () => {
    assert.equal(
      canUseDevelopmentClinicFeatures({
        isAuthenticated: true,
        fiOsRole: "fi_platform_admin",
      }),
      true
    );
  });

  it("parses configured development admin auth user ids", () => {
    const list = "aaa-111, bbb-222;ccc-333";
    assert.equal(isConfiguredDevelopmentAdminAuthUser("bbb-222", list), true);
    assert.equal(isConfiguredDevelopmentAdminAuthUser("zzz", list), false);
  });
});
