/**
 * FI-PATIENT-APP-P1 — Journey Control programme proof (contract + flow simulation).
 * Run: node --import tsx scripts/p1-journey-control-proof.ts
 */

import assert from "node:assert/strict";

import {
  formatMissingDocumentSections,
  PATIENT_JOURNEY_MILESTONE_KEYS,
  PATHOLOGY_NOTIFICATION_COPY,
  QUOTE_ACCEPTED_FOLLOW_ON_ACTIONS,
} from "../src/lib/patientJourneyControl/patientJourneyControlContracts";
import { buildPatientActionsGatewayResponse } from "../src/lib/patientJourneyControl/patientActionEngineCore";
import { derivePatientJourneyMilestones } from "../src/lib/patientJourneyControl/patientJourneyMilestoneCore";
import { buildPatientGatewayJourneyResponse } from "../src/lib/patientPortal/patientGatewayJourneyCore";
import type { PatientJourneySignals } from "../src/lib/patientJourney/patientJourneyStateCore";

const signals: PatientJourneySignals = {
  hasLead: true,
  leadLost: false,
  consultBooked: true,
  consultCompleted: true,
  treatmentRecommended: true,
  quoteSent: true,
  quoteAccepted: true,
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
  imagingComplete: false,
  consentSigned: false,
  followUpBooked: false,
};

function main() {
  assert.equal(PATIENT_JOURNEY_MILESTONE_KEYS.length, 11);

  const milestones = derivePatientJourneyMilestones({
    signals: {
      consultCompleted: true,
      treatmentRecommended: true,
      quoteDelivered: true,
      quoteAccepted: true,
      depositPaid: false,
      depositActionOpen: true,
      bloodRequestIssued: false,
      pathologyResultsReceived: false,
      clinicalReviewCompleted: false,
      surgeryBooked: false,
      preSurgeryDocumentsCompleted: false,
      surgeryReadinessReady: false,
    },
    nowIso: "2026-07-29T00:00:00.000Z",
  });
  assert.equal(milestones.find((m) => m.key === "quote_accepted")?.status, "completed");
  assert.equal(milestones.find((m) => m.key === "deposit_paid")?.status, "action_required");

  assert.deepEqual([...QUOTE_ACCEPTED_FOLLOW_ON_ACTIONS], ["pay_deposit", "complete_blood_tests"]);

  const actions = buildPatientActionsGatewayResponse(
    [
      {
        id: "1",
        kind: "pay_deposit",
        status: "open",
        priority: 90,
        dueAt: null,
        completedAt: null,
        title: "Pay your deposit",
        body: null,
        deepLinkKey: "deposit",
        resourceType: "invoice",
        resourceId: null,
        milestoneKey: "deposit_paid",
      },
      {
        id: "2",
        kind: "sign_document",
        status: "open",
        priority: 70,
        dueAt: null,
        completedAt: null,
        title: "Sign consent forms",
        body: null,
        deepLinkKey: "documents",
        resourceType: "document_packet",
        resourceId: "p1",
        milestoneKey: "pre_surgery_documents_completed",
      },
    ],
    "2026-07-29T00:00:00.000Z"
  );
  assert.equal(actions.primaryAction?.kind, "pay_deposit");
  assert.equal(actions.actionRequired.length, 2);

  const msg = formatMissingDocumentSections([
    "current_medications",
    "consent_to_treatment",
  ]);
  assert.match(msg, /current medications/i);
  assert.match(msg, /consent to treatment/i);
  assert.doesNotMatch(msg, /Documents incomplete/i);

  assert.match(
    PATHOLOGY_NOTIFICATION_COPY.pathology_received_awaiting_review.body,
    /awaiting clinical review/
  );
  assert.match(PATHOLOGY_NOTIFICATION_COPY.pathology_cleared.body, /No further action/);

  const journey = buildPatientGatewayJourneyResponse({
    state: "quote_accepted",
    signals,
    upcomingAppointments: [],
    nowIso: "2026-07-29T00:00:00.000Z",
    milestones,
    primaryActionOverride: {
      type: "pay_deposit",
      label: "Pay your deposit",
      dueAt: null,
      actionKey: "action:1",
      actionId: "1",
      deepLinkKey: "deposit",
    },
  });
  assert.equal(journey.milestones.length, 11);
  assert.equal(journey.nextAction.type, "pay_deposit");

  console.log(
    JSON.stringify(
      {
        ok: true,
        ticket: "FI-PATIENT-APP-P1",
        gates: {
          milestones: true,
          actionCentre: true,
          quoteFollowOns: true,
          documentCopy: true,
          pathologyCopy: true,
          journeyEnrichment: true,
        },
      },
      null,
      2
    )
  );
}

main();
