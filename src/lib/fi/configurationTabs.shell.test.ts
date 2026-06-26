import { existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

import { CONFIGURATION_TABS } from "@/src/lib/fi/configurationTabs";

test("Configuration page includes Calendar tab registry entry", () => {
  assert.ok(CONFIGURATION_TABS.includes("calendar"));
  assert.ok(
    existsSync("src/components/fi/ConfigurationTabNav.tsx"),
    "ConfigurationTabNav must exist for configuration section tabs"
  );
});
