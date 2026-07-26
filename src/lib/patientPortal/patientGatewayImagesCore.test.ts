import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PATIENT_IMAGE_MAX_BYTES } from "@/src/lib/patientImages/patientImagePolicy";

import { validatePatientGatewayUploadIntentInput } from "./patientGatewayImagesCore";

describe("patientGatewayImagesCore validation", () => {
  it("E. invalid category denied", () => {
    const r = validatePatientGatewayUploadIntentInput({
      category: "progress",
      mimeType: "image/jpeg",
      fileSize: 1000,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, "invalid_category");
  });

  it("F. unsupported MIME denied", () => {
    const r = validatePatientGatewayUploadIntentInput({
      category: "front_hairline",
      mimeType: "application/pdf",
      fileSize: 1000,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, "invalid_mime");
  });

  it("G. oversized upload denied", () => {
    const r = validatePatientGatewayUploadIntentInput({
      category: "front_hairline",
      mimeType: "image/jpeg",
      fileSize: PATIENT_IMAGE_MAX_BYTES + 1,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, "file_too_large");
  });

  it("accepts a valid patient-facing slot", () => {
    const r = validatePatientGatewayUploadIntentInput({
      category: "donor_area",
      mimeType: "image/png",
      fileSize: 2048,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.slot, "donor_area");
    assert.equal(r.bucket, "patient-images");
  });
});
