import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isStaffUatFrictionType,
  normalizeStaffUatRating,
  STAFF_UAT_FRICTION_TYPES,
} from "./staffUatFrictionCore";

describe("staffUatFrictionCore", () => {
  it("recognizes all friction types", () => {
    for (const t of STAFF_UAT_FRICTION_TYPES) {
      assert.equal(isStaffUatFrictionType(t), true);
    }
    assert.equal(isStaffUatFrictionType("unknown"), false);
  });

  it("normalizes ratings 1–5 only", () => {
    assert.equal(normalizeStaffUatRating(1), 1);
    assert.equal(normalizeStaffUatRating(5), 5);
    assert.equal(normalizeStaffUatRating("3"), 3);
    assert.equal(normalizeStaffUatRating(0), null);
    assert.equal(normalizeStaffUatRating(6), null);
    assert.equal(normalizeStaffUatRating(2.5), null);
    assert.equal(normalizeStaffUatRating(null), null);
  });
});