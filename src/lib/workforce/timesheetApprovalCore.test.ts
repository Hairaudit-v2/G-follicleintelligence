import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countTimesheetEntriesByStatus,
  isTimesheetLocked,
  resolveTimesheetTransition,
} from "./timesheetApprovalCore";

describe("timesheetApprovalCore", () => {
  it("submit moves draft to submitted only", () => {
    assert.equal(resolveTimesheetTransition("draft", "submit"), "submitted");
    assert.equal(resolveTimesheetTransition("submitted", "submit"), null);
    assert.equal(resolveTimesheetTransition("approved", "submit"), null);
  });

  it("approve moves submitted or draft to approved", () => {
    assert.equal(resolveTimesheetTransition("submitted", "approve"), "approved");
    assert.equal(resolveTimesheetTransition("draft", "approve"), "approved");
    assert.equal(resolveTimesheetTransition("approved", "approve"), null);
  });

  it("void only from draft or submitted", () => {
    assert.equal(resolveTimesheetTransition("draft", "void"), "void");
    assert.equal(resolveTimesheetTransition("submitted", "void"), "void");
    assert.equal(resolveTimesheetTransition("approved", "void"), null);
  });

  it("revert_to_draft only from submitted", () => {
    assert.equal(resolveTimesheetTransition("submitted", "revert_to_draft"), "draft");
    assert.equal(resolveTimesheetTransition("draft", "revert_to_draft"), null);
  });

  it("isTimesheetLocked for approved and void", () => {
    assert.equal(isTimesheetLocked("approved"), true);
    assert.equal(isTimesheetLocked("void"), true);
    assert.equal(isTimesheetLocked("draft"), false);
  });

  it("countTimesheetEntriesByStatus aggregates counts", () => {
    const counts = countTimesheetEntriesByStatus([
      { status: "draft" },
      { status: "draft" },
      { status: "submitted" },
      { status: "approved" },
    ]);
    assert.equal(counts.draft, 2);
    assert.equal(counts.submitted, 1);
    assert.equal(counts.approved, 1);
    assert.equal(counts.void, 0);
  });
});