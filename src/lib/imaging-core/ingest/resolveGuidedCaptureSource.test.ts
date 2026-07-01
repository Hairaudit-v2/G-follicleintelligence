import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveGuidedCaptureSource } from "./resolveGuidedCaptureSource";

describe("resolveGuidedCaptureSource", () => {
  it("maps surgery_day template to surgery_os for VIE wizard", () => {
    assert.equal(
      resolveGuidedCaptureSource({
        protocolTemplateSlug: "surgery_day",
        explicitCaptureSource: "vie_capture_wizard",
        guidedSurface: "vie",
      }),
      "surgery_os"
    );
  });

  it("maps follow_up_review template to follow_up_outcome for VIE wizard", () => {
    assert.equal(
      resolveGuidedCaptureSource({
        protocolTemplateSlug: "follow_up_review",
        explicitCaptureSource: "vie_capture_wizard",
        guidedSurface: "vie",
      }),
      "follow_up_outcome"
    );
  });

  it("maps follow_up_review template to follow_up_outcome for ImagingOS wizard", () => {
    assert.equal(
      resolveGuidedCaptureSource({
        protocolTemplateSlug: "follow_up_review",
        guidedSurface: "imaging_os",
      }),
      "follow_up_outcome"
    );
  });

  it("preserves appointment_procedure explicit source", () => {
    assert.equal(
      resolveGuidedCaptureSource({
        protocolTemplateSlug: "surgery_day",
        explicitCaptureSource: "appointment_procedure",
        guidedSurface: "vie",
      }),
      "appointment_procedure"
    );
  });

  it("preserves imaging_os_wizard for baseline consultation templates", () => {
    assert.equal(
      resolveGuidedCaptureSource({
        protocolTemplateSlug: "hair_loss_consultation",
        guidedSurface: "imaging_os",
      }),
      "imaging_os_wizard"
    );
    assert.equal(
      resolveGuidedCaptureSource({
        protocolTemplateSlug: "baseline_consultation",
        guidedSurface: "imaging_os",
      }),
      "imaging_os_wizard"
    );
  });

  it("preserves explicit surgery_os from SurgeryOS panel", () => {
    assert.equal(
      resolveGuidedCaptureSource({
        protocolTemplateSlug: "surgery_day",
        explicitCaptureSource: "surgery_os",
        guidedSurface: "vie",
      }),
      "surgery_os"
    );
  });
});