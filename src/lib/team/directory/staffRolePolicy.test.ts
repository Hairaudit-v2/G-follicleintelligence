import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertStaffBookableForClinicalWorkflow,
  isStaffBookableForClinicalWorkflow,
  isStaffRoleNeedsReview,
  NEEDS_REVIEW_STAFF_ROLE,
} from "@/src/lib/team/directory/staffRolePolicy";

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
