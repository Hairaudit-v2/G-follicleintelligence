import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyTiebreakerCursor,
  canAdvanceIncrementalWatermark,
  classifyUpsertOutcome,
  compareNotesForIncremental,
  decideMonotonicWatermarkAdvance,
  filterNotesInRange,
  hubspotSearchDatetimeMs,
  isHubspotIncrementalDataset,
  isIncrementalRunStuck,
  isNoteInIncrementalRange,
  nextWatermarkFromCutoffTo,
  parseIncrementalRange,
  parseStrictUtcTimestamp,
  HUBSPOT_INCREMENTAL_STUCK_AGE_MS,
} from "./hubspotIncrementalBackupCore";

describe("hubspotIncrementalBackupCore cutoffs", () => {
  it("accepts explicit UTC Z timestamps", () => {
    const parsed = parseStrictUtcTimestamp("2026-07-16T00:00:00.000Z", "cutoff-from");
    assert.equal(parsed.iso, "2026-07-16T00:00:00.000Z");
  });

  it("accepts explicit numeric offsets and normalizes to UTC", () => {
    const parsed = parseStrictUtcTimestamp("2026-07-16T10:00:00.000+10:00", "cutoff-from");
    assert.equal(parsed.iso, "2026-07-16T00:00:00.000Z");
  });

  it("rejects date-only and timezone-ambiguous local timestamps", () => {
    assert.throws(() => parseStrictUtcTimestamp("2026-07-16", "cutoff-from"));
    assert.throws(() => parseStrictUtcTimestamp("2026-07-16T00:00:00", "cutoff-from"));
    assert.throws(() => parseStrictUtcTimestamp("2026-07-16 00:00:00", "cutoff-from"));
  });

  it("rejects cutoff-to <= cutoff-from", () => {
    assert.throws(() =>
      parseIncrementalRange({
        cutoffFrom: "2026-07-16T01:00:00.000Z",
        cutoffTo: "2026-07-16T01:00:00.000Z",
      })
    );
    assert.throws(() =>
      parseIncrementalRange({
        cutoffFrom: "2026-07-16T02:00:00.000Z",
        cutoffTo: "2026-07-16T01:00:00.000Z",
      })
    );
  });

  it("parses a valid exclusive-upper range", () => {
    const range = parseIncrementalRange({
      cutoffFrom: "2026-07-16T00:00:00.000Z",
      cutoffTo: "2026-07-16T01:00:00.000Z",
    });
    assert.equal(range.cutoffFrom.iso, "2026-07-16T00:00:00.000Z");
    assert.equal(range.cutoffTo.iso, "2026-07-16T01:00:00.000Z");
  });
});

describe("hubspotIncrementalBackupCore range filter", () => {
  const range = parseIncrementalRange({
    cutoffFrom: "2026-07-16T00:00:00.000Z",
    cutoffTo: "2026-07-16T01:00:00.000Z",
  });

  it("includes lower bound and excludes upper bound", () => {
    assert.equal(
      isNoteInIncrementalRange({ id: "a", updatedAt: "2026-07-16T00:00:00.000Z" }, range),
      true
    );
    assert.equal(
      isNoteInIncrementalRange({ id: "b", updatedAt: "2026-07-16T00:59:59.999Z" }, range),
      true
    );
    assert.equal(
      isNoteInIncrementalRange({ id: "c", updatedAt: "2026-07-16T01:00:00.000Z" }, range),
      false
    );
  });

  it("does not skip equal-timestamp notes (stable id order)", () => {
    const ts = "2026-07-16T00:30:00.000Z";
    const notes = [
      { id: "n2", updatedAt: ts },
      { id: "n1", updatedAt: ts },
      { id: "n3", updatedAt: ts },
    ];
    const { inRange } = filterNotesInRange(notes, range);
    assert.deepEqual(
      inRange.map((n) => n.id),
      ["n1", "n2", "n3"]
    );
    assert.equal(compareNotesForIncremental(notes[0]!, notes[1]!) > 0, true);
  });

  it("tiebreaker cursor continues after equal timestamps", () => {
    const ts = "2026-07-16T00:30:00.000Z";
    const notes = [
      { id: "n1", updatedAt: ts },
      { id: "n2", updatedAt: ts },
      { id: "n3", updatedAt: ts },
    ];
    const remaining = applyTiebreakerCursor(notes, ts, "n1");
    assert.deepEqual(
      remaining.map((n) => n.id),
      ["n2", "n3"]
    );
  });
});

