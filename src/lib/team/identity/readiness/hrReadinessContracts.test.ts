import assert from "node:assert/strict";
import { test } from "node:test";

import {
  STAFF_HR_SYNC_STALE_DAYS,
  buildStaffHrReadinessLinkedSummary,
  buildStaffHrReadinessNoLinkSummary,
  computeStaffHrOutstandingTaskCount,
  isHrSyncStale,
  resolveHrOnboardingStatus,
} from "@/src/lib/team/identity/readiness/hrReadinessContracts";

const NOW = new Date("2026-06-09T12:00:00.000Z");

test("STAFF_HR_SYNC_STALE_DAYS is fourteen", () => {
  assert.equal(STAFF_HR_SYNC_STALE_DAYS, 14);
});

test("resolveHrOnboardingStatus prefers completed_at", () => {
  assert.equal(resolveHrOnboardingStatus("pending", "2026-01-01T00:00:00.000Z"), "complete");
  assert.equal(resolveHrOnboardingStatus("incomplete", null), "incomplete");
  assert.equal(resolveHrOnboardingStatus("complete", null), "complete");
  assert.equal(resolveHrOnboardingStatus(null, null), "unknown");
});

test("isHrSyncStale respects threshold", () => {
  const staleAt = new Date(
    NOW.getTime() - (STAFF_HR_SYNC_STALE_DAYS + 1) * 86_400_000
  ).toISOString();
  assert.equal(isHrSyncStale(staleAt, NOW), true);
  assert.equal(isHrSyncStale(NOW.toISOString(), NOW), false);
  assert.equal(isHrSyncStale(null, NOW), true);
});

test("no-link readiness summary is empty", () => {
  const s = buildStaffHrReadinessNoLinkSummary();
  assert.equal(s.hasHrLink, false);
  assert.equal(s.outstandingTaskCount, 0);
  assert.equal(s.isSyncStale, false);
});

test("linked readiness aggregates outstanding tasks", () => {
  const s = buildStaffHrReadinessLinkedSummary({
    source_system: "iiohr_hr",
    onboarding_status: "incomplete",
    required_documents_missing_count: 2,
    training_required_count: 1,
    certificates_outstanding_count: 0,
    last_synced_at: NOW.toISOString(),
    now: NOW,
  });
  assert.equal(s.hasHrLink, true);
  assert.equal(s.outstandingTaskCount, 4);
  assert.equal(
    computeStaffHrOutstandingTaskCount({
      onboardingStatus: "incomplete",
      required_documents_missing_count: 2,
      training_required_count: 1,
      certificates_outstanding_count: 0,
    }),
    4
  );
});
