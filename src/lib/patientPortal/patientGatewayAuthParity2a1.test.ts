/**
 * FI-PATIENT-APP-2A.1 — authorization parity: empty domain data must not become 403
 * once requirePatientGatewayContext has resolved an active patient.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PatientJourneySignals } from "@/src/lib/patientJourney/patientJourneyStateCore";

import { buildPatientGatewayBillingSummary } from "./patientGatewayBillingCore";
import { selectPortalPatientMapping } from "./patientGatewayGateCore";
import { buildPatientGatewayJourneyResponse } from "./patientGatewayJourneyCore";
import { buildPatientGatewayMeResponse } from "./patientGatewayMeCore";

const AUTH = "00000000-0000-4000-8000-0000000000aa";
const PATIENT = "00000000-0000-4000-8000-0000000000bb";
const TENANT = "00000000-0000-4000-8000-0000000000cc";
const PERSON = "00000000-0000-4000-8000-0000000000dd";

function emptySignals(): PatientJourneySignals {
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
    hasRecentActivity: false,
    imagingComplete: false,
    consentSigned: false,
    followUpBooked: false,
  };
}

describe("FI-PATIENT-APP-2A.1 gateway authorization parity (empty ≠ deny)", () => {
  it("A. active unique portal mapping resolves (gate foundation)", () => {
    const selected = selectPortalPatientMapping(AUTH, [
      {
        id: PATIENT,
        tenant_id: TENANT,
        person_id: PERSON,
        patient_status: "active",
        portal_auth_user_id: AUTH,
      },
    ]);
    assert.equal(selected.ok, true);
    if (!selected.ok) return;
    assert.equal(selected.row.id, PATIENT);
  });

  it("B. /me builder succeeds without surgery/appointment/invoice/message", () => {
    const me = buildPatientGatewayMeResponse({
      patientId: PATIENT,
      clinicId: TENANT,
      clinicName: "Demo Clinic",
      personMetadata: { preferred_name: "Demo", first_name: "Demo" },
      patientMetadata: {},
      branding: {
        logoUrl: null,
        primaryColor: null,
        secondaryColor: null,
        accentColor: null,
      },
    });
    assert.equal(me.ok, true);
    assert.equal(me.patientId, PATIENT);
  });

  it("C. /journey empty/early signals still produce patient-safe 200 DTO shape", () => {
    const journey = buildPatientGatewayJourneyResponse({
      state: "lead",
      signals: emptySignals(),
      upcomingAppointments: [],
      nowIso: "2026-07-27T00:00:00.000Z",
    });
    assert.equal(journey.ok, true);
    assert.ok(journey.stageLabel.length > 0);
    assert.ok(journey.nextAction.label.length > 0);
  });

  it("D. /billing with zero invoices is empty/zero state, not an auth failure", () => {
    const summary = buildPatientGatewayBillingSummary([], true);
    assert.equal(summary.ok, true);
    assert.equal(summary.outstandingBalance, 0);
    assert.equal(summary.hasOutstandingBalance, false);
    assert.equal(summary.nextPaymentDue, null);
  });

  it("E. unlinked auth remains fail-closed (no fuzzy match)", () => {
    const selected = selectPortalPatientMapping(AUTH, []);
    assert.equal(selected.ok, false);
    if (selected.ok) return;
    assert.equal(selected.code, "unlinked");
  });
});
