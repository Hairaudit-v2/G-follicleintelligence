import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMachineIngestCanonicalString,
  computeMachineIngestHmacHex,
  MACHINE_INGEST_TIMESTAMP_SKEW_MS,
  parseMachineIngestTimestampMs,
  sha256HexOfBuffer,
  verifyMachineIngestHmacTimingSafe,
  verifyMachineIngestTimestamp,
} from "./machineIngestCanonical";

describe("machineIngestCanonical", () => {
  it("buildMachineIngestCanonicalString is stable for given inputs", () => {
    const c = buildMachineIngestCanonicalString({
      method: "post",
      pathname: "/api/ingest/tenant-1/partners",
      timestampMs: 1700000000000,
      nonce: "n-1",
      bodySha256Hex: "abc".repeat(10),
    });
    assert.equal(
      c,
      `POST\n/api/ingest/tenant-1/partners\n1700000000000\nn-1\n${"abc".repeat(10)}`
    );
  });

  it("verifyMachineIngestHmacTimingSafe accepts matching signature", () => {
    const secret = "unit-test-secret";
    const canonical = buildMachineIngestCanonicalString({
      method: "POST",
      pathname: "/api/ingest/tid/partners",
      timestampMs: 1,
      nonce: "nonce",
      bodySha256Hex: "aa".repeat(32),
    });
    const sig = computeMachineIngestHmacHex(secret, canonical);
    assert.equal(verifyMachineIngestHmacTimingSafe(secret, canonical, sig), true);
  });

  it("verifyMachineIngestHmacTimingSafe rejects wrong signature", () => {
    const secret = "unit-test-secret";
    const canonical = "POST\n/p\n1\nn\nhash";
    assert.equal(verifyMachineIngestHmacTimingSafe(secret, canonical, "00".repeat(32)), false);
  });

  it("parseMachineIngestTimestampMs accepts 12–16 digit integer ms", () => {
    assert.equal(parseMachineIngestTimestampMs(" 1700000000000 "), 1_700_000_000_000);
    assert.equal(parseMachineIngestTimestampMs("100000000000"), 100_000_000_000);
  });

  it("parseMachineIngestTimestampMs rejects decimals, scientific notation, and unsafe lengths", () => {
    assert.equal(parseMachineIngestTimestampMs("1700000000000.1"), null);
    assert.equal(parseMachineIngestTimestampMs("1e12"), null);
    assert.equal(parseMachineIngestTimestampMs("17e12"), null);
    assert.equal(parseMachineIngestTimestampMs(""), null);
    assert.equal(parseMachineIngestTimestampMs("   "), null);
    assert.equal(parseMachineIngestTimestampMs("10000000000"), null); // 11 digits
    assert.equal(parseMachineIngestTimestampMs("10000000000000000"), null); // 17 digits / unsafe
  });

  it("verifyMachineIngestTimestamp respects skew window", () => {
    const now = 1_700_000_000_000;
    assert.equal(verifyMachineIngestTimestamp(now, now, MACHINE_INGEST_TIMESTAMP_SKEW_MS), true);
    assert.equal(
      verifyMachineIngestTimestamp(now - MACHINE_INGEST_TIMESTAMP_SKEW_MS - 1, now, MACHINE_INGEST_TIMESTAMP_SKEW_MS),
      false
    );
    assert.equal(
      verifyMachineIngestTimestamp(now + MACHINE_INGEST_TIMESTAMP_SKEW_MS + 1, now, MACHINE_INGEST_TIMESTAMP_SKEW_MS),
      false
    );
  });

  it("wrong pathname changes body hash / canonical so cross-tenant path replay fails", () => {
    const secret = "k";
    const body = Buffer.from('{"tenant_id":"tid","name":"A","reference_code":"ref1"}', "utf8");
    const h = sha256HexOfBuffer(body);
    const good = buildMachineIngestCanonicalString({
      method: "POST",
      pathname: "/api/ingest/tid/partners",
      timestampMs: 99,
      nonce: "nonce1",
      bodySha256Hex: h,
    });
    const badPath = buildMachineIngestCanonicalString({
      method: "POST",
      pathname: "/api/ingest/other-tid/partners",
      timestampMs: 99,
      nonce: "nonce1",
      bodySha256Hex: h,
    });
    const sig = computeMachineIngestHmacHex(secret, good);
    assert.equal(verifyMachineIngestHmacTimingSafe(secret, badPath, sig), false);
  });
});
