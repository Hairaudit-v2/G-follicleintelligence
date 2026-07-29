/**
 * FI-PATIENT-APP-P1 — pure contract / milestone / action leak tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PATIENT_ACTION_KINDS,
  PATIENT_DOCUMENT_SECTION_KEYS,
  PATIENT_JOURNEY_MILESTONE_KEYS,
  QUOTE_ACCEPTED_FOLLOW_ON_ACTIONS,
  bucketForPatientAction,
  formatMissingDocumentSections,
} from "./patientJourneyControlContracts";
import {
  actionPayloadExposesInternalFields,
  buildPatientActionsGatewayResponse,
  nextActionTypeFromKind,
  toGatewayActionItem,
} from "./patientActionEngineCore";
import {
  derivePatientJourneyMilestones,
  milestonePayloadExposesInternalFields,
} from "./patientJourneyMilestoneCore";

describe("patientJourneyControlContracts", () => {
  it("locks 11 milestone keys and 13 document sections", () => {
    assert.equal(PATIENT_JOURNEY_MILESTONE_KEYS.length, 11);
    assert.equal(PATIENT_DOCUMENT_SECTION_KEYS.length, 13);
    assert.deepEqual([...QUOTE_ACCEPTED_FOLLOW_ON_ACTIONS], ["pay_deposit", "complete_blood_tests"]);
    assert.ok(PATIENT_ACTION_KINDS.includes("review_quote"));
  });

  it("formats missing document sections with exact labels", () => {
    assert.equal(
      formatMissingDocumentSections(["contacts"]),
      "Please complete: Emergency contacts."
    );
    assert.match(
      formatMissingDocumentSections(["contacts", "medications", "finance"]),
      /Emergency contacts.*Medications.*Financial acknowledgement/
    );
  });

  it("buckets actions for Action Centre", () => {
    assert.equal(bucketForPatientAction({ status: "completed" }), "recently_completed");
    assert.equal(bucketForPatientAction({ status: "waiting_on_clinic" }), "waiting_on_clinic");
    assert.equal(bucketForPatientAction({ status: "open" }), "action_required");
    assert.equal(
      bucketForPatientAction({
        status: "open",
        dueAt: "2099-01-01T00:00:00.000Z",
        nowIso: "2026-07-29T00:00:00.000Z",
      }),
      "upcoming"
    );
  });
});

describe("derivePatientJourneyMilestones", () => {
  it("projects quote + deposit progression without internal fields", () => {
    const milestones = derivePatientJourneyMilestones({
      signals: {
        consultCompleted: true,
        treatmentRecommended: true,
        quoteDelivered: true,
        quoteReviewOpen: true,
      },
      nowIso: "2026-07-29T00:00:00.000Z",
    });
    assert.equal(milestones.length, 11);
    const quoteSent = milestones.find((m) => m.key === "quote_sent");
    assert.equal(quoteSent?.status, "action_required");
    assert.equal(milestonePayloadExposesInternalFields(milestones), false);
  });

  it("marks cleared for surgery when readiness ready", () => {
    const milestones = derivePatientJourneyMilestones({
      signals: { surgeryReadinessReady: true },
    });
    assert.equal(
      milestones.find((m) => m.key === "patient_cleared_for_surgery")?.status,
      "completed"
    );
  });
});

describe("patientActionEngineCore", () => {
  it("builds gateway buckets and primary action", () => {
    const response = buildPatientActionsGatewayResponse([
      {
        id: "a1",
        kind: "pay_deposit",
        status: "open",
        priority: 90,
        title: "Pay your deposit",
        due_at: null,
      },
      {
        id: "a2",
        kind: "await_pathology_review",
        status: "waiting_on_clinic",
        priority: 20,
        title: "Waiting",
      },
    ]);
    assert.equal(response.ok, true);
    assert.equal(response.primaryAction?.id, "a1");
    assert.equal(response.actionRequired.length, 1);
    assert.equal(response.waitingOnClinic.length, 1);
    assert.equal(nextActionTypeFromKind("review_quote"), "review_quote");
    assert.equal(nextActionTypeFromKind("pay_deposit"), "pay_deposit");
    assert.equal(nextActionTypeFromKind("sign_document"), "sign_document");
  });

  it("strips / detects internal action fields", () => {
    const item = toGatewayActionItem({
      id: "x",
      kind: "review_quote",
      status: "open",
      priority: 1,
      title: "Review",
    });
    assert.equal(actionPayloadExposesInternalFields(item), false);
    assert.equal(
      actionPayloadExposesInternalFields({ ...item, internalNote: "staff only" }),
      true
    );
  });
});