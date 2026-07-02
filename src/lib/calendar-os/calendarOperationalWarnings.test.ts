import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCalendarOsOperationalPanelSummary,
  deriveCalendarOsBookingWarnings,
  deriveCalendarOsSurgeryIntelligence,
} from "./calendarOperationalWarnings";
import type { FiBookingRow } from "@/src/lib/bookings/types";

const TID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function booking(
  p: Partial<FiBookingRow> & Pick<FiBookingRow, "id" | "start_at" | "end_at">
): FiBookingRow {
  return {
    tenant_id: TID,
    lead_id: null,
    person_id: null,
    patient_id: null,
    case_id: null,
    clinic_id: null,
    room_id: null,
    room_required: true,
    assigned_staff_id: null,
    assigned_user_id: null,
    booking_type: "surgery",
    booking_status: "scheduled",
    title: "Surgery case",
    description: null,
    timezone: "UTC",
    location: null,
    metadata: { planned_graft_count: 2500, photography_complete: false },
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: "2026-06-10T00:00:00.000Z",
    updated_at: "2026-06-10T00:00:00.000Z",
    ...p,
  };
}

describe("deriveCalendarOsBookingWarnings", () => {
  it("combines operational and staffing warnings", () => {
    const warnings = deriveCalendarOsBookingWarnings({
      booking: booking({
        id: "1",
        start_at: "2026-06-10T08:00:00.000Z",
        end_at: "2026-06-10T12:00:00.000Z",
      }),
      operational: {
        riskStatus: "at_risk",
        readinessPercent: 40,
        readinessReady: false,
        journeyState: null,
        journeyStateLabel: null,
        paymentFlag: "due",
        consentFlag: "missing",
        blockers: [],
        blockerCount: 0,
        nextAction: null,
        isSurgery: true,
      },
      staffing: {
        displayStatus: "missing_roles",
        templateConfigured: true,
        readinessScore: 40,
        ready: false,
        requiredRoles: {},
        assignedCounts: {},
        missingRoles: [{ role: "nurse", required: 1, assigned: 0 }],
        blockedAssignments: [],
        warnings: [],
      },
    });
    assert.ok(warnings.some((w) => w.kind === "unassigned"));
    assert.ok(warnings.some((w) => w.kind === "payment"));
    assert.ok(warnings.some((w) => w.kind === "staffing"));
    assert.ok(warnings.some((w) => w.kind === "room"));
  });
});

describe("deriveCalendarOsSurgeryIntelligence", () => {
  it("surfaces graft count and readiness", () => {
    const intel = deriveCalendarOsSurgeryIntelligence({
      booking: booking({
        id: "1",
        start_at: "2026-06-10T08:00:00.000Z",
        end_at: "2026-06-10T12:00:00.000Z",
      }),
      display: { anchorLabel: "Pt", scalesSummary: null, durationMin: 240, reminderHint: null, roomLabel: "T1" },
      operational: {
        riskStatus: "attention",
        readinessPercent: 55,
        readinessReady: false,
        journeyState: null,
        journeyStateLabel: null,
        paymentFlag: "due",
        consentFlag: "missing",
        blockers: [],
        blockerCount: 0,
        nextAction: null,
        isSurgery: true,
      },
      calendarTimezone: "UTC",
    });
    assert.equal(intel.plannedGraftCount, "2500");
    assert.equal(intel.consentComplete, false);
    assert.equal(intel.photographyComplete, false);
    assert.equal(intel.paymentStatus, "Deposit due");
  });
});

describe("buildCalendarOsOperationalPanelSummary", () => {
  it("counts unassigned and surgery readiness issues", () => {
    const summary = buildCalendarOsOperationalPanelSummary({
      bookings: [
        booking({
          id: "1",
          start_at: "2026-06-10T08:00:00.000Z",
          end_at: "2026-06-10T12:00:00.000Z",
        }),
        booking({
          id: "2",
          booking_type: "follow_up",
          start_at: "2026-06-10T14:00:00.000Z",
          end_at: "2026-06-10T14:30:00.000Z",
          assigned_staff_id: "s1",
        }),
      ],
      bookingDisplay: {
        "1": {
          anchorLabel: "A",
          scalesSummary: null,
          durationMin: 240,
          reminderHint: null,
          operational: {
            riskStatus: "attention",
            readinessPercent: 30,
            readinessReady: false,
            journeyState: null,
            journeyStateLabel: null,
            paymentFlag: "due",
            consentFlag: "missing",
            blockers: [],
            blockerCount: 0,
            nextAction: null,
            isSurgery: true,
          },
        },
        "2": {
          anchorLabel: "B",
          scalesSummary: null,
          durationMin: 30,
          reminderHint: null,
        },
      },
      staffDirectory: [
        {
          id: "s1",
          full_name: "Dr A",
          is_active: true,
          clinical_readiness: { clinically_available: true },
        },
      ],
      rooms: [{ id: "r1", is_active: true }, { id: "r2", is_active: true }],
      lanesDayKeys: ["2026-06-10"],
    });
    assert.equal(summary.unassignedBookings, 1);
    assert.equal(summary.surgeryReadinessIssues, 1);
    assert.equal(summary.followUpsDue, 1);
    assert.equal(summary.paymentsRequiringAttention, 1);
    assert.equal(summary.roomsAvailable, 2);
  });
});
