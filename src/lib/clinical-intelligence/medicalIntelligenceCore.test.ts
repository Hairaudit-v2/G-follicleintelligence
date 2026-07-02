import assert from "node:assert/strict";
import test from "node:test";

import { interpretMarkers } from "@hairlongevity/medical-intelligence-core";

import type { PathologyResultItemRow } from "@/src/lib/pathology/pathologyResultTypes";
import {
  buildFiClinicalInsights,
  buildFiLongevitySignals,
  getFiBloodworkEligibility,
  interpretFiPathologyMarkers,
  mapFiPathologyItemsToMarkerInputs,
} from "@/src/lib/clinical-intelligence/medicalIntelligenceCore";

function fiItem(
  partial: Partial<PathologyResultItemRow> &
    Pick<PathologyResultItemRow, "test_label" | "result_value">
): PathologyResultItemRow {
  return {
    id: partial.id ?? "item-1",
    tenant_id: partial.tenant_id ?? "tenant-1",
    result_id: partial.result_id ?? "result-1",
    test_code: partial.test_code ?? null,
    test_label: partial.test_label,
    result_value: partial.result_value,
    result_unit: partial.result_unit ?? null,
    reference_range: partial.reference_range ?? null,
    flag: partial.flag ?? "unknown",
    sort_order: partial.sort_order ?? 0,
    metadata: partial.metadata ?? {},
    created_at: partial.created_at ?? "2026-01-01T00:00:00.000Z",
  };
}

test("FI OS imports @hairlongevity/medical-intelligence-core", () => {
  const out = interpretMarkers([{ marker_name: "TSH", value: 2.1, unit: "mIU/L" }]);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.status, "optimal");
});

test("mapFiPathologyItemsToMarkerInputs maps ferritin with reference range", () => {
  const { markerInputs, skipped } = mapFiPathologyItemsToMarkerInputs([
    fiItem({
      test_label: "Ferritin",
      result_value: "25",
      result_unit: "ug/L",
      reference_range: "30-300",
    }),
  ]);
  assert.equal(skipped.length, 0);
  assert.equal(markerInputs.length, 1);
  assert.equal(markerInputs[0]?.marker_name, "Ferritin");
  assert.equal(markerInputs[0]?.value, 25);
  assert.equal(markerInputs[0]?.reference_low, 30);
  assert.equal(markerInputs[0]?.reference_high, 300);
});

test("interpretFiPathologyMarkers uses shared interpretMarkers for low ferritin", () => {
  const { interpreted, mapping } = interpretFiPathologyMarkers([
    fiItem({ test_label: "Ferritin", result_value: "25", result_unit: "ug/L" }),
  ]);
  assert.equal(mapping.skipped.length, 0);
  assert.equal(interpreted.length, 1);
  assert.equal(interpreted[0]?.status, "low");
  assert.equal(interpreted[0]?.clinical_flag, "Fe");
});

test("buildFiClinicalInsights generates iron driver without FI-local rules", () => {
  const insights = buildFiClinicalInsights({
    pathologyItems: [fiItem({ test_label: "Ferritin", result_value: "25", result_unit: "ug/L" })],
    derivedFlags: { possibleIronRisk: true },
  });
  assert.ok(insights.activeDrivers.some((d) => d.toLowerCase().includes("iron")));
  assert.ok(
    insights.clinicianInsights.some((line) => line.toLowerCase().includes("ferritin")),
    "expected ferritin insight from shared package"
  );
});

test("buildFiLongevitySignals emits normalized signals from FI marker data", () => {
  const signals = buildFiLongevitySignals({
    pathologyResultId: "result-abc",
    patientId: "patient-1",
    pathologyItems: [fiItem({ test_label: "Ferritin", result_value: "25", result_unit: "ug/L" })],
    derivedFlags: { possibleIronRisk: true },
  });
  assert.ok(signals.length > 0);
  assert.ok(signals.some((s) => s.signal_key === "iron_risk_active"));
});

test("incomplete or unknown markers are skipped safely", () => {
  const { interpreted, mapping } = interpretFiPathologyMarkers([
    fiItem({ id: "a", test_label: "", test_code: null, result_value: "25" }),
    fiItem({ id: "b", test_label: "Notes", result_value: "see comment" }),
    fiItem({ id: "c", test_label: "Unknown marker XYZ", result_value: "10", reference_range: "5-15" }),
  ]);
  assert.equal(mapping.skipped.length, 2);
  assert.equal(interpreted.length, 1);
  assert.equal(interpreted[0]?.status, "normal");
});

test("getFiBloodworkEligibility delegates to shared getEligibility", () => {
  const eligible = getFiBloodworkEligibility({
    questionnaireResponses: {
      medicalHistory: { diagnoses: ["iron_deficiency"] },
      mainConcern: { primaryConcerns: ["diffuse_thinning"] },
    },
  });
  assert.ok(eligible);
  assert.equal(eligible?.eligible, true);
  assert.ok(eligible?.recommended_tests.includes("ferritin"));
});

test("getFiBloodworkEligibility respects recent pathology on file", () => {
  const eligible = getFiBloodworkEligibility({
    questionnaireResponses: {
      medicalHistory: { diagnoses: ["iron_deficiency"] },
      mainConcern: { primaryConcerns: ["diffuse_thinning"] },
    },
    hasRecentPathologyOnFile: true,
  });
  assert.equal(eligible, null);
});
