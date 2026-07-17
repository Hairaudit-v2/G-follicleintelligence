import assert from "node:assert/strict";
import test from "node:test";
import {
  HUBSPOT_CANONICAL_SURFACES,
  HUBSPOT_WORKSPACE_TABS,
  hubspotDefaultTabForSession,
  hubspotSurfaceHref,
  hubspotSurfacesForSession,
  hubspotTabsForSession,
  hubspotWorkspaceHref,
  isHubspotTabAllowedForSession,
  resolveHubspotWorkspaceTab,
  resolveHubspotWorkspaceTabForSession,
} from "./hubspotWorkspaceRoutes";

test("canonical route supports every tab deep link", () => {
  for (const tab of HUBSPOT_WORKSPACE_TABS) {
    assert.equal(resolveHubspotWorkspaceTab(tab), tab);
    assert.equal(
      hubspotWorkspaceHref("tenant-a", tab),
      `/fi-admin/tenant-a/settings/integrations/hubspot?tab=${tab}`
    );
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

test("session-aware tab resolution lands CRM-read on import-review without forbidden Overview", () => {
  assert.equal(hubspotDefaultTabForSession(true), "overview");
  assert.equal(hubspotDefaultTabForSession(false), "import-review");

  assert.deepEqual(resolveHubspotWorkspaceTabForSession(undefined, true), { tab: "overview" });
  assert.deepEqual(resolveHubspotWorkspaceTabForSession(undefined, false), {
    tab: "import-review",
  });
  assert.deepEqual(resolveHubspotWorkspaceTabForSession("backup-sync", true), {
    tab: "backup-sync",
  });
  assert.deepEqual(resolveHubspotWorkspaceTabForSession("overview", false), {
    forbidden: "overview",
  });
  assert.deepEqual(resolveHubspotWorkspaceTabForSession("import-review", false), {
    tab: "import-review",
  });
});

test("canonical surfaces map the five Integrations HubSpot families", () => {
  assert.deepEqual(
    HUBSPOT_CANONICAL_SURFACES.map((surface) => surface.id),
    [
      "overview",
      "connection-sync",
      "migration-import-review",
      "identity-resolution",
      "health-history",
    ]
  );
  assert.deepEqual(
    HUBSPOT_CANONICAL_SURFACES.map((surface) => surface.label),
    [
      "Overview",
      "Connection and sync",
      "Migration/import review",
      "Identity resolution",
      "Health and history",
    ]
  );

  const configSurfaces = hubspotSurfacesForSession(true);
  assert.equal(configSurfaces.length, 5);
  for (const surface of configSurfaces) {
    assert.equal(
      hubspotSurfaceHref("tenant-a", surface),
      hubspotWorkspaceHref("tenant-a", surface.entryTab)
    );
    assert.equal(isHubspotTabAllowedForSession(surface.entryTab, true), true);
  }

  const crmReadSurfaces = hubspotSurfacesForSession(false);
  assert.deepEqual(
    crmReadSurfaces.map((surface) => surface.id),
    ["migration-import-review"]
  );
  assert.equal(crmReadSurfaces[0]!.entryTab, "import-review");
  assert.equal(isHubspotTabAllowedForSession("import-review", false), true);
});
