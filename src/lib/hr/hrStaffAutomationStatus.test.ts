import assert from "node:assert/strict";
import { test } from "node:test";

import { buildHrStaffAutomationStatus } from "@/src/lib/hr/hrStaffAutomationStatus";

const TENANT = "00000000-0000-4000-8000-000000000001";

test("automation stale warning when last success is older than threshold", () => {
  const now = new Date("2026-06-10T12:00:00.000Z").getTime();
  const old = "2026-06-01T10:00:00.000Z";
  const a = buildHrStaffAutomationStatus({
    pageTenantId: TENANT,
    recentRuns: [
      {
        status: "success",
        started_at: old,
        finished_at: old,
        error_message: null,
        metadata: { trigger: "cron" },
      },
    ],
    getEnv: (k) =>
      ({
        CRON_SECRET: "0123456789abcdef0123456789abcdef",
        EVOLVED_PERTH_TENANT_ID: TENANT,
        FI_BASE_URL: "https://fi.example",
        IIOHR_HR_SYNC_SECRET: "x",
        IIOHR_HR_PERTH_STAFF_FEED_URL: "https://hr.example/feed",
        STAFF_SYNC_STALE_WARNING_HOURS: "48",
      })[k],
    nowMs: now,
  });
  assert.ok(a.staleSyncWarning?.includes("48"));
});

test("automation finds last cron vs producer runs", () => {
  const a = buildHrStaffAutomationStatus({
    pageTenantId: TENANT,
    recentRuns: [
      {
        status: "success",
        started_at: "2026-06-09T12:00:00.000Z",
        finished_at: "2026-06-09T12:01:00.000Z",
        error_message: null,
        metadata: { trigger: "cron" },
      },
      {
        status: "success",
        started_at: "2026-06-08T12:00:00.000Z",
        finished_at: "2026-06-08T12:01:00.000Z",
        error_message: null,
        metadata: { channel: "api" },
      },
    ],
    getEnv: (k) =>
      ({
        CRON_SECRET: "0123456789abcdef0123456789abcdef",
        EVOLVED_PERTH_TENANT_ID: TENANT,
        FI_BASE_URL: "https://fi.example",
        IIOHR_HR_SYNC_SECRET: "x",
        IIOHR_HR_PERTH_STAFF_FEED_URL: "https://hr.example/feed",
      })[k],
    nowMs: new Date("2026-06-09T15:00:00.000Z").getTime(),
  });
  assert.equal(a.lastCronRun?.metadata.trigger, "cron");
  assert.ok(!a.lastProducerApiRun?.metadata.trigger);
});
