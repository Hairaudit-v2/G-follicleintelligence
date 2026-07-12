/**
 * FI-PIPELINE-STABILITY-DEPLOY-GATE — build identity resolver.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { pickBuildEnvironment, pickBuildSha, shortBuildSha } from "@/src/lib/fi-os/buildIdentity";

test("pickBuildSha prefers VERCEL_GIT_COMMIT_SHA, then NEXT_PUBLIC, then GITHUB_SHA", () => {
  assert.equal(
    pickBuildSha({ VERCEL_GIT_COMMIT_SHA: "abc", NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: "def", GITHUB_SHA: "ghi" }),
    "abc"
  );
  assert.equal(pickBuildSha({ NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: "def", GITHUB_SHA: "ghi" }), "def");
  assert.equal(pickBuildSha({ GITHUB_SHA: "ghi" }), "ghi");
});

test("pickBuildSha returns null when no deployment SHA (never fabricated)", () => {
  assert.equal(pickBuildSha({}), null);
  assert.equal(pickBuildSha({ VERCEL_GIT_COMMIT_SHA: "  " }), null);
  // package.json version must never be a source.
  assert.equal(pickBuildSha({ npm_package_version: "1.2.3" }), null);
});

test("pickBuildEnvironment reads VERCEL_ENV / NEXT_PUBLIC_VERCEL_ENV else null", () => {
  assert.equal(pickBuildEnvironment({ VERCEL_ENV: "preview" }), "preview");
  assert.equal(pickBuildEnvironment({ NEXT_PUBLIC_VERCEL_ENV: "production" }), "production");
  assert.equal(pickBuildEnvironment({}), null);
  assert.equal(pickBuildEnvironment({ VERCEL_ENV: "" }), null);
});

test("shortBuildSha truncates to 8 or reports unavailable", () => {
  assert.equal(shortBuildSha("87f6fc3d9bdc612c51dfeb43"), "87f6fc3d");
  assert.equal(shortBuildSha(null), "unavailable");
  assert.equal(shortBuildSha("   "), "unavailable");
});
