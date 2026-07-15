import assert from "node:assert/strict";
import test from "node:test";
import {
  HUBSPOT_WORKSPACE_TABS,
  hubspotTabsForSession,
  hubspotWorkspaceHref,
  isHubspotTabAllowedForSession,
  resolveHubspotWorkspaceTab,
} from "./hubspotWorkspaceRoutes";

test("canonical route supports every tab deep link", () => {
  for (const tab of HUBSPOT_WORKSPACE_TABS) {
    assert.equal(resolveHubspotWorkspaceTab(tab), tab);
    assert.equal(hubspotWorkspaceHref("tenant-a", tab), `/fi-admin/tenant-a/settings/integrations/hubspot?tab=${tab}`);
  }
  assert.equal(resolveHubspotWorkspaceTab("unsafe"), "overview");
});

test("CRM-read sessions are limited to import-review", () => {
  assert.deepEqual(hubspotTabsForSession(false), ["import-review"]);
  assert.equal(isHubspotTabAllowedForSession("import-review", false), true);
  assert.equal(isHubspotTabAllowedForSession("configuration", false), false);
  assert.equal(isHubspotTabAllowedForSession("overview", false), false);
  assert.equal(hubspotTabsForSession(true).length, HUBSPOT_WORKSPACE_TABS.length);
  assert.equal(isHubspotTabAllowedForSession("configuration", true), true);
});
