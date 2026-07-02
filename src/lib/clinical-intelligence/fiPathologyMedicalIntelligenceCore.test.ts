import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import type { PathologyResultItemRow } from "@/src/lib/pathology/pathologyResultTypes";
import {
  buildFiPathologyMedicalIntelligenceDisplay,
  buildFiMedicalIntelligenceTwinSummary,
  readFiMedicalIntelligenceSnapshot,
} from "@/src/lib/clinical-intelligence/fiPathologyMedicalIntelligenceCore";
import { FI_MEDICAL_INTELLIGENCE_SOURCE } from "@/src/lib/clinical-intelligence/fiPathologyMedicalIntelligenceTypes";

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

const reviewedResult = {
  id: "result-1",
  result_date: "2026-07-01",
  status: "reviewed" as const,
  metadata: {},
};

test("buildFiPathologyMedicalIntelligenceDisplay returns interpreted markers for reviewed results", () => {
  const display = buildFiPathologyMedicalIntelligenceDisplay({
    result: reviewedResult,
    items: [
      fiItem({ test_label: "Ferritin", result_value: "25", result_unit: "ug/L" }),
      fiItem({ id: "tsh", test_label: "TSH", result_value: "2.1", result_unit: "mIU/L" }),
    ],
    computedAt: "2026-07-02T12:00:00.000Z",
  });
  assert.ok(display);
  assert.equal(display?.source, FI_MEDICAL_INTELLIGENCE_SOURCE);
  assert.equal(display?.clinicianReviewRequired, true);
  assert.equal(display?.interpretedMarkers.length, 2);
  assert.equal(display?.interpretedMarkers[0]?.status, "low");
  assert.equal(display?.interpretedMarkers[1]?.status, "optimal");
});

test("low ferritin surfaces Fe clinical flag and iron driver", () => {
  const display = buildFiPathologyMedicalIntelligenceDisplay({
    result: reviewedResult,
    items: [fiItem({ test_label: "Ferritin", result_value: "25", result_unit: "ug/L" })],
  });
  assert.ok(display);
  assert.deepEqual(display?.clinicalFlags, ["Fe"]);
  assert.equal(display?.interpretedMarkers[0]?.clinical_flag, "Fe");
  assert.ok(display?.activeDrivers.some((d) => d.toLowerCase().includes("iron")));
});

test("unknown or non-numeric markers are skipped safely", () => {
  const display = buildFiPathologyMedicalIntelligenceDisplay({
    result: { ...reviewedResult, status: "draft" },
    items: [
      fiItem({ id: "a", test_label: "", test_code: null, result_value: "25" }),
      fiItem({ id: "b", test_label: "Notes", result_value: "see comment" }),
      fiItem({ id: "c", test_label: "Unknown marker XYZ", result_value: "10", reference_range: "5-15" }),
    ],
  });
  assert.ok(display);
  assert.equal(display?.skippedMarkerCount, 2);
  assert.equal(display?.interpretedMarkers.length, 1);
  assert.equal(display?.interpretedMarkers[0]?.status, "normal");
});

test("archived results do not produce medical intelligence display", () => {
  const display = buildFiPathologyMedicalIntelligenceDisplay({
    result: { ...reviewedResult, status: "archived" },
    items: [fiItem({ test_label: "Ferritin", result_value: "25" })],
  });
  assert.equal(display, null);
});

test("readFiMedicalIntelligenceSnapshot returns stored snapshot when valid", () => {
  const snapshot = buildFiPathologyMedicalIntelligenceDisplay({
    result: reviewedResult,
    items: [fiItem({ test_label: "Ferritin", result_value: "25" })],
  });
  assert.ok(snapshot);
  const read = readFiMedicalIntelligenceSnapshot({
    medical_intelligence_snapshot: snapshot,
  });
  assert.ok(read);
  assert.equal(read?.interpretedMarkers.length, 1);
});

test("buildFiMedicalIntelligenceTwinSummary produces compact twin payload", () => {
  const summary = buildFiMedicalIntelligenceTwinSummary({
    result: reviewedResult,
    items: [fiItem({ test_label: "Ferritin", result_value: "25", result_unit: "ug/L" })],
  });
  assert.ok(summary);
  assert.equal(summary?.pathology_result_id, "result-1");
  assert.equal(summary?.interpreted_marker_count, 1);
  assert.deepEqual(summary?.clinical_flags, ["Fe"]);
});

test("pathology result detail loader attaches medical intelligence via shared builder", async () => {
  const loaderPath = path.join(process.cwd(), "src/lib/pathology/pathologyResultLoad.server.ts");
  const source = readFileSync(loaderPath, "utf8");
  assert.match(source, /buildFiPathologyMedicalIntelligenceDisplay/);
  assert.match(source, /medicalIntelligence/);
  assert.doesNotMatch(source, /optimalLow|hairOptimal|interpretMarker\s*\(/);
});

test("FI OS pathology display layer does not duplicate shared clinical thresholds", () => {
  const files = [
    "src/lib/clinical-intelligence/fiPathologyMedicalIntelligenceCore.ts",
    "src/lib/pathology/pathologyResultLoad.server.ts",
    "src/components/clinical-intelligence/MedicalIntelligencePanel.tsx",
  ];
  for (const rel of files) {
    const source = readFileSync(path.join(process.cwd(), rel), "utf8");
    assert.doesNotMatch(source, /optimalLow|hairOptimal|Ferritin.*<\s*15/);
    assert.doesNotMatch(source, /interpretMarker\s*\(/);
  }
  const coreSource = readFileSync(
    path.join(process.cwd(), "src/lib/clinical-intelligence/fiPathologyMedicalIntelligenceCore.ts"),
    "utf8"
  );
  assert.match(coreSource, /interpretFiPathologyMarkers/);
  assert.match(coreSource, /buildFiClinicalInsights/);
});

test("patient twin pathology schema accepts null latest_medical_intelligence", async () => {
  const { patientTwinPathologySectionSchema } = await import("@/src/lib/patientTwin/patientTwinSchema");
  const parsed = patientTwinPathologySectionSchema.parse({
    requests: [],
    results: [],
    item_cap: 12,
    results_item_cap: 12,
    abnormal_markers_total: 0,
    last_result_reviewed_at: null,
    latest_ai_interpretation: null,
    latest_medical_intelligence: null,
  });
  assert.equal(parsed.latest_medical_intelligence, null);
});
