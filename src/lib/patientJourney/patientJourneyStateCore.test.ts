import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  derivePatientJourneyNextBestAction,
  derivePatientJourneyStateFromSignals,
  detectPatientJourneyBlockers,
  isPatientJourneyTransitionAllowed,
  pickHigherJourneyState,
  reviewDueFromProcedureDate,
  targetStateForAutomationEvent,
  type PatientJourneySignals,
} from "./patientJourneyStateCore";

function baseSignals(overrides: Partial<PatientJourneySignals> = {}): PatientJourneySignals {
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
    ...overrides,
  };
}

describe("patientJourneyStateCore", () => {
  it("derives consult booked from signals", () => {
    const state = derivePatientJourneyStateFromSignals(
      baseSignals({ hasLead: true, consultBooked: true, hasRecentActivity: true })
    );
    assert.equal(state, "consult_booked");
  });

  it("derives consult completed → treatment recommended progression", () => {
    assert.equal(
      derivePatientJourneyStateFromSignals(
        baseSignals({ consultCompleted: true, hasRecentActivity: true })
      ),
      "consult_completed"
    );
    assert.equal(
      derivePatientJourneyStateFromSignals(
        baseSignals({
          consultCompleted: true,
          treatmentRecommended: true,
          hasRecentActivity: true,
        })
      ),
      "treatment_recommended"
    );
  });

  it("derives quote accepted → pre_op_incomplete when surgery booked but not ready", () => {
    assert.equal(
      derivePatientJourneyStateFromSignals(
        baseSignals({
          quoteAccepted: true,
          depositPaid: true,
          surgeryBooked: true,
          hasRecentActivity: true,
        })
      ),
      "pre_op_incomplete"
    );
  });

  it("derives surgery booked → pre_op_ready when readiness signals complete", () => {
    assert.equal(
      derivePatientJourneyStateFromSignals(
        baseSignals({
          surgeryBooked: true,
          depositPaid: true,
          consentSigned: true,
          imagingComplete: true,
          surgeryReadinessReady: true,
          hasRecentActivity: true,
        })
      ),
      "pre_op_ready"
    );
  });

  it("derives procedure completed → review due states", () => {
    const reviews = reviewDueFromProcedureDate("2026-01-01", "2026-05-15");
    assert.equal(reviews.threeMonthReviewDue, true);
    const state = derivePatientJourneyStateFromSignals(
      baseSignals({
        procedureCompleted: true,
        threeMonthReviewDue: true,
        hasRecentActivity: true,
      })
    );
    assert.equal(state, "three_month_review_due");
  });

  it("payment automation maps to deposit_paid", () => {
    assert.equal(targetStateForAutomationEvent("payment_received"), "deposit_paid");
  });

  it("allows forward transition consult_booked → consult_completed", () => {
    assert.equal(
      isPatientJourneyTransitionAllowed("consult_booked", "consult_completed", false),
      true
    );
  });

  it("blocks backward automatic transition", () => {
    assert.equal(
      isPatientJourneyTransitionAllowed("surgery_booked", "consult_booked", false),
      false
    );
  });

  it("allows manual override to any valid state", () => {
    assert.equal(isPatientJourneyTransitionAllowed("lead", "pre_op_ready", true), true);
  });

  it("detects unpaid deposit blocker", () => {
    const blockers = detectPatientJourneyBlockers({
      state: "surgery_booked",
      signals: baseSignals({ depositPaid: false, consentSigned: true }),
    });
    assert.ok(blockers.some((b) => b.kind === "unpaid_deposit"));
  });

  it("missing_consent blocker uses provided href and never invents a dead path", () => {
    const blockers = detectPatientJourneyBlockers({
      state: "pre_op_incomplete",
      signals: baseSignals({ consentSigned: false, depositPaid: true }),
      hrefs: { missing_consent: "/fi-admin/t/surgery-readiness" },
    });
    const consent = blockers.find((b) => b.kind === "missing_consent");
    assert.ok(consent);
    assert.equal(consent!.href, "/fi-admin/t/surgery-readiness");
    assert.ok(!consent!.href?.includes("/patients/") || !consent!.href?.endsWith("/consultations"));
  });

  it("missing_consent without href is status-only (no link)", () => {
    const blockers = detectPatientJourneyBlockers({
      state: "quote_accepted",
      signals: baseSignals({ consentSigned: false, depositPaid: true }),
    });
    const consent = blockers.find((b) => b.kind === "missing_consent");
    assert.ok(consent);
    assert.equal(consent!.href, null);
  });

  it("picks higher ranked lifecycle state", () => {
    assert.equal(pickHigherJourneyState("consult_completed", "quote_sent"), "quote_sent");
  });

  it("next best action for quote accepted points to financial", () => {
    const action = derivePatientJourneyNextBestAction({
      state: "quote_accepted",
      blockers: [],
      basePath: "/fi-admin/t/patients/p",
    });
    assert.match(action.href, /financial/);
  });
});
