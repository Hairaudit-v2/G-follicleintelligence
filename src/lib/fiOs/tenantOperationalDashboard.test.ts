import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bookingAgendaBucket, computeOperationalAgendaUtcRange } from "./tenantOperationalDashboardHelpers";

describe("tenant operational dashboard — agenda helpers", () => {
  it("maps booking types to agenda buckets", () => {
    assert.equal(bookingAgendaBucket("consultation"), "consult");
    assert.equal(bookingAgendaBucket("surgery"), "surgery");
    assert.equal(bookingAgendaBucket("follow_up"), "follow_up");
    assert.equal(bookingAgendaBucket("review"), "follow_up");
    assert.equal(bookingAgendaBucket("prp"), "other");
  });

  it("computes a 72-hour UTC agenda window from midnight today", () => {
    const now = new Date("2026-06-09T15:30:00.000Z");
    const range = computeOperationalAgendaUtcRange(now);
    assert.equal(range.startIso, "2026-06-09T00:00:00.000Z");
    assert.equal(range.endIso, "2026-06-12T00:00:00.000Z");
  });
});
