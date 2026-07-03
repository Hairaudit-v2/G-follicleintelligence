import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assessGraftTrayCaptureGate,
  deriveGraftTrayReviewReasons,
  isGraftTrayCapture,
  parseRequireGraftTrayCaptureFlag,
} from "./imagingGraftTrayBridgeCore";
import { collectImagingReviewReasons } from "./clinicalImageAnalysisCore";

describe("imagingGraftTrayBridgeCore", () => {
  it("detects graft tray captures by slot, category, or region", () => {
    assert.equal(isGraftTrayCapture({ protocolSlotSlug: "graft_tray" }), true);
    assert.equal(isGraftTrayCapture({ imageCategory: "graft_tray" }), true);
    assert.equal(isGraftTrayCapture({ anatomicalRegion: "graft_tray" }), true);
    assert.equal(isGraftTrayCapture({ protocolSlotSlug: "donor" }), false);
  });

  it("derives graft tray reconciliation review reasons", () => {
    const reasons = deriveGraftTrayReviewReasons({
      reviewRequired: true,
      reconciliationEvidenceRequired: true,
      qualityNeedsReview: true,
      missingProtocolSlot: true,
    });
    assert.ok(reasons.includes("graft_tray_missing_protocol_slot"));
    assert.ok(reasons.includes("graft_tray_reconciliation_evidence_required"));
    assert.ok(reasons.includes("graft_tray_quality_review"));
  });

  it("blocks reconciliation only when feature flag is enabled", () => {
    assert.equal(
      assessGraftTrayCaptureGate({ trayImageCount: 0, requireTrayCapture: false }),
      null
    );
    const blocked = assessGraftTrayCaptureGate({ trayImageCount: 0, requireTrayCapture: true });
    assert.ok(blocked?.includes("graft tray photo"));
  });

  it("parses FI_IMAGING_REQUIRE_GRAFT_TRAY_CAPTURE flag", () => {
    assert.equal(parseRequireGraftTrayCaptureFlag({}), false);
    assert.equal(
      parseRequireGraftTrayCaptureFlag({ FI_IMAGING_REQUIRE_GRAFT_TRAY_CAPTURE: "true" }),
      true
    );
  });

  it("collectImagingReviewReasons includes graft tray reconciliation reasons", () => {
    const reasons = collectImagingReviewReasons({
      graftTrayReviewReasons: ["graft_tray_reconciliation_evidence_required"],
    });
    assert.ok(reasons.includes("graft_tray_reconciliation_evidence_required"));
  });
});