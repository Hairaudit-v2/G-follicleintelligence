import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatOperationalReadinessReport,
  scoreOperationalReadiness,
} from "./operationalReadinessScoreCore";

describe("scoreOperationalReadiness", () => {
  it("scores all criteria when clinic day artefacts are complete", () => {
    const score = scoreOperationalReadiness({
      consultBookingId: "a0000000-0000-4000-8000-000000000001",
      surgeryBookingId: "a0000000-0000-4000-8000-000000000002",
      consentSigned: true,
      depositRecorded: true,
      staffAssigned: true,
      roomAssigned: true,
      procedureDayCompleted: true,
      patientJourneyState: "procedure_completed",
      followUpTaskId: "a0000000-0000-4000-8000-000000000003",
      calendarBlockerCount: 0,
    });
    assert.equal(score.passed, 7);
    assert.equal(score.ready, true);
    assert.equal(score.percent, 100);
  });

  it("fails when bookings or follow-up are missing", () => {
    const score = scoreOperationalReadiness({
      consultBookingId: "a0000000-0000-4000-8000-000000000001",
      consentSigned: true,
      depositRecorded: false,
      staffAssigned: false,
      roomAssigned: false,
      procedureDayCompleted: false,
      calendarBlockerCount: 2,
    });
    assert.ok(score.passed < score.total);
    assert.equal(score.ready, false);
    const failed = score.criteria.filter((c) => !c.pass).map((c) => c.id);
    assert.ok(failed.includes("booking_complete"));
    assert.ok(failed.includes("follow_up_created"));
  });

  it("formats a markdown table report", () => {
    const score = scoreOperationalReadiness({
      consultBookingId: "x",
      surgeryBookingId: "y",
      consentSigned: true,
      depositRecorded: true,
      staffAssigned: true,
      roomAssigned: true,
      procedureDayCompleted: true,
      followUpTaskId: "z",
    });
    const report = formatOperationalReadinessReport(score);
    assert.match(report, /Operational Readiness: 7\/7/);
    assert.match(report, /\| Booking complete \| PASS \|/);
  });
});