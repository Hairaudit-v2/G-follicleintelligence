import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertFiCaseTenantMatchesGlobalTenant } from "./mapping";

describe("assertFiCaseTenantMatchesGlobalTenant", () => {
  it("allows matching tenant ids with trim", () => {
    assert.doesNotThrow(() => assertFiCaseTenantMatchesGlobalTenant("  t1 ", "t1"));
  });

  it("throws when tenants differ", () => {
    assert.throws(
      () => assertFiCaseTenantMatchesGlobalTenant("tenant-a", "tenant-b"),
      /does not match/i
    );
  });
});
