import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PatientJourneySignals } from "@/src/lib/patientJourney/patientJourneyStateCore";
import type { FiBookingRow } from "@/src/lib/bookings/types";

import { loadPatientGatewayJourney } from "./patientGatewayJourney.server";
import type { PatientGatewayContext } from "./patientGatewayTypes";

const AUTH_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATIENT_A = "11111111-1111-4111-8111-111111111111";
const PATIENT_B = "22222222-2222-4222-8222-222222222222";
const TENANT_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const CTX_A: PatientGatewayContext = {
  authUserId: AUTH_A,
  patientId: PATIENT_A,
  tenantId: TENANT_A,
  personId: "55555555-5555-4555-8555-555555555555",
  patientStatus: "active",
  clinicName: "Clinic A",
};

function baseSignals(overrides: Partial<PatientJourneySignals> = {}): PatientJourneySignals {
  return {
    hasLead: true,
    leadLost: false,
    consultBooked: true,
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
    consentSigned: true,
    followUpBooked: false,
    ...overrides,
  };
}

describe("loadPatientGatewayJourney", () => {
  it("A. valid patient reads own journey", async () => {
    const result = await loadPatientGatewayJourney(CTX_A, {
      writeAudit: false,
      nowIso: "2026-07-27T00:00:00.000Z",
      loadSignals: async () => baseSignals(),
      loadPersisted: async () => null,
      loadBookings: async () =>
        [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            tenant_id: TENANT_A,
            patient_id: PATIENT_A,
            booking_type: "consultation",
            booking_status: "confirmed",
            title: "Consultation",
            start_at: "2026-08-01T00:00:00.000Z",
            end_at: "2026-08-01T01:00:00.000Z",
            cancelled_at: null,
          },
        ] as FiBookingRow[],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.stage, "consultation");
    assert.equal(result.nextAction.type, "attend_appointment");
  });

  it("F. service ignores foreign patient identity — uses context only", async () => {
    let seenPatientId: string | null = null;
    const result = await loadPatientGatewayJourney(CTX_A, {
      writeAudit: false,
      nowIso: "2026-07-27T00:00:00.000Z",
      loadSignals: async (_t, patientId) => {
        seenPatientId = patientId;
        return baseSignals({ consultBooked: false, consultCompleted: true, treatmentRecommended: true });
      },
      loadPersisted: async () => null,
      loadBookings: async () => [],
    });
    assert.equal(seenPatientId, PATIENT_A);
    assert.notEqual(seenPatientId, PATIENT_B);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.stage, "treatment");
  });

  it("I. same FiOS state yields deterministic journey", async () => {
    const opts = {
      writeAudit: false as const,
      nowIso: "2026-07-27T00:00:00.000Z",
      loadSignals: async () =>
        baseSignals({
          consultCompleted: true,
          procedureCompleted: true,
          postOpFollowUpDue: true,
          imagingComplete: false,
          followUpBooked: true,
        }),
      loadPersisted: async () => null,
      loadBookings: async () => [] as FiBookingRow[],
    };
    const a = await loadPatientGatewayJourney(CTX_A, opts);
    const b = await loadPatientGatewayJourney(CTX_A, opts);
    assert.deepEqual(a, b);
  });
});
