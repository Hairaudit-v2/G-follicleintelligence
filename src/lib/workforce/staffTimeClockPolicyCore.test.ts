import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_WORKFORCE_TIME_CLOCK_POLICY,
  mergeWorkforceTimeClockPolicyIntoMetadata,
  parseWorkforceTimeClockPolicy,
} from "./staffTimeClockPolicyCore";

describe("staffTimeClockPolicyCore", () => {
  it("defaults breaks to disabled when metadata is missing", () => {
    assert.deepEqual(parseWorkforceTimeClockPolicy(null), DEFAULT_WORKFORCE_TIME_CLOCK_POLICY);
    assert.deepEqual(parseWorkforceTimeClockPolicy({}), DEFAULT_WORKFORCE_TIME_CLOCK_POLICY);
  });

  it("reads breaks_enabled from workforce_time_clock metadata", () => {
    assert.deepEqual(
      parseWorkforceTimeClockPolicy({
        workforce_time_clock: { breaks_enabled: true },
      }),
      { breaksEnabled: true }
    );
    assert.deepEqual(
      parseWorkforceTimeClockPolicy({
        workforce_time_clock: { breaks_enabled: false },
      }),
      { breaksEnabled: false }
    );
  });

  it("merge preserves unrelated metadata keys", () => {
    const merged = mergeWorkforceTimeClockPolicyIntoMetadata(
      { timezone_note: "Perth", workforce_time_clock: { breaks_enabled: false } },
      { breaksEnabled: true }
    );
    assert.equal(merged.timezone_note, "Perth");
    assert.deepEqual(merged.workforce_time_clock, { breaks_enabled: true });
  });
});