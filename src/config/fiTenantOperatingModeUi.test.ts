import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFiOsOperatingModePreviewLine,
  FI_TENANT_OPERATING_MODE_UI_OPTIONS,
  isFiTenantOperatingModeKey,
} from "@/src/config/fiTenantOperatingModeUi";

test("operating mode keys validate", () => {
  assert.equal(isFiTenantOperatingModeKey("hair_transplant_clinic"), true);
  assert.equal(isFiTenantOperatingModeKey("nope"), false);
});

test("preview line: hair transplant mentions SurgeryOS", () => {
  const line = buildFiOsOperatingModePreviewLine("hair_transplant_clinic");
  assert.match(line, /SurgeryOS/i);
});

test("UI options cover every canonical key", () => {
  const keys = new Set(FI_TENANT_OPERATING_MODE_UI_OPTIONS.map((o) => o.modeKey));
  assert.equal(keys.has("full_fi_os"), true);
  assert.equal(keys.has("audit_partner"), true);
});
