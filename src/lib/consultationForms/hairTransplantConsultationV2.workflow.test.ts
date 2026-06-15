import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildHairTransplantCompletionSummary } from "./completion/hairTransplantCompletionRules";
import { HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG } from "./consultationFormConstants";
import { evaluateConsultationFormCondition } from "./consultationFormCondition";
import {
  validateBodyAreaMapShapesInValues,
  validateConsultationFormRequiredFields,
} from "./consultationFormValidation";
import type { ConsultationFormSchema } from "./consultationFormTypes";
import {
  HAIR_TRANSPLANT_V2_SURGICAL_PRIMARY_OBJECTIVES,
  hairTransplantConsultationSchema,
  hairTransplantConsultationSchemaV2,
  hairTransplantConsultationSchemaV2_1,
} from "./templates/hairTransplantConsultationTemplate";

function collectFieldIds(schema: ConsultationFormSchema): string[] {
  return schema.sections.flatMap((s) => s.fields.map((f) => f.id));
}

const v2 = hairTransplantConsultationSchemaV2;

function visibleSectionCount(values: Record<string, unknown>): number {
  return v2.sections.filter((s) => evaluateConsultationFormCondition(s.showWhen, values)).length;
}

function findField(fieldId: string) {
  for (const sec of v2.sections) {
    const f = sec.fields.find((x) => x.id === fieldId);
    if (f) return { section: sec, field: f };
  }
  return null;
}

/** Minimal valid v2 values for a non-surgical pathway (surgical section off). */
function baseV2NonSurgicalValues(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    priority_focus: "hairline",
    duration_band: "1_3y",
    primary_objective: "medical_non_surgical",
    previous_treatment_yes_no: "no",
    previous_surgery_yes_no: "no",
    onset_pattern: "gradual",
    norwood_classification: "nw3",
    scalp_condition: "normal",
    hair_calibre: "medium",
    recommended_treatments: ["finasteride", "topical_minoxidil"],
    recommended_zones: ["hairline"],
    consultation_outcome_type: "medical_management",
    medical_suitability: "suitable",
    surgical_suitability: "not_suitable",
    ai_recommended_plan_summary: "Medical therapy first line.",
    structured_clinical_note: { mode: "clinical_note", note: "AGA pattern; counselled on meds." },
    follow_up_urgency: "routine",
    ...over,
  };
}

/** Minimal valid v2 values when surgical section is on (donor/recipient filled). */
function baseV2SurgicalValues(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...baseV2NonSurgicalValues({
      primary_objective: "ht_primary",
      surgical_suitability: "suitable",
      consultation_outcome_type: "proceed_surgery",
    }),
    donor_quality: "good",
    recipient_quality: "good",
    concern_map: { annotations: [] },
    ...over,
  };
}

describe("Hair Transplant Consultation v2 — section visibility (clinic QA)", () => {
  it("non-surgical objective hides Surgical Assessment (5 visible sections)", () => {
    const values = baseV2NonSurgicalValues();
    assert.equal(visibleSectionCount(values), 5);
    const surgical = v2.sections.find((s) => s.id === "surgical_assessment");
    assert.ok(surgical?.showWhen);
    assert.equal(evaluateConsultationFormCondition(surgical.showWhen, values), false);
  });

  it("surgery objectives show Surgical Assessment (6 visible sections)", () => {
    for (const obj of HAIR_TRANSPLANT_V2_SURGICAL_PRIMARY_OBJECTIVES) {
      const values = baseV2NonSurgicalValues({ primary_objective: obj });
      assert.equal(visibleSectionCount(values), 6, `expected surgical visible for ${obj}`);
    }
  });

  it("repair_revision + prior surgery shows prior_ht_year field", () => {
    const hit = findField("prior_ht_year");
    assert.ok(hit?.field.showWhen);
    assert.equal(
      evaluateConsultationFormCondition(hit.field.showWhen, {
        previous_surgery_yes_no: "no",
      }),
      false
    );
    assert.equal(
      evaluateConsultationFormCondition(hit.field.showWhen, {
        previous_surgery_yes_no: "yes",
      }),
      true
    );
  });

  it("pathology_reason required only when pathology_recommended_explicit is true", () => {
    const hit = findField("pathology_reason");
    assert.ok(hit?.field.required);
    assert.ok(hit.field.showWhen);
    assert.equal(
      evaluateConsultationFormCondition(hit.field.showWhen, { pathology_recommended_explicit: false }),
      false
    );
    assert.equal(
      evaluateConsultationFormCondition(hit.field.showWhen, { pathology_recommended_explicit: true }),
      true
    );
  });
});

