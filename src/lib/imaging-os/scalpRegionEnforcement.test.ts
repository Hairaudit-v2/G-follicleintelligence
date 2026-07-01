import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateScalpRegionCompliance } from "./scalpRegionEnforcement";

describe("scalpRegionEnforcement", () => {
  it("donor image with region passes protocol capture", () => {
    const result = evaluateScalpRegionCompliance({
      captureSource: "vie_capture_wizard",
      protocolSessionId: "sess-1",
      protocolSlotSlug: "donor",
      anatomicalRegion: "donor",
    });
    assert.equal(result.passes, true);
    assert.equal(result.reviewRequired, false);
  });

  it("donor image without region creates review flag", () => {
    const result = evaluateScalpRegionCompliance({
      captureSource: "vie_capture_wizard",
      protocolSessionId: "sess-1",
      protocolSlotSlug: "donor",
      anatomicalRegion: null,
      hasRegionLink: false,
    });
    assert.equal(result.passes, false);
    assert.equal(result.reviewRequired, true);
    assert.ok(result.reasons.some((r) => r.includes("donor")));
  });

  it("recipient image with region passes", () => {
    const result = evaluateScalpRegionCompliance({
      captureSource: "appointment_procedure",
      protocolSessionId: "sess-2",
      protocolSlotSlug: "recipient_midscalp",
      anatomicalRegion: "midscalp",
    });
    assert.equal(result.passes, true);
    assert.equal(result.reviewRequired, false);
  });

  it("recipient image without region creates review flag", () => {
    const result = evaluateScalpRegionCompliance({
      captureSource: "surgery_os",
      protocolSessionId: "sess-3",
      protocolSlotSlug: "recipient_crown",
      anatomicalRegion: null,
    });
    assert.equal(result.passes, false);
    assert.equal(result.reviewRequired, true);
    assert.ok(result.reasons.some((r) => r.includes("recipient")));
  });

  it("historical image without protocol session is unaffected", () => {
    const result = evaluateScalpRegionCompliance({
      captureSource: "unknown",
      protocolSessionId: null,
      protocolSlotSlug: null,
      viewType: "donor",
      anatomicalRegion: null,
    });
    assert.equal(result.passes, true);
    assert.equal(result.reviewRequired, false);
    assert.deepEqual(result.reasons, []);
  });

  it("region link satisfies donor requirement", () => {
    const result = evaluateScalpRegionCompliance({
      captureSource: "vie_capture_wizard",
      protocolSessionId: "sess-4",
      protocolSlotSlug: "donor_close",
      hasRegionLink: true,
    });
    assert.equal(result.passes, true);
  });

  it("admin fallback missing region is flagged", () => {
    const result = evaluateScalpRegionCompliance({
      captureSource: "appointment_procedure_admin_fallback",
      protocolSessionId: "sess-5",
      protocolSlotSlug: "donor",
      isAdminFallback: true,
    });
    assert.equal(result.reviewRequired, true);
    assert.ok(result.reasons.includes("admin_fallback_missing_region"));
  });
});