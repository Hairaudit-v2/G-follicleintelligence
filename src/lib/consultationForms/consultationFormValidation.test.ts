import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bodyAreaMapHasAnnotations,
  isWellFormedBodyAreaMapValue,
  normalizeBodyAreaMapValue,
} from "./bodyAreaMapModel";
import type { ConsultationFormSchema } from "./consultationFormTypes";
import {
  isValidBodyAreaMapJsonShape,
  validateBodyAreaMapShapesInValues,
  validateConsultationFormRequiredFields,
  validateVoiceNoteClinicalNoteShapesInValues,
} from "./consultationFormValidation";
import { hairLossTreatmentConsultationSchemaV1 } from "./templates/hairLossTreatmentConsultationTemplate";

describe("validateConsultationFormRequiredFields", () => {
  it("flags missing required visible fields", () => {
    const schema: ConsultationFormSchema = {
      sections: [
        {
          id: "s1",
          title: "One",
          fields: [
            { id: "a", label: "Alpha", type: "text", required: true },
            {
              id: "b",
              label: "Beta",
              type: "text",
              required: true,
              showWhen: { fieldId: "toggle", operator: "equals", value: "yes" },
            },
          ],
        },
      ],
    };
    const issues = validateConsultationFormRequiredFields(schema, { toggle: "no" });
    const ids = issues.map((i) => i.fieldId);
    assert.ok(ids.includes("a"));
    assert.ok(!ids.includes("b"));
  });

  it("honours showWhen for required fields", () => {
    const schema: ConsultationFormSchema = {
      sections: [
        {
          id: "s1",
          title: "One",
          fields: [
            { id: "toggle", label: "Toggle", type: "text" },
            {
              id: "b",
              label: "Beta",
              type: "text",
              required: true,
              showWhen: { fieldId: "toggle", operator: "equals", value: "yes" },
            },
          ],
        },
      ],
    };
    const hidden = validateConsultationFormRequiredFields(schema, { toggle: "no" });
    assert.equal(hidden.length, 0);

    const shown = validateConsultationFormRequiredFields(schema, { toggle: "yes", b: "" });
    assert.equal(shown.length, 1);
    assert.equal(shown[0]?.fieldId, "b");
  });
});

