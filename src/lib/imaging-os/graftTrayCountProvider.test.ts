import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isGraftTrayCapture } from "./imagingGraftTrayBridgeCore";
import {
  buildStubGraftTrayCountEstimate,
  compareGraftTrayAiEstimate,
  parseGraftTrayAiFeatureFlags,
  resolveManualGraftCountFromEvents,
} from "./graftTrayCountProviderCore";
import { mapReviewActionToStatus } from "./graftTrayCountProviderCore";
import { redactMetadataForPatientExport } from "./patientSafeImagingExportCore";
import { collectImagingReviewReasons } from "./clinicalImageAnalysisCore";

const IMAGE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("graftTrayCountProviderCore", () => {
  it("feature flags default to safe off + stub provider", () => {
    const flags = parseGraftTrayAiFeatureFlags({});
    assert.equal(flags.enabled, false);
    assert.equal(flags.provider, "stub");
    assert.equal(flags.tolerancePercent, 5);
  });

  it("only graft_tray captures qualify for estimate jobs", () => {
    assert.equal(isGraftTrayCapture({ protocolSlotSlug: "graft_tray" }), true);
    assert.equal(isGraftTrayCapture({ protocolSlotSlug: "donor" }), false);
    assert.equal(isGraftTrayCapture({ imageCategory: "front" }), false);
  });

  it("stub provider returns deterministic estimate", () => {
    const a = buildStubGraftTrayCountEstimate({ imageId: IMAGE_ID, manualCount: 100 });
    const b = buildStubGraftTrayCountEstimate({ imageId: IMAGE_ID, manualCount: 100 });
    assert.equal(a.estimated_graft_count, b.estimated_graft_count);
    assert.equal(a.provider, "stub");
    assert.ok(a.assessable);
  });

  it("compares within tolerance band", () => {
    const estimate = buildStubGraftTrayCountEstimate({ imageId: IMAGE_ID, manualCount: 100 });
    const manual = {
      manual_count: estimate.estimated_graft_count,
      manual_count_source: "confirmed_tray_latest" as const,
      graft_count_event_id: "evt-1",
      graft_session_id: "sess-1",
    };
    const comparison = compareGraftTrayAiEstimate({ estimate, manual, tolerancePercent: 5 });
    assert.equal(comparison.mismatch_band, "within_tolerance");
  });

  it("flags material mismatch when delta exceeds tolerance", () => {
    const estimate = buildStubGraftTrayCountEstimate({ imageId: IMAGE_ID, manualCount: 100 });
    const manual = {
      manual_count: 50,
      manual_count_source: "confirmed_tray_latest" as const,
      graft_count_event_id: "evt-1",
      graft_session_id: "sess-1",
    };
    const comparison = compareGraftTrayAiEstimate({ estimate, manual, tolerancePercent: 5 });
    assert.equal(comparison.mismatch_band, "material_mismatch");
    assert.ok(comparison.review_reasons.includes("graft_tray_ai_material_mismatch"));
  });

  it("handles manual count missing", () => {
    const estimate = buildStubGraftTrayCountEstimate({ imageId: IMAGE_ID });
    const comparison = compareGraftTrayAiEstimate({
      estimate,
      manual: {
        manual_count: null,
        manual_count_source: "missing",
        graft_count_event_id: null,
        graft_session_id: null,
      },
    });
    assert.equal(comparison.mismatch_band, "manual_count_missing");
  });

  it("resolves manual count from latest confirmed tray event", () => {
    const manual = resolveManualGraftCountFromEvents({
      graftSessionId: "sess-1",
      events: [
        {
          id: "e1",
          eventType: "tray_count",
          reviewStatus: "confirmed",
          singles: 10,
          doubles: 5,
          triples: 0,
          multiples: 0,
          createdAt: "2026-06-01T10:00:00Z",
        },
        {
          id: "e2",
          eventType: "tray_count",
          reviewStatus: "confirmed",
          singles: 20,
          doubles: 0,
          triples: 0,
          multiples: 0,
          createdAt: "2026-06-01T12:00:00Z",
        },
      ],
    });
    assert.equal(manual.manual_count, 20);
    assert.equal(manual.manual_count_source, "confirmed_tray_latest");
    assert.equal(manual.graft_count_event_id, "e2");
  });

  it("maps review actions to statuses", () => {
    assert.equal(mapReviewActionToStatus("accept_ai_estimate"), "accepted_ai");
    assert.equal(mapReviewActionToStatus("correct_count"), "corrected");
    assert.equal(mapReviewActionToStatus("request_retake"), "retake_requested");
  });

  it("collectImagingReviewReasons includes graft tray AI reasons", () => {
    const reasons = collectImagingReviewReasons({
      graftTrayReviewReasons: ["graft_tray_ai_count_needs_review", "graft_tray_ai_manual_mismatch"],
    });
    assert.ok(reasons.includes("graft_tray_ai_count_needs_review"));
    assert.ok(reasons.includes("graft_tray_ai_manual_mismatch"));
  });

  it("patient-safe export redacts graft tray AI metadata", () => {
    const redacted = redactMetadataForPatientExport({
      graft_tray_ai_estimate: { estimated_graft_count: 120 },
      graft_tray_ai_estimate_id: "est-1",
      graft_tray_review_reasons: ["graft_tray_ai_count_needs_review"],
      capture_source: "surgery_os",
    });
    assert.equal(redacted.graft_tray_ai_estimate, undefined);
    assert.equal(redacted.graft_tray_ai_estimate_id, undefined);
    assert.equal(redacted.graft_tray_review_reasons, undefined);
    assert.equal(redacted.capture_source, "surgery_os");
  });
});
