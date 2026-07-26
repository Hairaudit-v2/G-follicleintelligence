import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PatientJourneySignals } from "@/src/lib/patientJourney/patientJourneyStateCore";

import {
  buildPatientGatewayJourneyResponse,
  derivePatientGatewayNextAction,
  journeyResponseExposesInternalWorkflow,
  mapFiJourneyStateToPatientStage,
} from "./patientGatewayJourneyCore";

function signals(overrides: Partial<PatientJourneySignals> = {}): PatientJourneySignals {
  return {
    hasLead: true,
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
    hasRecentActivity: true,
    imagingComplete: true,
    consentSigned: false,
    followUpBooked: false,
    ...overrides,
  };
}

describe("patientGatewayJourneyCore", () => {
  it("A/I. maps FiOS states to stable patient stages deterministically", () => {
    assert.equal(mapFiJourneyStateToPatientStage("consult_booked"), "consultation");
    assert.equal(mapFiJourneyStateToPatientStage("quote_accepted"), "treatment");
    assert.equal(mapFiJourneyStateToPatientStage("surgery_booked"), "procedure");
    assert.equal(mapFiJourneyStateToPatientStage("post_op_follow_up_due"), "recovery");
    assert.equal(mapFiJourneyStateToPatientStage("three_month_review_due"), "review");
    assert.equal(mapFiJourneyStateToPatientStage("twelve_month_audit_due"), "audit");

    const a = buildPatientGatewayJourneyResponse({
      state: "post_op_follow_up_due",
      signals: signals({ procedureCompleted: true, postOpFollowUpDue: true }),
      upcomingAppointments: [],
      nowIso: "2026-07-27T00:00:00.000Z",
    });
    const b = buildPatientGatewayJourneyResponse({
      state: "post_op_follow_up_due",
      signals: signals({ procedureCompleted: true, postOpFollowUpDue: true }),
      upcomingAppointments: [],
      nowIso: "2026-07-27T00:00:00.000Z",
    });
    assert.deepEqual(a, b);
    assert.equal(a.stage, "recovery");
    assert.equal(a.progress.currentStep, 4);
    assert.equal(a.progress.totalSteps, 6);
  });

  it("H. does not expose internal workflow fields", () => {
    const payload = buildPatientGatewayJourneyResponse({
      state: "pre_op_incomplete",
      signals: signals({ surgeryBooked: true, imagingComplete: false }),
      upcomingAppointments: [],
      nowIso: "2026-07-27T00:00:00.000Z",
    });
    assert.equal(journeyResponseExposesInternalWorkflow(payload as unknown as Record<string, unknown>), false);
    assert.equal("blockers" in payload, false);
    assert.equal("derivedState" in payload, false);
    assert.equal("nextBestAction" in payload, false);
  });

  it("J. nextAction is derived server-side from FiOS state", () => {
    const attend = derivePatientGatewayNextAction({
      state: "consult_booked",
      signals: signals({ consultBooked: true }),
      upcomingAppointments: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          startAt: "2026-08-01T10:00:00.000Z",
          type: "consultation",
          title: "Consultation",
        },
      ],
      nowIso: "2026-07-27T00:00:00.000Z",
    });
    assert.equal(attend.type, "attend_appointment");

    const review = derivePatientGatewayNextAction({
      state: "three_month_review_due",
      signals: signals({ threeMonthReviewDue: true, followUpBooked: false, imagingComplete: true }),
      upcomingAppointments: [],
      nowIso: "2026-07-27T00:00:00.000Z",
    });
    assert.equal(review.type, "request_review");

    const upload = derivePatientGatewayNextAction({
      state: "post_op_follow_up_due",
      signals: signals({
        postOpFollowUpDue: true,
        followUpBooked: true,
        imagingComplete: false,
      }),
      upcomingAppointments: [],
      nowIso: "2026-07-27T00:00:00.000Z",
    });
    assert.equal(upload.type, "upload_images");
    assert.equal(upload.actionKey, "progress_images");
  });

  it("supports pre-surgery pathways without procedure stage force", () => {
    const treatment = buildPatientGatewayJourneyResponse({
      state: "treatment_recommended",
      signals: signals({ consultCompleted: true, treatmentRecommended: true }),
      upcomingAppointments: [],
      nowIso: "2026-07-27T00:00:00.000Z",
    });
    assert.equal(treatment.stage, "treatment");
    assert.equal(treatment.nextAction.type, "await_clinic");
  });
});
