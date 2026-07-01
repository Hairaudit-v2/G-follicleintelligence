import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateImagingQuality,
  isAuditCaptureContext,
  shouldBlockUploadForImagingQuality,
} from "./imageQualityCore";
import { IMAGING_QUALITY_POLICY_DEFAULTS } from "./imageQualityPolicy";

describe("evaluateImagingQuality", () => {
  it("passes a clear well-formed capture", () => {
    const result = evaluateImagingQuality({
      image_metadata: {
        width: 1920,
        height: 1080,
        size_bytes: 500_000,
        content_type: "image/jpeg",
      },
      server_heuristic: {
        sharpness_score: 82,
        blur_status: "clear",
        exposure_status: "normal",
      },
      duplicate_signal: { duplicate_status: "unique" },
      protocol_context: {
        capture_source: "vie_capture_wizard",
        slot_required: true,
      },
    });
    assert.equal(result.status, "pass");
    assert.equal(result.shouldBlockUpload, false);
    assert.ok(result.qualityScore >= 70);
  });

  it("marks blurred captures for review", () => {
    const result = evaluateImagingQuality({
      image_metadata: { width: 1280, height: 720, size_bytes: 300_000, content_type: "image/jpeg" },
      server_heuristic: { blur_status: "blurred", sharpness_score: 20, exposure_status: "normal" },
      protocol_context: { capture_source: "vie_capture_wizard", slot_required: true },
    });
    assert.equal(result.status, "review");
    assert.match(result.retakePrompt ?? "", /blurred/i);
  });

  it("flags duplicate captures in the same session", () => {
    const result = evaluateImagingQuality({
      image_metadata: { width: 1280, height: 720, size_bytes: 300_000, content_type: "image/jpeg" },
      server_heuristic: { blur_status: "clear", exposure_status: "normal" },
      duplicate_signal: { duplicate_status: "possible_duplicate" },
      protocol_context: { capture_source: "appointment_procedure", slot_required: true },
    });
    assert.ok(result.reasons.some((r) => r.startsWith("duplicate")));
    assert.match(result.retakePrompt ?? "", /similar/i);
  });

  it("blocks audit-required views only when policy enabled", () => {
    const evaluation = evaluateImagingQuality({
      image_metadata: { width: 400, height: 300, size_bytes: 40_000, content_type: "image/jpeg" },
      server_heuristic: { blur_status: "blurred", exposure_status: "underexposed" },
      protocol_context: {
        capture_source: "hairaudit",
        slot_required: true,
        is_audit_context: true,
      },
      policy: {
        ...IMAGING_QUALITY_POLICY_DEFAULTS,
        block_upload_on_poor_quality: true,
        minimum_quality_score: 80,
      },
    });
    assert.equal(evaluation.status, "fail");
    assert.equal(
      shouldBlockUploadForImagingQuality({
        evaluation,
        policy: {
          ...IMAGING_QUALITY_POLICY_DEFAULTS,
          block_upload_on_poor_quality: true,
        },
        protocol_context: { capture_source: "hairaudit", slot_required: true, is_audit_context: true },
      }),
      true
    );
  });

  it("allows non-audit optional view with warning when block_only_audit_required_views", () => {
    const evaluation = evaluateImagingQuality({
      image_metadata: { width: 400, height: 300, size_bytes: 40_000, content_type: "image/jpeg" },
      server_heuristic: { blur_status: "blurred", exposure_status: "underexposed" },
      protocol_context: {
        capture_source: "vie_capture_wizard",
        slot_required: false,
      },
      policy: {
        ...IMAGING_QUALITY_POLICY_DEFAULTS,
        block_upload_on_poor_quality: true,
      },
    });
    assert.equal(evaluation.status, "fail");
    assert.equal(
      shouldBlockUploadForImagingQuality({
        evaluation,
        policy: {
          ...IMAGING_QUALITY_POLICY_DEFAULTS,
          block_upload_on_poor_quality: true,
          block_only_audit_required_views: true,
        },
        protocol_context: { capture_source: "vie_capture_wizard", slot_required: false },
      }),
      false
    );
  });
});

describe("isAuditCaptureContext", () => {
  it("detects hairaudit and required protocol slots as audit contexts", () => {
    assert.equal(isAuditCaptureContext({ capture_source: "hairaudit" }), true);
    assert.equal(
      isAuditCaptureContext({
        capture_source: "appointment_procedure",
        slot_required: true,
      }),
      true
    );
    assert.equal(
      isAuditCaptureContext({ capture_source: "appointment_procedure_admin_fallback" }),
      false
    );
  });
});