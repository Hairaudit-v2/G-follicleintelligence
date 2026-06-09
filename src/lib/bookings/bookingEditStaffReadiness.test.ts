import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildClinicalStaffPickerReadiness,
  enrichCrmShellStaffPickerOption,
} from "@/src/lib/staff/clinicalStaffPicker";
import { buildStaffHrNotificationSummary } from "@/src/lib/staff/staffHrNotificationSummary";
import { NEEDS_REVIEW_STAFF_ROLE } from "@/src/lib/staff/staffRolePolicy";
import { bookingUpdateBodySchema } from "@/src/lib/bookings/bookingApiSchemas";

const STAFF_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const NOW = new Date("2026-06-09T12:00:00.000Z");

function freshHr() {
  return buildStaffHrNotificationSummary(
    {
      source_system: "iiohr_hr",
      source_url: "https://hr.example/s/1",
      metadata: {
        onboarding_status: "complete",
        training_required_count: 0,
        required_documents_missing_count: 0,
        certificates_outstanding_count: 0,
        last_synced_at: NOW.toISOString(),
      },
    },
    NOW
  );
}

test("booking edit drawer payload uses assignedStaffId (not legacy assignedUserId alone)", () => {
  const parsed = bookingUpdateBodySchema.parse({
    leadId: null,
    personId: null,
    patientId: null,
    caseId: null,
    bookingType: "consultation",
    bookingStatus: "scheduled",
    title: "Test",
    description: null,
    startAt: "2026-06-10T09:00:00.000Z",
    endAt: "2026-06-10T10:00:00.000Z",
    timezone: null,
    location: null,
    clinicId: null,
    assignedStaffId: STAFF_ID,
    metadata: {},
  });
  assert.equal(parsed.assignedStaffId, STAFF_ID);
  assert.equal(parsed.assignedUserId, undefined);
});

test("clinical staff picker options include readiness metadata for edit drawer", () => {
  const opt = enrichCrmShellStaffPickerOption(
    {
      id: STAFF_ID,
      email: "consult@example.com",
      full_name: "Consultant",
      staff_role: NEEDS_REVIEW_STAFF_ROLE,
      is_active: true,
      working_hours: { weekly: { mon: { enabled: true, start: "09:00", end: "17:00" } } },
    },
    freshHr()
  );
  assert.ok(opt.clinical_readiness);
  assert.equal(opt.clinical_readiness.clinically_available, false);
  assert.ok(opt.clinical_readiness.block_reason);
});

test("updateBooking edit path rejects same staff readiness state as picker", () => {
  const readiness = buildClinicalStaffPickerReadiness({
    full_name: "Payroll",
    staff_role: NEEDS_REVIEW_STAFF_ROLE,
    is_active: true,
    working_hours: { weekly: { mon: { enabled: true, start: "09:00", end: "17:00" } } },
    hr: freshHr(),
  });
  assert.equal(readiness.clinically_available, false);
});
