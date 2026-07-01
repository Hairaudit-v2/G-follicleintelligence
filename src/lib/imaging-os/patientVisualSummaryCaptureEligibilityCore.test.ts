import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isPatientVisualSummaryEligibleCaptureImage,
  imageMatchesVisualSummaryPhotoSlot,
} from "./patientVisualSummaryCaptureEligibilityCore";

describe("patientVisualSummaryCaptureEligibilityCore", () => {
  it("matches summary-eligible post-op capture", () => {
    const img = {
      ai_image_category: null,
      anatomical_region: null,
      image_category: "post_op" as const,
      imaging_protocol_slot_slug: "immediate_post_op",
      follow_up_interval: null,
    };
    assert.equal(isPatientVisualSummaryEligibleCaptureImage(img), true);
    assert.equal(imageMatchesVisualSummaryPhotoSlot(img, "immediate_post_op"), true);
  });

  it("rejects non-summary clinical image", () => {
    const img = {
      ai_image_category: null,
      anatomical_region: null,
      image_category: "consult" as const,
      imaging_protocol_slot_slug: "front_profile",
      follow_up_interval: null,
    };
    assert.equal(isPatientVisualSummaryEligibleCaptureImage(img), false);
  });
});