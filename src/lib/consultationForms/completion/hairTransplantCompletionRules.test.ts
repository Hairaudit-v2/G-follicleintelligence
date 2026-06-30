import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseGraftRangeText } from "./consultationCompletionExtractors";
import { HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG } from "../consultationFormConstants";
import { buildHairTransplantCompletionSummary } from "./hairTransplantCompletionRules";

const baseInput = (values: Record<string, unknown>) => ({
  consultationId: "c1111111-1111-4111-8111-111111111111",
  formInstanceId: "f2222222-2222-4222-8222-222222222222",
  templateSlug: HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG,
  values,
  completedAt: "2026-06-11T12:00:00.000Z",
});

describe("buildHairTransplantCompletionSummary", () => {
  it("parseGraftRangeText handles dash variants", () => {
    assert.deepEqual(parseGraftRangeText("2000-2800"), { min: 2000, max: 2800 });
    assert.deepEqual(parseGraftRangeText("2500"), { min: 2500, max: 2500 });
  });

  it("empty form returns undecided summary", () => {
    const s = buildHairTransplantCompletionSummary(baseInput({}));
    assert.equal(s.outcomeType, "undecided");
    assert.equal(s.pathologyRecommended, false);
    assert.equal(s.riskFlags.length, 0);
    assert.equal(s.areaMapHighlights.length, 0);
  });

  it("explicit outcomeType maps correctly", () => {
    const s = buildHairTransplantCompletionSummary(
      baseInput({ consultation_outcome_type: "proceed_surgery" })
    );
    assert.equal(s.outcomeType, "proceed_surgery");
  });

  it("graft min/max extracted from completion fields", () => {
    const s = buildHairTransplantCompletionSummary(
      baseInput({
        completion_estimated_grafts_min: 1800,
        completion_estimated_grafts_max: 2400,
      })
    );
    assert.equal(s.estimatedGraftsMin, 1800);
    assert.equal(s.estimatedGraftsMax, 2400);
  });

  it("graft range parsed from free text when numbers absent", () => {
    const s = buildHairTransplantCompletionSummary(
      baseInput({ graft_range_estimate: "2000–2800" })
    );
    assert.equal(s.estimatedGraftsMin, 2000);
    assert.equal(s.estimatedGraftsMax, 2800);
  });

  it("body_area_map highlights extracted", () => {
    const s = buildHairTransplantCompletionSummary(
      baseInput({
        concern_map: {
          view: "frontal_hairline",
          annotations: [
            {
              id: "1",
              view: "frontal_hairline",
              x: 10,
              y: 20,
              label: "temple_recession",
              severity: "moderate",
              tags: [],
              notes: "",
              createdAt: "t",
            },
          ],
        },
      })
    );
    assert.equal(s.areaMapHighlights.length, 1);
    assert.ok(s.areaMapHighlights[0]?.view.includes("Frontal"));
    assert.equal(s.areaMapHighlights[0]?.label, "temple_recession");
    assert.equal(s.areaMapHighlights[0]?.severity, "moderate");
  });

  it("concern_map highlights merge duplicate region labels across views", () => {
    const s = buildHairTransplantCompletionSummary(
      baseInput({
        concern_map: {
          view: "frontal_hairline",
          annotations: [
            {
              id: "1",
              view: "frontal_hairline",
              x: 10,
              y: 20,
              label: "temple_recession",
              severity: "mild",
              tags: [],
              notes: "",
              createdAt: "t",
            },
            {
              id: "2",
              view: "crown",
              x: 30,
              y: 40,
              label: "temple_recession",
              severity: "severe",
              tags: [],
              notes: "",
              createdAt: "t",
            },
          ],
        },
      })
    );
    assert.equal(s.areaMapHighlights.length, 1);
    assert.equal(s.areaMapHighlights[0]?.severity, "severe");
    assert.ok(s.areaMapHighlights[0]?.view.includes("Frontal"));
    assert.ok(s.areaMapHighlights[0]?.view.includes("Crown"));
  });

  it("voice/clinical notes preview extracted", () => {
    const s = buildHairTransplantCompletionSummary(
      baseInput({
        diagnosis_clinical_note: { mode: "clinical_note", note: "AGA pattern." },
        clinician_voice_note: { mode: "voice_note", transcript: "Discussed donor." },
      })
    );
    assert.ok(s.clinicianNotesPreview.includes("AGA"));
    assert.ok(s.clinicianNotesPreview.includes("donor"));
  });

  it("pathologyRecommended when medical flags include medical_review_required", () => {
    const s = buildHairTransplantCompletionSummary(
      baseInput({
        medical_flags: ["medical_review_required"],
      })
    );
    assert.equal(s.pathologyRecommended, true);
  });

  it("missing optional fields do not throw", () => {
    assert.doesNotThrow(() =>
      buildHairTransplantCompletionSummary(
        baseInput({
          priority_focus: "hairline",
          diagnosis_free_text: "AGA",
          recommended_plan_summary: "FUE plan",
        })
      )
    );
  });

  it("v2: duration_band and norwood_classification feed diagnosis impression", () => {
    const s = buildHairTransplantCompletionSummary(
      baseInput({
        duration_band: "1_3y",
        norwood_classification: "nw3",
        structured_clinical_note: { mode: "clinical_note", note: "Stable AGA." },
        ai_recommended_plan_summary: "FUE 2000–2500 grafts hairline+crown.",
      })
    );
    assert.match(s.diagnosisImpression, /Norwood III/i);
    assert.match(s.diagnosisImpression, /1–3 years/i);
    assert.match(s.diagnosisImpression, /Stable AGA/i);
    assert.equal(s.recommendedProcedure, "FUE 2000–2500 grafts hairline+crown.");
  });

  it("canonical risk flags merge legacy risk_flags_confirmed without duplication", () => {
    const s = buildHairTransplantCompletionSummary(
      baseInput({
        medical_flags: ["smoking", "medical_review_required"],
        risk_flags_confirmed: ["smoking", "diabetes"],
      })
    );
    assert.equal(s.riskFlags.includes("smoking"), true);
    assert.equal(s.riskFlags.includes("diabetes"), true);
    assert.equal(s.riskFlags.filter((x) => x === "smoking").length, 1);
  });

  it("visual assessment: empty Norwood and junk selected_zones do not break completion", () => {
    assert.doesNotThrow(() =>
      buildHairTransplantCompletionSummary(
        baseInput({
          duration_band: "1_3y",
          norwood_classification: "",
          selected_zones: ["not-a-zone", 123, null, "crown"] as unknown[],
          structured_clinical_note: { mode: "clinical_note", note: "Stable." },
        })
      )
    );
    const s = buildHairTransplantCompletionSummary(
      baseInput({
        duration_band: "1_3y",
        norwood_classification: "",
        selected_zones: ["bogus"],
        structured_clinical_note: { mode: "clinical_note", note: "Stable." },
      })
    );
    assert.ok(!s.diagnosisImpression.includes("Norwood"));
    assert.match(s.diagnosisImpression, /1–3 years|1-3 years/i);
  });
});
