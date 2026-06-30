import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ConsultationCompletionSummary } from "../completion/consultationCompletionTypes";
import { HAIR_TRANSPLANT_REPAIR_CONSULTATION_TEMPLATE_SLUG } from "../consultationFormConstants";
import {
  addBusinessDaysUtc,
  buildQuoteDraftNotesText,
  followUpTaskTitleForOutcome,
  handoffIdempotencyMetadata,
  pathologyTemplateForOutcome,
  quoteDraftAutomationIntentEligible,
  quoteDraftTitle,
  surgeryPlanningHandoffEligible,
} from "./consultationHandoffPure";

function baseSummary(
  over: Partial<ConsultationCompletionSummary> = {}
): ConsultationCompletionSummary {
  return {
    consultationId: "c1",
    formInstanceId: "f1",
    templateSlug: "hair_transplant",
    completedAt: "2026-01-01T00:00:00.000Z",
    outcomeType: "undecided",
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

describe("consultationHandoffPure", () => {
  it("followUpTaskTitleForOutcome maps known outcomes", () => {
    assert.equal(followUpTaskTitleForOutcome("needs_blood_tests"), "Follow up blood test request");
    assert.equal(followUpTaskTitleForOutcome("proceed_surgery"), "Follow up surgery plan");
    assert.equal(followUpTaskTitleForOutcome("review_later"), "Review consultation plan");
    assert.equal(followUpTaskTitleForOutcome("undecided"), "Follow up undecided consultation");
    assert.equal(followUpTaskTitleForOutcome("not_suitable"), "Follow up consultation");
  });

  it("buildQuoteDraftNotesText merges quote notes, grafts, treatments, zones, diagnosis", () => {
    const text = buildQuoteDraftNotesText(
      baseSummary({
        quoteNotes: "Line A",
        estimatedGraftsMin: 1200,
        estimatedGraftsMax: 1800,
        recommendedTreatments: ["prp", "finasteride"],
        recommendedZones: ["hairline", "crown"],
        diagnosisImpression: "AGA",
      })
    );
    assert.match(text, /Line A/);
    assert.match(text, /1200/);
    assert.match(text, /1800/);
    assert.match(text, /prp/);
    assert.match(text, /hairline/);
    assert.match(text, /AGA/);
  });

  it("quoteDraftTitle prefers recommended procedure", () => {
    assert.equal(quoteDraftTitle(baseSummary({ recommendedProcedure: "FUE plan" })), "FUE plan");
    assert.equal(
      quoteDraftTitle(baseSummary({ recommendedProcedure: "" })),
      "Consultation treatment plan"
    );
  });

  it("pathologyTemplateForOutcome picks templates aligned with DB naming", () => {
    assert.equal(pathologyTemplateForOutcome("proceed_surgery"), "hair_transplant_pre_op");
    assert.equal(pathologyTemplateForOutcome("medical_management"), "hair_loss_investigation");
    assert.equal(pathologyTemplateForOutcome("needs_blood_tests"), "hair_loss_investigation");
    assert.equal(pathologyTemplateForOutcome("undecided"), "custom_request");
  });

  it("surgeryPlanningHandoffEligible requires case, outcome, and plan signal", () => {
    const s = baseSummary({
      outcomeType: "proceed_surgery",
      recommendedProcedure: "FUE",
    });
    assert.equal(surgeryPlanningHandoffEligible(s, null), false);
    assert.equal(surgeryPlanningHandoffEligible(s, "case-1"), true);
    assert.equal(
      surgeryPlanningHandoffEligible(
        baseSummary({ outcomeType: "undecided", recommendedProcedure: "FUE" }),
        "case-1"
      ),
      false
    );
    assert.equal(
      surgeryPlanningHandoffEligible(
        baseSummary({
          outcomeType: "proceed_surgery",
          recommendedProcedure: "",
          estimatedGraftsMin: 1,
          estimatedGraftsMax: 2,
        }),
        "case-1"
      ),
      true
    );
    assert.equal(
      surgeryPlanningHandoffEligible(
        baseSummary({
          outcomeType: "proceed_surgery",
          recommendedProcedure: "",
          recommendedZones: ["crown"],
        }),
        "case-1"
      ),
      true
    );
  });

  it("surgeryPlanningHandoffEligible for repair pathway uses SurgeryOS flag without graft estimates", () => {
    const repairSlug = HAIR_TRANSPLANT_REPAIR_CONSULTATION_TEMPLATE_SLUG;
    const snap = {
      priorSurgeryHistoryLine: "Prior procedures: One prior procedure",
      mainRepairConcernLabel: "Poor density / failed yield",
      donorRecipientRiskLine: "Donor depletion: Mild",
      correctiveOptionsLabels: ["Focal FUE / revision grafting"],
      hairauditRecommended: true,
      surgeryosPlanningRecommended: true,
      followUpUrgencyLabel: "Routine (weeks)",
    };
    assert.equal(
      surgeryPlanningHandoffEligible(
        baseSummary({
          templateSlug: repairSlug,
          outcomeType: "proceed_surgery",
          recommendedProcedure: "",
          repairConsultationCompletionSnapshot: snap,
        }),
        "case-1"
      ),
      true
    );
    assert.equal(
      surgeryPlanningHandoffEligible(
        baseSummary({
          templateSlug: repairSlug,
          outcomeType: "proceed_surgery",
          recommendedProcedure: "Revision plan",
          repairConsultationCompletionSnapshot: { ...snap, surgeryosPlanningRecommended: false },
        }),
        "case-1"
      ),
      false
    );
  });

  it("quoteDraftAutomationIntentEligible detects quote/treatment intent signals", () => {
    assert.equal(
      quoteDraftAutomationIntentEligible(baseSummary({ outcomeType: "medical_management" })),
      false
    );
    assert.equal(
      quoteDraftAutomationIntentEligible(baseSummary({ outcomeType: "proceed_surgery" })),
      true
    );
    assert.equal(
      quoteDraftAutomationIntentEligible(baseSummary({ outcomeType: "proceed_prp" })),
      true
    );
    assert.equal(quoteDraftAutomationIntentEligible(baseSummary({ quoteNotes: "  " })), false);
    assert.equal(
      quoteDraftAutomationIntentEligible(baseSummary({ quoteNotes: "Pricing TBD" })),
      true
    );
    assert.equal(
      quoteDraftAutomationIntentEligible(baseSummary({ recommendedProcedure: "FUE" })),
      true
    );
    assert.equal(
      quoteDraftAutomationIntentEligible(baseSummary({ recommendedTreatments: ["finasteride"] })),
      true
    );
  });

  it("handoffIdempotencyMetadata builder is stable for JSON containment queries", () => {
    assert.deepEqual(handoffIdempotencyMetadata("fid", "consultation_completion"), {
      form_instance_id: "fid",
      source: "consultation_completion",
    });
  });

  it("addBusinessDaysUtc skips Sat/Sun", () => {
    const fri = new Date("2026-06-12T12:00:00.000Z");
    const out = addBusinessDaysUtc(fri, 2);
    assert.equal(out.toISOString().slice(0, 10), "2026-06-16");
  });
});
