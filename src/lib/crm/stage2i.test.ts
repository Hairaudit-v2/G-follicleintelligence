import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crmUpdateTaskBodySchema } from "./crmApiSchemas";
import { groupCrmTasksByBuckets } from "./crmTaskBuckets";
import {
  assertCompleteReopenBodyHasNoExtraKeys,
  assertCrmTaskStatusAllowedForWrite,
  assertCrmTaskTypeAllowed,
  CRM_TASK_STATUS_DONE,
  isCrmTaskActiveStatus,
} from "./crmTaskPolicy";
import {
  collectChangedTaskDetailKeys,
  taskDetailSnapshotFromRowLike,
  type TaskDetailComparableSnapshot,
} from "./crmTaskChangedFields";
import { isTaskOwnedByLeadTenant } from "./crmTaskOwnership";
import type { FiCrmTaskRow } from "./types";

const TID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function taskRow(p: Partial<FiCrmTaskRow> & Pick<FiCrmTaskRow, "id" | "title">): FiCrmTaskRow {
  return {
    tenant_id: TID,
    lead_id: LID,
    patient_id: null,
    case_id: null,
    consultation_id: null,
    description: null,
    task_type: "follow_up",
    status: "open",
    due_at: null,
    completed_at: null,
    assignee_user_id: null,
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...p,
  };
}

describe("Stage 2I — task status policy (pure)", () => {
  it("accepts active statuses", () => {
    assertCrmTaskStatusAllowedForWrite("open");
    assertCrmTaskStatusAllowedForWrite("in_progress");
    assertCrmTaskStatusAllowedForWrite("blocked");
  });

  it("rejects done status for normal writes", () => {
    assert.throws(() => assertCrmTaskStatusAllowedForWrite("done"), /Invalid task status/);
  });

  it("isCrmTaskActiveStatus matches policy", () => {
    assert.equal(isCrmTaskActiveStatus("open"), true);
    assert.equal(isCrmTaskActiveStatus(CRM_TASK_STATUS_DONE), false);
  });

  it("assertCrmTaskTypeAllowed rejects unknown types", () => {
    assert.throws(() => assertCrmTaskTypeAllowed("hubspot_sync"), /Invalid task type/);
  });
});

describe("Stage 2I — due / bucket grouping (pure)", () => {
  const now = new Date("2026-06-05T12:00:00.000Z");

  it("places completed rows in completed regardless of due_at", () => {
    const rows = [
      taskRow({
        id: "1",
        title: "A",
        due_at: "2026-01-01T00:00:00.000Z",
        completed_at: "2026-06-04T10:00:00.000Z",
      }),
    ];
    const g = groupCrmTasksByBuckets(rows, now);
    assert.equal(g.completed.length, 1);
    assert.equal(g.overdue.length, 0);
  });

  it("buckets open tasks by UTC calendar day", () => {
    const rows = [
      taskRow({ id: "o", title: "over", due_at: "2026-06-04T23:59:59.000Z", completed_at: null }),
      taskRow({ id: "t", title: "today", due_at: "2026-06-05T08:00:00.000Z", completed_at: null }),
      taskRow({ id: "u", title: "up", due_at: "2026-06-06T00:00:00.000Z", completed_at: null }),
      taskRow({ id: "n", title: "nodue", due_at: null, completed_at: null }),
    ];
    const g = groupCrmTasksByBuckets(rows, now);
    assert.deepEqual(
      g.overdue.map((x) => x.id),
      ["o"]
    );
    assert.deepEqual(
      g.due_today.map((x) => x.id),
      ["t"]
    );
    assert.deepEqual(
      g.upcoming.map((x) => x.id),
      ["u"]
    );
    assert.deepEqual(
      g.no_due.map((x) => x.id),
      ["n"]
    );
  });
});

describe("Stage 2I — changed field metadata (pure)", () => {
  it("collectChangedTaskDetailKeys lists only changed fields", () => {
    const before = taskDetailSnapshotFromRowLike(
      taskRow({
        id: "x",
        title: "A",
        description: "d",
        task_type: "call",
        status: "open",
        due_at: null,
        assignee_user_id: null,
      })
    );
    const after: TaskDetailComparableSnapshot = { ...before, title: "B" };
    assert.deepEqual(collectChangedTaskDetailKeys(before, after), ["title"]);
  });

  it("treats trimmed description equivalence", () => {
    const before = taskDetailSnapshotFromRowLike(
      taskRow({
        id: "x",
        title: "T",
        description: "  ",
        task_type: "email",
        status: "open",
        due_at: null,
        assignee_user_id: null,
      })
    );
    const after = taskDetailSnapshotFromRowLike(
      taskRow({
        id: "x",
        title: "T",
        description: null,
        task_type: "email",
        status: "open",
        due_at: null,
        assignee_user_id: null,
      })
    );
    assert.deepEqual(collectChangedTaskDetailKeys(before, after), []);
  });
});

describe("Stage 2I — complete/reopen payload rules (pure)", () => {
  it("allows adminKey only", () => {
    assertCompleteReopenBodyHasNoExtraKeys({ adminKey: "x" });
    assertCompleteReopenBodyHasNoExtraKeys({});
  });

  it("rejects stray keys", () => {
    assert.throws(
      () => assertCompleteReopenBodyHasNoExtraKeys({ status: "done" }),
      /Unexpected field/
    );
  });
});

describe("Stage 2I — task–lead ownership helper (pure)", () => {
  it("matches tenant and lead", () => {
    assert.equal(isTaskOwnedByLeadTenant({ tenant_id: TID, lead_id: LID }, TID, LID), true);
    assert.equal(
      isTaskOwnedByLeadTenant({ tenant_id: TID, lead_id: LID }, TID, "other-lead"),
      false
    );
    assert.equal(
      isTaskOwnedByLeadTenant({ tenant_id: TID, lead_id: LID }, "other-tenant", LID),
      false
    );
  });
});

describe("Stage 2I — update task Zod schema", () => {
  it("requires at least one patch field", () => {
    assert.throws(() => crmUpdateTaskBodySchema.parse({}), /at least one field/);
  });

  it("accepts partial update", () => {
    const v = crmUpdateTaskBodySchema.parse({ title: "Hello" });
    assert.equal(v.title, "Hello");
  });

  it("rejects invalid due_at string", () => {
    assert.throws(() => crmUpdateTaskBodySchema.parse({ dueAt: "not-a-date" }), /Invalid due_at/);
  });
});
