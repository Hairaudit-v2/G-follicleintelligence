import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildStaffReadinessCsvExport,
  buildStaffReadinessOverview,
  buildStaffReadinessTableRow,
  deriveStaffReadinessState,
  filterStaffReadinessRows,
  isStaffClinicallyAvailable,
  staffReadinessCsvIsSafe,
} from "./hrStaffReadinessDashboard";
import {
  buildStaffHrNotificationNoLinkSummary,
  buildStaffHrNotificationSummary,
  STAFF_HR_SYNC_STALE_DAYS,
} from "@/src/lib/staff/staffHrNotificationSummary";
import { NEEDS_REVIEW_STAFF_ROLE } from "@/src/lib/staff/staffRolePolicy";

const NOW = new Date("2026-06-09T12:00:00.000Z");

function staffBase(p: Partial<{
  id: string;
  full_name: string;
  staff_role: string;
  working_hours: Record<string, unknown>;
  is_active: boolean;
}> = {}) {
  return {
    id: "s1",
    full_name: "Alex Clinician",
    staff_role: "consultant",
    working_hours: {
      weekly: { mon: { enabled: true, start: "09:00", end: "17:00" } },
    },
    is_active: true,
    ...p,
  };
}

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

test("deriveStaffReadinessState returns ready for fully configured active staff", () => {
  const state = deriveStaffReadinessState({
    is_active: true,
    staff_role: "consultant",
    working_hours: staffBase().working_hours,
    hr: freshHr(),
  });
  assert.equal(state, "ready");
});

test("needs_review blocks clinical availability", () => {
  const available = isStaffClinicallyAvailable({
    is_active: true,
    staff_role: NEEDS_REVIEW_STAFF_ROLE,
    working_hours: staffBase().working_hours,
    hr: freshHr(),
  });
  assert.equal(available, false);

  const row = buildStaffReadinessTableRow({
    staff: staffBase({ staff_role: NEEDS_REVIEW_STAFF_ROLE }),
    hr: freshHr(),
    payroll: null,
    clinicNameById: {},
  });
  assert.equal(row.clinicalAvailabilityStatus, "unavailable");
  assert.equal(row.readinessState, "needs_role");
});

test("stale HR sync affects readiness state and clinical availability", () => {
  const staleAt = new Date(NOW.getTime() - (STAFF_HR_SYNC_STALE_DAYS + 1) * 86_400_000).toISOString();
  const hr = freshHr({ last_synced_at: staleAt });

  assert.equal(
    deriveStaffReadinessState({
      is_active: true,
      staff_role: "nurse",
      working_hours: staffBase().working_hours,
      hr,
    }),
    "hr_sync_stale"
  );

  assert.equal(
    isStaffClinicallyAvailable({
      is_active: true,
      staff_role: "nurse",
      working_hours: staffBase().working_hours,
      hr,
    }),
    false
  );
});

test("clinical provider blocked by training policy but admin role is not", () => {
  const hrTraining = freshHr({ training_required_count: 2 });
  assert.equal(
    isStaffClinicallyAvailable({
      is_active: true,
      staff_role: "nurse",
      working_hours: staffBase().working_hours,
      hr: hrTraining,
    }),
    false
  );
  assert.equal(
    isStaffClinicallyAvailable({
      is_active: true,
      staff_role: "admin",
      working_hours: staffBase().working_hours,
      hr: hrTraining,
    }),
    true
  );
});

test("filters return correct staff subsets", () => {
  const rows = [
    buildStaffReadinessTableRow({
      staff: staffBase({ id: "a", full_name: "A", staff_role: NEEDS_REVIEW_STAFF_ROLE }),
      hr: buildStaffHrNotificationNoLinkSummary(),
      payroll: null,
      clinicNameById: {},
    }),
    buildStaffReadinessTableRow({
      staff: staffBase({ id: "b", full_name: "B", staff_role: "consultant" }),
      hr: freshHr(),
      payroll: {
        source_system: "evolved_payroll",
        employee_id: "99",
        payroll_source: "payroll_export",
        employment_type: null,
        start_date: null,
        hours_per_week: null,
        hours_per_day: null,
        clinic_display_name: null,
        primary_fi_clinic_id: null,
        payroll_last_imported_at: null,
      },
      clinicNameById: {},
    }),
    buildStaffReadinessTableRow({
      staff: staffBase({ id: "c", full_name: "C", is_active: false }),
      hr: freshHr(),
      payroll: null,
      clinicNameById: {},
    }),
  ];

  assert.equal(filterStaffReadinessRows(rows, "needs_role").length, 1);
  assert.equal(filterStaffReadinessRows(rows, "payroll_imported").length, 1);
  assert.equal(filterStaffReadinessRows(rows, "inactive").length, 1);
  assert.equal(filterStaffReadinessRows(rows, "ready").length, 1);
  assert.equal(filterStaffReadinessRows(rows, "no_hr_link").length, 1);
});

test("overview cards count active, inactive, and clinically available staff", () => {
  const rows = [
    buildStaffReadinessTableRow({
      staff: staffBase({ id: "1", staff_role: "consultant" }),
      hr: freshHr(),
      payroll: null,
      clinicNameById: {},
    }),
    buildStaffReadinessTableRow({
      staff: staffBase({ id: "2", staff_role: NEEDS_REVIEW_STAFF_ROLE }),
      hr: freshHr(),
      payroll: null,
      clinicNameById: {},
    }),
    buildStaffReadinessTableRow({
      staff: staffBase({ id: "3", is_active: false }),
      hr: freshHr(),
      payroll: null,
      clinicNameById: {},
    }),
  ];
  const overview = buildStaffReadinessOverview(rows);
  assert.equal(overview.totalActiveStaff, 2);
  assert.equal(overview.needsRoleAssignment, 1);
  assert.equal(overview.clinicallyAvailableStaff, 1);
  assert.equal(overview.inactiveStaff, 1);
});

test("CSV export excludes sensitive fields", () => {
  const row = buildStaffReadinessTableRow({
    staff: staffBase(),
    hr: freshHr({
      hr_profile_url: "https://hr.example/s/1",
      bank_details: "secret",
      tfn: "123",
    }),
    payroll: null,
    clinicNameById: {},
  });
  const csv = buildStaffReadinessCsvExport([row]);
  assert.ok(staffReadinessCsvIsSafe(csv));
  assert.ok(!csv.toLowerCase().includes("bank"));
  assert.ok(!csv.toLowerCase().includes("tfn"));
  assert.ok(!csv.toLowerCase().includes("hr_portal_url"));
  assert.ok(csv.includes("Alex Clinician"));
  assert.ok(csv.includes("Ready"));
});
