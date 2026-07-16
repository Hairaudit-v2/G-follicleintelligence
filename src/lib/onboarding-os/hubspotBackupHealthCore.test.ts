import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HUBSPOT_INCREMENTAL_STUCK_AGE_MS } from "./hubspotIncrementalBackupCore";
import {
  deriveHubspotBackupHealth,
  lastExpectedDailyBrisbaneRunUtc,
  redactHubspotBackupHealthForLowRole,
  HUBSPOT_BACKUP_HEALTH_GRACE_MS,
  type HubspotBackupHealthRunInput,
} from "./hubspotBackupHealthCore";
import { nextDailyBrisbaneRunUtc } from "./hubspotScheduledIncrementalBackupCore";

function successRun(
  overrides: Partial<HubspotBackupHealthRunInput> = {}
): HubspotBackupHealthRunInput {
  return {
    runId: "run-success",
    status: "completed",
    verificationState: "passed",
    cutoffFrom: "2026-07-16T03:20:00.000Z",
    cutoffTo: "2026-07-16T03:45:02.366Z",
    startedAt: "2026-07-16T03:45:02.366Z",
    completedAt: "2026-07-16T03:45:10.000Z",
    emptyRange: false,
    outcome: "success",
    counters: {
      discovered: 1,
      inRange: 1,
      inserted: 1,
      updated: 0,
      unchanged: 0,
      failed: 0,
    },
    ...overrides,
  };
}

/** 2026-07-16T10:00:00.000Z — after P3 run, before next 16:00 UTC window. */
const NOW_WITHIN_WINDOW = Date.parse("2026-07-16T10:00:00.000Z");

