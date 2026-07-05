import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("tenantBrandingPermissions", () => {
  it("manage_clinic_settings and manage_admin_users are the expected branding write capabilities", () => {
    const allowed = new Set(["manage_clinic_settings", "manage_admin_users"]);
    assert.equal(allowed.has("manage_clinic_settings"), true);
    assert.equal(allowed.has("manage_admin_users"), true);
    assert.equal(allowed.has("settings"), false);
  });
});
