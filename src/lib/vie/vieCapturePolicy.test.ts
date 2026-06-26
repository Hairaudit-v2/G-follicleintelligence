import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertVieProtocolCapturePolicy } from "./vieCapturePolicy.server";

describe("assertVieProtocolCapturePolicy", () => {
  it("blocks generic patient profile upload without protocol", () => {
    assert.throws(
      () =>
        assertVieProtocolCapturePolicy({
          captureSource: "patient_profile",
          protocolSessionId: null,
          protocolTemplateSlug: null,
          protocolSlotSlug: null,
        }),
      /active capture protocol/i
    );
  });

  it("allows vie wizard capture with session and slot", () => {
    assert.doesNotThrow(() =>
      assertVieProtocolCapturePolicy({
        captureSource: "vie_capture_wizard",
        protocolSessionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        protocolTemplateSlug: "baseline_consultation",
        protocolSlotSlug: "front_hairline",
      })
    );
  });

  it("allows imaging_os_wizard without extra VIE checks", () => {
    assert.doesNotThrow(() =>
      assertVieProtocolCapturePolicy({
        captureSource: "imaging_os_wizard",
        protocolSessionId: null,
        protocolTemplateSlug: null,
        protocolSlotSlug: null,
      })
    );
  });
});
