import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CONFIGURATION_TAB_LABELS,
  parseConfigurationTab,
} from "@/src/lib/fi/configurationTabs";

describe("parseConfigurationTab", () => {
  it("defaults to branding when tab is absent", () => {
    assert.equal(parseConfigurationTab(undefined), "branding");
    assert.equal(parseConfigurationTab(""), "branding");
  });

  it("parses calendar tab", () => {
    assert.equal(parseConfigurationTab("calendar"), "calendar");
    assert.equal(parseConfigurationTab(["calendar"]), "calendar");
  });

  it("falls back to branding for unknown tab values", () => {
    assert.equal(parseConfigurationTab("unknown"), "branding");
  });
});

describe("CONFIGURATION_TAB_LABELS", () => {
  it("includes Calendar tab label", () => {
    assert.equal(CONFIGURATION_TAB_LABELS.calendar, "Calendar");
    assert.equal(CONFIGURATION_TAB_LABELS.branding, "Branding");
  });
});
