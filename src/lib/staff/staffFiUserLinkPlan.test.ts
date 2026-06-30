import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildEmailToFiUserMap,
  listUnlinkedStaffWithEmail,
  normalizeStaffLinkEmail,
  planStaffFiUserLinks,
} from "@/src/lib/staff/staffFiUserLinkPlan";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STAFF_1 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const STAFF_2 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const USER_1 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

test("normalizeStaffLinkEmail lowercases and trims", () => {
  assert.equal(normalizeStaffLinkEmail("  Alex@Example.COM "), "alex@example.com");
  assert.equal(normalizeStaffLinkEmail(""), null);
});

test("planStaffFiUserLinks matches existing fi_users by email", () => {
  const plan = planStaffFiUserLinks({
    tenantId: TENANT_A,
    staff: [{ staffId: STAFF_1, fullName: "Alex", email: "alex@example.com", fiUserId: null }],
    users: [{ id: USER_1, email: "Alex@Example.com", tenantId: TENANT_A }],
    selectedStaffIds: [STAFF_1],
  });
  assert.equal(plan.rows[0]?.action, "link_existing_user");
  assert.equal(plan.rows[0]?.matchedUserId, USER_1);
});

test("planStaffFiUserLinks plans create when no fi_user exists", () => {
  const plan = planStaffFiUserLinks({
    tenantId: TENANT_A,
    staff: [{ staffId: STAFF_1, fullName: "Alex", email: "new@example.com", fiUserId: null }],
    users: [],
    selectedStaffIds: [STAFF_1],
  });
  assert.equal(plan.rows[0]?.action, "create_user_and_link");
});

test("planStaffFiUserLinks ignores users from other tenants", () => {
  const emailMap = buildEmailToFiUserMap([
    { id: USER_1, email: "alex@example.com", tenantId: TENANT_B },
  ]);
  const plan = planStaffFiUserLinks({
    tenantId: TENANT_A,
    staff: [{ staffId: STAFF_1, fullName: "Alex", email: "alex@example.com", fiUserId: null }],
    users: [{ id: USER_1, email: "alex@example.com", tenantId: TENANT_B }],
    selectedStaffIds: [STAFF_1],
  });
  assert.equal(emailMap.has("alex@example.com"), true);
  assert.equal(plan.rows[0]?.action, "create_user_and_link");
});

test("listUnlinkedStaffWithEmail skips linked staff and blank emails", () => {
  const rows = listUnlinkedStaffWithEmail([
    { staffId: STAFF_1, fullName: "A", email: "a@x.com", fiUserId: null },
    { staffId: STAFF_2, fullName: "B", email: "b@x.com", fiUserId: USER_1 },
    { staffId: "s3", fullName: "C", email: "  ", fiUserId: null },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.staffId, STAFF_1);
});

test("duplicate staff emails in plan share one create action (executor dedupes inserts)", () => {
  const plan = planStaffFiUserLinks({
    tenantId: TENANT_A,
    staff: [
      { staffId: STAFF_1, fullName: "A1", email: "shared@example.com", fiUserId: null },
      { staffId: STAFF_2, fullName: "A2", email: "shared@example.com", fiUserId: null },
    ],
    users: [],
    selectedStaffIds: [STAFF_1, STAFF_2],
  });
  assert.equal(plan.rows.length, 2);
  assert.equal(
    plan.rows.every((r) => r.action === "create_user_and_link"),
    true
  );
  assert.equal(plan.unlinkedAfter, 0);
});

test("bulk selection updates before/after counts", () => {
  const plan = planStaffFiUserLinks({
    tenantId: TENANT_A,
    staff: [
      { staffId: STAFF_1, fullName: "A", email: "a@x.com", fiUserId: null },
      { staffId: STAFF_2, fullName: "B", email: "b@x.com", fiUserId: null },
    ],
    users: [],
    selectedStaffIds: [STAFF_1],
  });
  assert.equal(plan.unlinkedBefore, 2);
  assert.equal(plan.selectedCount, 1);
  assert.equal(plan.unlinkedAfter, 1);
});
