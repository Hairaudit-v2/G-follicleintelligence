import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("legacy HubSpot routes retain compatibility redirects", async () => {
  const importSource = await readFile("app/(fi-admin)/fi-admin/[tenantId]/settings/imports/hubspot/page.tsx", "utf8");
  const reviewSource = await readFile("app/(fi-admin)/fi-admin/[tenantId]/onboarding-os/import-review/page.tsx", "utf8");
  assert.match(importSource, /tab: "import-review"/);
  assert.match(importSource, /batchId/);
  assert.match(reviewSource, /settings\/integrations\/hubspot\?tab=import-review/);
});
