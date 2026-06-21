import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateFiOsNexusRoleCodes, isFiOsNexusRoleCode } from "./fiOsNexusRoles";

describe("fiOsNexusRoles", () => {
  it("accepts canonical role codes", () => {
    assert.equal(isFiOsNexusRoleCode("surgeon_operator"), true);
    assert.equal(isFiOsNexusRoleCode("fi_admin"), true);
    assert.equal(isFiOsNexusRoleCode("unknown_role"), false);
  });

  it("validateFiOsNexusRoleCodes rejects invalid roles", () => {
    const result = validateFiOsNexusRoleCodes(["crm_operator", "not_a_role"]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.deepEqual(result.invalidRoles, ["not_a_role"]);
    }
  });

  it("validateFiOsNexusRoleCodes deduplicates valid roles", () => {
    const result = validateFiOsNexusRoleCodes(["crm_operator", "crm_operator", "audit_viewer"]);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.roles, ["crm_operator", "audit_viewer"]);
    }
  });
});
