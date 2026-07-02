import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCalendarOsBookingCardModel } from "./calendarBookingCardModel";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { OperationalCalendarBookingDisplay } from "@/src/lib/calendar/operationalCalendarTypes";

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
    room_required: false,
    assigned_staff_id: null,
    assigned_user_id: null,
    booking_type: "surgery",
    booking_status: "confirmed",
    title: "Alex Patient",
    description: null,
    timezone: "UTC",
    location: null,
    metadata: { planned_graft_count: 3200 },
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: "2026-06-10T00:00:00.000Z",
    updated_at: "2026-06-10T00:00:00.000Z",
    ...p,
  };
}

describe("buildCalendarOsBookingCardModel", () => {
  it("includes patient, type, warnings, and surgery context", () => {
    const display: OperationalCalendarBookingDisplay = {
      anchorLabel: "Alex Patient",
      scalesSummary: null,
      durationMin: 240,
      reminderHint: null,
      roomLabel: "Theatre 1",
      resourceTeamLine: "Dr Surgeon · Nurse A",
      operational: {
        riskStatus: "attention",
        readinessPercent: 72,
        readinessReady: false,
        journeyState: null,
        journeyStateLabel: null,
        paymentFlag: "due",
        consentFlag: "missing",
        blockers: [{ kind: "missing_consent", label: "Consent missing", severity: "warning", href: null }],
        blockerCount: 1,
        nextAction: { label: "Collect consent", href: null },
        isSurgery: true,
      },
      clinicalStaffing: {
        displayStatus: "missing_roles",
        templateConfigured: true,
        readinessScore: 60,
        ready: false,
        requiredRoles: { nurse: 1 },
        assignedCounts: { surgeon: 1 },
        missingRoles: [{ role: "nurse", required: 1, assigned: 0 }],
        blockedAssignments: [],
        warnings: ["Nurse not assigned"],
      },
    };

    const card = buildCalendarOsBookingCardModel({
      booking: booking({
        id: "bk-1",
        start_at: "2026-06-10T08:00:00.000Z",
        end_at: "2026-06-10T12:00:00.000Z",
        assigned_staff_id: "staff-1",
      }),
      display,
      calendarTimezone: "UTC",
    });

    assert.equal(card.patientName, "Alex Patient");
    assert.equal(card.bookingType, "surgery");
    assert.equal(card.durationMin, 240);
    assert.equal(card.roomLabel, "Theatre 1");
    assert.ok(card.warnings.some((w) => w.kind === "payment"));
    assert.ok(card.warnings.some((w) => w.kind === "consent"));
    assert.ok(card.surgery);
    assert.equal(card.surgery?.plannedGraftCount, "3200");
    assert.equal(card.isUnassigned, false);
  });

  it("flags unassigned bookings", () => {
    const card = buildCalendarOsBookingCardModel({
      booking: booking({
        id: "bk-2",
        start_at: "2026-06-10T08:00:00.000Z",
        end_at: "2026-06-10T09:00:00.000Z",
        booking_type: "consultation",
      }),
      display: {
        anchorLabel: "Walk-in",
        scalesSummary: null,
        durationMin: 60,
        reminderHint: null,
      },
      calendarTimezone: "UTC",
    });
    assert.equal(card.isUnassigned, true);
    assert.ok(card.warnings.some((w) => w.kind === "unassigned"));
  });
});
