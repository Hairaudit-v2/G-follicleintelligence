import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  IMAGING_QUALITY_POLICY_DEFAULTS,
  parseImagingQualityPolicy,
  parseImagingQualityPolicyFromTenantMetadata,
} from "./imageQualityPolicy";
import { shouldBlockUploadForImagingQuality } from "./imageQualityCore";

describe("imaging quality tenant policy", () => {
  it("uses safe defaults", () => {
    assert.deepEqual(parseImagingQualityPolicy(null), IMAGING_QUALITY_POLICY_DEFAULTS);
    assert.equal(IMAGING_QUALITY_POLICY_DEFAULTS.block_upload_on_poor_quality, false);
    assert.equal(IMAGING_QUALITY_POLICY_DEFAULTS.minimum_quality_score, 70);
  });

  it("parses tenant metadata imaging_quality block", () => {
    const parsed = parseImagingQualityPolicyFromTenantMetadata({
      imaging_quality: {
        block_upload_on_poor_quality: true,
        minimum_quality_score: 85,
      },
    });
    assert.equal(parsed.block_upload_on_poor_quality, true);
    assert.equal(parsed.minimum_quality_score, 85);
  });

  it("does not block when policy disabled", () => {
    assert.equal(
      shouldBlockUploadForImagingQuality({
        evaluation: { status: "fail", qualityScore: 20 },
        policy: { ...IMAGING_QUALITY_POLICY_DEFAULTS, block_upload_on_poor_quality: false },
        protocol_context: { capture_source: "hairaudit", slot_required: true, is_audit_context: true },
      }),
      false
    );
  });
});