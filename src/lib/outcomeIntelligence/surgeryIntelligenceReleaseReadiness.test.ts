import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const PUBLISH_MARKERS = [
  "publishSurgeryCaseIntelligenceFacts",
  "tryPublishSurgeryCaseIntelligenceFactsForSurgery",
  "processSurgeryCaseIntelligenceBackfillItem",
  "runSurgeryIntelligenceBackfill",
  "recordAnalyticsEvent",
] as const;

const READ_ONLY_LOADERS = [
  "src/lib/surgeryOs/surgeryOsCommandCentreLoader.server.ts",
  "src/lib/outcomeIntelligence/surgeryIntelligenceDashboardLoader.server.ts",
  "src/lib/imaging-os/imagingClinicalReviewQueue.server.ts",
  "src/lib/imaging-os/graftTrayCountProvider.server.ts",
] as const;

const MUTATION_PUBLISH_PATHS = [
  "src/lib/surgeryOs/surgeryMutations.server.ts",
  "src/lib/imaging-os/graftTrayCountReviewMutations.server.ts",
  "src/lib/outcomeIntelligence/surgeryIntelligenceBackfill.server.ts",
] as const;

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("surgeryIntelligenceReleaseReadiness", () => {
  it("read-only loaders do not import publisher or backfill write paths", () => {
    for (const path of READ_ONLY_LOADERS) {
      const source = readRepoFile(path);
      for (const marker of PUBLISH_MARKERS) {
        assert.equal(
          source.includes(marker),
          false,
          `${path} must not reference ${marker}`
        );
      }
    }
  });

  it("publish paths exist only on approved mutation/backfill modules", () => {
    const publisherHits = MUTATION_PUBLISH_PATHS.filter((path) =>
      readRepoFile(path).includes("tryPublishSurgeryCaseIntelligenceFactsForSurgery") ||
      readRepoFile(path).includes("publishSurgeryCaseIntelligenceFacts") ||
      readRepoFile(path).includes("processSurgeryCaseIntelligenceBackfillItem")
    );
    assert.deepEqual(
      publisherHits.sort(),
      [
        "src/lib/imaging-os/graftTrayCountReviewMutations.server.ts",
        "src/lib/outcomeIntelligence/surgeryIntelligenceBackfill.server.ts",
        "src/lib/surgeryOs/surgeryMutations.server.ts",
      ].sort()
    );
  });

  it("dashboard page does not invoke backfill on load", () => {
    const page = readRepoFile(
      "app/(fi-admin)/fi-admin/[tenantId]/surgery-os/intelligence/page.tsx"
    );
    assert.equal(page.includes("runSurgeryIntelligenceBackfill"), false);
    assert.equal(page.includes("processSurgeryCaseIntelligenceBackfillItem"), false);
    assert.equal(page.includes("loadSurgeryIntelligenceDashboard"), true);
  });
});