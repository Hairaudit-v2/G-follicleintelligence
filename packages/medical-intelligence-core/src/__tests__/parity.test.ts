/**
 * Parity tests: extracted medical-intelligence-core outputs match HLI expectations.
 * Run: pnpm --filter @hairlongevity/medical-intelligence-core test
 */

import assert from "node:assert/strict";
import {
  getAllMarkerDefinitions,
  interpretMarker,
  interpretMarkers,
  buildClinicalInsights,
  buildCurrentVsPreviousTrendRows,
  recommendedTestsFromFlags,
  getEligibility,
  ruleBasedEligible,
  reasonFromFlags,
  buildLongevitySignals,
  LONGEVITY_SIGNAL_KEY,
  buildDraftsFromExtractedMarkers,
  resolveMarkerKey,
} from "../index";
import { REVIEW_OUTCOME } from "../constants/reviewOutcomes";
import type { LongevityQuestionnaireResponses } from "../types/questionnaire";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

const IRON_RISK_RESPONSES: LongevityQuestionnaireResponses = {
  medicalHistory: {
    diagnoses: ["iron_deficiency"],
    priorBloodTests: "older_than_3_months",
  },
  mainConcern: {
    primaryConcerns: ["diffuse_thinning"],
  },
};

const THYROID_RESPONSES: LongevityQuestionnaireResponses = {
  medicalHistory: {
    diagnoses: ["thyroid_disorder"],
    priorBloodTests: "no",
  },
  mainConcern: {
    primaryConcerns: ["diffuse_thinning"],
  },
};

test("marker registry exports all existing markers", () => {
  const defs = getAllMarkerDefinitions();
  assert.ok(defs.length >= 40, "Expected full marker registry");
  const keys = new Set(defs.map((d) => d.key));
  for (const expected of ["ferritin", "tsh", "vitamin_d_25oh", "crp", "shbg", "alt"]) {
    assert.ok(keys.has(expected), `Missing marker key: ${expected}`);
  }
});

test("interpretMarker output unchanged for ferritin low", () => {
  const result = interpretMarker("Ferritin", 25, "µg/L", null, null);
  assert.deepEqual(result, {
    marker: "Ferritin",
    value: 25,
    unit: "µg/L",
    status: "low",
    clinical_flag: "Fe",
    explanation: "Low ferritin can contribute to telogen shedding; consider repletion for hair.",
  });
});

test("interpretMarkers output unchanged for fixture batch", () => {
  const results = interpretMarkers([
    { marker_name: "TSH", value: 1.5, unit: "mU/L" },
    { marker_name: "unknown_marker", value: 10, unit: "U/L", reference_low: 5, reference_high: 15 },
  ]);
  assert.equal(results[0].status, "optimal");
  assert.equal(results[0].marker, "TSH");
  assert.equal(results[1].status, "normal");
});

test("buildClinicalInsights output unchanged for iron + ferritin fixture", () => {
  const insights = buildClinicalInsights({
    derivedFlags: { possibleIronRisk: true, bloodsLikelyNeeded: true },
    interpretedMarkers: interpretMarkers([{ marker_name: "ferritin", value: 20, unit: "µg/L" }]),
    markerTrends: [],
    review_outcome: REVIEW_OUTCOME.BLOODS_RECOMMENDED,
    workflow: { hasStructuredMarkers: false, hasBloodResultUploadDocument: false },
  });
  assert.ok(
    insights.activeDrivers.includes("Iron / oxygen delivery"),
    "Expected iron driver"
  );
  assert.ok(
    insights.clinicianInsights.some((item) => item.includes("Ferritin")),
    "Expected ferritin clinician insight"
  );
  assert.ok(
    insights.clinicianInsights.some((item) => item.includes("Structured blood result review is still pending")),
    "Expected pending blood review insight"
  );
});

