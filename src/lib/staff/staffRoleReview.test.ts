import assert from "node:assert/strict";
import { test } from "node:test";

import { buildStaffPayrollSourceDisplay } from "./staffPayrollSourceDisplay";
import {
  applyBulkNonClinicalAdminRole,
  applyBulkPrimaryClinic,
  buildStaffRoleReviewEditableRow,
  computeStaffRoleReviewProgress,
  filterActiveNeedsReviewStaff,
  isPayrollMetadataReadOnly,
  validateStaffRoleReviewSave,
  validateStaffRoleReviewSaveAll,
} from "./staffRoleReviewApply";
import type { FiStaffRow } from "./staff.server";

function staff(p: Partial<FiStaffRow> & Pick<FiStaffRow, "id" | "full_name">): FiStaffRow {
  return {
    tenant_id: "t1",
    fi_user_id: null,
    staff_role: "needs_review",
    position_type_id: null,
    email: "a@example.com",
    mobile: null,
    default_timezone: null,
    working_hours: {},
    staff_metadata: {},
    is_active: true,
    calendar_color: null,
    created_at: "",
    updated_at: "",
    ...p,
  };
}

test("only active needs_review staff appear in role review filter", () => {
  const rows = filterActiveNeedsReviewStaff([
    staff({ id: "1", full_name: "Active", staff_role: "needs_review", is_active: true }),
    staff({ id: "2", full_name: "Inactive", staff_role: "needs_review", is_active: false }),
    staff({ id: "3", full_name: "Done", staff_role: "nurse", is_active: true }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.id, "1");
});

test("saving role requires non-needs_review value", () => {
  assert.ok(validateStaffRoleReviewSave({ staff_role: "needs_review" }));
  assert.equal(validateStaffRoleReviewSave({ staff_role: "nurse" }), null);
});

test("bulk clinic assignment updates selected rows only", () => {
  const rows = [
    buildStaffRoleReviewEditableRow(staff({ id: "1", full_name: "A" }), null, {
      position_title: null,
      primary_clinic_id: null,
    }),
    buildStaffRoleReviewEditableRow(staff({ id: "2", full_name: "B" }), null, {
      position_title: null,
      primary_clinic_id: null,
    }),
  ];
  const next = applyBulkPrimaryClinic(rows, new Set(["1"]), "clinic-perth");
  assert.equal(next[0]?.primary_clinic_id, "clinic-perth");
  assert.equal(next[1]?.primary_clinic_id, null);
});

test("cannot save all while any row still needs_review", () => {
  const rows = [
    buildStaffRoleReviewEditableRow(staff({ id: "1", full_name: "A", staff_role: "nurse" }), null, {
      position_title: null,
      primary_clinic_id: null,
    }),
    buildStaffRoleReviewEditableRow(staff({ id: "2", full_name: "B" }), null, {
      position_title: null,
      primary_clinic_id: null,
    }),
  ];
  assert.ok(validateStaffRoleReviewSaveAll(rows));
  rows[1]!.staff_role = "technician";
  assert.equal(validateStaffRoleReviewSaveAll(rows), null);
});

test("progress tracks assigned roles", () => {
  const rows = [
    buildStaffRoleReviewEditableRow(staff({ id: "1", full_name: "A", staff_role: "nurse" }), null, {
      position_title: null,
      primary_clinic_id: null,
    }),
    buildStaffRoleReviewEditableRow(staff({ id: "2", full_name: "B" }), null, {
      position_title: null,
      primary_clinic_id: null,
    }),
  ];
  const p = computeStaffRoleReviewProgress(rows);
  assert.equal(p.assigned, 1);
  assert.equal(p.total, 2);
  assert.equal(p.isComplete, false);
});

test("bulk admin clears needs_review on selected rows locally", () => {
  const rows = [
    buildStaffRoleReviewEditableRow(staff({ id: "1", full_name: "A" }), null, {
      position_title: null,
      primary_clinic_id: null,
    }),
  ];
  const next = applyBulkNonClinicalAdminRole(rows, new Set(["1"]));
  assert.equal(next[0]?.staff_role, "admin");
  assert.equal(validateStaffRoleReviewSave({ staff_role: next[0]!.staff_role }), null);
});

test("payroll metadata remains read-only and excludes sensitive fields", () => {
  assert.equal(isPayrollMetadataReadOnly(), true);
  const d = buildStaffPayrollSourceDisplay({
    source_system: "evolved_payroll",
    source_staff_id: "1",
    metadata: {
      employment_type: "Full Time",
      start_date: "2022-01-01",
      hours_per_week: 38,
      TaxFileNumber: "secret",
      Rate: 100000,
    },
  });
  assert.ok(d);
  assert.equal(d!.employment_type, "Full Time");
  assert.equal((d as Record<string, unknown>).TaxFileNumber, undefined);
});
