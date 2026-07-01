import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAutoRegenMetadata,
  mergeAutoRegenMetadata,
  readAutoRegenMetadata,
  shouldAutoRegenerateVisualSummary,
} from "./patientVisualSummaryAutoRegenCore";
import { defaultPatientVisualSummaryApproval } from "./patientVisualSummaryApprovalCore";

describe("patientVisualSummaryAutoRegenCore", () => {
  it("regenerates when draft or missing approval", () => {
    const draft = defaultPatientVisualSummaryApproval("surgery_post_op_summary");
    assert.equal(shouldAutoRegenerateVisualSummary(draft), true);
    assert.equal(shouldAutoRegenerateVisualSummary(null), true);
  });

  it("preserves approved summary", () => {
    const approved = {
      ...defaultPatientVisualSummaryApproval("surgery_post_op_summary"),
      status: "approved" as const,
      approved_by: "staff-1",
      approved_at: "2026-07-01T00:00:00.000Z",
    };
    assert.equal(shouldAutoRegenerateVisualSummary(approved), false);
  });

  it("records auto-regen metadata", () => {
    const meta = mergeAutoRegenMetadata(
      {},
      buildAutoRegenMetadata({
        trigger: "graft_reconciled",
        source: "surgeryos",
        regenerated: true,
        triggeredAt: "2026-07-02T10:00:00.000Z",
      })
    );
    const read = readAutoRegenMetadata(meta);
    assert.equal(read?.trigger, "graft_reconciled");
    assert.equal(read?.regenerated, true);
    assert.equal(read?.source, "surgeryos");
  });

  it("records preserved approved flag", () => {
    const meta = mergeAutoRegenMetadata(
      {},
      buildAutoRegenMetadata({
        trigger: "post_op_capture",
        source: "imagingos",
        regenerated: false,
        preservedApproved: true,
      })
    );
    assert.equal(readAutoRegenMetadata(meta)?.preserved_approved, true);
  });
});