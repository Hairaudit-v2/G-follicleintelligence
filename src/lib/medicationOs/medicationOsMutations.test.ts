import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertCanonicalCodesAllowed,
  assertPlanCanTransition,
  findInvalidCanonicalCodes,
  normaliseTherapyPlanItems,
} from "./medicationOsMutationPolicy";

describe("medicationOsMutationPolicy", () => {
  describe("assertPlanCanTransition", () => {
    it("allows activate from draft only", () => {
      assertPlanCanTransition("draft", "activate");
      assert.throws(() => assertPlanCanTransition("active", "activate"), /activate/);
    });
    it("allows pause from active only", () => {
      assertPlanCanTransition("active", "pause");
      assert.throws(() => assertPlanCanTransition("draft", "pause"), /pause/);
    });
    it("allows resume from paused only", () => {
      assertPlanCanTransition("paused", "resume");
      assert.throws(() => assertPlanCanTransition("active", "resume"), /resume/);
    });
    it("allows complete from active only", () => {
      assertPlanCanTransition("active", "complete");
      assert.throws(() => assertPlanCanTransition("paused", "complete"), /complete/);
    });
    it("allows cancel from draft, active, paused", () => {
      assertPlanCanTransition("draft", "cancel");
      assertPlanCanTransition("active", "cancel");
      assertPlanCanTransition("paused", "cancel");
      assert.throws(() => assertPlanCanTransition("completed", "cancel"), /cancel/);
    });
    it("allows supersede from draft, active, paused", () => {
      assertPlanCanTransition("draft", "supersede");
      assertPlanCanTransition("active", "supersede");
      assertPlanCanTransition("paused", "supersede");
      assert.throws(() => assertPlanCanTransition("superseded", "supersede"), /supersede/);
    });
  });

  describe("normaliseTherapyPlanItems", () => {
    it("sorts by sort_order then reindexes", () => {
      const out = normaliseTherapyPlanItems([
        { canonical_code: "B", role: "prn", sort_order: 10 },
        { canonical_code: "A", role: "continuous", sort_order: 0 },
      ]);
      assert.equal(out[0]?.canonical_code, "a");
      assert.equal(out[1]?.canonical_code, "b");
      assert.equal(out[0]?.sort_order, 0);
      assert.equal(out[1]?.sort_order, 1);
    });
    it("throws when items empty", () => {
      assert.throws(() => normaliseTherapyPlanItems([]), /at least one item/);
    });
    it("throws when canonical_code blank", () => {
      assert.throws(
        () =>
          normaliseTherapyPlanItems([
            { canonical_code: "  ", role: "continuous" },
          ]),
        /canonical_code/
      );
    });
  });

  describe("findInvalidCanonicalCodes / assertCanonicalCodesAllowed", () => {
    it("finds codes missing from set", () => {
      const s = new Set(["finasteride", "prp"]);
      assert.deepEqual(findInvalidCanonicalCodes(["finasteride", "unknown"], s), ["unknown"]);
    });
    it("assertCanonicalCodesAllowed throws listing invalid", () => {
      assert.throws(() => assertCanonicalCodesAllowed(["x"], new Set(["y"])), /x/);
    });
  });
});
