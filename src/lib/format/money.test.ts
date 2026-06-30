import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatMoneyFromCents, formatMoneyMajor } from "./money";

describe("formatMoneyFromCents", () => {
  it("formats AUD cents with currency symbol", () => {
    const out = formatMoneyFromCents(123_456, "AUD");
    assert.match(out, /\$|AUD/);
    assert.match(out, /1,?234\.56/);
  });

  it("formats zero", () => {
    const out = formatMoneyFromCents(0, "AUD");
    assert.match(out, /0\.00/);
  });

  it("falls back when currency code is invalid", () => {
    const out = formatMoneyFromCents(100, "NOTACURRENCY");
    assert.match(out, /NOTACURRENCY/);
    assert.match(out, /1\.00/);
  });
});

describe("formatMoneyMajor", () => {
  it("formats whole-dollar amounts", () => {
    const out = formatMoneyMajor(12500, "AUD");
    assert.match(out, /12,?500/);
  });
});
