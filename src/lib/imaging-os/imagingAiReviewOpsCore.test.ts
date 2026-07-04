import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildImagingAiReviewOpsJobView,
  canRequeueStaleImagingAiJob,
  canRetryFailedImagingAiJob,
  classifyImagingAiReviewOpsBuckets,
  graftTrayReviewBlocksAiReplay,
  isStaleRunningImagingAiJob,
} from "./imagingAiReviewOpsCore";

const NOW = Date.parse("2026-07-04T12:00:00.000Z");

describe("imagingAiReviewOpsCore", () => {
  it("failed job appears in operator health buckets", () => {
    const buckets = classifyImagingAiReviewOpsBuckets({
      analysisKind: "graft_tray_count_estimate",
      jobStatus: "failed",
      updatedAt: "2026-07-04T11:00:00.000Z",
      provider: "stub",
      graftTrayReviewStatus: "pending_review",
    });
    assert.ok(buckets.includes("failed"));
    assert.ok(buckets.includes("requires_staff_review"));
  });

  it("stale running job is detectable for safe requeue", () => {
    assert.equal(
      isStaleRunningImagingAiJob({
        jobStatus: "running",
        updatedAt: "2026-07-04T11:00:00.000Z",
        nowMs: NOW,
      }),
      true
    );
    const gate = canRequeueStaleImagingAiJob({
      jobStatus: "running",
      updatedAt: "2026-07-04T11:00:00.000Z",
      analysisKind: "graft_tray_count_estimate",
      graftTrayReviewStatus: "pending_review",
      nowMs: NOW,
    });
    assert.equal(gate.allowed, true);
  });

  it("accepted staff-reviewed estimate blocks replay", () => {
    assert.equal(graftTrayReviewBlocksAiReplay("accepted_ai"), true);
    const retry = canRetryFailedImagingAiJob({
      jobStatus: "failed",
      analysisKind: "graft_tray_count_estimate",
      graftTrayReviewStatus: "accepted_ai",
    });
    assert.equal(retry.allowed, false);
    assert.ok(retry.reason?.includes("cannot be overwritten"));
  });

  it("low-confidence pending estimate surfaces warning bucket", () => {
    const view = buildImagingAiReviewOpsJobView({
      tenantId: "tenant-1",
      patientImageId: "img-1",
      patientId: "patient-1",
      snapshot: {
        jobId: "job-1",
        analysisKind: "graft_tray_count_estimate",
        jobStatus: "completed",
        attemptCount: 1,
        lastError: null,
        queuedAt: "2026-07-04T10:00:00.000Z",
        startedAt: "2026-07-04T10:01:00.000Z",
        completedAt: "2026-07-04T10:02:00.000Z",
        updatedAt: "2026-07-04T10:02:00.000Z",
        provider: "stub",
        graftTrayReviewStatus: "pending_review",
        supersedeReason: null,
      },
      estimate: {
        confidence_band: "low",
        image_quality: "marginal",
        review_status: "pending_review",
        provider: "stub",
      },
    });
    assert.ok(view.buckets.includes("low_confidence"));
    assert.ok(view.buckets.includes("completed_awaiting_review"));
  });
});