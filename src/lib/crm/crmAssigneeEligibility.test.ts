/**
 * CRM lead assignee eligibility — pure tests.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CRM_ASSIGNEE_INELIGIBLE_USER_MESSAGE,
  filterCrmAssignableOwnerOptions,
  isCrmAssigneeEligible,
  isCrmAssigneeSyntheticEmail,
  resolveCrmAssigneeEligibility,
} from "@/src/lib/crm/crmAssigneeEligibility";

test("1. active staff appears", () => {
  assert.equal(
    isCrmAssigneeEligible({
      fiUserId: "u1",
      staff: { isActive: true, employmentStatus: "active" },
    }),
    true
  );
});

test("2. inactive staff is excluded", () => {
  const r = resolveCrmAssigneeEligibility({
    fiUserId: "u1",
    staff: { isActive: false, employmentStatus: "active" },
  });
  assert.equal(r.eligible, false);
  assert.equal(r.reasonCode, "inactive_staff");
});

test("3. terminated staff is excluded", () => {
  assert.equal(
    isCrmAssigneeEligible({
      fiUserId: "u1",
      staff: { isActive: true, employmentStatus: "terminated" },
    }),
    false
  );
});

test("4. archived staff is excluded", () => {
  const r = resolveCrmAssigneeEligibility({
    fiUserId: "u1",
    staff: {
      isActive: true,
      employmentStatus: "active",
      archivedAt: "2026-01-01T00:00:00.000Z",
    },
  });
  assert.equal(r.eligible, false);
  assert.equal(r.reasonCode, "archived");
});

test("5. suspended staff is excluded", () => {
  assert.equal(
    isCrmAssigneeEligible({
      fiUserId: "u1",
      staff: { isActive: true, employmentStatus: "suspended" },
    }),
    false
  );
});

test("6. offboarded / resigned / contract_ended excluded", () => {
  for (const status of ["offboarded", "resigned", "contract_ended", "contract_expired"]) {
    assert.equal(
      isCrmAssigneeEligible({
        fiUserId: "u1",
        staff: { isActive: true, employmentStatus: status },
      }),
      false,
      status
    );
  }
});

test("7. on_leave staff remains assignable (assignment ≠ roster)", () => {
  assert.equal(
    isCrmAssigneeEligible({
      fiUserId: "u1",
      staff: { isActive: true, employmentStatus: "on_leave" },
    }),
    true
  );
});

test("8. CRM operator without staff row is assignable", () => {
  assert.equal(
    isCrmAssigneeEligible({
      fiUserId: "u1",
      role: "crm_operator",
      staff: null,
    }),
    true
  );
});

test("9. member without staff row is not assignable", () => {
  assert.equal(
    isCrmAssigneeEligible({
      fiUserId: "u1",
      role: "member",
      staff: null,
    }),
    false
  );
});

test("10. filterCrmAssignableOwnerOptions drops ineligible", () => {
  const staff = new Map([
    ["active-u", { isActive: true, employmentStatus: "active" as const }],
    ["term-u", { isActive: true, employmentStatus: "terminated" as const }],
    ["inact-u", { isActive: false, employmentStatus: "active" as const }],
  ]);
  const out = filterCrmAssignableOwnerOptions(
    [
      { id: "active-u", email: "a@clinic.com" },
      { id: "term-u", email: "t@clinic.com" },
      { id: "inact-u", email: "i@clinic.com" },
      { id: "op-u", email: "o@clinic.com", role: "fi_admin" },
      { id: "smoke-u", email: "smoketest@clinic.com", role: "fi_admin" },
    ],
    staff
  );
  assert.deepEqual(
    out.map((o) => o.id).sort(),
    ["active-u", "op-u"]
  );
});

test("11. empty id is not eligible", () => {
  assert.equal(isCrmAssigneeEligible({ fiUserId: "  " }), false);
});

test("12. user-facing message is non-technical", () => {
  assert.match(CRM_ASSIGNEE_INELIGIBLE_USER_MESSAGE, /no longer available/i);
  assert.doesNotMatch(CRM_ASSIGNEE_INELIGIBLE_USER_MESSAGE, /fi_staff|uuid|sql/i);
});

test("13. smoketest email is never assignable even as fi_admin", () => {
  assert.equal(isCrmAssigneeSyntheticEmail("smoketest+owner@clinic.com"), true);
  assert.equal(
    isCrmAssigneeEligible({
      fiUserId: "u-smoke",
      role: "fi_admin",
      email: "smoketest@clinic.com",
      staff: null,
    }),
    false
  );
});

test("14. admin with only inactive staff is excluded (not rescued by role)", () => {
  const r = resolveCrmAssigneeEligibility({
    fiUserId: "u-admin",
    role: "admin",
    email: "admin@clinic.com",
    staffRows: [{ isActive: false, employmentStatus: "terminated" }],
  });
  assert.equal(r.eligible, false);
});

test("15. multi-staff: one active row is enough", () => {
  assert.equal(
    isCrmAssigneeEligible({
      fiUserId: "u-multi",
      email: "multi@clinic.com",
      staffRows: [
        { isActive: false, employmentStatus: "terminated" },
        { isActive: true, employmentStatus: "active" },
      ],
    }),
    true
  );
});

test("16. multi-staff: all inactive excludes", () => {
  assert.equal(
    isCrmAssigneeEligible({
      fiUserId: "u-multi2",
      role: "fi_admin",
      email: "multi2@clinic.com",
      staffRows: [
        { isActive: false, employmentStatus: "inactive" },
        { isActive: true, employmentStatus: "terminated" },
      ],
    }),
    false
  );
});
