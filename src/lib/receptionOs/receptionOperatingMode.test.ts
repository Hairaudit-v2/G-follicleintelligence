import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  inferDefaultOperatingMode,
  taskStatusesForOperatingMode,
  widgetsForOperatingMode,
} from "@/src/lib/receptionOs/receptionOperatingMode";

describe("receptionOperatingMode", () => {
  it("infers morning, live, and end-of-day modes from local hour", () => {
    assert.equal(inferDefaultOperatingMode(8), "morning_prep");
    assert.equal(inferDefaultOperatingMode(12), "live_clinic");
    assert.equal(inferDefaultOperatingMode(18), "end_of_day");
  });

  it("orders persona widgets by mode priority", () => {
    const all = widgetsForOperatingMode("morning_prep", [
      "communication_timeline",
      "todays_patients",
      "action_alerts",
      "upcoming_surgery",
    ]);
    assert.deepEqual(all.slice(0, 2), ["todays_patients", "upcoming_surgery"]);
    assert.ok(all.includes("communication_timeline"));
  });

  it("filters task statuses per mode", () => {
    assert.deepEqual(taskStatusesForOperatingMode("morning_prep"), ["open", "snoozed"]);
    assert.ok(taskStatusesForOperatingMode("live_clinic").includes("in_progress"));
  });
});
