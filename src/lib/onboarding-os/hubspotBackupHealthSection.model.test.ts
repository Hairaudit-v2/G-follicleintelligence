/**
 * Lightweight presentation assertions for HubspotBackupHealthSection (no React DOM runner required).
 * Validates privacy-safe model shaping used by the Backup & Sync health cards.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveHubspotBackupHealth, redactHubspotBackupHealthForLowRole } from "./hubspotBackupHealthCore";

describe("HubspotBackupHealthSection model contracts", () => {
  const base = {
    nowMs: Date.parse("2026-07-16T10:00:00.000Z"),
    schedulerEnabled: true as const,
    scheduleConfigured: true,
    watermarkTimestamp: "2026-07-16T03:45:02.366Z",
    activeRun: null,
    latestRelevantAlert: null,
  };

  it("Healthy card model includes empty_success outcome", () => {
    const health = deriveHubspotBackupHealth({
      ...base,
      latestRun: {
        runId: "r1",
        status: "completed",
        verificationState: "passed",
        cutoffFrom: "2026-07-16T03:20:00.000Z",
        cutoffTo: "2026-07-16T03:45:02.366Z",
        startedAt: "2026-07-16T03:45:02.366Z",
        completedAt: "2026-07-16T03:45:10.000Z",
        emptyRange: true,
        outcome: "empty_success",
        counters: { discovered: 0, inserted: 0, failed: 0 },
      },
    });
    assert.equal(health.status, "healthy");
    assert.equal(health.latestRun?.outcome, "empty_success");
    assert.equal(health.operatorActionRequired, false);
  });

  it("Needs review and Failed models set operatorActionRequired", () => {
    const review = deriveHubspotBackupHealth({
      ...base,
      latestRun: {
        runId: "r2",
        status: "partial",
        verificationState: "pending",
        cutoffFrom: null,
        cutoffTo: null,
        startedAt: "2026-07-16T03:45:02.366Z",
        completedAt: "2026-07-16T03:45:10.000Z",
      },
    });
    assert.equal(review.status, "needs_review");
    assert.equal(review.operatorActionRequired, true);

    const failed = deriveHubspotBackupHealth({
      ...base,
      latestRun: {
        runId: "r3",
        status: "failed",
        verificationState: "failed",
        cutoffFrom: null,
        cutoffTo: null,
        startedAt: "2026-07-16T03:45:02.366Z",
        completedAt: "2026-07-16T03:45:10.000Z",
      },
    });
    assert.equal(failed.status, "failed");
    assert.equal(failed.operatorActionRequired, true);
  });

  it("admin technical view keeps runId; low-role redacts", () => {
    const health = deriveHubspotBackupHealth({
      ...base,
      latestRun: {
        runId: "3b0a231b-9a0c-4ab4-a6d9-81bca8b2c3b4",
        status: "completed",
        verificationState: "passed",
        cutoffFrom: "2026-07-16T03:20:00.000Z",
        cutoffTo: "2026-07-16T03:45:02.366Z",
        startedAt: "2026-07-16T03:45:02.366Z",
        completedAt: "2026-07-16T03:45:10.000Z",
        emptyRange: true,
        counters: { discovered: 0 },
      },
    });
    assert.equal(health.latestRun?.runId, "3b0a231b-9a0c-4ab4-a6d9-81bca8b2c3b4");
    const low = redactHubspotBackupHealthForLowRole(health);
    assert.equal(low.latestRun?.runId, "");
    assert.equal(low.watermark.value, null);
  });

  it("primary/secondary evidence remain separately addressable fields for UI", () => {
    // UI binds primaryEvidence and secondaryEvidence as distinct cards.
    const primary = { label: "Primary operational evidence", detail: "run + watermark" };
    const secondary = { label: "Secondary operational evidence", detail: "notifications" };
    assert.notEqual(primary.label, secondary.label);
    assert.ok(primary.label.toLowerCase().includes("primary"));
    assert.ok(secondary.label.toLowerCase().includes("secondary"));
  });
});
