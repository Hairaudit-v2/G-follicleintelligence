import assert from "node:assert/strict";
import test from "node:test";

import { mergeTenantConfigJsonWithOperatingModeKey } from "@/lib/fi/tenantConfig";

test("merge operating mode preserves unrelated config keys", () => {
  const out = mergeTenantConfigJsonWithOperatingModeKey({ scorecard_weights: { a: 1 }, other: true }, "medical_hair_clinic");
  assert.equal(out.fi_os_operating_mode_key, "medical_hair_clinic");
  assert.deepEqual(out.scorecard_weights, { a: 1 });
  assert.equal(out.other, true);
});

test("merge operating mode clears key when empty", () => {
  const out = mergeTenantConfigJsonWithOperatingModeKey({ fi_os_operating_mode_key: "audit_partner" }, "");
  assert.equal(Object.prototype.hasOwnProperty.call(out, "fi_os_operating_mode_key"), false);
});
