import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildIiohrNexusSignatureMaterial,
  computeIiohrNexusHmacHex,
  evaluateIiohrNexusSignedRequest,
  IIOHR_NEXUS_TIMESTAMP_SKEW_MS,
  signIiohrNexusRequestForTests,
  verifyIiohrNexusHmacTimingSafe,
  verifyIiohrNexusTimestamp,
} from "./iiohrNexusWebhookAuth.server";

describe("iiohrNexusWebhookAuth", () => {
  it("verifyIiohrNexusHmacTimingSafe accepts matching signature", () => {
    const secret = "nexus-test-secret-value";
    const material = buildIiohrNexusSignatureMaterial("1700000000", '{"a":1}');
    const sig = computeIiohrNexusHmacHex(secret, material);
    assert.equal(verifyIiohrNexusHmacTimingSafe(secret, material, sig), true);
  });

  it("verifyIiohrNexusHmacTimingSafe rejects wrong signature", () => {
    const secret = "nexus-test-secret-value";
    const material = buildIiohrNexusSignatureMaterial("1700000000", "{}");
    assert.equal(verifyIiohrNexusHmacTimingSafe(secret, material, "00".repeat(32)), false);
  });

  it("verifyIiohrNexusTimestamp respects 5 minute skew", () => {
    const now = 1_700_000_000_000;
    assert.equal(verifyIiohrNexusTimestamp(now, now, IIOHR_NEXUS_TIMESTAMP_SKEW_MS), true);
    assert.equal(
      verifyIiohrNexusTimestamp(
        now - IIOHR_NEXUS_TIMESTAMP_SKEW_MS - 1,
        now,
        IIOHR_NEXUS_TIMESTAMP_SKEW_MS
      ),
      false
    );
  });

  it("evaluateIiohrNexusSignedRequest rejects missing secret", () => {
    const result = evaluateIiohrNexusSignedRequest({
      timestampHeader: "1700000000",
      signatureHeader: "abc",
      rawBody: "{}",
      secret: null,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.httpStatus, 503);
  });

  it("evaluateIiohrNexusSignedRequest rejects invalid signature", () => {
    const result = evaluateIiohrNexusSignedRequest({
      timestampHeader: String(Math.floor(Date.now() / 1000)),
      signatureHeader: "00".repeat(32),
      rawBody: '{"x":1}',
      secret: "nexus-test-secret-value",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.httpStatus, 401);
  });

  it("evaluateIiohrNexusSignedRequest accepts valid signed body", () => {
    const secret = "nexus-test-secret-value";
    const rawBody = '{"globalProfessionalId":"gp-1"}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const { signature } = signIiohrNexusRequestForTests({ secret, timestamp, rawBody });
    const result = evaluateIiohrNexusSignedRequest({
      timestampHeader: timestamp,
      signatureHeader: signature,
      rawBody,
      secret,
    });
    assert.equal(result.ok, true);
  });
});
