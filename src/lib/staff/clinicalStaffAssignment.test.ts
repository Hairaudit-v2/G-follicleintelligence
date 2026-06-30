import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildClinicalStaffPickerReadiness,
  buildProcedureTeamPickerOption,
  canSelectStaffForClinicalPicker,
  canSelectStaffForProcedureSlot,
  clinicalAssignmentErrorMessage,
  enrichCrmShellStaffPickerOption,
  isSupportStaffRole,
  staffAllowedInProcedureSlot,
} from "./clinicalStaffPicker";
import {
  buildStaffHrNotificationSummary,
  STAFF_HR_SYNC_STALE_DAYS,
} from "@/src/lib/staff/staffHrNotificationSummary";
import { NEEDS_REVIEW_STAFF_ROLE } from "@/src/lib/staff/staffRolePolicy";

const NOW = new Date("2026-06-09T12:00:00.000Z");

function freshHr(overrides: Record<string, unknown> = {}) {
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
        ...overrides,
      },
    },
    NOW
  );
}

const hours = { weekly: { mon: { enabled: true, start: "09:00", end: "17:00" } } };

test("inactive staff cannot be selected for clinical pickers", () => {
  const opt = enrichCrmShellStaffPickerOption(
    {
      id: "s1",
      email: "a@x.com",
      full_name: "Alex",
      staff_role: "consultant",
      is_active: false,
      working_hours: hours,
    },
    freshHr()
  );
  assert.equal(canSelectStaffForClinicalPicker(opt), false);
  assert.match(opt.clinical_readiness.block_reason ?? "", /inactive/i);
});

test("needs_review cannot be assigned to clinical pickers", () => {
  const readiness = buildClinicalStaffPickerReadiness({
    full_name: "Payroll",
    staff_role: NEEDS_REVIEW_STAFF_ROLE,
    is_active: true,
    working_hours: hours,
    hr: freshHr(),
  });
  assert.equal(readiness.clinically_available, false);
  assert.equal(staffAllowedInProcedureSlot(NEEDS_REVIEW_STAFF_ROLE, "clinical"), false);
  assert.equal(staffAllowedInProcedureSlot(NEEDS_REVIEW_STAFF_ROLE, "support"), false);
});

test("missing working hours blocks calendar clinical assignment", () => {
  const readiness = buildClinicalStaffPickerReadiness({
    full_name: "Alex",
    staff_role: "consultant",
    is_active: true,
    working_hours: {},
    hr: freshHr(),
  });
  assert.equal(readiness.clinically_available, false);
  assert.match(readiness.block_reason ?? "", /working hours/i);
});

test("training incomplete blocks clinical provider roles", () => {
  const nurse = buildClinicalStaffPickerReadiness({
    full_name: "Nurse",
    staff_role: "nurse",
    is_active: true,
    working_hours: hours,
    hr: freshHr({ training_required_count: 2 }),
  });
  assert.equal(nurse.clinically_available, false);

  const admin = buildClinicalStaffPickerReadiness({
    full_name: "Admin",
    staff_role: "admin",
    is_active: true,
    working_hours: hours,
    hr: freshHr({ training_required_count: 2 }),
  });
  assert.equal(admin.clinically_available, true);
});

test("non-clinical admin can be assigned only to support procedure slots", () => {
  const opt = buildProcedureTeamPickerOption({
    staff: {
      id: "s1",
      fi_user_id: "u1",
      full_name: "Ops Admin",
      staff_role: "admin",
      is_active: true,
      working_hours: hours,
    },
    hr: freshHr(),
  });
  assert.ok(opt);
  assert.equal(canSelectStaffForProcedureSlot(opt!, "support"), true);
  assert.equal(canSelectStaffForProcedureSlot(opt!, "clinical"), false);
  assert.equal(isSupportStaffRole("admin"), true);
  assert.equal(staffAllowedInProcedureSlot("admin", "clinical"), false);
});

test("clinical assignment error message format for server mutations", () => {
  const msg = clinicalAssignmentErrorMessage("HR sync stale");
  assert.equal(msg, "This staff member is not clinically available yet: HR sync stale.");
});

test("stale HR sync blocks clinical availability", () => {
  const staleAt = new Date(
    NOW.getTime() - (STAFF_HR_SYNC_STALE_DAYS + 1) * 86_400_000
  ).toISOString();
  const readiness = buildClinicalStaffPickerReadiness({
    full_name: "Alex",
    staff_role: "surgeon",
    is_active: true,
    working_hours: hours,
    hr: freshHr({ last_synced_at: staleAt }),
  });
  assert.equal(readiness.clinically_available, false);
  assert.match(readiness.block_reason ?? "", /stale/i);
});
