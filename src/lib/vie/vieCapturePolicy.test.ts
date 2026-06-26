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

  it("blocks surgery_os upload without protocol session", () => {
    assert.throws(
      () =>
        assertVieProtocolCapturePolicy({
          captureSource: "surgery_os",
          protocolSessionId: null,
          protocolTemplateSlug: "surgery_day",
          protocolSlotSlug: "graft_tray_overview",
        }),
      /active capture protocol/i
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