describe("body_area_map validation", () => {
  it("isWellFormedBodyAreaMapValue requires annotations array key", () => {
    assert.equal(isWellFormedBodyAreaMapValue({ view: "crown" }), false);
    assert.equal(isWellFormedBodyAreaMapValue({ annotations: [] }), true);
  });

  it("isValidBodyAreaMapJsonShape allows partial objects without annotations", () => {
    assert.equal(isValidBodyAreaMapJsonShape({}), true);
    assert.equal(isValidBodyAreaMapJsonShape({ view: "crown" }), true);
  });

  it("isValidBodyAreaMapJsonShape rejects non-array annotations", () => {
    assert.equal(isValidBodyAreaMapJsonShape({ annotations: "nope" }), false);
  });

  it("validateBodyAreaMapShapesInValues flags bad annotations type", () => {
    const schema: ConsultationFormSchema = {
      sections: [
        { id: "s", title: "S", fields: [{ id: "m", label: "Map", type: "body_area_map" }] },
      ],
    };
    const issues = validateBodyAreaMapShapesInValues(schema, { m: { annotations: 3 } });
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.fieldId, "m");
  });

  it("required body_area_map needs at least one annotation", () => {
    const schema: ConsultationFormSchema = {
      sections: [
        {
          id: "s",
          title: "S",
          fields: [{ id: "m", label: "Map", type: "body_area_map", required: true }],
        },
      ],
    };
    const empty = validateConsultationFormRequiredFields(schema, {
      m: { view: "crown", annotations: [] },
    });
    assert.ok(empty.some((i) => i.fieldId === "m"));
    const ok = validateConsultationFormRequiredFields(schema, {
      m: {
        view: "crown",
        annotations: [
          {
            id: "1",
            view: "crown",
            x: 50,
            y: 50,
            label: "scar",
            severity: "mild",
            tags: [],
            notes: "",
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    assert.equal(ok.length, 0);
  });

  it("normalizeBodyAreaMapValue clamps coordinates", () => {
    const n = normalizeBodyAreaMapValue({
      view: "crown",
      annotations: [
        {
          id: "a",
          view: "crown",
          x: 500,
          y: -10,
          label: "scar",
          severity: "severe",
          tags: ["scar"],
          notes: "x",
          createdAt: "t",
        },
      ],
    });
    assert.equal(n.annotations[0]?.x, 100);
    assert.equal(n.annotations[0]?.y, 0);
  });

  it("bodyAreaMapHasAnnotations is true when annotations exist", () => {
    assert.equal(
      bodyAreaMapHasAnnotations({
        view: "crown",
        annotations: [
          {
            id: "1",
            view: "crown",
            x: 1,
            y: 2,
            label: "scar",
            severity: "mild",
            tags: [],
            notes: "",
            createdAt: "t",
          },
        ],
      }),
      true
    );
    assert.equal(bodyAreaMapHasAnnotations({ view: "crown", annotations: [] }), false);
  });
});

describe("voice_note / clinical_note validation", () => {
  const schema: ConsultationFormSchema = {
    sections: [
      {
        id: "s",
        title: "S",
        fields: [
          { id: "v_req", label: "Voice", type: "voice_note", required: true },
          { id: "c_req", label: "Clinical", type: "clinical_note", required: true },
          { id: "v_opt", label: "Voice opt", type: "voice_note", required: false },
          { id: "c_opt", label: "Clinical opt", type: "clinical_note", required: false },
        ],
      },
    ],
  };

  it("required voice_note fails when transcript blank", () => {
    const issues = validateConsultationFormRequiredFields(schema, {
      v_req: { mode: "voice_note", transcript: "   " },
      c_req: { mode: "clinical_note", note: "ok" },
    });
    assert.ok(issues.some((i) => i.fieldId === "v_req"));
  });

  it("required voice_note passes when transcript exists", () => {
    const issues = validateConsultationFormRequiredFields(schema, {
      v_req: { mode: "voice_note", transcript: "Patient reports thinning." },
      c_req: { mode: "clinical_note", note: "ok" },
    });
    assert.equal(issues.length, 0);
  });

  it("required clinical_note fails when note blank", () => {
    const issues = validateConsultationFormRequiredFields(schema, {
      v_req: { mode: "voice_note", transcript: "x" },
      c_req: { mode: "clinical_note", note: "" },
    });
    assert.ok(issues.some((i) => i.fieldId === "c_req"));
  });

  it("required clinical_note passes when note exists", () => {
    const issues = validateConsultationFormRequiredFields(schema, {
      v_req: { mode: "voice_note", transcript: "x" },
      c_req: { mode: "clinical_note", note: "Donor suitable." },
    });
    assert.equal(issues.length, 0);
  });

  it("invalid voice_note object fails shape validation", () => {
    const issues = validateVoiceNoteClinicalNoteShapesInValues(schema, {
      v_opt: { mode: "voice_note", transcript: 123 },
    });
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.fieldId, "v_opt");
  });

  it("optional voice_note empty passes required check", () => {
    const issues = validateConsultationFormRequiredFields(schema, {
      v_req: { mode: "voice_note", transcript: "x" },
      c_req: { mode: "clinical_note", note: "y" },
      v_opt: { mode: "voice_note", transcript: "" },
      c_opt: { mode: "clinical_note", note: "" },
    });
    assert.equal(issues.length, 0);
  });
});

describe("Hair Loss Treatment template validation", () => {
  it("requires norwood when male-pattern zones are visible", () => {
    const values: Record<string, unknown> = {
      priority_focus: "general",
      duration_band: "3_12m",
      primary_objective: "patient_twin_baseline",
      shedding_reported: "none",
      previous_treatment_yes_no: "no",
      pattern_type: "hairline",
      norwood_classification: "",
      hair_calibre: "fine",
      scalp_condition: "normal",
      medical_flags: [],
      hormonal_flags: [],
      stress_sleep_flags: [],
      nutrition_flags: [],
      pathology_recommended_explicit: false,
      recommended_treatments: ["topical_minoxidil"],
      blood_analysis_recommended: false,
      treatment_priority: "patient_led_pacing",
      treatment_timeline: "watchful",
      hli_pathway_recommended: "patient_twin_lite",
      consultation_outcome_type: "review_later",
      structured_clinical_note: { mode: "clinical_note", note: "Hairline recession." },
      follow_up_urgency: "routine",
    };

    const issues = validateConsultationFormRequiredFields(
      hairLossTreatmentConsultationSchemaV1,
      values
    );
    assert.ok(issues.some((i) => i.fieldId === "norwood_classification"));
  });

  it("hidden classification fields do not fail validation when pattern omits them", () => {
    const values: Record<string, unknown> = {
      priority_focus: "general",
      duration_band: "3_12m",
      primary_objective: "patient_twin_baseline",
      shedding_reported: "none",
      previous_treatment_yes_no: "no",
      pattern_type: "unknown",
      hair_calibre: "fine",
      scalp_condition: "normal",
      medical_flags: [],
      hormonal_flags: [],
      stress_sleep_flags: [],
      nutrition_flags: [],
      pathology_recommended_explicit: false,
      recommended_treatments: ["topical_minoxidil"],
      blood_analysis_recommended: false,
      treatment_priority: "patient_led_pacing",
      treatment_timeline: "watchful",
      hli_pathway_recommended: "patient_twin_lite",
      consultation_outcome_type: "review_later",
      structured_clinical_note: { mode: "clinical_note", note: "Telogen effluvium query; watch." },
      follow_up_urgency: "routine",
    };

    const requiredIssues = validateConsultationFormRequiredFields(
      hairLossTreatmentConsultationSchemaV1,
      values
    );
    assert.equal(requiredIssues.length, 0);

    const shapeIssues = validateVoiceNoteClinicalNoteShapesInValues(
      hairLossTreatmentConsultationSchemaV1,
      values
    );
    assert.equal(shapeIssues.length, 0);

    const mapIssues = validateBodyAreaMapShapesInValues(
      hairLossTreatmentConsultationSchemaV1,
      values
    );
    assert.equal(mapIssues.length, 0);
  });
});
