import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildIiohrHrStaffFeedEnvDiagnostics,
  readIiohrHrStaffFeedUrl,
} from "./iiohrHrStaffFeedEnv";

test("readIiohrHrStaffFeedUrl prefers Perth env var", () => {
  const result = readIiohrHrStaffFeedUrl((key) => {
    if (key === "IIOHR_HR_PERTH_STAFF_FEED_URL") return "https://www.iiohr.com/api/hr/evolved-perth/staff-feed\r\n";
    if (key === "IIOHR_HR_STAFF_FEED_URL") return "https://legacy.example/feed";
    return undefined;
  });
  assert.equal(result?.source, "IIOHR_HR_PERTH_STAFF_FEED_URL");
  assert.equal(result?.url, "https://www.iiohr.com/api/hr/evolved-perth/staff-feed");
});

test("readIiohrHrStaffFeedUrl falls back to legacy alias", () => {
  const result = readIiohrHrStaffFeedUrl((key) => {
    if (key === "IIOHR_HR_STAFF_FEED_URL") return "https://legacy.example/feed";
    return undefined;
  });
  assert.equal(result?.source, "IIOHR_HR_STAFF_FEED_URL");
  assert.equal(result?.url, "https://legacy.example/feed");
});

test("buildIiohrHrStaffFeedEnvDiagnostics reports configured feed and cron", () => {
  const diag = buildIiohrHrStaffFeedEnvDiagnostics((key) => {
    const values: Record<string, string> = {
      IIOHR_HR_PERTH_STAFF_FEED_URL: "https://feed.example/staff",
      IIOHR_HR_PERTH_STAFF_FEED_KEY: "secret",
      CRON_SECRET: "0123456789abcdef",
      EVOLVED_PERTH_TENANT_ID: "00000000-0000-4000-8000-000000000001",
    };
    return values[key];
  });
  assert.equal(diag.feedUrlConfigured, true);
  assert.equal(diag.feedKeyConfigured, true);
  assert.equal(diag.cronSecretConfigured, true);
  assert.equal(diag.evolvedPerthTenantIdConfigured, true);
});
