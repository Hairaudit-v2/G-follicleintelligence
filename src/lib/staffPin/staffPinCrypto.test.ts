import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashStaffPin, staffPinStorageDiffersFromRawPin, verifyStaffPinHash } from "./staffPinCrypto";

describe("staffPinCrypto", () => {
  it("hashes PIN without storing raw value", () => {
    const pin = "4821";
    const { hash, salt } = hashStaffPin(pin);
    assert.notEqual(hash, pin);
    assert.notEqual(salt, pin);
    assert.equal(staffPinStorageDiffersFromRawPin(pin, hash, salt), true);
  });

  it("verifies correct PIN", () => {
    const pin = "9012";
    const { hash, salt } = hashStaffPin(pin);
    assert.equal(verifyStaffPinHash(pin, hash, salt), true);
  });

  it("rejects wrong PIN", () => {
    const { hash, salt } = hashStaffPin("1111");
    assert.equal(verifyStaffPinHash("2222", hash, salt), false);
  });

  it("uses stable salt when provided", () => {
    const salt = "abc123saltvalue0";
    const a = hashStaffPin("3333", salt);
    const b = hashStaffPin("3333", salt);
    assert.equal(a.hash, b.hash);
    assert.equal(a.salt, salt);
  });
});
