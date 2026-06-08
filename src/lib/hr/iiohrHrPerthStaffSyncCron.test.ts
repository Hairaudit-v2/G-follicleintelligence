import assert from "node:assert/strict";
import { test } from "node:test";

import type { ScheduledIiohrHrStaffSyncCoreResult } from "@/src/lib/hr/runScheduledIiohrHrStaffSyncCore";
import { handleIiohrHrPerthStaffSyncCronPost } from "@/src/lib/hr/iiohrHrPerthStaffSyncCron";

const CRON = "0123456789abcdef"; // 16 chars
const TENANT = "00000000-0000-4000-8000-000000000001";

function envMap(m: Record<string, string | undefined>): (k: string) => string | undefined {
  return (k) => m[k];
}

test("cron rejects missing CRON_SECRET configuration", async () => {
  const res = await handleIiohrHrPerthStaffSyncCronPost(
    new Request("https://fi.example/api/cron", {
      method: "POST",
      headers: { authorization: "Bearer anything" },
    }),
    {
      getEnv: envMap({ EVOLVED_PERTH_TENANT_ID: TENANT }),
      runScheduled: async () => ({ ok: true, rowsSent: 0, runId: null, created: null, updated: null, linked: null, skipped: null, warnings: [] }),
    }
  );
  assert.equal(res.status, 503);
});

test("cron rejects missing Authorization", async () => {
  const res = await handleIiohrHrPerthStaffSyncCronPost(
    new Request("https://fi.example/api/cron", { method: "POST" }),
    {
      getEnv: envMap({ CRON_SECRET: CRON, EVOLVED_PERTH_TENANT_ID: TENANT }),
      runScheduled: async () => ({ ok: true, rowsSent: 0, runId: null, created: null, updated: null, linked: null, skipped: null, warnings: [] }),
    }
  );
  assert.equal(res.status, 401);
});

test("cron rejects invalid Authorization", async () => {
  const res = await handleIiohrHrPerthStaffSyncCronPost(
    new Request("https://fi.example/api/cron", {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret-123456" },
    }),
    {
      getEnv: envMap({ CRON_SECRET: CRON, EVOLVED_PERTH_TENANT_ID: TENANT }),
      runScheduled: async () => ({ ok: true, rowsSent: 0, runId: null, created: null, updated: null, linked: null, skipped: null, warnings: [] }),
    }
  );
  assert.equal(res.status, 401);
});

test("cron rejects missing EVOLVED_PERTH_TENANT_ID", async () => {
  const res = await handleIiohrHrPerthStaffSyncCronPost(
    new Request("https://fi.example/api/cron", {
      method: "POST",
      headers: { authorization: `Bearer ${CRON}` },
    }),
    {
      getEnv: envMap({ CRON_SECRET: CRON }),
      runScheduled: async () => ({ ok: true, rowsSent: 0, runId: null, created: null, updated: null, linked: null, skipped: null, warnings: [] }),
    }
  );
  assert.equal(res.status, 503);
});

test("cron rejects invalid EVOLVED_PERTH_TENANT_ID", async () => {
  const res = await handleIiohrHrPerthStaffSyncCronPost(
    new Request("https://fi.example/api/cron", {
      method: "POST",
      headers: { authorization: `Bearer ${CRON}` },
    }),
    {
      getEnv: envMap({ CRON_SECRET: CRON, EVOLVED_PERTH_TENANT_ID: "not-a-uuid" }),
      runScheduled: async () => ({ ok: true, rowsSent: 0, runId: null, created: null, updated: null, linked: null, skipped: null, warnings: [] }),
    }
  );
  assert.equal(res.status, 503);
});

test("cron returns 400 when scheduled run refuses empty feed", async () => {
  const body: ScheduledIiohrHrStaffSyncCoreResult = {
    ok: false,
    error: "HR staff feed returned no rows; refusing sync (set ALLOW_EMPTY_HR_SYNC=true to allow no-op).",
    rowsSent: 0,
    runId: null,
    created: null,
    updated: null,
    linked: null,
    skipped: null,
    warnings: [],
  };
  const res = await handleIiohrHrPerthStaffSyncCronPost(
    new Request("https://fi.example/api/cron", {
      method: "POST",
      headers: { authorization: `Bearer ${CRON}` },
    }),
    {
      getEnv: envMap({ CRON_SECRET: CRON, EVOLVED_PERTH_TENANT_ID: TENANT }),
      runScheduled: async () => body,
    }
  );
  assert.equal(res.status, 400);
  const j = (await res.json()) as { ok: boolean };
  assert.equal(j.ok, false);
});

test("cron returns 200 for empty-feed no-op when allowed", async () => {
  const res = await handleIiohrHrPerthStaffSyncCronPost(
    new Request("https://fi.example/api/cron", {
      method: "POST",
      headers: { authorization: `Bearer ${CRON}` },
    }),
    {
      getEnv: envMap({ CRON_SECRET: CRON, EVOLVED_PERTH_TENANT_ID: TENANT }),
      runScheduled: async () => ({
        ok: true,
        rowsSent: 0,
        runId: null,
        created: null,
        updated: null,
        linked: null,
        skipped: null,
        warnings: ["No HR rows from feed; sync skipped (ALLOW_EMPTY_HR_SYNC)."],
      }),
    }
  );
  assert.equal(res.status, 200);
});

test("successful cron returns FI runId in JSON", async () => {
  const res = await handleIiohrHrPerthStaffSyncCronPost(
    new Request("https://fi.example/api/cron", {
      method: "POST",
      headers: { authorization: `Bearer ${CRON}` },
    }),
    {
      getEnv: envMap({ CRON_SECRET: CRON, EVOLVED_PERTH_TENANT_ID: TENANT }),
      runScheduled: async () => ({
        ok: true,
        rowsSent: 3,
        runId: "uuid-run-1",
        created: 1,
        updated: 2,
        linked: 0,
        skipped: 0,
        warnings: [],
      }),
    }
  );
  assert.equal(res.status, 200);
  const j = (await res.json()) as { ok: boolean; runId: string; rowsSent: number };
  assert.equal(j.ok, true);
  assert.equal(j.runId, "uuid-run-1");
  assert.equal(j.rowsSent, 3);
});

test("cron 500 response does not echo shared secrets from thrown errors", async () => {
  const leak = "never-leak-this-cron-secret-xyz";
  const res = await handleIiohrHrPerthStaffSyncCronPost(
    new Request("https://fi.example/api/cron", {
      method: "POST",
      headers: { authorization: `Bearer ${CRON}` },
    }),
    {
      getEnv: envMap({ CRON_SECRET: CRON, EVOLVED_PERTH_TENANT_ID: TENANT }),
      runScheduled: async () => {
        throw new Error(`internal ${leak} oops`);
      },
    }
  );
  assert.equal(res.status, 500);
  const text = await res.text();
  assert.ok(!text.includes(leak));
});
