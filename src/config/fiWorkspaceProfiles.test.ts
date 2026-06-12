import assert from "node:assert/strict";
import test from "node:test";

import { FI_DASHBOARD_WIDGET_KEYS } from "@/src/config/fiDashboardRegistry";
import {
  assertFiWorkspaceProfilesComplete,
  FI_WORKSPACE_PROFILE_KEYS,
  FI_WORKSPACE_PROFILES,
} from "@/src/config/fiWorkspaceProfiles";

test("workspace profiles: registry is complete", () => {
  assertFiWorkspaceProfilesComplete();
  assert.equal(FI_WORKSPACE_PROFILE_KEYS.length, Object.keys(FI_WORKSPACE_PROFILES).length);
});

test("workspace profiles: every profile widget key exists in dashboard registry", () => {
  const reg = new Set(FI_DASHBOARD_WIDGET_KEYS);
  for (const pk of FI_WORKSPACE_PROFILE_KEYS) {
    const p = FI_WORKSPACE_PROFILES[pk];
    for (const w of p.defaultDashboardWidgets) {
      assert.ok(reg.has(w), `profile ${pk} references unknown widget ${w}`);
    }
  }
});
