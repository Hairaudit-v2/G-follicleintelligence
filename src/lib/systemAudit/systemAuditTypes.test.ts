import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isSystemAuditAction,
  SYSTEM_AUDIT_ACTIONS,
  SYSTEM_AUDIT_ACTION_LABELS,
} from "./systemAuditTypes";

describe("system audit types", () => {
  it("includes Phase 1 standardised actions", () => {
    for (const a of [
      "patient.created",
      "note.created",
      "payment.recorded",
      "deposit.recorded",
      "lead.approved",
      "lead.rejected",
      "image.uploaded",
      "image.submitted_by_patient",
      "auth.login",
      "auth.login_failed",
    ]) {
      assert.equal(isSystemAuditAction(a), true, a);
      assert.ok(SYSTEM_AUDIT_ACTIONS.includes(a as (typeof SYSTEM_AUDIT_ACTIONS)[number]));
      assert.ok(SYSTEM_AUDIT_ACTION_LABELS[a as keyof typeof SYSTEM_AUDIT_ACTION_LABELS]);
    }
  });

  it("rejects unknown actions", () => {
    assert.equal(isSystemAuditAction("foo.bar"), false);
    assert.equal(isSystemAuditAction(""), false);
  });
});
