import assert from "node:assert/strict";
import { test } from "node:test";

import { NextRequest } from "next/server";

import { assertCronAuthorized, CronEnvError, getRequiredEnv } from "@/src/lib/server/cronAuth";

const SECRET = "0123456789abcdef"; // 16 chars

test("assertCronAuthorized returns 401 when no bearer or alternate header", () => {
  const res = assertCronAuthorized(new NextRequest("https://x.test/api/cron", { method: "GET" }), [SECRET]);
  assert.ok(res);
  assert.equal(res.status, 401);
});

test("assertCronAuthorized returns 401 when bearer wrong", () => {
  const res = assertCronAuthorized(
    new NextRequest("https://x.test/api/cron", {
      method: "GET",
      headers: { authorization: "Bearer wrong-secret-123456" },
    }),
    [SECRET]
  );
  assert.ok(res);
  assert.equal(res.status, 401);
});

test("assertCronAuthorized returns null when bearer matches", () => {
  const res = assertCronAuthorized(
    new NextRequest("https://x.test/api/cron", {
      method: "GET",
      headers: { authorization: `Bearer ${SECRET}` },
    }),
    [SECRET]
  );
  assert.equal(res, null);
});

test("assertCronAuthorized accepts alternate timing-safe header", () => {
  const res = assertCronAuthorized(
    new NextRequest("https://x.test/api/cron", {
      method: "GET",
      headers: { "x-fi-reminder-secret": SECRET },
    }),
    [SECRET],
    { alternateTimingSafeHeaderName: "x-fi-reminder-secret" }
  );
  assert.equal(res, null);
});

test("assertCronAuthorized returns 503 when no valid-length secrets configured", () => {
  const res = assertCronAuthorized(
    new NextRequest("https://x.test/api/cron", {
      headers: { authorization: `Bearer ${SECRET}` },
    }),
    ["", "short"]
  );
  assert.ok(res);
  assert.equal(res.status, 503);
});

test("assertCronAuthorized accepts any of multiple secrets", () => {
  const other = "fedcba9876543210"; // 16 chars
  const res = assertCronAuthorized(
    new NextRequest("https://x.test/api/cron", {
      headers: { authorization: `Bearer ${other}` },
    }),
    [SECRET, other]
  );
  assert.equal(res, null);
});

test("getRequiredEnv throws CronEnvError when missing", () => {
  const prev = process.env.CRON_AUTH_TEST_VAR___;
  delete process.env.CRON_AUTH_TEST_VAR___;
  assert.throws(() => getRequiredEnv("CRON_AUTH_TEST_VAR___"), (e: unknown) => e instanceof CronEnvError);
  if (prev !== undefined) process.env.CRON_AUTH_TEST_VAR___ = prev;
});

test("getRequiredEnv returns trimmed value", () => {
  const prev = process.env.CRON_AUTH_TEST_VAR___;
  process.env.CRON_AUTH_TEST_VAR___ = "  hello  ";
  assert.equal(getRequiredEnv("CRON_AUTH_TEST_VAR___"), "hello");
  if (prev === undefined) delete process.env.CRON_AUTH_TEST_VAR___;
  else process.env.CRON_AUTH_TEST_VAR___ = prev;
});
