import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertStaffPinFormat,
  isValidStaffPinFormat,
  normalizeStaffPinInput,
  staffPinsMatch,
} from "./staffPinValidation";

describe("staffPinValidation", () => {
  it("accepts exactly four digits", () => {
    assert.equal(isValidStaffPinFormat("1234"), true);
    assert.equal(isValidStaffPinFormat("0000"), true);
  });

  it("rejects non-digit PINs", () => {
    assert.equal(isValidStaffPinFormat("12a4"), false);
    assert.equal(isValidStaffPinFormat("123"), false);
    assert.equal(isValidStaffPinFormat("12345"), false);
    assert.equal(isValidStaffPinFormat("12 34"), false);
  });

  it("assertStaffPinFormat throws for invalid input", () => {
    assert.throws(() => assertStaffPinFormat("abc"), /exactly 4 digits/);
  });

  it("staffPinsMatch compares normalized values", () => {
    assert.equal(staffPinsMatch("1234", " 1234 "), true);
    assert.equal(staffPinsMatch("1234", "4321"), false);
  });

  it("normalizeStaffPinInput trims whitespace", () => {
    assert.equal(normalizeStaffPinInput(" 5678 "), "5678");
  });
});