describe("hubspotBackupHealthCore", () => {
  it("1. completed + verified + watermark match = Healthy", () => {
    const health = deriveHubspotBackupHealth({
      nowMs: NOW_WITHIN_WINDOW,
      schedulerEnabled: true,
      scheduleConfigured: true,
      watermarkTimestamp: "2026-07-16T03:45:02.366Z",
      latestRun: successRun(),
      activeRun: null,
      latestRelevantAlert: null,
    });
    assert.equal(health.status, "healthy");
    assert.equal(health.reasonCode, "verified_success");
    assert.equal(health.operatorActionRequired, false);
  });

  it("2. empty_success + verified + watermark match = Healthy", () => {
    const health = deriveHubspotBackupHealth({
      nowMs: NOW_WITHIN_WINDOW,
      schedulerEnabled: true,
      scheduleConfigured: true,
      watermarkTimestamp: "2026-07-16T03:45:02.366Z",
      latestRun: successRun({ emptyRange: true, outcome: "empty_success", counters: {
        discovered: 0, inRange: 0, inserted: 0, updated: 0, unchanged: 0, failed: 0,
      }}),
      activeRun: null,
      latestRelevantAlert: null,
    });
    assert.equal(health.status, "healthy");
    assert.equal(health.reasonCode, "empty_success");
  });

  it("3. failed latest run = Failed", () => {
    const health = deriveHubspotBackupHealth({
      nowMs: NOW_WITHIN_WINDOW,
      schedulerEnabled: true,
      scheduleConfigured: true,
      watermarkTimestamp: "2026-07-16T03:20:00.000Z",
      latestRun: successRun({
        status: "failed",
        verificationState: "failed",
        outcome: "failure",
      }),
      activeRun: null,
      latestRelevantAlert: null,
    });
    assert.equal(health.status, "failed");
    assert.ok(["run_failed", "verification_failed"].includes(health.reasonCode));
  });

  it("4. verification failed = Failed", () => {
    const health = deriveHubspotBackupHealth({
      nowMs: NOW_WITHIN_WINDOW,
      schedulerEnabled: true,
      scheduleConfigured: true,
      watermarkTimestamp: "2026-07-16T03:20:00.000Z",
      latestRun: successRun({
        status: "completed",
        verificationState: "failed",
      }),
      activeRun: null,
      latestRelevantAlert: null,
    });
    assert.equal(health.status, "failed");
    assert.equal(health.reasonCode, "verification_failed");
  });

  it("5. partial latest run = Needs review", () => {
    const health = deriveHubspotBackupHealth({
      nowMs: NOW_WITHIN_WINDOW,
      schedulerEnabled: true,
      scheduleConfigured: true,
      watermarkTimestamp: "2026-07-16T03:20:00.000Z",
      latestRun: successRun({ status: "partial", verificationState: "pending", outcome: "partial" }),
      activeRun: null,
      latestRelevantAlert: null,
    });
    assert.equal(health.status, "needs_review");
    assert.equal(health.reasonCode, "run_partial");
  });

  it("6. verification pending = Needs review", () => {
    const health = deriveHubspotBackupHealth({
      nowMs: NOW_WITHIN_WINDOW,
      schedulerEnabled: true,
      scheduleConfigured: true,
      watermarkTimestamp: "2026-07-16T03:20:00.000Z",
      latestRun: successRun({ status: "completed", verificationState: "pending" }),
      activeRun: null,
      latestRelevantAlert: null,
    });
    assert.equal(health.status, "needs_review");
    assert.equal(health.reasonCode, "verification_pending");
  });

  it("7. scheduler disabled = Needs review", () => {
    const health = deriveHubspotBackupHealth({
      nowMs: NOW_WITHIN_WINDOW,
      schedulerEnabled: false,
      scheduleConfigured: true,
      watermarkTimestamp: "2026-07-16T03:45:02.366Z",
      latestRun: successRun(),
      activeRun: null,
      latestRelevantAlert: null,
    });
    assert.equal(health.status, "needs_review");
    assert.equal(health.reasonCode, "scheduler_disabled");
  });

  it("8. overdue expected run = Needs review", () => {
    // After 16:00 UTC + 2h grace on 2026-07-16, last verified at 03:45 does not cover the window.
    const nowMs = Date.parse("2026-07-16T19:00:00.000Z");
    const health = deriveHubspotBackupHealth({
      nowMs,
      schedulerEnabled: true,
      scheduleConfigured: true,
      watermarkTimestamp: "2026-07-16T03:45:02.366Z",
      latestRun: successRun(),
      activeRun: null,
      latestRelevantAlert: null,
    });
    assert.equal(health.status, "needs_review");
    assert.equal(health.reasonCode, "expected_run_overdue");
  });

  it("9. stuck active run = Failed", () => {
    const startedAt = new Date(NOW_WITHIN_WINDOW - HUBSPOT_INCREMENTAL_STUCK_AGE_MS - 60_000).toISOString();
    const health = deriveHubspotBackupHealth({
      nowMs: NOW_WITHIN_WINDOW,
      schedulerEnabled: true,
      scheduleConfigured: true,
      watermarkTimestamp: "2026-07-16T03:20:00.000Z",
      latestRun: successRun({
        completedAt: "2026-07-16T03:20:00.000Z",
        cutoffTo: "2026-07-16T03:20:00.000Z",
      }),
      activeRun: successRun({
        runId: "stuck",
        status: "started",
        verificationState: "pending",
        startedAt,
        completedAt: null,
        lastCheckpointAt: startedAt,
      }),
      latestRelevantAlert: null,
    });
    assert.equal(health.status, "failed");
    assert.equal(health.reasonCode, "stuck_active_run");
  });

  it("10. watermark mismatch = Failed", () => {
    const health = deriveHubspotBackupHealth({
      nowMs: NOW_WITHIN_WINDOW,
      schedulerEnabled: true,
      scheduleConfigured: true,
      watermarkTimestamp: "2026-07-16T03:20:00.000Z",
      latestRun: successRun(),
      activeRun: null,
      latestRelevantAlert: null,
    });
    assert.equal(health.status, "failed");
    assert.equal(health.reasonCode, "watermark_mismatch");
  });

  it("11. resolved old alert does not override later success", () => {
    const health = deriveHubspotBackupHealth({
      nowMs: NOW_WITHIN_WINDOW,
      schedulerEnabled: true,
      scheduleConfigured: true,
      watermarkTimestamp: "2026-07-16T03:45:02.366Z",
      latestRun: successRun(),
      activeRun: null,
      latestRelevantAlert: {
        id: "a1",
        eventType: "hubspot_incremental_backup_failed",
        severity: "high",
        status: "open",
        createdAt: "2026-07-16T02:00:00.000Z",
        runId: "old-run",
      },
    });
    assert.equal(health.status, "healthy");
  });

  it("12. recent unresolved failure alert affects state", () => {
    const health = deriveHubspotBackupHealth({
      nowMs: NOW_WITHIN_WINDOW,
      schedulerEnabled: true,
      scheduleConfigured: true,
      watermarkTimestamp: "2026-07-16T03:45:02.366Z",
      latestRun: successRun(),
      activeRun: null,
      latestRelevantAlert: {
        id: "a2",
        eventType: "hubspot_incremental_backup_failed",
        severity: "high",
        status: "open",
        createdAt: "2026-07-16T04:00:00.000Z",
        runId: "later",
      },
    });
    assert.equal(health.status, "failed");
    assert.equal(health.reasonCode, "unresolved_failure_alert");
  });

  it("13. no runs = Needs review", () => {
    const health = deriveHubspotBackupHealth({
      nowMs: NOW_WITHIN_WINDOW,
      schedulerEnabled: true,
      scheduleConfigured: true,
      watermarkTimestamp: "2026-07-16T03:45:02.366Z",
      latestRun: null,
      activeRun: null,
      latestRelevantAlert: null,
    });
    assert.equal(health.status, "needs_review");
    assert.equal(health.reasonCode, "no_runs");
  });

  it("14. missing watermark = Needs review", () => {
    const health = deriveHubspotBackupHealth({
      nowMs: NOW_WITHIN_WINDOW,
      schedulerEnabled: true,
      scheduleConfigured: true,
      watermarkTimestamp: null,
      latestRun: successRun(),
      activeRun: null,
      latestRelevantAlert: null,
    });
    assert.equal(health.status, "needs_review");
    assert.equal(health.reasonCode, "missing_watermark");
  });

  it("15. source query error never yields Healthy", () => {
    const health = deriveHubspotBackupHealth({
      nowMs: NOW_WITHIN_WINDOW,
      schedulerEnabled: true,
      scheduleConfigured: true,
      watermarkTimestamp: "2026-07-16T03:45:02.366Z",
      latestRun: successRun(),
      activeRun: null,
      latestRelevantAlert: null,
      sourceError: { code: "query_error", message: "db down" },
    });
    assert.notEqual(health.status, "healthy");
    assert.equal(health.status, "failed");
  });

  it("16. severity precedence Failed > Needs review > Healthy", () => {
    const health = deriveHubspotBackupHealth({
      nowMs: NOW_WITHIN_WINDOW,
      schedulerEnabled: true,
      scheduleConfigured: true,
      watermarkTimestamp: "2026-07-16T03:45:02.366Z",
      latestRun: successRun({ status: "partial", verificationState: "pending" }),
      activeRun: successRun({
        runId: "stuck",
        status: "started",
        verificationState: "pending",
        startedAt: new Date(NOW_WITHIN_WINDOW - HUBSPOT_INCREMENTAL_STUCK_AGE_MS - 1).toISOString(),
        completedAt: null,
        lastCheckpointAt: new Date(NOW_WITHIN_WINDOW - HUBSPOT_INCREMENTAL_STUCK_AGE_MS - 1).toISOString(),
      }),
      latestRelevantAlert: null,
    });
    assert.equal(health.status, "failed");
  });

  it("17–18. Brisbane schedule and next expected run calculation", () => {
    const from = new Date("2026-07-16T10:00:00.000Z");
    assert.equal(nextDailyBrisbaneRunUtc(from), "2026-07-16T16:00:00.000Z");
    assert.equal(lastExpectedDailyBrisbaneRunUtc(from), "2026-07-15T16:00:00.000Z");
    const after = new Date("2026-07-16T16:00:01.000Z");
    assert.equal(nextDailyBrisbaneRunUtc(after), "2026-07-17T16:00:00.000Z");
    assert.equal(lastExpectedDailyBrisbaneRunUtc(after), "2026-07-16T16:00:00.000Z");
    assert.ok(HUBSPOT_BACKUP_HEALTH_GRACE_MS >= 60 * 60 * 1000);
  });

  it("19. low-role redaction hides technical fields", () => {
    const health = deriveHubspotBackupHealth({
      nowMs: NOW_WITHIN_WINDOW,
      schedulerEnabled: true,
      scheduleConfigured: true,
      watermarkTimestamp: "2026-07-16T03:45:02.366Z",
      latestRun: successRun(),
      activeRun: null,
      latestRelevantAlert: null,
    });
    const redacted = redactHubspotBackupHealthForLowRole(health);
    assert.equal(redacted.status, "healthy");
    assert.equal(redacted.latestRun?.runId, "");
    assert.equal(redacted.latestRun?.cutoffFrom, null);
    assert.equal(redacted.watermark.value, null);
    assert.equal(redacted.latestRelevantAlert, null);
  });

  it("20. tenant isolation fail-closed via sourceError", () => {
    const health = deriveHubspotBackupHealth({
      nowMs: NOW_WITHIN_WINDOW,
      schedulerEnabled: true,
      scheduleConfigured: true,
      watermarkTimestamp: null,
      latestRun: null,
      activeRun: null,
      latestRelevantAlert: null,
      sourceError: { code: "tenant_missing", message: "missing" },
    });
    assert.equal(health.status, "needs_review");
    assert.equal(health.reasonCode, "tenant_missing");
    assert.notEqual(health.status, "healthy");
  });
});
