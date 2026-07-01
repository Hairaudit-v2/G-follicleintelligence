import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeNetWorkMinutes,
  computePunchMinutes,
  derivePunchMinutesWorked,
  shouldOpenNewPunchOnLogin,
  sumBreakMinutes,
} from "./staffTimeClockCore";

describe("staffTimeClockCore", () => {
  it("computes minutes between clock-in and clock-out", () => {
    const mins = computePunchMinutes(
      "2026-07-01T00:00:00.000Z",
      "2026-07-01T08:30:00.000Z"
    );
    assert.equal(mins, 510);
  });

  it("returns zero for invalid or reversed spans", () => {
    assert.equal(computePunchMinutes("invalid", "2026-07-01T08:00:00.000Z"), 0);
    assert.equal(
      computePunchMinutes("2026-07-01T10:00:00.000Z", "2026-07-01T08:00:00.000Z"),
      0
    );
  });

  it("shouldOpenNewPunchOnLogin only when no open punch", () => {
    assert.equal(shouldOpenNewPunchOnLogin(false), true);
    assert.equal(shouldOpenNewPunchOnLogin(true), false);
  });

  it("derivePunchMinutesWorked returns null for open punches", () => {
    assert.equal(
      derivePunchMinutesWorked("open", "2026-07-01T00:00:00.000Z", null),
      null
    );
    assert.equal(
      derivePunchMinutesWorked(
        "closed",
        "2026-07-01T00:00:00.000Z",
        "2026-07-01T08:00:00.000Z"
      ),
      480
    );
  });

  it("sumBreakMinutes aggregates closed breaks", () => {
    const total = sumBreakMinutes([
      {
        breakStartAt: "2026-07-01T01:00:00.000Z",
        breakEndAt: "2026-07-01T01:30:00.000Z",
        status: "closed",
      },
      {
        breakStartAt: "2026-07-01T04:00:00.000Z",
        breakEndAt: "2026-07-01T04:15:00.000Z",
        status: "closed",
      },
    ]);
    assert.equal(total, 45);
  });

  it("computeNetWorkMinutes deducts breaks from gross", () => {
    assert.equal(computeNetWorkMinutes(480, 45), 435);
    assert.equal(computeNetWorkMinutes(30, 60), 0);
  });

  it("derivePunchMinutesWorked deducts break minutes when provided", () => {
    assert.equal(
      derivePunchMinutesWorked(
        "closed",
        "2026-07-01T00:00:00.000Z",
        "2026-07-01T08:00:00.000Z",
        30
      ),
      450
    );
  });
});