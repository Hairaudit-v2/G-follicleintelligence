import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_WORKFORCE_TIME_CLOCK_POLICY,
  mergeWorkforceTimeClockPolicyIntoMetadata,
  parseWorkforceTimeClockPolicy,
} from "./staffTimeClockPolicyCore";

describe("staffTimeClockPolicyCore", () => {
  it("defaults when metadata is missing", () => {
    assert.deepEqual(parseWorkforceTimeClockPolicy(null), DEFAULT_WORKFORCE_TIME_CLOCK_POLICY);
  });

  it("reads extended workforce_time_clock metadata", () => {
    assert.deepEqual(
      parseWorkforceTimeClockPolicy({
        workforce_time_clock: {
          breaks_enabled: true,
          pay_period_frequency: "monthly",
          pay_period_anchor: "2026-03-01",
          auto_close_enabled: false,
          auto_close_local_hour: 22,
        },
      }),
      {
        breaksEnabled: true,
        payPeriodFrequency: "monthly",
        payPeriodAnchor: "2026-03-01",
        autoCloseEnabled: false,
        autoCloseLocalHour: 22,
      }
    );
  });

  it("merge preserves unrelated metadata keys", () => {
    const merged = mergeWorkforceTimeClockPolicyIntoMetadata(
      { timezone_note: "Perth" },
      { breaksEnabled: true }
    );
    assert.equal(merged.timezone_note, "Perth");
    assert.equal(
      (merged.workforce_time_clock as { breaks_enabled: boolean }).breaks_enabled,
      true
    );
  });
});