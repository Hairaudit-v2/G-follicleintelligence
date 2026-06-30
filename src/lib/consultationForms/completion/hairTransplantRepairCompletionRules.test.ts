import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HAIR_TRANSPLANT_REPAIR_CONSULTATION_TEMPLATE_SLUG } from "../consultationFormConstants";
import { buildHairTransplantRepairCompletionSummary } from "./hairTransplantRepairCompletionRules";

function baseValues(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    priority_focus: "hairline",
    duration_band: "1_3y",
    medicolegal_counselling_documented: true,
    previous_surgery_count: "1",
    prior_clinic_known: "no",
    prior_surgery_year: "2023_2024",
    primary_repair_concern: "poor_density",
    donor_depletion_level: "mild",
    donor_scarring_level: "none",
    recipient_scarring_level: "mild",
    hairline_design_issue: "yes",
    growth_failure_suspected: true,
    pluggy_or_unnatural_grafts: false,
    transection_or_overharvesting_concern: false,
    corrective_options: ["fue_focal_repair"],
    hairaudit_baseline_recommended: true,
    surgeryos_planning_recommended: true,
    corrective_surgical_planning_selected: false,
    repair_completion_outcome: "proceed_surgery",
    structured_clinical_note: { mode: "clinical_note", note: "Repair candidacy discussed." },
    follow_up_required_explicit: false,
    follow_up_urgency: "routine",
    ...over,
  };
}

describe("hairTransplantRepairCompletionRules", () => {
  it("builds repair snapshot with HairAudit and SurgeryOS flags", () => {
    const s = buildHairTransplantRepairCompletionSummary({
      consultationId: "c-rep",
      formInstanceId: "f-rep",
      templateSlug: HAIR_TRANSPLANT_REPAIR_CONSULTATION_TEMPLATE_SLUG,
      values: baseValues({
        ai_recommended_plan_summary: "Stage FUE correction after counselling.",
      }),
      completedAt: "2026-06-16T12:00:00.000Z",
    });
    assert.equal(s.templateSlug, HAIR_TRANSPLANT_REPAIR_CONSULTATION_TEMPLATE_SLUG);
    assert.equal(s.outcomeType, "proceed_surgery");
    assert.ok(
      s.repairConsultationCompletionSnapshot?.priorSurgeryHistoryLine.includes("Prior procedures")
    );
    assert.ok(s.repairConsultationCompletionSnapshot?.mainRepairConcernLabel.length);
    assert.ok(
      s.repairConsultationCompletionSnapshot?.donorRecipientRiskLine.includes("Donor depletion")
    );
    assert.deepEqual(s.repairConsultationCompletionSnapshot?.correctiveOptionsLabels, [
      "Focal FUE / revision grafting",
    ]);
    assert.equal(s.repairConsultationCompletionSnapshot?.hairauditRecommended, true);
    assert.equal(s.repairConsultationCompletionSnapshot?.surgeryosPlanningRecommended, true);
    assert.ok(s.repairConsultationCompletionSnapshot?.followUpUrgencyLabel.length);
    assert.ok(s.riskFlags.includes("growth_failure_suspected"));
  });

  it("visual assessment: invalid repair_visual_annotations does not break completion", () => {
    assert.doesNotThrow(() =>
      buildHairTransplantRepairCompletionSummary({
        consultationId: "c-rep",
        formInstanceId: "f-rep",
        templateSlug: HAIR_TRANSPLANT_REPAIR_CONSULTATION_TEMPLATE_SLUG,
        values: baseValues({
          repair_visual_annotations: ["not", "an", "object"] as unknown,
          selected_zones: "also-not-array" as unknown,
        }),
        completedAt: "2026-06-16T12:00:00.000Z",
      })
    );
  });
});
