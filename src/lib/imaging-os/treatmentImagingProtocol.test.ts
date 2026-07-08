import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTreatmentImagingCompletionState,
  isDutasterideMesotherapyBooking,
  isRegenerativeTreatmentBookingType,
  isSurgeryBookingType,
  requiresTreatmentPhotosChecklist,
  resolveTreatmentTypeLabel,
  TREATMENT_IMAGING_PROTOCOL_SLUG,
  TREATMENT_IMAGING_REQUIRED_VIEW_SLUGS,
  treatmentImagingProtocolSlots,
} from "./treatmentImagingProtocol";
import { mergeProgressForSlotCapture } from "@/src/lib/imagingOs/imagingOsProtocol";
import {
  evaluateTreatmentImagingCompletionPolicy,
  parseClinicSettingsFromMetadata,
} from "./treatmentImagingCompletionPolicy";

describe("treatment imaging protocol — booking detection", () => {
  it("requires checklist for PRP, exosomes, and mesotherapy", () => {
    assert.equal(requiresTreatmentPhotosChecklist("prp"), true);
    assert.equal(requiresTreatmentPhotosChecklist("exosomes"), true);
    assert.equal(requiresTreatmentPhotosChecklist("mesotherapy"), true);
    assert.equal(isRegenerativeTreatmentBookingType("prp"), true);
    assert.equal(isRegenerativeTreatmentBookingType("exosomes"), true);
  });

  it("detects dutasteride mesotherapy from booking text", () => {
    assert.equal(
      isDutasterideMesotherapyBooking("mesotherapy", { title: "Dutasteride mesotherapy session" }),
      true
    );
    assert.equal(
      requiresTreatmentPhotosChecklist("mesotherapy", {
        title: "Dutasteride mesotherapy",
      }),
      true
    );
    assert.equal(resolveTreatmentTypeLabel("mesotherapy", { title: "Dutasteride mesotherapy" }), "dutasteride_mesotherapy");
  });

  it("excludes consultation and surgery bookings", () => {
    assert.equal(requiresTreatmentPhotosChecklist("consultation"), false);
    assert.equal(requiresTreatmentPhotosChecklist("hair_transplant_consultation"), false);
    assert.equal(requiresTreatmentPhotosChecklist("surgery"), false);
    assert.equal(isSurgeryBookingType("surgery"), true);
    assert.equal(isSurgeryBookingType("prp"), false);
  });
});

describe("treatment imaging protocol — views and completion", () => {
  it("defines five required views and optional misc", () => {
    const slots = treatmentImagingProtocolSlots();
    assert.equal(slots.length, 6);
    assert.deepEqual(
      slots.filter((s) => s.required).map((s) => s.slug),
      [...TREATMENT_IMAGING_REQUIRED_VIEW_SLUGS]
    );
    const misc = slots.find((s) => s.slug === "misc");
    assert.ok(misc);
    assert.equal(misc?.required, false);
  });

  it("tracks required-view completion from session progress", () => {
    let progress: Record<string, unknown> = { __meta__: { status: "active" } };
    for (const slug of TREATMENT_IMAGING_REQUIRED_VIEW_SLUGS) {
      progress = mergeProgressForSlotCapture.apply(progress, slug, `img-${slug}`);
    }
    const state = buildTreatmentImagingCompletionState(progress);
    assert.equal(state.requiredTotal, 5);
    assert.equal(state.requiredComplete, 5);
    assert.equal(state.complete, true);
    assert.equal(state.percent, 100);
  });

  it("misc slot does not affect required completion", () => {
    let progress: Record<string, unknown> = { __meta__: { status: "active" } };
    for (const slug of TREATMENT_IMAGING_REQUIRED_VIEW_SLUGS) {
      progress = mergeProgressForSlotCapture.apply(progress, slug, `img-${slug}`);
    }
    const beforeMisc = buildTreatmentImagingCompletionState(progress);
    progress = mergeProgressForSlotCapture.apply(progress, "misc", "img-misc");
    const afterMisc = buildTreatmentImagingCompletionState(progress);
    assert.equal(beforeMisc.complete, true);
    assert.equal(afterMisc.complete, true);
    assert.equal(afterMisc.slots.find((s) => s.slug === "misc")?.complete, true);
  });

  it("uses treatment_scalp_standard protocol slug", () => {
    assert.equal(TREATMENT_IMAGING_PROTOCOL_SLUG, "treatment_scalp_standard");
  });
});

describe("treatment imaging completion policy", () => {
  it("warns by default when photos incomplete", () => {
    const completion = buildTreatmentImagingCompletionState({});
    const policy = evaluateTreatmentImagingCompletionPolicy({
      applies: true,
      completion,
      clinicSettings: parseClinicSettingsFromMetadata({}),
    });
    assert.equal(policy.allowed, true);
    assert.match(policy.warning ?? "", /incomplete/i);
    assert.equal(policy.blocked, false);
  });

  it("blocks completion when clinic setting requires photos", () => {
    const completion = buildTreatmentImagingCompletionState({});
    const policy = evaluateTreatmentImagingCompletionPolicy({
      applies: true,
      completion,
      clinicSettings: parseClinicSettingsFromMetadata({
        imaging: { require_treatment_photos_before_completion: true },
      }),
    });
    assert.equal(policy.allowed, false);
    assert.equal(policy.blocked, true);
    assert.match(policy.blockedMessage ?? "", /requires treatment photos/i);
  });
});
