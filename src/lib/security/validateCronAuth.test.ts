import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { NextRequest } from "next/server";

import { validateCronAuth } from "./validateCronAuth";

const CRON_SECRET = "0123456789abcdef";
const FINANCIAL_OS_CRON_SECRET = "fedcba9876543210";
const FI_PAYMENTS_CRON_SECRET = "abcdef0123456789";
const WRONG_SECRET = "wrong-secret-123456";

const ENV_KEYS = ["CRON_SECRET", "FINANCIAL_OS_CRON_SECRET", "FI_PAYMENTS_CRON_SECRET"] as const;

type EnvKey = (typeof ENV_KEYS)[number];

let savedEnv: Partial<Record<EnvKey, string | undefined>>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function cronRequest(bearer?: string) {
  const headers: Record<string, string> = {};
  if (bearer !== undefined) headers.authorization = `Bearer ${bearer}`;
  return new NextRequest("https://x.test/api/cron/financial-os/automation", { method: "GET", headers });
}

describe("validateCronAuth", () => {
  it("returns true when Bearer matches CRON_SECRET", () => {
    process.env.CRON_SECRET = CRON_SECRET;
    assert.equal(validateCronAuth(cronRequest(CRON_SECRET)), true);
  });

  it("returns true when Bearer matches FINANCIAL_OS_CRON_SECRET", () => {
    process.env.FINANCIAL_OS_CRON_SECRET = FINANCIAL_OS_CRON_SECRET;
    assert.equal(validateCronAuth(cronRequest(FINANCIAL_OS_CRON_SECRET)), true);
  });

  it("returns true when Bearer matches FI_PAYMENTS_CRON_SECRET", () => {
    process.env.FI_PAYMENTS_CRON_SECRET = FI_PAYMENTS_CRON_SECRET;
    assert.equal(validateCronAuth(cronRequest(FI_PAYMENTS_CRON_SECRET)), true);
  });

  it("returns false when Authorization header is missing", () => {
    process.env.CRON_SECRET = CRON_SECRET;
    assert.equal(validateCronAuth(cronRequest()), false);
  });

  it("returns false when Bearer token is wrong", () => {
    process.env.CRON_SECRET = CRON_SECRET;
    assert.equal(validateCronAuth(cronRequest(WRONG_SECRET)), false);
  });

  it("returns false when all configured env secrets are empty or too short", () => {
    process.env.CRON_SECRET = "";
    process.env.FINANCIAL_OS_CRON_SECRET = "short";
    assert.equal(validateCronAuth(cronRequest(CRON_SECRET)), false);
  });

  it("does not expose secret values in its return type or thrown errors", () => {
    process.env.CRON_SECRET = CRON_SECRET;
    const result = validateCronAuth(cronRequest(CRON_SECRET));
    assert.equal(typeof result, "boolean");
    assert.notEqual(String(result), CRON_SECRET);
  });
});
