import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeIiohrHrStaffSyncHealth,
  parseStaffSyncStaleWarningHours,
  type StaffSyncRunHealthRef,
} from "@/src/lib/hr/iiohrHrStaffSyncHealth";

const TENANT = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-06-10T12:00:00.000Z").getTime();

function cronRun(p: Partial<StaffSyncRunHealthRef> & Pick<StaffSyncRunHealthRef, "status" | "started_at">): StaffSyncRunHealthRef {
  return {
    finished_at: null,
    error_message: null,
    metadata: { trigger: "cron" },
    ...p,
  };
}

test("healthy cron sync", () => {
  const h = computeIiohrHrStaffSyncHealth({
    evolvedTenantId: TENANT,
    runs: [
      cronRun({
        status: "success",
        started_at: "2026-06-10T10:00:00.000Z",
        finished_at: "2026-06-10T10:00:05.000Z",
      }),
    ],
    staleWarningHours: 48,
    nowMs: NOW,
  });
  assert.equal(h.ok, true);
  assert.equal(h.stale, false);
  assert.equal(h.recent_failure_count, 0);
  assert.ok(h.last_success_at);
});

test("stale sync when last cron success is older than threshold", () => {
  const h = computeIiohrHrStaffSyncHealth({
    evolvedTenantId: TENANT,
    runs: [
      cronRun({
        status: "success",
        started_at: "2026-06-01T10:00:00.000Z",
        finished_at: "2026-06-01T10:00:01.000Z",
      }),
    ],
    staleWarningHours: 48,
    nowMs: NOW,
  });
  assert.equal(h.stale, true);
  assert.equal(h.ok, false);
});

test("latest failed cron exposes last_error", () => {
  const h = computeIiohrHrStaffSyncHealth({
    evolvedTenantId: TENANT,
    runs: [
      cronRun({
        status: "failed",
        started_at: "2026-06-10T11:00:00.000Z",
        finished_at: "2026-06-10T11:00:02.000Z",
        error_message: "Planner validation failed.",
      }),
      cronRun({
        status: "success",
        started_at: "2026-06-09T10:00:00.000Z",
        finished_at: "2026-06-09T10:00:01.000Z",
      }),
    ],
    staleWarningHours: 48,
    nowMs: NOW,
  });
  assert.equal(h.ok, false);
  assert.ok(h.last_error?.includes("Planner"));
});

test("recent_failure_count counts failed cron rows in window", () => {
  const h = computeIiohrHrStaffSyncHealth({
    evolvedTenantId: TENANT,
    runs: [
      cronRun({ status: "failed", started_at: "2026-06-10T09:00:00.000Z", error_message: "a" }),
      cronRun({ status: "failed", started_at: "2026-06-09T09:00:00.000Z", error_message: "b" }),
      cronRun({ status: "success", started_at: "2026-06-08T09:00:00.000Z", finished_at: "2026-06-08T09:01:00.000Z" }),
    ],
    staleWarningHours: 48,
    nowMs: NOW,
  });
  assert.equal(h.recent_failure_count, 2);
});

test("missing env tenant yields not ok and descriptive last_error", () => {
  const h = computeIiohrHrStaffSyncHealth({
    evolvedTenantId: null,
    runs: [],
    staleWarningHours: parseStaffSyncStaleWarningHours(() => undefined),
    nowMs: NOW,
  });
  assert.equal(h.ok, false);
  assert.equal(h.stale, true);
  assert.ok(h.last_error?.includes("EVOLVED_PERTH_TENANT_ID"));
});

test("parseStaffSyncStaleWarningHours respects env", () => {
  assert.equal(parseStaffSyncStaleWarningHours((k) => (k === "STAFF_SYNC_STALE_WARNING_HOURS" ? "72" : undefined)), 72);
  assert.equal(parseStaffSyncStaleWarningHours((k) => (k === "STAFF_SYNC_STALE_WARNING_HOURS" ? "0" : undefined)), 48);
});
