import assert from "node:assert/strict";
import test from "node:test";

import { applyPartialFeatureOverrides, buildDefaultFeatureAccessAllEnabled } from "@/src/config/fiFeatureAccessRegistry";
import { buildFiOsWorkspaceFocusLine } from "@/src/lib/fi-os/fiOsWorkspaceFocusCopy";

test("workspace focus line: null when Stage 2 map skipped", () => {
  assert.equal(buildFiOsWorkspaceFocusLine({ workspaceProfile: "nurse", featureAccess: null }), null);
});

test("workspace focus line: uses preferred enabled features positively", () => {
  const access = applyPartialFeatureOverrides(buildDefaultFeatureAccessAllEnabled(), {
    analytics: false,
    audit: false,
  });
  const line = buildFiOsWorkspaceFocusLine({ workspaceProfile: "consultant", featureAccess: access });
  assert.ok(line?.includes("focused"));
  assert.ok(!line?.toLowerCase().includes("restrict"));
});
