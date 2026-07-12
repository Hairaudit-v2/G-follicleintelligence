/**
 * CRM lead assignee eligibility — pure tests.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CRM_ASSIGNEE_INELIGIBLE_USER_MESSAGE,
  filterCrmAssignableOwnerOptions,
  isCrmAssigneeEligible,
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
      { id: "active-u", email: "a@x.com" },
      { id: "term-u", email: "t@x.com" },
      { id: "inact-u", email: "i@x.com" },
      { id: "op-u", email: "o@x.com", role: "fi_admin" },
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
