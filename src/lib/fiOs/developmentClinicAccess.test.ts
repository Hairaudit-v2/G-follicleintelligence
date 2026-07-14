import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canUseDevelopmentClinicFeatures,
  canUseDevelopmentClinicFeaturesFromFiUserRole,
  isConfiguredDevelopmentAdminAuthUser,
  isDevelopmentClinicStaffRole,
} from "./developmentClinicAccess";

describe("developmentClinicAccess (pure)", () => {
  it("denies unauthenticated users", () => {
    assert.equal(
      canUseDevelopmentClinicFeatures({ isAuthenticated: false, fiUserRole: "fi_admin" }),
      false
    );
  });

  it("allows CRM mutation roles and owner during development", () => {
    for (const role of [
      "fi_admin",
      "admin",
      "crm_operator",
      "owner",
      "manager",
      "consultant",
    ] as const) {
      assert.equal(canUseDevelopmentClinicFeaturesFromFiUserRole(role), true, role);
    }
    assert.equal(canUseDevelopmentClinicFeaturesFromFiUserRole("member"), false);
  });

  it("allows ordinary CRM staff roles when fi_users.role is member (OW parity)", () => {
    assert.equal(
      canUseDevelopmentClinicFeatures({
        isAuthenticated: true,
        fiUserRole: "member",
        staffRole: "consultant",
      }),
      true
    );
    assert.equal(
      canUseDevelopmentClinicFeatures({
        isAuthenticated: true,
        fiUserRole: "member",
        staffRole: "reception",
      }),
      true
    );
    assert.equal(
      canUseDevelopmentClinicFeatures({
        isAuthenticated: true,
        fiUserRole: "member",
        staffRole: "receptionist",
      }),
      true
    );
    assert.equal(
      canUseDevelopmentClinicFeatures({
        isAuthenticated: true,
        fiUserRole: "member",
        staffRole: "manager",
      }),
      true
    );
  });

  it("keeps true read-only / clinical staff roles from ClinicOS mutations", () => {
    assert.equal(
      canUseDevelopmentClinicFeatures({
        isAuthenticated: true,
        fiUserRole: "member",
        staffRole: "nurse",
      }),
      false
    );
    assert.equal(
      canUseDevelopmentClinicFeatures({
        isAuthenticated: true,
        fiUserRole: "member",
        staffRole: "doctor",
      }),
      false
    );
    assert.equal(
      canUseDevelopmentClinicFeatures({
        isAuthenticated: true,
        fiUserRole: "member",
      }),
      false
    );
    assert.equal(isDevelopmentClinicStaffRole("consultant"), true);
    assert.equal(isDevelopmentClinicStaffRole("nurse"), false);
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
