/**
 * ConsultationOS v2 consolidation — cross-cutting assertions (HT v2.1, HLI untouched, completion, routing contracts).
 * Complements pathway launcher tests and per-template workflow tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildHairLossTreatmentCompletionSummary } from "./completion/hairLossTreatmentCompletionRules";
import { buildHairTransplantCompletionSummary } from "./completion/hairTransplantCompletionRules";
import { HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG, HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG } from "./consultationFormConstants";
import {
  hairTransplantConsultationSchema,
  hairTransplantConsultationSchemaV1,
  hairTransplantConsultationSchemaV2,
  hairTransplantConsultationSchemaV2_1,
} from "./templates/hairTransplantConsultationTemplate";

function allFieldIdsFromSchema(schema: { sections: { fields: { id: string }[] }[] }): string[] {
  return schema.sections.flatMap((s) => s.fields.map((f) => f.id));
}

describe("ConsultationOS v2 consolidation checkpoint", () => {
  it("HT v2.1 (latest alias) omits clinician_voice_note; v2 snapshot still includes it for historical rows", () => {
    assert.equal(allFieldIdsFromSchema(hairTransplantConsultationSchemaV2_1).includes("clinician_voice_note"), false);
    assert.equal(allFieldIdsFromSchema(hairTransplantConsultationSchema).includes("clinician_voice_note"), false);
    assert.equal(allFieldIdsFromSchema(hairTransplantConsultationSchemaV2).includes("clinician_voice_note"), true);
    assert.equal(hairTransplantConsultationSchemaV2_1.schemaRevision, 4);
  });

  it("HT v1 legacy schema object is unchanged and still distinct from v2 pathway", () => {
    assert.ok(allFieldIdsFromSchema(hairTransplantConsultationSchemaV1).length > 20);
    assert.equal(hairTransplantConsultationSchemaV1.sections.some((s) => s.id === "clinical_summary_handoff"), false);
  });

  it("legacy clinician_voice_note values still contribute to HT completion preview (dual-read)", () => {
    const s = buildHairTransplantCompletionSummary({
      consultationId: "c1",
      formInstanceId: "f1",
      templateSlug: HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG,
      values: {
        consultation_outcome_type: "undecided",
        clinician_voice_note: { mode: "voice_note", transcript: "Legacy dictation retained." },
      },
      completedAt: "2026-06-16T12:00:00.000Z",
    });
    assert.ok(s.clinicianNotesPreview.includes("Legacy dictation"));
  });

  it("HLI completion path still builds a summary (pathway 2 unchanged)", () => {
    const s = buildHairLossTreatmentCompletionSummary({
      consultationId: "c-hli",
      formInstanceId: "f-hli",
      templateSlug: HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG,
      values: {
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
      },
      completedAt: "2026-06-16T12:00:00.000Z",
    });
    assert.equal(s.templateSlug, HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG);
    assert.ok(s.hliPathwayRecommendedLabel?.length);
  });
});
