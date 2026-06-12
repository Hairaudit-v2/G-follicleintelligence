import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveWorkspaceProfileFromFiOsRole,
  deriveWorkspaceProfileFromStaffRole,
  deriveWorkspaceProfileFromTenantAdminRole,
  parseExplicitWorkspaceProfile,
  resolveWorkspaceProfileKeyFromSignals,
} from "@/src/lib/fi-os/workspaceProfileDerivation";

test("explicit metadata override wins", () => {
  assert.equal(
    resolveWorkspaceProfileKeyFromSignals({
      explicitWorkspaceProfile: "nurse",
      staffRole: "surgeon",
      tenantAdminRole: "clinic_admin",
      fiOsRole: "fi_platform_admin",
    }),
    "nurse"
  );
});

test("parseExplicit rejects platform_admin storage", () => {
  assert.equal(parseExplicitWorkspaceProfile("platform_admin"), null);
});

test("staff role heuristics", () => {
  assert.equal(deriveWorkspaceProfileFromStaffRole("Lead Surgeon"), "surgeon");
  assert.equal(deriveWorkspaceProfileFromStaffRole("Registered Nurse"), "nurse");
  assert.equal(deriveWorkspaceProfileFromStaffRole("Front desk reception"), "reception");
});

test("tenant admin mapping", () => {
  assert.equal(deriveWorkspaceProfileFromTenantAdminRole("clinic_admin"), "director");
  assert.equal(deriveWorkspaceProfileFromTenantAdminRole("operations_admin"), "clinic_manager");
  assert.equal(deriveWorkspaceProfileFromTenantAdminRole("dashboard_viewer"), null);
});

test("fi os role mapping", () => {
  assert.equal(deriveWorkspaceProfileFromFiOsRole("fi_platform_admin"), "platform_admin");
  assert.equal(deriveWorkspaceProfileFromFiOsRole("fi_auditor"), "auditor");
});

test("default fallback", () => {
  assert.equal(
    resolveWorkspaceProfileKeyFromSignals({
      explicitWorkspaceProfile: null,
      positionTypeDefaultWorkspaceProfile: null,
      featureTemplateWorkspaceProfile: null,
      staffRole: "technician",
      tenantAdminRole: null,
      fiOsRole: null,
    }),
    "default"
  );
});

test("position type default wins over legacy staff_role substring heuristics", () => {
  assert.equal(
    resolveWorkspaceProfileKeyFromSignals({
      explicitWorkspaceProfile: null,
      positionTypeDefaultWorkspaceProfile: "nurse",
      featureTemplateWorkspaceProfile: null,
      staffRole: "Lead Surgeon",
      tenantAdminRole: null,
      fiOsRole: null,
    }),
    "nurse"
  );
});

test("feature template workspace used when position type profile absent", () => {
  assert.equal(
    resolveWorkspaceProfileKeyFromSignals({
      explicitWorkspaceProfile: null,
      positionTypeDefaultWorkspaceProfile: null,
      featureTemplateWorkspaceProfile: "consultant",
      staffRole: "technician",
      tenantAdminRole: null,
      fiOsRole: null,
    }),
    "consultant"
  );
});
