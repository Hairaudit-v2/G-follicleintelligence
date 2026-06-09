import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { STAFF_PIN_DIGIT_COUNT } from "./staffPinValidation";

const SCRYPT_KEYLEN = 32;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export function hashStaffPin(pin: string, salt?: string): { hash: string; salt: string } {
  const pinSalt = salt ?? randomBytes(16).toString("hex");
  const derived = scryptSync(pin, pinSalt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return { hash: derived.toString("hex"), salt: pinSalt };
}

export function verifyStaffPinHash(pin: string, hash: string, salt: string): boolean {
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== SCRYPT_KEYLEN) return false;
  const derived = scryptSync(pin, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** Ensures stored material never equals the raw PIN. */
export function staffPinStorageDiffersFromRawPin(pin: string, hash: string, salt: string): boolean {
  return pin !== hash && pin !== salt && hash.length > STAFF_PIN_DIGIT_COUNT;
}
