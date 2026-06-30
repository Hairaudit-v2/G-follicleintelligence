import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import type { FiBookingRow } from "@/src/lib/bookings/types";
import { buildCalendarOsDisplayPipelineTrace } from "@/src/lib/calendar/calendarOsDisplayPipeline";
import {
  CALENDAR_OS_EVENT_META_FLAG,
  type FiCalendarEventOverlapRow,
} from "@/src/lib/calendar/calendarOsEventsCore";
import {
  appendProviderLinkedStaffColumns,
  staffColumnId,
} from "@/src/lib/calendar/operationalCalendarColumns";
import { buildCalendarDay } from "@/src/lib/bookings/calendarView";
import { resolveDisplayResourceColumnId } from "@/src/lib/calendar/operationalCalendarLayout";
import { buildClinicalStaffPickerReadiness } from "@/src/lib/staff/clinicalStaffPicker";

const STAFF_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function sampleEventRow(
  overrides: Partial<FiCalendarEventOverlapRow> = {}
): FiCalendarEventOverlapRow {
  return {
    id: randomUUID(),
    tenant_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    external_event_id: "google-event-123",
    provider: "google",
    calendar_id: "primary",
    title: "Consultation",
    description: null,
    location: null,
    start_time: "2026-06-26T10:00:00.000Z",
    end_time: "2026-06-26T10:30:00.000Z",
    event_type: "consultation",
    google_meet_url: null,
    patient_id: null,
    lead_id: null,
    metadata: {},
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function calendarOsBooking(overrides: Partial<FiBookingRow> = {}): FiBookingRow {
  return {
    id: randomUUID(),
    tenant_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    lead_id: null,
    person_id: null,
    patient_id: null,
    case_id: null,
    clinic_id: null,
    room_id: null,
    room_required: false,
    assigned_staff_id: STAFF_A,
    assigned_user_id: null,
    booking_type: "consultation",
    booking_status: "scheduled",
    title: "CalendarOS event",
    description: null,
    start_at: "2026-06-26T10:00:00.000Z",
    end_at: "2026-06-26T10:30:00.000Z",
    timezone: "UTC",
    location: null,
    metadata: { [CALENDAR_OS_EVENT_META_FLAG]: true },
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("CalendarOS display pipeline", () => {
  it("resolveDisplayResourceColumnId falls back to unassigned when staff column is missing", () => {
    const booking = calendarOsBooking();
    const visible = ["unassigned"];
    assert.equal(resolveDisplayResourceColumnId(booking, visible), "unassigned");
  });

  it("resolveDisplayResourceColumnId keeps linked staff column when present", () => {
    const booking = calendarOsBooking();
    const visible = [staffColumnId(STAFF_A), "unassigned"];
    assert.equal(resolveDisplayResourceColumnId(booking, visible), staffColumnId(STAFF_A));
  });

  it("appendProviderLinkedStaffColumns adds linked staff before unassigned", () => {
    const columns = appendProviderLinkedStaffColumns(
      [
        { id: "s:other", kind: "fi_staff", label: "Other", subtitle: "Doctor", staffId: "other" },
        { id: "unassigned", kind: "unassigned", label: "Unassigned", subtitle: "No staff column" },
      ],
      [STAFF_A],
      new Map([
        [
          STAFF_A,
          {
            id: STAFF_A,
            email: "paul@example.com",
            full_name: "Paul",
            staff_role: "consultant",
            is_active: true,
            working_hours: {},
            clinical_readiness: buildClinicalStaffPickerReadiness({
              full_name: "Paul",
              staff_role: "consultant",
              is_active: true,
              working_hours: {},
            }),
          },
        ],
      ])
    );

    assert.equal(
      columns.some((c) => c.id === staffColumnId(STAFF_A)),
      true
    );
    assert.equal(columns.at(-1)?.id, "unassigned");
  });

  it("buildCalendarOsDisplayPipelineTrace reports mapping, merge, bucket, and filter flags", () => {
    const raw = sampleEventRow();
    const mapped = calendarOsBooking({ id: raw.id });
    const lanes = buildCalendarDay("2026-06-26", "UTC");
    const resourceColumns = [
      {
        id: staffColumnId(STAFF_A),
        kind: "fi_staff" as const,
        label: "Paul",
        subtitle: "Consultant",
        staffId: STAFF_A,
      },
      {
        id: "unassigned",
        kind: "unassigned" as const,
        label: "Unassigned",
        subtitle: "No staff column",
      },
    ];

    const trace = buildCalendarOsDisplayPipelineTrace({
      rawRows: [raw],
      mappedBookings: [mapped],
      displayedCalendarOs: [mapped],
      bookingFilterExcludedIds: new Set([raw.id]),
      mergedBookings: [mapped],
      buckets: { "2026-06-26": [mapped] },
      resourceColumns,
      lanes,
    });

    assert.equal(trace.rawCalendarOsEventCount, 1);
    assert.equal(trace.mappedCalendarOsEventCount, 1);
    assert.equal(trace.events.length, 1);
    assert.equal(trace.events[0]!.assignedStaffId, STAFF_A);
    assert.equal(trace.events[0]!.inMergedBookings, true);
    assert.equal(trace.events[0]!.inDayBucket, true);
    assert.equal(trace.events[0]!.removedByBookingFilters, true);
    assert.equal(trace.events[0]!.isCalendarOsEventRow, true);
    assert.equal(trace.events[0]!.displayColumnId, staffColumnId(STAFF_A));
  });
});
