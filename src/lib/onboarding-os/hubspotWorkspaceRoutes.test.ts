import assert from "node:assert/strict";
import test from "node:test";
import { HUBSPOT_WORKSPACE_TABS, hubspotWorkspaceHref, resolveHubspotWorkspaceTab } from "./hubspotWorkspaceRoutes";

test("canonical route supports every tab deep link", () => {
  for (const tab of HUBSPOT_WORKSPACE_TABS) {
    assert.equal(resolveHubspotWorkspaceTab(tab), tab);
    assert.equal(hubspotWorkspaceHref("tenant-a", tab), `/fi-admin/tenant-a/settings/integrations/hubspot?tab=${tab}`);
  }
  assert.equal(resolveHubspotWorkspaceTab("unsafe"), "overview");
});
