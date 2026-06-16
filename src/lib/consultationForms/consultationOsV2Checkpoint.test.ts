/**
 * ConsultationOS v2 consolidation — cross-cutting assertions (HT v2.1, HLI untouched, completion, routing contracts).
 * Complements pathway launcher tests and per-template workflow tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildConsultationCompletionSummary } from "./completion/buildConsultationCompletionSummary";
import { buildHairLossTreatmentCompletionSummary } from "./completion/hairLossTreatmentCompletionRules";
import { buildHairTransplantCompletionSummary } from "./completion/hairTransplantCompletionRules";
import {
  FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG,
  FOLLOW_UP_REVIEW_CONSULTATION_TEMPLATE_SLUG,
  HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG,
  HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG,
  HAIR_TRANSPLANT_REPAIR_CONSULTATION_TEMPLATE_SLUG,
} from "./consultationFormConstants";
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
    assert.equal(hairTransplantConsultationSchemaV2_1.schemaRevision, 6);
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

  it("Female hair loss completion dispatch returns pathway 3 snapshot fields", () => {
    const s = buildConsultationCompletionSummary({
      consultationId: "c-fem",
      formInstanceId: "f-fem",
      templateSlug: FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG,
      values: {
        priority_focus: "vertex_part_density",
        duration_band: "1_3y",
        primary_objective: "stabilise_shedding",
        shedding_reported: "mild",
        postpartum_status: "not_recently_postpartum",
        previous_treatment_yes_no: "no",
        female_pattern_type: "diffuse",
        ludwig_classification: "l1",
        sinclair_classification: "s2",
        traction_pattern_present: false,
        scalp_condition: "normal",
        hair_calibre: "medium",
        hormonal_flags: [],
        medical_flags: [],
        ferritin_history_known: "not_checked",
        thyroid_history_known: "unknown",
        pathology_recommended_explicit: false,
        recommended_treatments: ["topical_minoxidil"],
        blood_analysis_recommended: false,
        hli_pathway_recommended: "hli_core",
        treatment_priority: "patient_led_pacing",
        treatment_timeline: "watchful",
        structured_clinical_note: { mode: "clinical_note", note: "Diffuse FPHL." },
        follow_up_urgency: "routine",
      },
      completedAt: "2026-06-16T12:00:00.000Z",
    });
    assert.equal(s.templateSlug, FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG);
    assert.ok(s.femaleHairLossCompletionSnapshot?.patternLabel);
  });

  it("Repair pathway completion dispatch returns pathway 4 snapshot fields", () => {
    const s = buildConsultationCompletionSummary({
      consultationId: "c-rep",
      formInstanceId: "f-rep",
      templateSlug: HAIR_TRANSPLANT_REPAIR_CONSULTATION_TEMPLATE_SLUG,
      values: {
        priority_focus: "hairline",
        duration_band: "1_3y",
        medicolegal_counselling_documented: true,
        previous_surgery_count: "2",
        prior_clinic_known: "unsure",
        prior_surgery_year: "unknown",
        primary_repair_concern: "donor_scar",
        donor_depletion_level: "moderate",
        donor_scarring_level: "severe",
        recipient_scarring_level: "none",
        hairline_design_issue: "unsure",
        growth_failure_suspected: false,
        pluggy_or_unnatural_grafts: false,
        transection_or_overharvesting_concern: true,
        corrective_options: ["strip_scar_revision", "medical_stabilisation"],
        hairaudit_baseline_recommended: true,
        surgeryos_planning_recommended: false,
        corrective_surgical_planning_selected: false,
        repair_completion_outcome: "review_later",
        structured_clinical_note: { mode: "clinical_note", note: "Wide scar; counselled." },
        follow_up_required_explicit: false,
        follow_up_urgency: "soon",
      },
      completedAt: "2026-06-16T12:00:00.000Z",
    });
    assert.equal(s.templateSlug, HAIR_TRANSPLANT_REPAIR_CONSULTATION_TEMPLATE_SLUG);
    assert.ok(s.repairConsultationCompletionSnapshot?.priorSurgeryHistoryLine);
    assert.equal(s.outcomeType, "review_later");
    assert.equal(s.repairConsultationCompletionSnapshot?.surgeryosPlanningRecommended, false);
  });

  it("Follow-up / Review completion dispatch returns pathway 5 snapshot fields", () => {
    const s = buildConsultationCompletionSummary({
      consultationId: "c-fu2",
      formInstanceId: "f-fu2",
      templateSlug: FOLLOW_UP_REVIEW_CONSULTATION_TEMPLATE_SLUG,
      values: {
        review_type: "annual_review",
        time_since_last_review: "12_month",
        current_primary_concern: "Routine interval check.",
        treatment_compliance: "partially_compliant",
        perceived_improvement: "minimal_improvement",
        shedding_changes: "unchanged",
        density_changes: "stable",
        patient_satisfaction: 6,
        side_effects_present: false,
        clinical_progression_assessment: "further_investigation_needed",
        hairaudit_progression_capture: false,
        updated_photos_captured: false,
        treatment_modification_required: true,
        updated_recommended_treatments: [],
        next_pathway_recommended: "request_blood_analysis",
        structured_clinical_note: { mode: "clinical_note", note: "Annual review." },
        follow_up_required_explicit: true,
        follow_up_urgency: "priority",
      },
      completedAt: "2026-06-16T12:00:00.000Z",
    });
    assert.equal(s.templateSlug, FOLLOW_UP_REVIEW_CONSULTATION_TEMPLATE_SLUG);
    assert.equal(s.outcomeType, "needs_blood_tests");
    assert.ok(s.followUpReviewCompletionSnapshot?.reviewTypeLabel);
    assert.equal(s.pathologyRecommended, true);
  });
});
