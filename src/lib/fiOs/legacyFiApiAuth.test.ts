import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateLegacyFiApiAccess,
  isLegacyFiApiEnabled,
  safeTimingEqual,
} from "./legacyFiApiAuth";

function req(headers: Record<string, string>): Request {
  return new Request("https://example.com/api/fi/events", {
    method: "POST",
    headers,
  });
}

describe("legacyFiApiAuth", () => {
  it("isLegacyFiApiEnabled is false when unset or not affirmative", () => {
    assert.equal(isLegacyFiApiEnabled({}), false);
    assert.equal(isLegacyFiApiEnabled({ FI_LEGACY_FI_API_ENABLED: "" }), false);
    assert.equal(isLegacyFiApiEnabled({ FI_LEGACY_FI_API_ENABLED: "false" }), false);
    assert.equal(isLegacyFiApiEnabled({ FI_LEGACY_FI_API_ENABLED: "0" }), false);
  });

  it("isLegacyFiApiEnabled is true for explicit affirmative values", () => {
    assert.equal(isLegacyFiApiEnabled({ FI_LEGACY_FI_API_ENABLED: "true" }), true);
    assert.equal(isLegacyFiApiEnabled({ FI_LEGACY_FI_API_ENABLED: "1" }), true);
    assert.equal(isLegacyFiApiEnabled({ FI_LEGACY_FI_API_ENABLED: " YES " }), true);
    assert.equal(isLegacyFiApiEnabled({ FI_LEGACY_FI_API_ENABLED: "yes" }), true);
  });

  it("disabled route blocks request with generic 404", () => {
    const r = evaluateLegacyFiApiAccess(req({ Authorization: "Bearer x" }), {});
    assert.ok(r);
    assert.equal(r.status, 404);
    assert.equal(r.body.error, "Not found.");
  });

  it("enabled route without bearer blocks with 401", () => {
    const env = { FI_LEGACY_FI_API_ENABLED: "true", FI_LEGACY_FI_API_SECRET: "correct-secret" };
    const r = evaluateLegacyFiApiAccess(req({}), env);
    assert.ok(r);
    assert.equal(r.status, 401);
  });

  it("enabled route with wrong bearer blocks with 401", () => {
    const env = { FI_LEGACY_FI_API_ENABLED: "true", FI_LEGACY_FI_API_SECRET: "correct-secret" };
    const r = evaluateLegacyFiApiAccess(req({ Authorization: "Bearer wrong" }), env);
    assert.ok(r);
    assert.equal(r.status, 401);
  });

  it("enabled route with correct bearer proceeds", () => {
    const env = { FI_LEGACY_FI_API_ENABLED: "true", FI_LEGACY_FI_API_SECRET: "correct-secret" };
    const r = evaluateLegacyFiApiAccess(req({ Authorization: "Bearer correct-secret" }), env);
    assert.equal(r, null);
  });

  it("enabled route with lowercase bearer prefix proceeds", () => {
    const env = { FI_LEGACY_FI_API_ENABLED: "true", FI_LEGACY_FI_API_SECRET: "s3cret" };
    const r = evaluateLegacyFiApiAccess(req({ Authorization: "bearer s3cret" }), env);
    assert.equal(r, null);
  });

  it("returns 503 when enabled but secret not configured", () => {
    const env = { FI_LEGACY_FI_API_ENABLED: "true", FI_LEGACY_FI_API_SECRET: "" };
    const r = evaluateLegacyFiApiAccess(req({ Authorization: "Bearer anything" }), env);
    assert.ok(r);
    assert.equal(r.status, 503);
  });

  it("does not accept secret from query string", () => {
    const env = { FI_LEGACY_FI_API_ENABLED: "true", FI_LEGACY_FI_API_SECRET: "secret-value" };
    const url = "https://example.com/api/fi/events?FI_LEGACY_FI_API_SECRET=secret-value";
    const r = evaluateLegacyFiApiAccess(new Request(url, { method: "POST", headers: {} }), env);
    assert.ok(r);
    assert.equal(r.status, 401);
  });

  it("safeTimingEqual matches equal strings", () => {
    assert.equal(safeTimingEqual("a", "a"), true);
  });

  it("safeTimingEqual rejects unequal strings", () => {
    assert.equal(safeTimingEqual("a", "b"), false);
  });
});
