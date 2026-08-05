import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildStaffHrTaskMap,
  findStaffHrTaskById,
  groupStaffHrTasksByCategory,
} from "@/src/lib/team/access/staffHrTaskMapCore";

const TENANT = "tenant-abc";
const STAFF = "staff-1";

describe("staff HR task map", () => {
  const tasks = buildStaffHrTaskMap(TENANT, STAFF);

  it("includes maternity leave task with correct route", () => {
    const task = findStaffHrTaskById(tasks, "set_maternity_leave");
    assert.ok(task);
    assert.equal(task.category, "leave_availability");
    assert.match(task.route.href, /workforce-os\/staff\/staff-1/);
    assert.match(task.route.href, /set_maternity_leave/);
    assert.equal(task.route.serverAction, "setStaffMaternityLeaveAction");
  });

  it("HR task map links point at canonical routes after A2 consolidation", () => {
    const maternity = findStaffHrTaskById(tasks, "set_maternity_leave");
    const standardHours = findStaffHrTaskById(tasks, "set_standard_hours");
    const identityAudit = findStaffHrTaskById(tasks, "view_identity_audit");
    const hrTaskMap = findStaffHrTaskById(tasks, "hr_task_map");

    assert.match(maternity?.route.href ?? "", /^\/fi-admin\/tenant-abc\//);
    assert.match(standardHours?.route.href ?? "", /standard-hours/);
    // Admin diagnostics moved into the /team/admin namespace.
    assert.match(identityAudit?.route.href ?? "", /\/team\/admin\/identity-audit/);
    assert.match(hrTaskMap?.route.href ?? "", /\/team\/admin\/access-task-map/);
  });

  it("groups tasks into expected categories", () => {
    const grouped = groupStaffHrTasksByCategory(tasks);
    const categoryIds = grouped.map((g) => g.category);
    assert.ok(categoryIds.includes("leave_availability"));
    assert.ok(categoryIds.includes("offboarding"));
    const leaveGroup = grouped.find((g) => g.category === "leave_availability");
    assert.ok(leaveGroup?.tasks.some((t) => t.id === "set_maternity_leave"));
  });

  it("maternity leave task documents what it does not change", () => {
    const task = findStaffHrTaskById(tasks, "set_maternity_leave");
    assert.ok(task?.doesNotChange.some((line) => /not archive/i.test(line)));
    assert.ok(task?.doesNotChange.some((line) => /historical shifts/i.test(line)));
  });
});
