import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isUuid } from "@/src/lib/validation/uuid";

function extractLegacyHubspotRedirectSemantics(source: string): {
  setsImportReviewTab: boolean;
  preservesValidBatchId: boolean;
  targetsHubspotWorkspace: boolean;
} {
  const setsImportReviewTab = /new URLSearchParams\(\{\s*tab:\s*"import-review"\s*\}\)/.test(
    source
  );
  const preservesValidBatchId =
    /isUuid\(batchId\)/.test(source) && /query\.set\("batchId"/.test(source);
  const targetsHubspotWorkspace = /settings\/integrations\/hubspot\?\$\{query\.toString\(\)\}/.test(
    source
  );
  return { setsImportReviewTab, preservesValidBatchId, targetsHubspotWorkspace };
}

function simulateLegacyHubspotRedirectQuery(batchId?: string): URLSearchParams {
  const query = new URLSearchParams({ tab: "import-review" });
  if (isUuid(batchId)) query.set("batchId", batchId.trim());
  return query;
}

test("legacy HubSpot routes retain semantic compatibility redirects", async () => {
  const importSource = await readFile(
    "app/(fi-admin)/fi-admin/[tenantId]/settings/imports/hubspot/page.tsx",
    "utf8"
  );
  const reviewSource = await readFile(
    "app/(fi-admin)/fi-admin/[tenantId]/onboarding-os/import-review/page.tsx",
    "utf8"
  );

  for (const source of [importSource, reviewSource]) {
    const semantics = extractLegacyHubspotRedirectSemantics(source);
    assert.equal(semantics.setsImportReviewTab, true);
    assert.equal(semantics.preservesValidBatchId, true);
    assert.equal(semantics.targetsHubspotWorkspace, true);
  }

  const withBatch = simulateLegacyHubspotRedirectQuery("550e8400-e29b-41d4-a716-446655440000");
  assert.equal(withBatch.get("tab"), "import-review");
  assert.equal(withBatch.get("batchId"), "550e8400-e29b-41d4-a716-446655440000");

  const withoutBatch = simulateLegacyHubspotRedirectQuery("not-a-uuid");
  assert.equal(withoutBatch.get("tab"), "import-review");
  assert.equal(withoutBatch.get("batchId"), null);
});
