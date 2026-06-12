import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isFiAdminApiKeyMatch } from "./crmGatePolicy";
import { extractFiAdminKeyFromRequestParts, isAdminKeyQueryAllowed } from "./fiAdminKeyTransport";

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("isAdminKeyQueryAllowed", () => {
  it("blocks query in production even when flag is set", () => {
    assert.equal(
      isAdminKeyQueryAllowed({ NODE_ENV: "production", FI_ALLOW_ADMIN_KEY_QUERY: "true" }),
      false
    );
  });

  it("defaults to false in development when flag missing", () => {
    assert.equal(isAdminKeyQueryAllowed({ NODE_ENV: "development" }), false);
  });

  it("allows in non-production when flag affirmative", () => {
    assert.equal(
      isAdminKeyQueryAllowed({ NODE_ENV: "development", FI_ALLOW_ADMIN_KEY_QUERY: "yes" }),
      true
    );
  });
});

describe("extractFiAdminKeyFromRequestParts", () => {
  const secret = "test-admin-key-32chars-minimum!!";

  it("rejects query adminKey in production", () => {
    const sp = new URLSearchParams({ adminKey: secret });
    const out = extractFiAdminKeyFromRequestParts({
      urlSearchParams: sp,
      headers: headers({}),
      configuredApiKey: secret,
      env: { NODE_ENV: "production" },
    });
    assert.equal(out, undefined);
  });

  it("accepts x-fi-admin-key in production", () => {
    const sp = new URLSearchParams({ adminKey: "ignored" });
    const out = extractFiAdminKeyFromRequestParts({
      urlSearchParams: sp,
      headers: headers({ "x-fi-admin-key": secret }),
      configuredApiKey: secret,
      env: { NODE_ENV: "production" },
    });
    assert.equal(out, secret);
  });

  it("accepts Authorization Bearer admin key in production when token matches configured key", () => {
    const sp = new URLSearchParams();
    const out = extractFiAdminKeyFromRequestParts({
      urlSearchParams: sp,
      headers: headers({ authorization: `Bearer ${secret}` }),
      configuredApiKey: secret,
      env: { NODE_ENV: "production" },
    });
    assert.equal(out, secret);
  });

  it("rejects query adminKey in development by default", () => {
    const sp = new URLSearchParams({ adminKey: secret });
    const out = extractFiAdminKeyFromRequestParts({
      urlSearchParams: sp,
      headers: headers({}),
      configuredApiKey: secret,
      env: { NODE_ENV: "development" },
    });
    assert.equal(out, undefined);
  });

  it("accepts query adminKey in development only with FI_ALLOW_ADMIN_KEY_QUERY", () => {
    const sp = new URLSearchParams({ adminKey: secret });
    const out = extractFiAdminKeyFromRequestParts({
      urlSearchParams: sp,
      headers: headers({}),
      configuredApiKey: secret,
      env: { NODE_ENV: "development", FI_ALLOW_ADMIN_KEY_QUERY: "true" },
    });
    assert.equal(out, secret);
  });

  it("does not treat Bearer as admin key when it does not match configured key", () => {
    const out = extractFiAdminKeyFromRequestParts({
      urlSearchParams: new URLSearchParams(),
      headers: headers({ authorization: "Bearer not-the-admin-key" }),
      configuredApiKey: secret,
      env: { NODE_ENV: "production" },
    });
    assert.equal(out, undefined);
  });

  it("falls back to JSON body adminKey", () => {
    const out = extractFiAdminKeyFromRequestParts({
      urlSearchParams: new URLSearchParams(),
      headers: headers({}),
      body: { adminKey: secret },
      configuredApiKey: secret,
      env: { NODE_ENV: "production" },
    });
    assert.equal(out, secret);
  });
});

describe("isFiAdminApiKeyMatch", () => {
  it("empty configured key does not authenticate", () => {
    assert.equal(isFiAdminApiKeyMatch("x", ""), false);
    assert.equal(isFiAdminApiKeyMatch("x", undefined), false);
    assert.equal(isFiAdminApiKeyMatch("x", "   "), false);
  });

  it("empty candidate does not authenticate", () => {
    assert.equal(isFiAdminApiKeyMatch("", "secret"), false);
    assert.equal(isFiAdminApiKeyMatch(undefined, "secret"), false);
    assert.equal(isFiAdminApiKeyMatch("   ", "secret"), false);
  });
});
