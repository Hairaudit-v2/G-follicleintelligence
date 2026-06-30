import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FOLLOW_UP_REVIEW_CONSULTATION_TEMPLATE_SLUG } from "../consultationFormConstants";
import { buildFollowUpReviewCompletionSummary } from "./followUpReviewCompletionRules";

function baseValues(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    review_type: "post_prp_review",
    time_since_last_review: "3_month",
    current_primary_concern: "Maintaining density after PRP series.",
    treatment_compliance: "fully_compliant",
    perceived_improvement: "moderate_improvement",
    shedding_changes: "improved",
    density_changes: "stable",
    patient_satisfaction: 8,
    side_effects_present: false,
    clinical_progression_assessment: "progressing_well",
    hairaudit_progression_capture: true,
    updated_photos_captured: true,
    treatment_modification_required: false,
    updated_recommended_treatments: ["prp", "topical_minoxidil"],
    ai_progress_summary: "Stable improvement; continue series.",
    structured_clinical_note: { mode: "clinical_note", note: "PRP follow-up documented." },
    follow_up_required_explicit: false,
    follow_up_urgency: "routine",
    next_pathway_recommended: "continue_current_protocol",
    ...over,
  };
}

describe("followUpReviewCompletionRules", () => {
  it("builds follow-up snapshot with trend, compliance, satisfaction, and next pathway", () => {
    const s = buildFollowUpReviewCompletionSummary({
      consultationId: "c-fu",
      formInstanceId: "f-fu",
      templateSlug: FOLLOW_UP_REVIEW_CONSULTATION_TEMPLATE_SLUG,
      values: baseValues(),
      completedAt: "2026-06-16T12:00:00.000Z",
    });
    assert.equal(s.templateSlug, FOLLOW_UP_REVIEW_CONSULTATION_TEMPLATE_SLUG);
    assert.equal(s.outcomeType, "medical_management");
    assert.ok(s.followUpReviewCompletionSnapshot?.reviewTypeLabel.includes("PRP"));
    assert.equal(s.followUpReviewCompletionSnapshot?.satisfactionScore, 8);
    assert.ok(s.followUpReviewCompletionSnapshot?.complianceLabel.length);
    assert.ok(s.followUpReviewCompletionSnapshot?.nextPathwayLabel.length);
    assert.ok(s.recommendedTreatments.includes("PRP"));
    assert.ok(
      s.followUpReviewCompletionSnapshot?.integrationPlaceholderLine.includes("Patient Twin")
    );
  });
});
