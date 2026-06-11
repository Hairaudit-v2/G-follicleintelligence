import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ConsultationCompletionSummary } from "@/src/lib/consultationForms/completion/consultationCompletionTypes";

import { quoteDraftAllowedForAutomationRun } from "./consultationAutomationPolicy";

function baseSummary(over: Partial<ConsultationCompletionSummary> = {}): ConsultationCompletionSummary {
  return {
    consultationId: "c1",
    formInstanceId: "f1",
    templateSlug: "hair_transplant",
    completedAt: "2026-01-01T00:00:00.000Z",
    outcomeType: "medical_management",
    primaryConcern: "",
    diagnosisImpression: "",
    surgicalSuitability: "not_assessed",
    medicalSuitability: "not_assessed",
    recommendedProcedure: "",
    estimatedGraftsMin: null,
    estimatedGraftsMax: null,
    recommendedZones: [],
    recommendedTreatments: [],
    pathologyRecommended: false,
    pathologyReason: "",
    quoteNotes: "",
    followUpRequired: false,
    followUpReason: "",
    riskFlags: [],
    areaMapHighlights: [],
    clinicianNotesPreview: "",
    source: "rules_v1",
    ...over,
  };
}

describe("consultationAutomationPolicy", () => {
  it("quoteDraftAllowedForAutomationRun: default mode uses intent signals", () => {
    assert.equal(quoteDraftAllowedForAutomationRun(undefined, baseSummary()), false);
    assert.equal(quoteDraftAllowedForAutomationRun(undefined, baseSummary({ outcomeType: "proceed_surgery" })), true);
    assert.equal(quoteDraftAllowedForAutomationRun(undefined, baseSummary({ quoteNotes: "x" })), true);
  });

  it("quoteDraftAllowedForAutomationRun: explicit quote_draft bypasses intent when filter is present", () => {
    assert.equal(
      quoteDraftAllowedForAutomationRun({ quote_draft: true, follow_up_task: true }, baseSummary()),
      true
    );
    assert.equal(quoteDraftAllowedForAutomationRun({ follow_up_task: true }, baseSummary()), false);
  });
});
