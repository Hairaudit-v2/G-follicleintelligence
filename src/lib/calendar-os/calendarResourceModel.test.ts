import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCalendarOsResourceRows,
  deriveCalendarOsResourceUtilisation,
  groupCalendarOsResourceRowsByRole,
  isBookingUnassignedForCalendarOs,
  mapBookingsToWeekResourceCells,
  mapStaffRoleToCalendarOsGroup,
  calendarOsViewModeFromQuery,
  filterBookingsForCalendarOsView,
} from "./calendarResourceModel";
import type { ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { OperationalCalendarResourceColumn } from "@/src/lib/calendar/operationalCalendarTypes";
import { buildCalendarWeek } from "@/src/lib/bookings/calendarView";
import { DEFAULT_BUSINESS_GRID } from "@/src/lib/calendar/operationalCalendarLayout";

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
    booking_type: "consultation",
    booking_status: "scheduled",
    title: "Test patient",
    description: null,
    timezone: "UTC",
    location: null,
    metadata: {},
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: "2026-06-10T00:00:00.000Z",
    updated_at: "2026-06-10T00:00:00.000Z",
    ...p,
  };
}

function query(overrides: Partial<ParsedCalendarQuery> = {}): ParsedCalendarQuery {
  return {
    view: "week",
    dateAnchor: "2026-06-10",
    calendarTimezone: "UTC",
    status: null,
    bookingType: null,
    assignedUserId: null,
    staffId: null,
    clinicId: null,
    roomId: null,
    resourceView: "staff",
    includeCancelled: false,
    search: null,
    sampleMode: false,
    staffRoleBucket: null,
    waitingOnly: false,
    unassignedOnly: false,
    ...overrides,
  };
}

describe("mapStaffRoleToCalendarOsGroup", () => {
  it("maps surgeon and nurse roles", () => {
    assert.equal(mapStaffRoleToCalendarOsGroup("surgeon"), "surgeons");
    assert.equal(mapStaffRoleToCalendarOsGroup("senior_nurse"), "nurses");
    assert.equal(mapStaffRoleToCalendarOsGroup("reception"), "reception_admin");
    assert.equal(mapStaffRoleToCalendarOsGroup("clinical_assistant"), "surgical_assistants");
  });
});

describe("calendarOsViewModeFromQuery", () => {
  it("derives surgery mode from booking type filter", () => {
    assert.equal(calendarOsViewModeFromQuery(query({ bookingType: "surgery" })), "surgery");
    assert.equal(calendarOsViewModeFromQuery(query({ resourceView: "room" })), "room");
  });
});

describe("resource grouping", () => {
  const columns: OperationalCalendarResourceColumn[] = [
    {
      id: "s:staff-1",
      kind: "fi_staff",
      label: "Dr Smith",
      subtitle: "Consultant",
      staffId: "staff-1",
      clinicallyAvailable: true,
      readinessWarning: null,
    },
    {
      id: "s:staff-2",
      kind: "fi_staff",
      label: "Nurse Jones",
      subtitle: "Nurse",
      staffId: "staff-2",
      clinicallyAvailable: true,
      readinessWarning: null,
    },
    {
      id: "unassigned",
      kind: "unassigned",
      label: "Unassigned",
      subtitle: null,
    },
  ];

  it("groups staff by role with unassigned lane last", () => {
    const rows = buildCalendarOsResourceRows({
      query: query(),
      resourceColumns: columns,
      staffDirectory: [
        {
          id: "staff-1",
          full_name: "Dr Smith",
          email: "a@test.com",
          fi_user_id: null,
          staff_role: "consultant",
          is_active: true,
          working_hours: null,
          clinical_readiness: {
            clinically_available: true,
            block_reason: null,
            readiness_state: "ready",
            warning_label: null,
          },
        },
        {
          id: "staff-2",
          full_name: "Nurse Jones",
          email: "b@test.com",
          fi_user_id: null,
          staff_role: "nurse",
          is_active: true,
          working_hours: null,
          clinical_readiness: {
            clinically_available: true,
            block_reason: null,
            readiness_state: "ready",
            warning_label: null,
          },
        },
      ],
      rooms: [],
    });
    const groups = groupCalendarOsResourceRowsByRole(rows);
    assert.ok(groups.some((g) => g.group === "doctors"));
    assert.ok(groups.some((g) => g.group === "nurses"));
    assert.ok(groups.some((g) => g.group === "unassigned"));
  });
});

describe("week layout mapping", () => {
  it("places bookings in staff x day cells", () => {
    const lanes = buildCalendarWeek("2026-06-10", "UTC");
    const staffId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const columns: OperationalCalendarResourceColumn[] = [
      {
        id: `s:${staffId}`,
        kind: "fi_staff",
        label: "Dr A",
        subtitle: null,
        staffId,
      },
      { id: "unassigned", kind: "unassigned", label: "Unassigned", subtitle: null },
    ];
    const bookings = [
      booking({
        id: "bk-1",
        assigned_staff_id: staffId,
        start_at: "2026-06-10T09:00:00.000Z",
        end_at: "2026-06-10T10:00:00.000Z",
      }),
      booking({
        id: "bk-2",
        start_at: "2026-06-11T09:00:00.000Z",
        end_at: "2026-06-11T10:00:00.000Z",
      }),
    ];
    const cells = mapBookingsToWeekResourceCells({
      query: query(),
      lanes,
      bookings,
      resourceColumns: columns,
      staffDirectory: [],
      rooms: [],
      staffIdByUserId: new Map(),
      gridConfig: DEFAULT_BUSINESS_GRID,
    });
    const assignedCell = cells.find((c) => c.resourceId === `s:${staffId}`);
    assert.ok(assignedCell?.bookingIds.includes("bk-1"));
    const unassignedCell = cells.find((c) => c.resourceId === "unassigned");
    assert.ok(unassignedCell?.bookingIds.includes("bk-2"));
  });
});

describe("unassigned bookings", () => {
  it("detects bookings without assignee", () => {
    const b = booking({
      id: "x",
      start_at: "2026-06-10T09:00:00.000Z",
      end_at: "2026-06-10T10:00:00.000Z",
    });
    assert.equal(isBookingUnassignedForCalendarOs(b), true);
  });

  it("filters surgery view", () => {
    const bookings = [
      booking({
        id: "1",
        booking_type: "surgery",
        start_at: "2026-06-10T09:00:00.000Z",
        end_at: "2026-06-10T10:00:00.000Z",
      }),
      booking({
        id: "2",
        booking_type: "consultation",
        start_at: "2026-06-10T11:00:00.000Z",
        end_at: "2026-06-10T12:00:00.000Z",
      }),
    ];
    const filtered = filterBookingsForCalendarOsView(bookings, query({ bookingType: "surgery" }));
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]!.id, "1");
  });
});

describe("resource utilisation", () => {
  it("derives utilisation from booking durations", () => {
    const bookings = [
      booking({
        id: "bk-1",
        start_at: "2026-06-10T09:00:00.000Z",
        end_at: "2026-06-10T11:00:00.000Z",
      }),
    ];
    const util = deriveCalendarOsResourceUtilisation(["bk-1"], bookings);
    assert.equal(util.bookingCount, 1);
    assert.equal(util.bookedMinutes, 120);
    assert.ok(util.percent > 0);
  });
});
