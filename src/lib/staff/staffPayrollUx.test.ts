import assert from "node:assert/strict";
import { test } from "node:test";

import {
  enrichStaffDirectoryRows,
  filterStaffDirectoryRows,
  parseStaffDirectoryFiltersFromSearchParams,
} from "./staffDirectoryFilters";
import { buildStaffPayrollSourceDisplay } from "./staffPayrollSourceDisplay";
import {
  assertStaffBookableForClinicalWorkflow,
  isStaffBookableForClinicalWorkflow,
  isStaffRoleNeedsReview,
  NEEDS_REVIEW_STAFF_ROLE,
} from "./staffRolePolicy";
import type { FiStaffRow } from "./staff.server";

function staff(p: Partial<FiStaffRow> & Pick<FiStaffRow, "id" | "full_name">): FiStaffRow {
  return {
    tenant_id: "t1",
    fi_user_id: null,
    staff_role: "consultant",
    email: null,
    mobile: null,
    default_timezone: null,
    working_hours: {},
    is_active: true,
    calendar_color: null,
    created_at: "",
    updated_at: "",
    ...p,
  };
}

test("isStaffRoleNeedsReview detects payroll default role", () => {
  assert.equal(isStaffRoleNeedsReview(NEEDS_REVIEW_STAFF_ROLE), true);
  assert.equal(isStaffRoleNeedsReview("consultant"), false);
});

test("needs_review staff are not bookable for clinical workflows", () => {
  assert.equal(
    isStaffBookableForClinicalWorkflow({ is_active: true, staff_role: NEEDS_REVIEW_STAFF_ROLE }),
    false
  );
  assert.throws(() =>
    assertStaffBookableForClinicalWorkflow({
      full_name: "Payroll Hire",
      is_active: true,
      staff_role: NEEDS_REVIEW_STAFF_ROLE,
    })
  );
});

test("staff directory filters parse URL params", () => {
  const f = parseStaffDirectoryFiltersFromSearchParams({
    staff_role: "needs_review",
    payroll: "1",
    active: "0",
  });
  assert.equal(f.staffRole, NEEDS_REVIEW_STAFF_ROLE);
  assert.equal(f.payrollOnly, true);
  assert.equal(f.activeFilter, "inactive");
});

test("filterStaffDirectoryRows supports payroll and needs_review filters", () => {
  const rows = enrichStaffDirectoryRows(
    [
      staff({ id: "1", full_name: "A", staff_role: NEEDS_REVIEW_STAFF_ROLE }),
      staff({ id: "2", full_name: "B", staff_role: "nurse" }),
    ],
    {
      "1": buildStaffPayrollSourceDisplay({
        source_system: "evolved_payroll",
        source_staff_id: "99",
        metadata: { source: "payroll_export", start_date: "2022-01-01" },
      }),
      "2": null,
    }
  );
  const needsReview = filterStaffDirectoryRows(rows, {
    staffRole: NEEDS_REVIEW_STAFF_ROLE,
    payrollOnly: false,
    activeFilter: "all",
  });
  assert.equal(needsReview.length, 1);
  assert.equal(needsReview[0]?.id, "1");

  const payrollOnly = filterStaffDirectoryRows(rows, {
    staffRole: null,
    payrollOnly: true,
    activeFilter: "all",
  });
  assert.equal(payrollOnly.length, 1);
});

test("payroll display excludes sensitive metadata keys", () => {
  const d = buildStaffPayrollSourceDisplay({
    source_system: "evolved_payroll",
    source_staff_id: "4491810",
    metadata: {
      source: "payroll_export",
      employment_type: "Full Time",
      start_date: "2022-02-02",
      hours_per_week: 38,
      payroll_last_imported_at: "2026-06-09T10:00:00.000Z",
      TaxFileNumber: "secret",
      Rate: 99999,
    },
  });
  assert.ok(d);
  assert.equal(d!.employee_id, "4491810");
  assert.equal(d!.employment_type, "Full Time");
  assert.equal((d as Record<string, unknown>).TaxFileNumber, undefined);
  assert.equal((d as Record<string, unknown>).Rate, undefined);
});