test("blood marker trend output unchanged for pure comparison fixture", () => {
  const trends = buildCurrentVsPreviousTrendRows(
    [
      {
        marker_name: "Ferritin",
        value: 60,
        unit: "µg/L",
        collected_at: "2026-01-15",
        intake_id: "intake-2",
      },
    ],
    [
      {
        marker_name: "Ferritin",
        value: 45,
        unit: "µg/L",
        collected_at: "2025-10-01",
        intake_id: "intake-1",
      },
      {
        marker_name: "Ferritin",
        value: 60,
        unit: "µg/L",
        collected_at: "2026-01-15",
        intake_id: "intake-2",
      },
    ],
    "intake-2"
  );
  assert.equal(trends.length, 1);
  assert.equal(trends[0].markerKey, "ferritin");
  assert.equal(trends[0].direction, "up");
  assert.equal(trends[0].previous?.value, 45);
});

test("blood request eligibility output unchanged for iron-risk fixture", () => {
  assert.equal(ruleBasedEligible(IRON_RISK_RESPONSES), true);
  const tests = recommendedTestsFromFlags(IRON_RISK_RESPONSES);
  assert.ok(tests.includes("ferritin"));
  assert.ok(tests.includes("iron_studies"));
  assert.match(reasonFromFlags(IRON_RISK_RESPONSES), /iron\/ferritin relevance/);

  const eligibility = getEligibility(IRON_RISK_RESPONSES, null);
  assert.ok(eligibility?.eligible);
  assert.equal(eligibility?.recommended_by, "rules");
});

test("blood request eligibility unchanged for thyroid-risk fixture", () => {
  const tests = recommendedTestsFromFlags(THYROID_RESPONSES);
  assert.ok(tests.includes("tsh"));
  assert.ok(tests.includes("t4"));
});

test("normalized signal payloads unchanged for iron-risk fixture", () => {
  const signals = buildLongevitySignals({
    profileId: "profile-1",
    intakeId: "intake-1",
    derivedFlags: { possibleIronRisk: true },
    clinicalInsights: buildClinicalInsights({
      interpretedMarkers: interpretMarkers([{ marker_name: "ferritin", value: 18, unit: "µg/L" }]),
    }),
  });
  const ironSignal = signals.find((s) => s.signal_key === LONGEVITY_SIGNAL_KEY.IRON_RISK_ACTIVE);
  assert.ok(ironSignal);
  assert.equal(ironSignal.source_system, "hli_longevity");
  assert.equal(ironSignal.status, "active");
  assert.deepEqual(ironSignal.payload, {
    profile_id: "profile-1",
    intake_id: "intake-1",
    evidence: ["questionnaire_possible_iron_risk", "clinical_driver_iron_oxygen_delivery"],
  });
});

test("extraction draft builder unchanged for duplicate suppression fixture", () => {
  const drafts = buildDraftsFromExtractedMarkers({
    profile_id: "p1",
    intake_id: "i1",
    markers: [
      { name: "Ferritin", value: 42, unit: "µg/L", confidence: 0.9, sourceFile: "doc1__report.pdf" },
      { name: "Ferritin", value: 42, unit: "µg/L", confidence: 0.9, sourceFile: "doc1__report.pdf" },
    ],
    sourceDocuments: [{ id: "doc1", filename: "report.pdf", blood_request_id: null }],
    existingMarkers: [],
  });
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].marker_name, "ferritin");
  assert.equal(drafts[0].display_name, "Ferritin");
});

test("HLI import path resolves package exports", async () => {
  const hliRegistry = await import("../../../../lib/longevity/bloodMarkerRegistry");
  const hliInterpretation = await import("../../../../lib/longevity/bloodInterpretation");
  assert.equal(typeof hliRegistry.resolveMarkerKey, "function");
  assert.equal(typeof hliInterpretation.interpretMarker, "function");
  assert.equal(resolveMarkerKey("Serum Ferritin"), hliRegistry.resolveMarkerKey("Serum Ferritin"));
});

console.log("\nAll medical-intelligence-core parity tests passed.");
