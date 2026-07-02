import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildTodaySignalValidationWarnings,
  classifyTodaySignalValidationStatus,
  getTodaySignalValidationChecks,
  summarizeTodaySignalValidationResults,
  type TodaySignalValidationCheckResult,
} from "@/src/lib/fiOs/todaySignal/todaySignalValidationRegistry";

function check(
  checkId: string,
  domain: TodaySignalValidationCheckResult["domain"],
  status: TodaySignalValidationCheckResult["status"],
  message?: string
): TodaySignalValidationCheckResult {
  return { checkId, domain, status, message };
}

const baseFlags = {
  todaySurface: true,
  revisionPolling: true,
  realtimeEnabled: false,
  signalLearning: true,
  workspaceSignalSync: true,
  presenceEngine: true,
};

const baseCounts = {
  todayFeedItemCount: 4,
  workspaceSignalCount: 2,
  presenceSnapshotCount: 1,
  learningEnabled: true,
  revisionEndpointAvailable: true,
};

test("registry exposes D6 validation domains", () => {
  const checks = getTodaySignalValidationChecks();
  assert.ok(checks.length >= 18);
  const domains = new Set(checks.map((entry) => entry.domain));
  assert.ok(domains.has("refresh_behaviour"));
  assert.ok(domains.has("privacy_safety"));
  assert.ok(domains.has("rollout_flag_consistency"));
});

test("validation summary classifies fail if any critical fail exists", () => {
  const results = [
    check("feed.missing_id", "refresh_behaviour", "fail"),
    check("rollout.realtime_polling_fallback", "rollout_flag_consistency", "watch"),
  ];
  assert.equal(classifyTodaySignalValidationStatus(results), "fail");
});

test("validation summary classifies watch if warnings only", () => {
  const results = [
    check("feed.missing_id", "refresh_behaviour", "pass"),
    check("workspace.count_bounded", "workspace_sync", "watch", "Workspace signal count 60 exceeds 50."),
    check("rollout.realtime_polling_fallback", "rollout_flag_consistency", "watch"),
  ];
  assert.equal(classifyTodaySignalValidationStatus(results), "watch");
});

test("validation summary classifies pass when all checks pass", () => {
  const results = [
    check("feed.missing_id", "refresh_behaviour", "pass"),
    check("privacy.forbidden_keys", "privacy_safety", "pass"),
    check("rollout.realtime_polling_fallback", "rollout_flag_consistency", "pass"),
  ];
  assert.equal(classifyTodaySignalValidationStatus(results), "pass");
});

test("realtime disabled with polling enabled is watch, not fail", () => {
  const results = [
    check("feed.missing_id", "refresh_behaviour", "pass"),
    check(
      "rollout.realtime_polling_fallback",
      "rollout_flag_consistency",
      "watch",
      "Realtime is disabled; polling fallback is active."
    ),
  ];
  assert.equal(classifyTodaySignalValidationStatus(results), "watch");
  const warnings = buildTodaySignalValidationWarnings({
    results,
    rolloutFlags: { ...baseFlags, realtimeEnabled: false, revisionPolling: true },
    counts: baseCounts,
  });
  assert.ok(warnings.some((w) => /polling fallback/i.test(w)));
});

test("summarize groups results by domain", () => {
  const results = [
    check("feed.missing_id", "refresh_behaviour", "pass"),
    check("feed.invalid_bucket", "refresh_behaviour", "pass"),
    check("privacy.forbidden_keys", "privacy_safety", "pass"),
  ];
  const grouped = summarizeTodaySignalValidationResults(results);
  assert.equal(grouped.length, 2);
  assert.equal(grouped.find((g) => g.domain === "refresh_behaviour")?.checks.length, 2);
});
