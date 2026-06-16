import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG } from "../consultationFormConstants";
import { buildConsultationCompletionSummary } from "./buildConsultationCompletionSummary";
import { buildFemaleHairLossCompletionSummary } from "./femaleHairLossCompletionRules";
import type { ConsultationCompletionSummary } from "./consultationCompletionTypes";

const baseInput = (values: Record<string, unknown>) => ({
  consultationId: "c1111111-1111-4111-8111-111111111111",
  formInstanceId: "f2222222-2222-4222-8222-222222222222",
  templateSlug: FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG,
  values,
  completedAt: "2026-06-16T12:00:00.000Z",
});

function minimalFemaleValues(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    priority_focus: "vertex_part_density",
    duration_band: "1_3y",
    primary_objective: "stabilise_shedding",
    shedding_reported: "mild",
    postpartum_status: "not_recently_postpartum",
    previous_treatment_yes_no: "no",
    female_pattern_type: "part_widening",
    ludwig_classification: "l2",
    sinclair_classification: "s3",
    traction_pattern_present: false,
    scalp_condition: "normal",
    hair_calibre: "medium",
    miniaturisation_clinical: "yes",
    hormonal_flags: ["pcos_features"],
    medical_flags: [],
    medication_tolerance: "na",
    ferritin_history_known: "normal_recent",
    thyroid_history_known: "treated_euthyroid",
    pathology_recommended_explicit: false,
    blood_analysis_recommended: false,
    recommended_treatments: ["topical_minoxidil"],
    hli_pathway_recommended: "patient_twin_full",
    treatment_priority: "gentle_escalation",
    treatment_timeline: "2_4_weeks",
    structured_clinical_note: { mode: "clinical_note", note: "FPHL pattern; discuss topical therapy." },
    follow_up_urgency: "routine",
    ...over,
  };
}

describe("buildFemaleHairLossCompletionSummary", () => {
  it("exposes femaleHairLossCompletionSnapshot with expected labels", () => {
    const s = buildFemaleHairLossCompletionSummary(baseInput(minimalFemaleValues()));
    assert.equal(s.templateSlug, FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG);
    assert.ok(s.femaleHairLossCompletionSnapshot);
    assert.match(s.femaleHairLossCompletionSnapshot.patternLabel, /part|widening/i);
    assert.ok(s.femaleHairLossCompletionSnapshot.durationLabel.length > 0);
    assert.ok(s.femaleHairLossCompletionSnapshot.sheddingLabel.length > 0);
    assert.match(s.femaleHairLossCompletionSnapshot.femaleScaleSummary, /Ludwig/i);
    assert.match(s.femaleHairLossCompletionSnapshot.femaleScaleSummary, /Sinclair/i);
    assert.match(s.femaleHairLossCompletionSnapshot.hormonalSystemicSummary, /PCOS/i);
    assert.ok(s.femaleHairLossCompletionSnapshot.ferritinLabel.length > 0);
    assert.ok(s.femaleHairLossCompletionSnapshot.thyroidLabel.length > 0);
    assert.ok(s.femaleHairLossCompletionSnapshot.followUpUrgencyLabel.length > 0);
    assert.ok(s.femaleHairLossCompletionSnapshot.treatmentPathwayLabel.length > 0);
  });

  it("pathology reason is required in schema workflow; explicit true without free-text still yields summary pathologyReason", () => {
    const s = buildFemaleHairLossCompletionSummary(
      baseInput(
        minimalFemaleValues({
          pathology_recommended_explicit: true,
          pathology_reason: "",
        })
      )
    );
    assert.equal(s.pathologyRecommended, true);
    assert.ok(s.pathologyReason.length > 0);
  });

  it("no graft, donor, or quote fields on completion summary", () => {
    const s = buildFemaleHairLossCompletionSummary(baseInput(minimalFemaleValues()));
    assert.equal(s.estimatedGraftsMin, null);
    assert.equal(s.estimatedGraftsMax, null);
    assert.deepEqual(s.recommendedZones, []);
    assert.equal(s.quoteNotes, "");
    assert.equal(s.surgicalSuitability, "not_assessed");
  });

  it("visual assessment: empty ludwig and noisy selected_zones still build snapshot", () => {
    const s = buildFemaleHairLossCompletionSummary(
      baseInput(
        minimalFemaleValues({
          ludwig_classification: "",
          selected_zones: [123, "donor_safe_zone"] as unknown[],
        })
      )
    );
    assert.ok(s.femaleHairLossCompletionSnapshot);
    assert.match(s.femaleHairLossCompletionSnapshot.femaleScaleSummary, /Sinclair/i);
  });

  it("wrong template slug returns sparse summary", () => {
    const s = buildFemaleHairLossCompletionSummary({
      ...baseInput(minimalFemaleValues()),
      templateSlug: "other-template",
    });
    assert.equal(s.femaleHairLossCompletionSnapshot, undefined);
  });
});

describe("buildConsultationCompletionSummary female dispatch", () => {
  it("routes female-hair-loss-consultation slug to female rules", () => {
    const s: ConsultationCompletionSummary = buildConsultationCompletionSummary(baseInput(minimalFemaleValues()));
    assert.equal(s.templateSlug, FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG);
    assert.ok(s.femaleHairLossCompletionSnapshot?.patternLabel);
  });
});
