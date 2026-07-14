import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const HAIRAUDIT_LINK_MUTATION_MARKERS = [
  "tryEnsureStructuredHairAuditLinkForSurgery",
  "runHairAuditLinkBackfill",
  "mergeAdditiveCaseHairAuditMetadata",
  "planHairAuditLinkBackfillItem",
] as const;

const READ_ONLY_SURFACES = [
  "src/lib/outcomeIntelligence/surgeryIntelligenceDashboardLoader.server.ts",
  "src/lib/surgeryOs/surgeryOsCommandCentreLoader.server.ts",
  "app/(fi-admin)/fi-admin/[tenantId]/surgery-os/intelligence/page.tsx",
] as const;

const APPROVED_HAIRAUDIT_MUTATION_PATHS = [
  "src/lib/surgeryOs/surgeryMutations.server.ts",
  "src/lib/outcomeIntelligence/hairAuditLink.server.ts",
  "src/lib/outcomeIntelligence/hairAuditLinkBackfill.server.ts",
  "src/lib/outcomeIntelligence/hairAuditOutcomeReportWorkflow.server.ts",
  "lib/actions/fi-hairaudit-outcome-report-actions.ts",
] as const;

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("surgeryIntelligenceHairAuditReleaseReadiness", () => {
  it("read-only dashboard and page loaders do not mutate HairAudit linkage", () => {
    for (const path of READ_ONLY_SURFACES) {
      const source = readRepoFile(path);
      for (const marker of HAIRAUDIT_LINK_MUTATION_MARKERS) {
        assert.equal(source.includes(marker), false, `${path} must not reference ${marker}`);
      }
    }
  });

  it("dashboard loader resolves HairAudit links read-only via resolver", () => {
    const loader = readRepoFile(
      "src/lib/outcomeIntelligence/surgeryIntelligenceDashboardLoader.server.ts"
    );
    assert.equal(loader.includes("resolveHairAuditLinkForSurgery"), false);
    assert.equal(loader.includes("loadHairAuditLinkContextForCases"), true);
    assert.equal(loader.includes("composeSurgeryIntelligenceDashboardFromEvents"), true);
  });

  it("HairAudit linkage writes exist only on approved mutation/backfill modules", () => {
    const ensureHits = APPROVED_HAIRAUDIT_MUTATION_PATHS.filter((path) =>
      readRepoFile(path).includes("tryEnsureStructuredHairAuditLinkForSurgery")
    );
    assert.deepEqual(ensureHits.sort(), [
      "src/lib/outcomeIntelligence/hairAuditLink.server.ts",
      "src/lib/surgeryOs/surgeryMutations.server.ts",
    ]);

    const backfillHits = APPROVED_HAIRAUDIT_MUTATION_PATHS.filter((path) =>
      readRepoFile(path).includes("runHairAuditLinkBackfill")
    );
    assert.deepEqual(backfillHits, ["src/lib/outcomeIntelligence/hairAuditLinkBackfill.server.ts"]);
  });

  it("intelligence page loads dashboard only and does not invoke HairAudit backfill on load", () => {
    const page = readRepoFile(
      "app/(fi-admin)/fi-admin/[tenantId]/surgery-os/intelligence/page.tsx"
    );
    assert.equal(page.includes("loadSurgeryIntelligenceDashboard"), true);
    assert.equal(page.includes("runHairAuditLinkBackfill"), false);
    assert.equal(page.includes("tryEnsureStructuredHairAuditLinkForSurgery"), false);
  });
});
