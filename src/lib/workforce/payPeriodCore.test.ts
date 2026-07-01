import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolvePayPeriodContaining } from "./payPeriodCore";

describe("payPeriodCore", () => {
  it("resolves monthly period", () => {
    const p = resolvePayPeriodContaining("2026-07-15", "monthly", "2026-01-01");
    assert.equal(p.start, "2026-07-01");
    assert.equal(p.end, "2026-07-31");
  });

  it("resolves fortnightly period from anchor", () => {
    const p = resolvePayPeriodContaining("2026-07-15", "fortnightly", "2026-01-01");
    assert.equal(p.frequency, "fortnightly");
    assert.ok(p.start <= "2026-07-15");
    assert.ok(p.end >= "2026-07-15");
  });
});