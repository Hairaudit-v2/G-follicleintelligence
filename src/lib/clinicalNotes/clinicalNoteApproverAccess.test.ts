import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isClinicalNoteApproverRole } from "./clinicalNoteApproverAccess.server";

describe("isClinicalNoteApproverRole", () => {
  it("allows clinical and operational approver roles", () => {
    for (const role of [
      "fi_admin",
      "admin",
      "owner",
      "doctor",
      "nurse",
      "surgeon",
      "crm_operator",
      "consultant",
    ]) {
      assert.equal(isClinicalNoteApproverRole(role), true, role);
    }
  });

  it("denies member and reception from approving voice notes", () => {
    assert.equal(isClinicalNoteApproverRole("member"), false);
    assert.equal(isClinicalNoteApproverRole("reception"), false);
  });

  it("denies unknown or empty roles", () => {
    assert.equal(isClinicalNoteApproverRole(""), false);
    assert.equal(isClinicalNoteApproverRole("finance"), false);
    assert.equal(isClinicalNoteApproverRole(null), false);
  });
});