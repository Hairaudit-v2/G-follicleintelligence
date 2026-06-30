import assert from "node:assert/strict";
import { test } from "node:test";

import { bookingCreateBodySchema } from "@/src/lib/bookings/bookingApiSchemas";
import { parseOperatorBookingSearchParams } from "@/src/lib/bookings/operatorBookingQuery";
import {
  canSelectStaffForClinicalPicker,
  enrichCrmShellStaffPickerOption,
  formatClinicalPickerOptionLabel,
} from "@/src/lib/staff/clinicalStaffPicker";
import { bookingAssignmentDisplay } from "@/src/lib/staff/staffAssigneeDisplay";
import { NEEDS_REVIEW_STAFF_ROLE } from "@/src/lib/staff/staffRolePolicy";
import type { FiBookingRow } from "@/src/lib/bookings/types";

const STAFF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

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
    financial_os_status: null,
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

test("quick-create payload uses assignedStaffId", () => {
  const parsed = bookingCreateBodySchema.parse({
    leadId: STAFF_ID,
    bookingType: "consultation",
    startAt: "2026-06-10T09:00:00.000Z",
    endAt: "2026-06-10T10:00:00.000Z",
    assignedStaffId: STAFF_ID,
  });
  assert.equal(parsed.assignedStaffId, STAFF_ID);
  assert.equal(parsed.assignedUserId, undefined);
});

test("blocked staff cannot be selected in readiness picker", () => {
  const opt = enrichCrmShellStaffPickerOption({
    id: STAFF_ID,
    email: "blocked@example.com",
    full_name: "Blocked",
    staff_role: NEEDS_REVIEW_STAFF_ROLE,
    is_active: true,
    working_hours: {},
  });
  assert.equal(canSelectStaffForClinicalPicker(opt), false);
  assert.match(formatClinicalPickerOptionLabel(opt), /Needs role|needs review/i);
});

test("booking display prefers staff provider over legacy user id", () => {
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
  const users = [{ id: USER_ID, email: "dr@example.com", full_name: "Dr Smith" }];
  const display = bookingAssignmentDisplay(
    staff,
    users,
    bookingRow({ assigned_staff_id: STAFF_ID, assigned_user_id: USER_ID })
  );
  assert.equal(display.providerLabel, "Dr Smith");
  assert.equal(display.ownerLabel, null);
  assert.equal(display.summaryLine, "Provider: Dr Smith");
});

test("legacy user-only booking falls back to user label", () => {
  const users = [{ id: USER_ID, email: "legacy@example.com", full_name: null }];
  const display = bookingAssignmentDisplay([], users, bookingRow({ assigned_user_id: USER_ID }));
  assert.equal(display.providerLabel, "legacy@example.com");
  assert.match(display.summaryLine, /legacy@example.com/);
});

test("provider and divergent owner both shown", () => {
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
    { id: OWNER_ID, email: "admin@example.com", full_name: "Admin User" },
  ];
  const display = bookingAssignmentDisplay(
    staff,
    users,
    bookingRow({ assigned_staff_id: STAFF_ID, assigned_user_id: OWNER_ID })
  );
  assert.equal(display.providerLabel, "Dr Smith");
  assert.equal(display.ownerLabel, "Admin User");
  assert.match(display.summaryLine, /Provider: Dr Smith/);
  assert.match(display.summaryLine, /Owner: Admin User/);
});

test("operator filter parses staffId not legacy assignedUserId", () => {
  const q = parseOperatorBookingSearchParams(
    { staffId: STAFF_ID, assignedUserId: USER_ID },
    new Date("2026-01-01T00:00:00.000Z")
  );
  assert.equal(q.assignedStaffId, STAFF_ID);
});

test("filter labels use staff names not fi_user emails", () => {
  const opt = enrichCrmShellStaffPickerOption({
    id: STAFF_ID,
    email: "hidden@example.com",
    full_name: "Visible Name",
    staff_role: "consultant",
    is_active: true,
    working_hours: { weekly: { mon: { enabled: true, start: "09:00", end: "17:00" } } },
  });
  const label = formatClinicalPickerOptionLabel(opt);
  assert.match(label, /Visible Name/);
  assert.doesNotMatch(label, /hidden@example.com/);
});
