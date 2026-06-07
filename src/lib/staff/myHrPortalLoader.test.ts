import assert from "node:assert/strict";
import { test } from "node:test";

/**
 * HR portal URL resolution for `loadMyHrPortalPage` (see `myHrPortalLoader.server.ts`).
 * Auth and `fi_staff` linkage (`no_staff_profile`, `no_tenant_membership`) are enforced in the loader with DB access;
 * these tests cover the source-id URL contract only.
 */
import { isAllowedHrPortalUrl, pickHrPortalFromSourceIds } from "./myHrPortalSelection";

test("isAllowedHrPortalUrl accepts http(s) only", () => {
  assert.equal(isAllowedHrPortalUrl("https://hr.example/onboarding"), true);
  assert.equal(isAllowedHrPortalUrl("http://legacy.example/"), true);
  assert.equal(isAllowedHrPortalUrl("javascript:alert(1)"), false);
  assert.equal(isAllowedHrPortalUrl("ftp://files.example/x"), false);
  assert.equal(isAllowedHrPortalUrl(""), false);
  assert.equal(isAllowedHrPortalUrl(null), false);
});

test("linked staff with iiohr_hr URL", () => {
  const r = pickHrPortalFromSourceIds([
    { source_system: "iiohr_hr", source_url: "https://hr.example/me" },
  ]);
  assert.equal(r.hasHrLink, true);
  assert.equal(r.hrPortalUrl, "https://hr.example/me");
  assert.equal(r.sourceSystem, "iiohr_hr");
});

test("linked staff with no HR URL (no matching safe link)", () => {
  const r = pickHrPortalFromSourceIds([{ source_system: "iiohr_academy", source_url: "https://academy.example" }]);
  assert.equal(r.hasHrLink, false);
  assert.equal(r.hrPortalUrl, null);
  assert.equal(r.sourceSystem, null);
});

test("linked staff with recognised tiers but no rows yields no link", () => {
  assert.deepEqual(pickHrPortalFromSourceIds([]), {
    hasHrLink: false,
    hrPortalUrl: null,
    sourceSystem: null,
  });
});

test("invalid source_url is ignored", () => {
  const r = pickHrPortalFromSourceIds([
    { source_system: "iiohr_hr", source_url: "javascript:void(0)" },
    { source_system: "hr", source_url: "https://hr.example/ok" },
  ]);
  assert.equal(r.hasHrLink, true);
  assert.equal(r.hrPortalUrl, "https://hr.example/ok");
  assert.equal(r.sourceSystem, "hr");
});

test("source_system priority: iiohr_hr over iiohr over hr", () => {
  const a = pickHrPortalFromSourceIds([
    { source_system: "hr", source_url: "https://hr-only.example" },
    { source_system: "iiohr", source_url: "https://iiohr.example" },
    { source_system: "iiohr_hr", source_url: "https://iiohr-hr.example" },
  ]);
  assert.deepEqual(a, {
    hasHrLink: true,
    hrPortalUrl: "https://iiohr-hr.example",
    sourceSystem: "iiohr_hr",
  });

  const b = pickHrPortalFromSourceIds([
    { source_system: "hr", source_url: "https://hr.example" },
    { source_system: "iiohr", source_url: "https://iiohr.example" },
  ]);
  assert.deepEqual(b, { hasHrLink: true, hrPortalUrl: "https://iiohr.example", sourceSystem: "iiohr" });

  const c = pickHrPortalFromSourceIds([{ source_system: "hr", source_url: "https://generic-hr.example" }]);
  assert.deepEqual(c, { hasHrLink: true, hrPortalUrl: "https://generic-hr.example", sourceSystem: "hr" });
});

test("iiohr_hr with bad URL falls through to next tier", () => {
  const r = pickHrPortalFromSourceIds([
    { source_system: "iiohr_hr", source_url: "javascript:evil()" },
    { source_system: "iiohr", source_url: "https://fallback.example" },
  ]);
  assert.deepEqual(r, { hasHrLink: true, hrPortalUrl: "https://fallback.example", sourceSystem: "iiohr" });
});

test("iiohr_hr row with empty URL falls through to lower tier", () => {
  const r = pickHrPortalFromSourceIds([
    { source_system: "iiohr_hr", source_url: "   " },
    { source_system: "hr", source_url: "https://hr.example/only" },
  ]);
  assert.deepEqual(r, { hasHrLink: true, hrPortalUrl: "https://hr.example/only", sourceSystem: "hr" });
});

test("normalises source_system case", () => {
  const r = pickHrPortalFromSourceIds([{ source_system: "  IIOHR_HR  ", source_url: "https://x" }]);
  assert.equal(r.sourceSystem, "iiohr_hr");
  assert.equal(r.hrPortalUrl, "https://x");
});