describe("hubspotIncrementalBackupCore watermark rules", () => {
  it("advances only after completed + verification passed + no failures", () => {
    assert.equal(
      canAdvanceIncrementalWatermark({
        status: "completed",
        verificationState: "passed",
        paginationComplete: true,
        unresolvedFailures: false,
      }),
      true
    );
    assert.equal(
      canAdvanceIncrementalWatermark({
        status: "partial",
        verificationState: "passed",
        paginationComplete: true,
        unresolvedFailures: false,
      }),
      false
    );
    assert.equal(
      canAdvanceIncrementalWatermark({
        status: "completed",
        verificationState: "failed",
        paginationComplete: true,
        unresolvedFailures: false,
      }),
      false
    );
    assert.equal(
      canAdvanceIncrementalWatermark({
        status: "failed",
        verificationState: "failed",
        paginationComplete: false,
        unresolvedFailures: true,
      }),
      false
    );
    assert.equal(
      canAdvanceIncrementalWatermark({
        status: "completed",
        verificationState: "passed",
        paginationComplete: true,
        unresolvedFailures: true,
      }),
      false
    );
  });

  it("sets next watermark to exclusive cutoff-to", () => {
    assert.deepEqual(nextWatermarkFromCutoffTo("2026-07-16T01:00:00.000Z"), {
      watermark_timestamp: "2026-07-16T01:00:00.000Z",
      watermark_tiebreaker: null,
    });
  });

  it("rejects watermark rewind and treats equal cutoff as already_at_target", () => {
    assert.equal(
      decideMonotonicWatermarkAdvance({
        currentWatermarkIso: null,
        proposedWatermarkIso: "2026-07-16T01:00:00.000Z",
      }),
      "create_or_advance"
    );
    assert.equal(
      decideMonotonicWatermarkAdvance({
        currentWatermarkIso: "2026-07-16T01:00:00.000Z",
        proposedWatermarkIso: "2026-07-16T02:00:00.000Z",
      }),
      "create_or_advance"
    );
    assert.equal(
      decideMonotonicWatermarkAdvance({
        currentWatermarkIso: "2026-07-16T01:00:00.000Z",
        proposedWatermarkIso: "2026-07-16T01:00:00.000Z",
      }),
      "already_at_target"
    );
    assert.throws(
      () =>
        decideMonotonicWatermarkAdvance({
          currentWatermarkIso: "2026-07-16T03:45:02.366Z",
          proposedWatermarkIso: "2026-07-16T03:20:00.000Z",
        }),
      /WATERMARK_MONOTONIC/
    );
  });
});

describe("hubspotIncrementalBackupCore misc", () => {
  it("recognizes notes dataset only", () => {
    assert.equal(isHubspotIncrementalDataset("notes"), true);
    assert.equal(isHubspotIncrementalDataset("emails"), false);
  });

  it("classifies upsert outcomes", () => {
    assert.equal(
      classifyUpsertOutcome({ existedBefore: false, previousChecksum: null, nextChecksum: "a" }),
      "inserted"
    );
    assert.equal(
      classifyUpsertOutcome({
        existedBefore: true,
        previousChecksum: "a",
        nextChecksum: "a",
      }),
      "unchanged"
    );
    assert.equal(
      classifyUpsertOutcome({
        existedBefore: true,
        previousChecksum: "a",
        nextChecksum: "b",
      }),
      "updated"
    );
  });

  it("detects stuck started runs by age", () => {
    const now = Date.parse("2026-07-16T02:00:00.000Z");
    assert.equal(
      isIncrementalRunStuck({
        status: "started",
        startedAt: "2026-07-16T01:00:00.000Z",
        lastCheckpointAt: null,
        nowMs: now,
        staleAgeMs: HUBSPOT_INCREMENTAL_STUCK_AGE_MS,
      }),
      true
    );
    assert.equal(
      isIncrementalRunStuck({
        status: "started",
        startedAt: "2026-07-16T01:50:00.000Z",
        lastCheckpointAt: "2026-07-16T01:55:00.000Z",
        nowMs: now,
        staleAgeMs: HUBSPOT_INCREMENTAL_STUCK_AGE_MS,
      }),
      false
    );
    assert.equal(
      isIncrementalRunStuck({
        status: "completed",
        startedAt: "2026-07-16T00:00:00.000Z",
        lastCheckpointAt: null,
        nowMs: now,
      }),
      false
    );
  });

  it("converts ISO to HubSpot search epoch ms", () => {
    const iso = "2026-07-16T00:00:00.000Z";
    assert.equal(hubspotSearchDatetimeMs(iso), String(Date.parse(iso)));
  });
});