describe("Hair Transplant Consultation v2 — required-field validation (hidden sections)", () => {
  it("does not require donor/recipient when surgical section is hidden", () => {
    const values = baseV2NonSurgicalValues();
    const issues = validateConsultationFormRequiredFields(v2, values);
    const ids = issues.map((i) => i.fieldId);
    assert.ok(!ids.includes("donor_quality"));
    assert.ok(!ids.includes("recipient_quality"));
    assert.equal(issues.length, 0);
  });

  it("requires donor_quality and recipient_quality when surgical section is visible", () => {
    const values = baseV2NonSurgicalValues({
      primary_objective: "ht_primary",
      consultation_outcome_type: "proceed_surgery",
      surgical_suitability: "suitable",
    });
    const issues = validateConsultationFormRequiredFields(v2, values);
    const ids = issues.map((i) => i.fieldId);
    assert.ok(ids.includes("donor_quality"));
    assert.ok(ids.includes("recipient_quality"));
  });

  it("requires pathology_reason when pathology toggle is on", () => {
    const values = baseV2NonSurgicalValues({
      pathology_recommended_explicit: true,
      pathology_reason: "",
    });
    const issues = validateConsultationFormRequiredFields(v2, values);
    assert.ok(issues.some((i) => i.fieldId === "pathology_reason"));
  });

  it("does not require pathology_reason when pathology toggle is off", () => {
    const values = baseV2NonSurgicalValues({
      pathology_recommended_explicit: false,
      pathology_reason: "",
    });
    const issues = validateConsultationFormRequiredFields(v2, values);
    assert.ok(!issues.some((i) => i.fieldId === "pathology_reason"));
  });

  it("skips body_area_map shape checks in hidden surgical section", () => {
    const values = baseV2NonSurgicalValues({
      concern_map: { annotations: "not-an-array" } as unknown as Record<string, unknown>,
    });
    const mapIssues = validateBodyAreaMapShapesInValues(v2, values);
    assert.equal(mapIssues.length, 0);
  });

  it("does not reference quote_builder or quote_notes as required in v2 schema", () => {
    const allFieldIds = v2.sections.flatMap((s) => s.fields.map((f) => f.id));
    assert.ok(!allFieldIds.includes("quote_builder"));
    assert.ok(!allFieldIds.includes("quote_notes_completion"));
  });
});

describe("Hair Transplant Consultation v2 — completion summary", () => {
  const completionInput = (values: Record<string, unknown>) => ({
    consultationId: "c1111111-1111-4111-8111-111111111111",
    formInstanceId: "f2222222-2222-4222-8222-222222222222",
    templateSlug: HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG,
    values,
    completedAt: "2026-06-16T12:00:00.000Z",
  });

  it("standard surgical consult: summary strings and arrays are always defined", () => {
    const s = buildHairTransplantCompletionSummary(
      completionInput(
        baseV2SurgicalValues({
          ai_recommended_plan_summary: "FUE hairline 2200 grafts.",
        })
      )
    );
    const json = JSON.stringify(s);
    assert.ok(json.length > 0);
    assert.equal(typeof s.primaryConcern, "string");
    assert.equal(typeof s.diagnosisImpression, "string");
    assert.equal(typeof s.recommendedProcedure, "string");
    assert.equal(Array.isArray(s.recommendedZones), true);
    assert.equal(Array.isArray(s.recommendedTreatments), true);
    assert.equal(Array.isArray(s.riskFlags), true);
    assert.equal(Array.isArray(s.areaMapHighlights), true);
    assert.equal(s.recommendedProcedure.includes("FUE"), true);
  });

  it("non-surgical consult: completion works without concern_map or donor fields", () => {
    const s = buildHairTransplantCompletionSummary(completionInput(baseV2NonSurgicalValues()));
    assert.equal(s.outcomeType, "medical_management");
    assert.ok(s.diagnosisImpression.includes("Norwood"));
    assert.equal(s.quoteNotes, "");
  });

  it("single Norwood field only (no diagnosis_norwood_confirm) still labels pattern", () => {
    const s = buildHairTransplantCompletionSummary(
      completionInput(
        baseV2NonSurgicalValues({
          norwood_classification: "nw4",
        })
      )
    );
    assert.match(s.diagnosisImpression, /Norwood IV/i);
  });
});

describe("Hair Transplant Consultation v2.1 template (latest seeded schema)", () => {
  it("latest alias schema has no clinician_voice_note field", () => {
    assert.equal(collectFieldIds(hairTransplantConsultationSchema).includes("clinician_voice_note"), false);
  });

  it("v2.1 explicit schema omits dictation; v2 snapshot still includes it for historical rows", () => {
    assert.equal(collectFieldIds(hairTransplantConsultationSchemaV2_1).includes("clinician_voice_note"), false);
    assert.equal(collectFieldIds(hairTransplantConsultationSchemaV2).includes("clinician_voice_note"), true);
  });

  it("v2.1 matches v2 field count minus one in handoff section only", () => {
    const n2 = hairTransplantConsultationSchemaV2.sections.reduce((n, s) => n + s.fields.length, 0);
    const n21 = hairTransplantConsultationSchemaV2_1.sections.reduce((n, s) => n + s.fields.length, 0);
    assert.equal(n21, n2 - 1);
  });
});

describe("Hair Transplant Consultation — legacy v1 completion dual-read", () => {
  it("reads legacy diagnosis_free_text, risk_flags_confirmed, and graft range", () => {
    const s = buildHairTransplantCompletionSummary({
      consultationId: "c1",
      formInstanceId: "f1",
      templateSlug: HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG,
      values: {
        priority_focus: "crown",
        duration_months: "3_12m",
        diagnosis_free_text: "AGA crown-predominant.",
        diagnosis_norwood_confirm: "nw5",
        norwood_classification: "",
        risk_flags_confirmed: ["smoking"],
        medical_flags: ["diabetes"],
        recommended_plan_summary: "Crown FUE discussion.",
        graft_range_estimate: "1500-2000",
        consultation_outcome_type: "review_later",
        surgical_suitability: "suitable_with_caution",
        medical_suitability: "suitable",
        recommended_treatments: ["surgery_fu"],
        recommended_zones: ["crown"],
      },
      completedAt: "2026-06-16T12:00:00.000Z",
    });
    assert.match(s.diagnosisImpression, /Norwood V/i);
    assert.match(s.diagnosisImpression, /AGA crown/i);
    assert.equal(s.estimatedGraftsMin, 1500);
    assert.equal(s.estimatedGraftsMax, 2000);
    assert.ok(s.riskFlags.includes("smoking") && s.riskFlags.includes("diabetes"));
    assert.equal(s.recommendedProcedure, "Crown FUE discussion.");
  });
});
