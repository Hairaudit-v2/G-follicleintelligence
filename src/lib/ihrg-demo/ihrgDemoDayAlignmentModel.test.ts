import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  IHRG_DEMO_DAY_BOOKING_SPECS,
  IHRG_DEMO_DAY_CLINIC_SLUG,
  IHRG_DEMO_DAY_RECEPTION_TASK_SPECS,
  IHRG_DEMO_DAY_TIMEZONE,
  ihrgDemoDayTodaySpecs,
  ihrgDemoDayTomorrowSpecs,
} from "./ihrgDemoDayAlignmentModel";

describe("ihrgDemoDayAlignmentModel", () => {
  it("targets Sydney Hair Institute in Australia/Sydney", () => {
    assert.equal(IHRG_DEMO_DAY_CLINIC_SLUG, "sydney-hair-institute");
    assert.equal(IHRG_DEMO_DAY_TIMEZONE, "Australia/Sydney");
  });

  it("splits today vs tomorrow booking specs without overlap", () => {
    const today = ihrgDemoDayTodaySpecs();
    const tomorrow = ihrgDemoDayTomorrowSpecs();
    assert.ok(today.length >= 5);
    assert.ok(tomorrow.length >= 1);
    assert.equal(today.length + tomorrow.length, IHRG_DEMO_DAY_BOOKING_SPECS.length);

    const todayKeys = new Set(today.map((s) => s.key));
    for (const s of tomorrow) {
      assert.equal(todayKeys.has(s.key), false);
      assert.match(s.key, /tomorrow/);
    }
  });

  it("includes at least one pending-deposit surgery for the board", () => {
    const depositSpecs = IHRG_DEMO_DAY_BOOKING_SPECS.filter((s) => s.withPendingDeposit);
    assert.ok(depositSpecs.length >= 1);
    assert.ok(depositSpecs.every((s) => s.kind === "surgery"));
  });

  it("defines reception follow-ups for morning prep storytelling", () => {
    assert.ok(IHRG_DEMO_DAY_RECEPTION_TASK_SPECS.length >= 3);
    assert.ok(IHRG_DEMO_DAY_RECEPTION_TASK_SPECS.some((t) => t.severity === "warning"));
  });
});
