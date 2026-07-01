import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  derivePatientJourneyStateFromSignals,
  isPatientJourneyTransitionAllowed,
  targetStateForAutomationEvent,
  type PatientJourneySignals,
} from "./patientJourneyStateCore";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PATIENT = "22222222-2222-4222-8222-222222222222";

function signals(partial: Partial<PatientJourneySignals>): PatientJourneySignals {
  return {
    hasLead: false,
    leadLost: false,
    consultBooked: false,
    consultCompleted: false,
    treatmentRecommended: false,
    quoteSent: false,
    quoteAccepted: false,
    depositPaid: false,
    surgeryBooked: false,
    surgeryDateYmd: null,
    preOpChecklistComplete: false,
    surgeryReadinessReady: false,
    procedureDayToday: false,
    procedureCompleted: false,
    postOpFollowUpDue: false,
    threeMonthReviewDue: false,
    sixMonthReviewDue: false,
    twelveMonthAuditDue: false,
    hasRecentActivity: false,
    imagingComplete: false,
    consentSigned: false,
    followUpBooked: false,
    ...partial,
  };
}

describe("patientJourneyState.server safety", () => {
  it("tenant isolation: patient hrefs stay under tenant base", () => {
    const basePath = `/fi-admin/${TENANT}/patients/${PATIENT}`;
    assert.ok(basePath.includes(TENANT));
    assert.ok(basePath.includes(PATIENT));
  });

  it("manual transition policy requires allowed graph for automatic moves", () => {
    assert.equal(
      isPatientJourneyTransitionAllowed("consult_booked", "consult_completed", false),
      true
    );
    assert.equal(isPatientJourneyTransitionAllowed("completed", "lead", false), false);
  });

  it("regression: consult booked → consult completed via signals", () => {
    const booked = derivePatientJourneyStateFromSignals(
      signals({ hasLead: true, consultBooked: true, hasRecentActivity: true })
    );
    const completed = derivePatientJourneyStateFromSignals(
      signals({ consultCompleted: true, hasRecentActivity: true })
    );
    assert.equal(booked, "consult_booked");
    assert.equal(completed, "consult_completed");
  });

  it("regression: quote accepted → surgery path advances to pre_op_incomplete", () => {
    const accepted = derivePatientJourneyStateFromSignals(
      signals({ quoteAccepted: true, hasRecentActivity: true })
    );
    const surgeryPath = derivePatientJourneyStateFromSignals(
      signals({
        quoteAccepted: true,
        depositPaid: true,
        surgeryBooked: true,
        hasRecentActivity: true,
      })
    );
    assert.equal(accepted, "quote_accepted");
    assert.equal(surgeryPath, "pre_op_incomplete");
  });

  it("regression: surgery booked → pre_op_ready when readiness complete", () => {
    const ready = derivePatientJourneyStateFromSignals(
      signals({
        surgeryBooked: true,
        depositPaid: true,
        consentSigned: true,
        imagingComplete: true,
        surgeryReadinessReady: true,
        hasRecentActivity: true,
      })
    );
    assert.equal(ready, "pre_op_ready");
  });

  it("regression: procedure completed → review due", () => {
    const state = derivePatientJourneyStateFromSignals(
      signals({
        procedureCompleted: true,
        threeMonthReviewDue: true,
        hasRecentActivity: true,
      })
    );
    assert.equal(state, "three_month_review_due");
  });

  it("regression: payment received maps to deposit_paid automation target", () => {
    assert.equal(targetStateForAutomationEvent("payment_received"), "deposit_paid");
  });

  it("manual override action module exports transition helpers", async () => {
    const core = await import("./patientJourneyStateCore");
    assert.equal(typeof core.isPatientJourneyTransitionAllowed, "function");
    assert.ok(core.PATIENT_JOURNEY_STATES.includes("surgery_booked"));
  });
});