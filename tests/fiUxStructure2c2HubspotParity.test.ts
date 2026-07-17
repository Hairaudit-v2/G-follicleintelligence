import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { buildFiOsClinicSettingsGroups } from "@/src/lib/fiOs/settings/clinicSettingsNavigationCore";
import {
  HUBSPOT_CANONICAL_SURFACES,
  hubspotSurfacesForSession,
  hubspotSurfaceHref,
  isHubspotTabAllowedForSession,
  resolveHubspotWorkspaceTabForSession,
} from "@/src/lib/onboarding-os/hubspotWorkspaceRoutes";

type Evidence = {
  milestone: string;
  verdict: string;
  temporaryHubspotImportPeerRemoved: boolean;
  permissionsExpanded: boolean;
  surfaces: Array<{ id: string; configurationHub: boolean; crmRead: boolean }>;
};

const evidence = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "docs", "audits", "evidence-fi-ux-structure-2c2.json"),
    "utf8"
  )
) as Evidence;

const base = "/fi-admin/t-2c2";

test("2C.2 evidence freezes HubSpot Integrations parity contract", () => {
  assert.equal(evidence.milestone, "FI-UX-STRUCTURE-2C.2");
  assert.equal(evidence.verdict, "GREEN");
  assert.equal(evidence.temporaryHubspotImportPeerRemoved, true);
  assert.equal(evidence.permissionsExpanded, false);
  assert.deepEqual(
    evidence.surfaces.map((surface) => surface.id),
    HUBSPOT_CANONICAL_SURFACES.map((surface) => surface.id)
  );
});

test("Configuration-hub sessions reach all five surfaces without temporary HubSpot import peer", () => {
  const groups = buildFiOsClinicSettingsGroups(base, {
    showConfiguration: true,
    showClinicOperations: false,
    showTemplates: false,
    showTaxLocalisation: false,
    showBilling: false,
    showSecurity: false,
    showHubspotImport: true,
  });
  const integrations = groups.find((group) => group.id === "integrations")!;
  assert.ok(integrations.destinations.some((item) => item.id === "integrations"));
  assert.ok(
    !integrations.destinations.some((item) => item.id === "integrations-hubspot-import")
  );

  const surfaces = hubspotSurfacesForSession(true);
  assert.equal(surfaces.length, 5);
  for (const surface of surfaces) {
    assert.equal(isHubspotTabAllowedForSession(surface.entryTab, true), true);
    assert.match(hubspotSurfaceHref("t-2c2", surface), /\/settings\/integrations\/hubspot\?tab=/);
  }

  const hubSource = readFileSync(
    path.join(
      process.cwd(),
      "src",
      "components",
      "fi-admin",
      "settings",
      "OtherIntegrationsSection.tsx"
    ),
    "utf8"
  );
  assert.match(hubSource, /HUBSPOT_CANONICAL_SURFACES/);
  assert.match(hubSource, /hubspotSurfaceHref/);
  for (const label of [
    "Overview",
    "Connection and sync",
    "Migration/import review",
    "Identity resolution",
    "Health and history",
  ]) {
    assert.ok(
      HUBSPOT_CANONICAL_SURFACES.some((surface) => surface.label === label),
      label
    );
  }
});

test("CRM-read sessions reach Import Review via Integrations without temporary peer id", () => {
  const groups = buildFiOsClinicSettingsGroups(base, {
    showConfiguration: false,
    showClinicOperations: false,
    showTemplates: false,
    showTaxLocalisation: false,
    showBilling: false,
    showSecurity: false,
    showHubspotImport: true,
  });
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.id, "integrations");
  assert.equal(groups[0]!.destinations[0]?.id, "integrations-hubspot");
  assert.equal(
    groups[0]!.destinations[0]?.href,
    `${base}/settings/integrations/hubspot?tab=import-review`
  );
  assert.ok(
    !groups[0]!.destinations.some((item) => item.id === "integrations-hubspot-import")
  );

  assert.deepEqual(
    hubspotSurfacesForSession(false).map((surface) => surface.id),
    ["migration-import-review"]
  );
  assert.deepEqual(resolveHubspotWorkspaceTabForSession(undefined, false), {
    tab: "import-review",
  });
  assert.deepEqual(resolveHubspotWorkspaceTabForSession("overview", false), {
    forbidden: "overview",
  });
});

test("HubSpot page uses session-aware tab resolution", () => {
  const pageSource = readFileSync(
    path.join(
      process.cwd(),
      "app",
      "(fi-admin)",
      "fi-admin",
      "[tenantId]",
      "settings",
      "integrations",
      "hubspot",
      "page.tsx"
    ),
    "utf8"
  );
  assert.match(pageSource, /resolveHubspotWorkspaceTabForSession/);
  assert.doesNotMatch(pageSource, /resolveHubspotWorkspaceTab\(sp\.tab\)/);
});
