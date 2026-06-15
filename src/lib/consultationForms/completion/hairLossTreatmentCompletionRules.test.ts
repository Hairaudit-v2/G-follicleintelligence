import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG } from "../consultationFormConstants";
import { buildConsultationCompletionSummary } from "./buildConsultationCompletionSummary";
import { buildHairLossTreatmentCompletionSummary } from "./hairLossTreatmentCompletionRules";
import type { ConsultationCompletionSummary } from "./consultationCompletionTypes";

const baseInput = (values: Record<string, unknown>) => ({
  consultationId: "c1111111-1111-4111-8111-111111111111",
  formInstanceId: "f2222222-2222-4222-8222-222222222222",
  templateSlug: HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG,
  values,
  completedAt: "2026-06-16T12:00:00.000Z",
});

const REQUIRED_SUMMARY_KEYS: (keyof ConsultationCompletionSummary)[] = [
  "consultationId",
  "formInstanceId",
  "templateSlug",
  "completedAt",
  "outcomeType",
  "primaryConcern",
  "diagnosisImpression",
  "surgicalSuitability",
  "medicalSuitability",
  "recommendedProcedure",
  "estimatedGraftsMin",
  "estimatedGraftsMax",
  "recommendedZones",
  "recommendedTreatments",
  "pathologyRecommended",
  "pathologyReason",
  "quoteNotes",
  "followUpRequired",
  "followUpReason",
  "riskFlags",
  "areaMapHighlights",
  "clinicianNotesPreview",
  "source",
];

function minimalValidValues(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    priority_focus: "hairline",
    duration_band: "1_3y",
    primary_objective: "stabilise_shedding",
    shedding_reported: "mild",
    previous_treatment_yes_no: "no",
    pattern_type: "hairline",
    norwood_classification: "nw3",
    hair_calibre: "medium",
    scalp_condition: "normal",
    medical_flags: [],
    hormonal_flags: [],
    stress_sleep_flags: [],
    nutrition_flags: [],
    pathology_recommended_explicit: false,
    recommended_treatments: ["finasteride", "topical_minoxidil"],
    blood_analysis_recommended: false,
    treatment_priority: "gentle_escalation",
    treatment_timeline: "2_4_weeks",
    hli_pathway_recommended: "patient_twin_full",
    consultation_outcome_type: "medical_management",
    structured_clinical_note: { mode: "clinical_note", note: "AGA pattern; discuss finasteride." },
    follow_up_urgency: "routine",
    ...over,
  };
}

describe("buildHairLossTreatmentCompletionSummary", () => {
  it("male-pattern path carries Norwood into diagnosis impression", () => {
    const s = buildHairLossTreatmentCompletionSummary(
      baseInput(
        minimalValidValues({
          pattern_type: "hairline",
          norwood_classification: "nw4",
        })
      )
    );
    assert.match(s.diagnosisImpression, /Norwood/i);
    assert.match(s.diagnosisImpression, /nw4|Norwood IV/i);
    assert.equal(s.hairLossPatternTypeLabel?.includes("Hairline"), true);
  });

  it("female / diffuse path uses Ludwig and Sinclair without Norwood line", () => {
    const vals = minimalValidValues({
      pattern_type: "female_pattern",
      ludwig_classification: "l2",
      sinclair_classification: "s3",
    });
    delete (vals as Record<string, unknown>).norwood_classification;
    const s = buildHairLossTreatmentCompletionSummary(baseInput(vals));
    assert.match(s.diagnosisImpression, /Ludwig/i);
    assert.match(s.diagnosisImpression, /Sinclair/i);
    assert.ok(!s.diagnosisImpression.includes("Norwood"));
  });

  it("pathology explicit with reason surfaces in summary", () => {
    const s = buildHairLossTreatmentCompletionSummary(
      baseInput(
        minimalValidValues({
          pathology_recommended_explicit: true,
          pathology_reason: "Ferritin not checked in 18 months.",
        })
      )
    );
    assert.equal(s.pathologyRecommended, true);
    assert.match(s.pathologyReason, /Ferritin/i);
  });

  it("blood_analysis_recommended alone flags pathologyRecommended", () => {
    const s = buildHairLossTreatmentCompletionSummary(
      baseInput(
        minimalValidValues({
          pathology_recommended_explicit: false,
          blood_analysis_recommended: true,
        })
      )
    );
    assert.equal(s.pathologyRecommended, true);
    assert.match(s.pathologyReason, /Blood analysis/i);
  });

  it("no surgical graft or quote fields on summary (non-surgical pathway)", () => {
    const v = minimalValidValues();
    assert.equal("donor_quality" in v, false);
    assert.equal("concern_map" in v, false);
    assert.equal("surgical_suitability" in v, false);
    assert.equal("graft_range_estimate" in v, false);
    const s = buildHairLossTreatmentCompletionSummary(baseInput(v));
    assert.equal(s.estimatedGraftsMin, null);
    assert.equal(s.estimatedGraftsMax, null);
    assert.deepEqual(s.recommendedZones, []);
    assert.equal(s.quoteNotes, "");
    assert.equal(s.surgicalSuitability, "not_assessed");
    assert.equal(s.medicalSuitability, "not_assessed");
  });

  it("returns all core ConsultationCompletionSummary keys plus HLI labels", () => {
    const s = buildHairLossTreatmentCompletionSummary(baseInput(minimalValidValues()));
    for (const k of REQUIRED_SUMMARY_KEYS) {
      assert.ok(k in s, `missing summary key: ${k}`);
    }
    assert.equal(typeof s.hliPathwayRecommendedLabel, "string");
    assert.ok((s.hliPathwayRecommendedLabel ?? "").length > 0);
    assert.equal(typeof s.treatmentPriorityLabel, "string");
    assert.equal(typeof s.treatmentTimelineLabel, "string");
    assert.equal(typeof s.bloodAnalysisRecommended, "boolean");
  });

  it("wrong template slug returns sparse summary from HLT builder", () => {
    const s = buildHairLossTreatmentCompletionSummary({
      ...baseInput(minimalValidValues()),
      templateSlug: "other-template",
    });
    assert.equal(s.outcomeType, "undecided");
    assert.equal(s.recommendedTreatments.length, 0);
  });
});

describe("buildConsultationCompletionSummary dispatch", () => {
  it("routes hair-loss-treatment slug to HLT rules", () => {
    const s = buildConsultationCompletionSummary(baseInput(minimalValidValues()));
    assert.equal(s.templateSlug, HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG);
    assert.ok((s.hliPathwayRecommendedLabel ?? "").length > 0);
  });
});
