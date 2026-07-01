import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertReceptionBoardTenantScope,
  buildQuickActions,
  nextFlowActionForQueueColumn,
} from "./receptionBoardCore";
import { parseReceptionBoardCommandCenterPayload } from "./receptionBoardPayloadSchema";
import type { ReceptionBoardCommandCenterPayload } from "./receptionBoardTypes";

const TENANT = "11111111-1111-4111-8111-111111111111";
const BOOKING = "22222222-2222-4222-8222-222222222222";

function minimalPayload(tenantId: string): ReceptionBoardCommandCenterPayload {
  return {
    tenantId,
    tenantName: "Test Clinic",
    loadedAt: new Date().toISOString(),
    operationalDay: {
      calendarTimezone: "UTC",
      todayYmd: "2026-07-02",
      localStartIso: "2026-07-02T00:00:00.000Z",
      localEndIso: "2026-07-03T00:00:00.000Z",
    },
    appointments: [],
    queue: {
      scheduled: [],
      arrived: [],
      checked_in: [],
      waiting: [],
      in_consultation: [],
      procedure_in_progress: [],
      completed: [],
      follow_up_booked: [],
    },
    actionAlerts: [],
    quickActions: [],
    tomorrowSurgeries: [],
    intelligence: {
      todayConsultations: 0,
      todaySurgeries: 0,
      revenueBookedToday: 0,
      outstandingPayments: 0,
      conversionRateToday: null,
      doctorUtilizationPercent: null,
      staffUtilizationPercent: null,
      averageConsultationCloseRate: null,
      upcomingFollowUps: 0,
      unreadPatientTasks: 0,
    },
    liveEvents: [],
    receptionCards: [],
  };
}

describe("receptionBoard.server safety", () => {
  it("parses command center payload with tenant id", () => {
    const parsed = parseReceptionBoardCommandCenterPayload(minimalPayload(TENANT));
    assert.equal(parsed.tenantId, TENANT);
  });

  it("tenant isolation guard blocks mismatched refresh tenant", () => {
    const parsed = parseReceptionBoardCommandCenterPayload(minimalPayload(TENANT));
    assert.throws(
      () => assertReceptionBoardTenantScope("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", parsed.tenantId),
      /tenant mismatch/
    );
  });

  it("status transition actions align with reception board flow policy", async () => {
    const { RECEPTION_BOARD_FLOW_ACTIONS } = await import(
      "@/src/lib/fiOs/receptionBoardFlowPolicy"
    );
    assert.ok(RECEPTION_BOARD_FLOW_ACTIONS.includes("mark_arrived"));
    assert.ok(RECEPTION_BOARD_FLOW_ACTIONS.includes("start_consultation"));
    assert.ok(RECEPTION_BOARD_FLOW_ACTIONS.includes("complete"));
  });

  it("booking mutation policy blocks terminal status changes", async () => {
    const { assertBookingMutableForReceptionFlow } = await import(
      "@/src/lib/fiOs/receptionBoardFlowPolicy"
    );
    assert.equal(assertBookingMutableForReceptionFlow("completed").ok, false);
    assert.equal(assertBookingMutableForReceptionFlow("scheduled").ok, true);
  });

  it("payment action quick links target financial dashboard", () => {
    const collect = buildQuickActions(`/fi-admin/${TENANT}`).find((a) => a.id === "collect_payment");
    assert.ok(collect);
    assert.match(collect!.href, /financial\/dashboard/);
  });

  it("patient state transition uses mark_arrived for scheduled queue", () => {
    assert.equal(nextFlowActionForQueueColumn("scheduled"), "mark_arrived");
  });

  it("appointment cards reference booking id in hrefs", () => {
    const payload = minimalPayload(TENANT);
    payload.appointments = [
      {
        id: BOOKING,
        patientName: "Jane",
        appointmentTime: "09:00",
        appointmentType: "Consultation",
        clinician: "Dr A",
        status: "scheduled",
        statusLabel: "Scheduled",
        durationMinutes: 30,
        room: null,
        paymentStatus: "unknown",
        paymentStatusLabel: "—",
        confirmationStatus: "unconfirmed",
        journeyState: "consult_booked",
        journeyStateLabel: "Consultation booked",
        sortKey: "2026-07-02T09:00:00.000Z",
        hrefs: {
          patient: null,
          case: null,
          lead: null,
          appointment: `/fi-admin/${TENANT}/appointments?bookingId=${BOOKING}`,
          calendar: `/fi-admin/${TENANT}/calendar?bookingId=${BOOKING}`,
        },
      },
    ];
    const parsed = parseReceptionBoardCommandCenterPayload(payload);
    assert.ok(parsed.appointments[0]!.hrefs.appointment.includes(BOOKING));
  });
});