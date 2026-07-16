import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildScheduledCutoffs,
  classifyScheduledOutcome,
  computeScheduledBackoffMs,
  isTransientScheduledError,
  nextDailyBrisbaneRunUtc,
  resolveScheduledDataset,
} from "./hubspotScheduledIncrementalBackupCore";

describe("hubspotScheduledIncrementalBackupCore", () => {
  it("resolves notes dataset only", () => {
    assert.equal(resolveScheduledDataset("notes"), "notes");
    assert.throws(() => resolveScheduledDataset("emails"));
  });

  it("builds cutoffs from watermark and frozen invocation time", () => {
    const plan = buildScheduledCutoffs({
      watermarkTimestamp: "2026-07-16T03:20:00.000Z",
      invocationTimeIso: "2026-07-16T04:00:00.000Z",
    });
    assert.equal(plan.cutoffFrom, "2026-07-16T03:20:00.000Z");
    assert.equal(plan.cutoffTo, "2026-07-16T04:00:00.000Z");
    assert.equal(plan.watermarkBefore, "2026-07-16T03:20:00.000Z");
  });

  it("refuses missing watermark and non-advancing cutoff-to", () => {
    assert.throws(() =>
      buildScheduledCutoffs({
        watermarkTimestamp: null,
        invocationTimeIso: "2026-07-16T04:00:00.000Z",
      })
    );
    assert.throws(() =>
      buildScheduledCutoffs({
        watermarkTimestamp: "2026-07-16T03:20:00.000Z",
        invocationTimeIso: "2026-07-16T03:20:00.000Z",
      })
    );
  });

  it("classifies scheduled outcomes", () => {
    assert.equal(
      classifyScheduledOutcome({
        ok: true,
        status: "completed",
        verificationState: "passed",
        emptyRange: true,
      }),
      "empty_success"
    );
    assert.equal(
      classifyScheduledOutcome({ ok: false, exitHint: "conflict" }),
      "overlap_blocked"
    );
    assert.equal(
      classifyScheduledOutcome({
        ok: false,
        exitHint: "validation",
        error: "Missing verified notes watermark.",
      }),
      "missing_watermark"
    );
  });

  it("detects transient errors and computes backoff", () => {
    assert.equal(isTransientScheduledError({ status: 429, category: "rate_limit" }), true);
    assert.equal(isTransientScheduledError({ status: 400, category: "provider" }), false);
    assert.equal(computeScheduledBackoffMs(0, 1000), 1000);
    assert.equal(computeScheduledBackoffMs(2, 1000), 4000);
  });

  it("computes next 02:00 Brisbane (16:00 UTC) run", () => {
    const before = nextDailyBrisbaneRunUtc(new Date("2026-07-16T03:00:00.000Z"));
    assert.equal(before, "2026-07-16T16:00:00.000Z");
    const after = nextDailyBrisbaneRunUtc(new Date("2026-07-16T16:00:00.000Z"));
    assert.equal(after, "2026-07-17T16:00:00.000Z");
  });
});
