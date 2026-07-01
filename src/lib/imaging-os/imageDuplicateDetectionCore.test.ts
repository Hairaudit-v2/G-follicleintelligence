import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectDuplicateInSessionFingerprints } from "./imageDuplicateDetectionCore";

describe("detectDuplicateInSessionFingerprints", () => {
  it("detects duplicate content hash in same protocol session", () => {
    const result = detectDuplicateInSessionFingerprints({
      candidate: { content_hash: "abc123", protocol_slot_slug: "front_hairline" },
      session_images: [
        {
          image_id: "img-1",
          content_hash: "abc123",
          protocol_slot_slug: "front_hairline",
        },
      ],
    });
    assert.equal(result.duplicate_status, "possible_duplicate");
    assert.equal(result.matched_image_id, "img-1");
  });

  it("does not flag unique uploads in different sessions implicitly", () => {
    const result = detectDuplicateInSessionFingerprints({
      candidate: { content_hash: "new-hash", protocol_slot_slug: "left_temple" },
      session_images: [{ image_id: "img-2", content_hash: "other-hash", protocol_slot_slug: "right_temple" }],
    });
    assert.equal(result.duplicate_status, "unique");
  });

  it("records unknown when no fingerprint data available", () => {
    const result = detectDuplicateInSessionFingerprints({
      candidate: {},
      session_images: [],
    });
    assert.equal(result.duplicate_status, "unknown");
  });
});