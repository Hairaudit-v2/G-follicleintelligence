import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSlotImageIds, mergeProgressForSlotCapture, slotIsSatisfied } from "@/src/lib/imagingOs/imagingOsProtocol";
import { assertVieProtocolCapturePolicy } from "./vieCapturePolicy.server";
import { VIE_CAPTURE_POLICY_DEFAULTS } from "./vieCapturePolicy";
import { canAcceptVieCapture, deriveClinicalUsability } from "./vieQualityGate";

describe("VIE capture policy", () => {
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

describe("VIE quality gate", () => {
  const baseIntel = {
    quality_score: 80,
    quality_band: "acceptable" as const,
    focus_verification: { status: "heuristic_pass" as const, blur_score: null, message: "ok" },
    lighting_verification: { status: "heuristic_pass" as const, exposure_score: null, message: "ok" },
    classification: {
      status: "pending_ai" as const,
      expected_slot: "front_hairline",
      expected_region: "hairline",
      message: "pending",
    },
    angle_verification: {
      status: "pending_ai" as const,
      expected_guide: "front_hairline" as const,
      message: "pending",
    },
  };

  it("allows accept for clinically usable capture", () => {
    const clinical = deriveClinicalUsability(baseIntel, VIE_CAPTURE_POLICY_DEFAULTS);
    const decision = canAcceptVieCapture({ clinical, quality_score: 80, policy: VIE_CAPTURE_POLICY_DEFAULTS });
    assert.equal(decision.allowed, true);
    assert.equal(decision.requires_override, false);
  });

  it("blocks low-quality capture when policy disallows override", () => {
    const lowIntel = {
      ...baseIntel,
      quality_score: 40,
      quality_band: "retake_recommended" as const,
      focus_verification: {
        status: "heuristic_fail" as const,
        blur_score: null,
        message: "blurry",
      },
    };
    const clinical = deriveClinicalUsability(lowIntel, VIE_CAPTURE_POLICY_DEFAULTS);
    const decision = canAcceptVieCapture({ clinical, quality_score: 40, policy: VIE_CAPTURE_POLICY_DEFAULTS });
    assert.equal(decision.allowed, false);
    assert.equal(decision.requires_override, true);
  });

  it("allows override when tenant policy permits", () => {
    const policy = { ...VIE_CAPTURE_POLICY_DEFAULTS, allow_quality_override: true };
    const lowIntel = {
      ...baseIntel,
      quality_score: 40,
      quality_band: "retake_recommended" as const,
      focus_verification: {
        status: "heuristic_fail" as const,
        blur_score: null,
        message: "blurry",
      },
    };
    const clinical = deriveClinicalUsability(lowIntel, policy);
    const decision = canAcceptVieCapture({
      clinical,
      quality_score: 40,
      policy,
      quality_override: true,
    });
    assert.equal(decision.allowed, true);
    assert.equal(decision.requires_override, true);
  });

  it("pending slot image does not count as satisfied until accept", () => {
    const progress = {
      __meta__: {
        vie_pending: {
          front_hairline: {
            patient_image_id: "img-pending",
            intelligence_id: "intel-1",
            captured_at: new Date().toISOString(),
            quality_score: 90,
            quality_band: "excellent",
            clinically_usable: true,
          },
        },
      },
    };
    assert.equal(slotIsSatisfied({ slug: "front_hairline", label: "Front", required: true }, progress), false);
    assert.deepEqual(getSlotImageIds(progress, "front_hairline"), []);
  });

  it("retake replace keeps a single slot image id", () => {
    const progress = { front_hairline: ["old-id"] };
    const prev = mergeProgressForSlotCapture.extractPreviousSlotImageIds(progress, "front_hairline");
    assert.deepEqual(prev, ["old-id"]);
    const next = mergeProgressForSlotCapture.apply(progress, "front_hairline", "new-id");
    assert.deepEqual(getSlotImageIds(next, "front_hairline"), ["new-id"]);
  });
});
