import assert from "node:assert/strict";
import test from "node:test";

import { isStaffIntelligenceHomeWidgetAllowedForWorkspace } from "@/src/lib/fi-os/staffIntelligenceVisibility";

test("staff intelligence home widget: allowed for director, clinic_manager, platform_admin", () => {
  assert.equal(isStaffIntelligenceHomeWidgetAllowedForWorkspace("director"), true);
  assert.equal(isStaffIntelligenceHomeWidgetAllowedForWorkspace("clinic_manager"), true);
  assert.equal(isStaffIntelligenceHomeWidgetAllowedForWorkspace("platform_admin"), true);
});

test("staff intelligence home widget: not shown for clinical personas by default", () => {
  assert.equal(isStaffIntelligenceHomeWidgetAllowedForWorkspace("nurse"), false);
  assert.equal(isStaffIntelligenceHomeWidgetAllowedForWorkspace("consultant"), false);
  assert.equal(isStaffIntelligenceHomeWidgetAllowedForWorkspace(null), false);
});
