import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildGraftIntelligence } from "@/src/lib/surgeryOs/graftIntelligenceCore";

const surgeryId = "00000000-0000-4000-8000-000000000030";

function baseInput(
  overrides: Partial<Parameters<typeof buildGraftIntelligence>[0]> = {}
) {
  return {
    surgeryId,
    patientLabel: "Jordan Patient",
    targetGrafts: 3000,
    extractedGrafts: 0,
    implantedGrafts: 0,
    discardedGrafts: 0,
    remainingGrafts: 0,
    singles: 0,
    doubles: 0,
    triples: 0,
    multiples: 0,
    totalHairs: 0,
    averageHairsPerGraft: null,
    reconciliationStatus: "pending" as const,
    pendingTrayCount: 0,
    ...overrides,
  };
}

describe("graftIntelligenceCore", () => {
  it("returns empty state when no graft data exists", () => {
    const snapshot = buildGraftIntelligence(baseInput());

    assert.equal(snapshot.totalGrafts, 0);
    assert.equal(snapshot.summary, "No graft intelligence available yet.");
    assert.equal(snapshot.warnings.some((w) => w.kind === "no_data"), true);
    assert.equal(snapshot.graftCountConfidence, 0);
  });

  it("calculates total graft and hair totals from session data", () => {
    const snapshot = buildGraftIntelligence(
      baseInput({
        extractedGrafts: 1200,
        implantedGrafts: 800,
        discardedGrafts: 50,
        remainingGrafts: 350,
        totalHairs: 2600,
      })
    );

    assert.equal(snapshot.totalGrafts, 1200);
    assert.equal(snapshot.totalHairs, 2600);
  });

  it("computes average hairs per graft safely", () => {
    const snapshot = buildGraftIntelligence(
      baseInput({
        extractedGrafts: 1000,
        singles: 400,
        doubles: 300,
        triples: 200,
        multiples: 100,
        totalHairs: 2200,
      })
    );

    assert.equal(snapshot.averageHairsPerGraft, 2.2);
  });

  it("reports singles, doubles, triples, and multi-hair graft counts", () => {
    const snapshot = buildGraftIntelligence(
      baseInput({
        extractedGrafts: 500,
        singles: 100,
        doubles: 150,
        triples: 120,
        multiples: 80,
        totalHairs: 1100,
      })
    );

    assert.equal(snapshot.singles, 100);
    assert.equal(snapshot.doubles, 150);
    assert.equal(snapshot.triples, 120);
    assert.equal(snapshot.multiHairGrafts, 350);
  });

  it("preserves reconciliation status from session data", () => {
    const snapshot = buildGraftIntelligence(
      baseInput({
        extractedGrafts: 1000,
        implantedGrafts: 950,
        discardedGrafts: 50,
        remainingGrafts: 0,
        totalHairs: 2100,
        reconciliationStatus: "completed",
      })
    );

    assert.equal(snapshot.reconciliationStatus, "completed");
  });

  it("warns on inconsistent totals", () => {
    const snapshot = buildGraftIntelligence(
      baseInput({
        extractedGrafts: 1000,
        implantedGrafts: 1100,
        remainingGrafts: -100,
        singles: 200,
        doubles: 200,
        triples: 200,
        multiples: 200,
        totalHairs: 1800,
        reconciliationStatus: "mismatch",
      })
    );

    assert.ok(snapshot.warnings.some((w) => w.kind === "over_implantation"));
    assert.ok(snapshot.warnings.some((w) => w.kind === "remaining_unaccounted"));
    assert.ok(snapshot.warnings.some((w) => w.kind === "composition_mismatch"));
    assert.ok(snapshot.warnings.some((w) => w.kind === "reconciliation_incomplete"));
  });

  it("clamps progress and confidence percentages to 0–100", () => {
    const snapshot = buildGraftIntelligence(
      baseInput({
        targetGrafts: 1000,
        extractedGrafts: 1500,
        implantedGrafts: 1200,
        remainingGrafts: 300,
        singles: 1500,
        totalHairs: 3000,
        reconciliationStatus: "balanced",
      })
    );

    assert.equal(snapshot.extractionProgressPercent, 100);
    assert.equal(snapshot.implantationProgressPercent, 100);
    assert.ok(snapshot.graftCountConfidence >= 0 && snapshot.graftCountConfidence <= 100);
  });

  it("never produces NaN outputs", () => {
    const snapshot = buildGraftIntelligence(
      baseInput({
        targetGrafts: 0,
        extractedGrafts: 10,
        implantedGrafts: 0,
        remainingGrafts: 10,
        totalHairs: 0,
        averageHairsPerGraft: null,
      })
    );

    assert.ok(snapshot.averageHairsPerGraft == null || Number.isFinite(snapshot.averageHairsPerGraft));
    assert.ok(
      snapshot.extractionProgressPercent == null ||
        Number.isFinite(snapshot.extractionProgressPercent)
    );
    assert.ok(
      snapshot.implantationProgressPercent == null ||
        Number.isFinite(snapshot.implantationProgressPercent)
    );
    assert.ok(Number.isFinite(snapshot.graftCountConfidence));
  });
});
