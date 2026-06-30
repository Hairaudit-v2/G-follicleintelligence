import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertNeverHardDeleteFiCase } from "./fiCasesDeletePolicy";

describe("assertNeverHardDeleteFiCase", () => {
  it("throws with context so callers cannot hard-delete fi_cases", () => {
    assert.throws(
      () => assertNeverHardDeleteFiCase("unit-test"),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Hard delete of fi_cases is not permitted/);
        assert.match(err.message, /unit-test/);
        assert.match(err.message, /softDeleteFiCase/);
        return true;
      }
    );
  });
});
