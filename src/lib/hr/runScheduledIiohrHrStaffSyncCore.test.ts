import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  PushStaffSyncToFiInput,
  PushStaffSyncToFiResult,
} from "@/src/lib/hr/iiohrFiStaffSyncClient";
import { runScheduledIiohrHrStaffSyncCore } from "@/src/lib/hr/runScheduledIiohrHrStaffSyncCore";
import type { IiohrHrPortalStaffRecord } from "@/src/lib/hr/iiohrFiStaffSyncMapper";

const TENANT = "00000000-0000-4000-8000-000000000001";

test("core blocks empty feed by default", async () => {
  const r = await runScheduledIiohrHrStaffSyncCore({
    tenantId: TENANT,
    allowEmptyFeed: false,
    loadHrStaff: async () => [],
    pushFi: async () => {
      throw new Error("push should not run");
    },
  });
  assert.equal(r.ok, false);
  assert.ok(r.error?.includes("refusing sync"));
  assert.equal(r.rowsSent, 0);
});

test("core allows empty feed when ALLOW_EMPTY_HR_SYNC behaviour (allowEmpty true)", async () => {
  const r = await runScheduledIiohrHrStaffSyncCore({
    tenantId: TENANT,
    allowEmptyFeed: true,
    loadHrStaff: async () => [],
    pushFi: async () => {
      throw new Error("push should not run");
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.rowsSent, 0);
  assert.equal(r.runId, null);
  assert.ok(r.warnings.some((w) => w.includes("ALLOW_EMPTY_HR_SYNC")));
});

test("core returns FI runId on successful push", async () => {
  const r = await runScheduledIiohrHrStaffSyncCore({
    tenantId: TENANT,
    allowEmptyFeed: false,
    loadHrStaff: async (): Promise<IiohrHrPortalStaffRecord[]> => [
      { external_staff_id: "E-1", full_name: "A", email: "a@example.com" },
    ],
    pushFi: async (input: PushStaffSyncToFiInput): Promise<PushStaffSyncToFiResult> => {
      assert.equal(input.mode, "commit");
      assert.equal(input.confirm, true);
      assert.equal(input.syncTrigger, "cron");
      return {
        httpStatus: 200,
        ok: true,
        runId: "run-from-test",
        rowsSent: 1,
        raw: {
          ok: true,
          runId: "run-from-test",
          summary: {
            warnings: [],
            skippedRowCount: 0,
            counts: { createdCount: 2, updatedCount: 1, linkedCount: 0, raw: {} },
          },
        },
      };
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.runId, "run-from-test");
  assert.equal(r.rowsSent, 1);
  assert.equal(r.created, 2);
});

test("core scrubs sync secret from push error messages", async () => {
  const secret = "sync-secret-never-leak-123";
  const r = await runScheduledIiohrHrStaffSyncCore({
    tenantId: TENANT,
    allowEmptyFeed: false,
    loadHrStaff: async () => [{ external_staff_id: "E-1", full_name: "A" }],
    pushFi: async () => {
      throw new Error(`denied ${secret}`);
    },
    syncSecretForScrub: secret,
  });
  assert.equal(r.ok, false);
  assert.ok(r.error?.includes("[redacted]"));
  assert.ok(!r.error?.includes(secret));
});
