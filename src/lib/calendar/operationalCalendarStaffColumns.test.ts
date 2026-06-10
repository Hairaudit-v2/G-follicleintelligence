import assert from "node:assert/strict";
import { test } from "node:test";

import { parseCalendarSearchParams } from "@/src/lib/bookings/calendarQuery";
import { resourceColumnIdForBooking } from "@/src/lib/calendar/operationalCalendarLayout";
import {
  buildStaffUserLinkIndex,
  calendarFilterColumnId,
  columnPrefillAssignment,
  legacyUserColumnId,
  normalizeCalendarStaffFilter,
  resolveUserColumnToStaffColumnId,
} from "@/src/lib/calendar/operationalCalendarColumns";
import {
  canSelectStaffForClinicalPicker,
  enrichCrmShellStaffPickerOption,
} from "@/src/lib/staff/clinicalStaffPicker";
import { bookingAssignmentDisplay } from "@/src/lib/staff/staffAssigneeDisplay";
import { NEEDS_REVIEW_STAFF_ROLE } from "@/src/lib/staff/staffRolePolicy";
import type { FiBookingRow } from "@/src/lib/bookings/types";

const STAFF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UNLINKED_USER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function bookingRow(p: Partial<FiBookingRow>): FiBookingRow {
  return {
    id: "d1",
    tenant_id: "t1",
    lead_id: null,
    person_id: null,
    patient_id: null,
    case_id: null,
    clinic_id: null,
    assigned_staff_id: null,
    assigned_user_id: null,
    booking_type: "consultation",
    booking_status: "scheduled",
    title: null,
    description: null,
    start_at: "2026-06-01T10:00:00.000Z",
    end_at: "2026-06-01T11:00:00.000Z",
    timezone: null,
    location: null,
    metadata: {},
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...p,
    room_id: p.room_id ?? null,
    room_required: p.room_required ?? false,
  };
}

test("u: user column maps to s: staff column when linked", () => {
  const { staffIdByUserId } = buildStaffUserLinkIndex([
    { id: STAFF_ID, fi_user_id: USER_ID },
  ]);
  assert.equal(resolveUserColumnToStaffColumnId(USER_ID, staffIdByUserId), `s:${STAFF_ID}`);
  assert.equal(
    resourceColumnIdForBooking(bookingRow({ assigned_user_id: USER_ID }), { staffIdByUserId }),
    `s:${STAFF_ID}`
  );
});

test("unlinked u: user column stays legacy", () => {
  const { staffIdByUserId } = buildStaffUserLinkIndex([{ id: STAFF_ID, fi_user_id: USER_ID }]);
  assert.equal(resolveUserColumnToStaffColumnId(UNLINKED_USER, staffIdByUserId), null);
  assert.equal(
    resourceColumnIdForBooking(bookingRow({ assigned_user_id: UNLINKED_USER }), { staffIdByUserId }),
    legacyUserColumnId(UNLINKED_USER)
  );
});

test("quick-create preselects assignedStaffId from staff column", () => {
  const { staffIdByUserId } = buildStaffUserLinkIndex([{ id: STAFF_ID, fi_user_id: USER_ID }]);
  const fromStaff = columnPrefillAssignment(`s:${STAFF_ID}`, staffIdByUserId);
  assert.equal(fromStaff.assignedStaffId, STAFF_ID);
  assert.equal(fromStaff.legacyOwnerUserId, "");

  const fromLinkedUser = columnPrefillAssignment(legacyUserColumnId(USER_ID), staffIdByUserId);
  assert.equal(fromLinkedUser.assignedStaffId, STAFF_ID);
  assert.equal(fromLinkedUser.legacyOwnerUserId, "");
});

test("blocked staff cannot be selected in clinical picker", () => {
  const opt = enrichCrmShellStaffPickerOption({
    id: STAFF_ID,
    email: "blocked@example.com",
    full_name: "Blocked",
    staff_role: NEEDS_REVIEW_STAFF_ROLE,
    is_active: true,
    working_hours: {},
  });
  assert.equal(canSelectStaffForClinicalPicker(opt), false);
});

test("staffId URL filter resolves from legacy assignedUserId when linked", () => {
  const { staffIdByUserId } = buildStaffUserLinkIndex([{ id: STAFF_ID, fi_user_id: USER_ID }]);
  const parsed = parseCalendarSearchParams({ assignedUserId: USER_ID });
  const { query, shouldCanonicalizeToStaffId } = normalizeCalendarStaffFilter(parsed, staffIdByUserId);
  assert.equal(query.staffId, STAFF_ID);
  assert.equal(query.assignedUserId, null);
  assert.equal(shouldCanonicalizeToStaffId, true);
});

test("legacy assignedUserId filter still works for unlinked user", () => {
  const { staffIdByUserId } = buildStaffUserLinkIndex([{ id: STAFF_ID, fi_user_id: USER_ID }]);
  const parsed = parseCalendarSearchParams({ assignedUserId: UNLINKED_USER });
  const { query, shouldCanonicalizeToStaffId } = normalizeCalendarStaffFilter(parsed, staffIdByUserId);
  assert.equal(query.staffId, null);
  assert.equal(query.assignedUserId, UNLINKED_USER);
  assert.equal(shouldCanonicalizeToStaffId, false);
  assert.equal(calendarFilterColumnId(query, staffIdByUserId), legacyUserColumnId(UNLINKED_USER));
});

test("userId param is legacy alias for assignedUserId", () => {
  const parsed = parseCalendarSearchParams({ userId: UNLINKED_USER });
  assert.equal(parsed.assignedUserId, UNLINKED_USER);
});

test("display labels distinguish Provider vs Owner", () => {
  const staff = [
    {
      id: STAFF_ID,
      email: "dr@example.com",
      full_name: "Dr Smith",
      fi_user_id: USER_ID,
      staff_role: "consultant",
      is_active: true,
    },
  ];
  const users = [
    { id: USER_ID, email: "dr@example.com" },
    { id: UNLINKED_USER, email: "admin@example.com", full_name: "Admin User" },
  ];
  const display = bookingAssignmentDisplay(
    staff,
    users,
    bookingRow({ assigned_staff_id: STAFF_ID, assigned_user_id: UNLINKED_USER })
  );
  assert.match(display.summaryLine, /Provider: Dr Smith/);
  assert.match(display.summaryLine, /Owner: Admin User/);
});
