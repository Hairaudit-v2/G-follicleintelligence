import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isTodayRealtimeEnabledForTenant,
  isTodaySignalRevisionPollEnabled,
  TODAY_REALTIME_SUBSCRIPTION_PLAN,
} from "@/src/lib/fiOs/todaySignal/todayRealtimePlan";

test("TODAY_REALTIME_SUBSCRIPTION_PLAN covers low-risk operational tables", () => {
  const tables = TODAY_REALTIME_SUBSCRIPTION_PLAN.map((s) => s.table);
  assert.ok(tables.includes("fi_bookings"));
  assert.ok(tables.includes("fi_payment_records"));
  assert.ok(tables.includes("fi_pathology_results"));
});

test("isTodayRealtimeEnabledForTenant respects allowlist", () => {
  const prevEnabled = process.env.FI_TODAY_REALTIME_ENABLED;
  const prevIds = process.env.FI_TODAY_REALTIME_TENANT_IDS;
  process.env.FI_TODAY_REALTIME_ENABLED = "false";
  process.env.FI_TODAY_REALTIME_TENANT_IDS = "11111111-1111-1111-1111-111111111111";
  assert.equal(isTodayRealtimeEnabledForTenant("11111111-1111-1111-1111-111111111111"), true);
  assert.equal(isTodayRealtimeEnabledForTenant("22222222-2222-2222-2222-222222222222"), false);
  if (prevEnabled === undefined) delete process.env.FI_TODAY_REALTIME_ENABLED;
  else process.env.FI_TODAY_REALTIME_ENABLED = prevEnabled;
  if (prevIds === undefined) delete process.env.FI_TODAY_REALTIME_TENANT_IDS;
  else process.env.FI_TODAY_REALTIME_TENANT_IDS = prevIds;
});

test("isTodaySignalRevisionPollEnabled parses env", () => {
  const prev = process.env.FI_TODAY_SIGNAL_REVISION_POLL;
  process.env.FI_TODAY_SIGNAL_REVISION_POLL = "true";
  assert.equal(isTodaySignalRevisionPollEnabled(), true);
  if (prev === undefined) delete process.env.FI_TODAY_SIGNAL_REVISION_POLL;
  else process.env.FI_TODAY_SIGNAL_REVISION_POLL = prev;
});
