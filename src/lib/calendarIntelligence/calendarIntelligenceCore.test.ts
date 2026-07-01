import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  buildCalendarBookingIntelligence,
  detectCalendarOperationalBlockers,
  detectCalendarOverlapConflicts,
  deriveAppointmentRiskStatus,
  isSurgeryBookingType,
  shapeCalendarOperationalFeedItem,
} from "./calendarIntelligenceCore";

const TID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function booking(p: Partial<FiBookingRow> & Pick<FiBookingRow, "id" | "start_at" | "end_at">): FiBookingRow {
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
    booking_type: "consultation",
    booking_status: "scheduled",
    title: "Test",
    description: null,
    timezone: "UTC",
    location: null,
    metadata: {},
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: p.start_at,
    updated_at: p.start_at,
    ...p,
  };
}

describe("calendarIntelligenceCore", () => {
  it("detects surgery booking type", () => {
    assert.equal(isSurgeryBookingType("surgery"), true);
    assert.equal(isSurgeryBookingType("consultation"), false);
  });

  it("flags room overlap conflicts", () => {
    const room = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const existing = booking({
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      room_id: room,
      start_at: "2026-06-10T08:00:00.000Z",
      end_at: "2026-06-10T10:00:00.000Z",
    });
    const candidate = booking({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      room_id: room,
      start_at: "2026-06-10T09:00:00.000Z",
      end_at: "2026-06-10T11:00:00.000Z",
    });
    const conflicts = detectCalendarOverlapConflicts(candidate, [existing], {
      ignoreBookingId: candidate.id,
    });
    assert.ok(conflicts.some((c) => c.kind === "room_overlap"));
  });

  it("detects missing staff and room blockers for surgery", () => {
    const blockers = detectCalendarOperationalBlockers({
      bookingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenantId: TID,
      bookingType: "surgery",
      bookingStatus: "scheduled",
      startAt: "2026-06-10T08:00:00.000Z",
      endAt: "2026-06-10T16:00:00.000Z",
      patientId: null,
      caseId: null,
      clinicId: null,
      roomId: null,
      roomRequired: true,
      assignedStaffId: null,
      assignedUserId: null,
      metadata: {},
      depositSatisfied: false,
      consentSigned: false,
    });
    assert.ok(blockers.some((b) => b.kind === "missing_staff"));
    assert.ok(blockers.some((b) => b.kind === "missing_room"));
    assert.ok(blockers.some((b) => b.kind === "unpaid_deposit"));
  });

  it("derives blocked risk when critical blockers exist", () => {
    const risk = deriveAppointmentRiskStatus({
      blockers: [{ kind: "missing_room", label: "No room", severity: "critical", href: null }],
      readinessPercent: 40,
      bookingStatus: "scheduled",
    });
    assert.equal(risk, "blocked");
  });

  it("shapes lightweight operational feed item with readiness and blockers", () => {
    const row = booking({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      booking_type: "surgery",
      patient_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      start_at: "2026-06-10T08:00:00.000Z",
      end_at: "2026-06-10T16:00:00.000Z",
      metadata: { graft_count_estimate: "3000" },
    });
    const intelligence = buildCalendarBookingIntelligence({
      bookingId: row.id,
      tenantId: TID,
      bookingType: row.booking_type,
      bookingStatus: row.booking_status,
      startAt: row.start_at,
      endAt: row.end_at,
      patientId: row.patient_id,
      caseId: null,
      clinicId: null,
      roomId: null,
      roomRequired: true,
      assignedStaffId: null,
      assignedUserId: null,
      metadata: row.metadata,
      depositSatisfied: false,
    });
    const item = shapeCalendarOperationalFeedItem({
      booking: row,
      patientDisplayName: "Jamie Fox",
      staffSummary: null,
      roomLabel: null,
      intelligence,
    });
    assert.equal(item.patientDisplayName, "Jamie Fox");
    assert.equal(item.isSurgery, true);
    assert.ok(item.blockerCount > 0);
    assert.equal(item.graftEstimate, "3000");
  });
});