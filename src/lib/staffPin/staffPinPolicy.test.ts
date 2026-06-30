import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  STAFF_PIN_MAX_FAILED_ATTEMPTS,
  nextFailedPinAttemptState,
  resolveStaffPinPublicStatus,
} from "./staffPinPolicy";

describe("staffPinPolicy", () => {
  it("locks after max failed attempts", () => {
    const now = new Date("2026-06-09T10:00:00.000Z");
    const state = nextFailedPinAttemptState(STAFF_PIN_MAX_FAILED_ATTEMPTS - 1, now);
    assert.equal(state.shouldLock, true);
    assert.equal(state.failedAttemptCount, 0);
    assert.ok(state.lockedUntil);
  });

  it("increments failed count before lockout threshold", () => {
    const state = nextFailedPinAttemptState(2);
    assert.equal(state.shouldLock, false);
    assert.equal(state.failedAttemptCount, 3);
    assert.equal(state.lockedUntil, null);
  });

  it("disabled PIN status blocks floor login eligibility", () => {
    const status = resolveStaffPinPublicStatus({
      hasPinRow: true,
      isActive: false,
      lockedUntil: null,
    });
    assert.equal(status, "disabled");
  });

  it("resolveStaffPinPublicStatus covers lifecycle states", () => {
    assert.equal(
      resolveStaffPinPublicStatus({ hasPinRow: false, isActive: false, lockedUntil: null }),
      "not_set"
    );
    assert.equal(
      resolveStaffPinPublicStatus({ hasPinRow: true, isActive: false, lockedUntil: null }),
      "disabled"
    );
    assert.equal(
      resolveStaffPinPublicStatus({
        hasPinRow: true,
        isActive: true,
        lockedUntil: "2099-01-01T00:00:00.000Z",
      }),
      "locked"
    );
    assert.equal(
      resolveStaffPinPublicStatus({ hasPinRow: true, isActive: true, lockedUntil: null }),
      "active"
    );
  });
});
