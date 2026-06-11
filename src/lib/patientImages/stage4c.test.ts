import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  patientImageArchiveChangedKeys,
  patientImageDetailChangedKeys,
  type PatientImageEditableSnapshot,
} from "./patientImageChangedFields";
import { buildPatientImageStoragePath, buildSafePatientImageFilename } from "./patientImagePaths";
import {
  assertAllowedPatientImageContentType,
  assertFileSizeWithinPolicy,
  assertPatientImageEditableStatus,
  assertPatientImageMetadataObject,
  isPatientImageCategory,
  isPatientImageStatus,
  normalizePatientImageCategory,
  PATIENT_IMAGE_MAX_BYTES,
  resolvePatientImageContentType,
} from "./patientImagePolicy";
import type { PatientImageSignedDescriptor } from "./patientImageTypes";

describe("Stage 4C — patient images foundation (pure)", () => {
  it("category allow-list", () => {
    assert.equal(isPatientImageCategory("consult"), true);
    assert.equal(isPatientImageCategory("bogus"), false);
    assert.equal(normalizePatientImageCategory("bogus"), "other");
  });

  it("status allow-list", () => {
    assert.equal(isPatientImageStatus("active"), true);
    assert.equal(isPatientImageStatus("archived"), true);
    assert.equal(isPatientImageStatus("deleted"), false);
  });

  it("content type validation", () => {
    assert.equal(resolvePatientImageContentType({ name: "x.jpg", type: "image/jpeg" }), "image/jpeg");
    assert.equal(resolvePatientImageContentType({ name: "x.jpg", type: "" }), "image/jpeg");
    assert.equal(resolvePatientImageContentType({ name: "x.heic", type: "application/octet-stream" }), "image/heic");
    assert.equal(resolvePatientImageContentType({ name: "x.bin", type: "application/octet-stream" }), null);
    assert.equal(assertAllowedPatientImageContentType({ name: "a.png", type: "image/png", size: 10 }), "image/png");
  });

  it("file size validation", () => {
    assert.throws(() => assertFileSizeWithinPolicy(PATIENT_IMAGE_MAX_BYTES + 1));
    assert.throws(() => assertFileSizeWithinPolicy(0));
    assert.doesNotThrow(() => assertFileSizeWithinPolicy(PATIENT_IMAGE_MAX_BYTES));
  });

  it("safe filename generation", () => {
    assert.equal(buildSafePatientImageFilename("my photo (1).jpg"), "my_photo_1_.jpg");
    assert.ok(buildSafePatientImageFilename("  ").length > 0);
  });

  it("storage path construction", () => {
    const p = buildPatientImageStoragePath({
      tenantId: "t1",
      patientId: "p1",
      imageId: "i1",
      safeFilename: "shot.png",
    });
    assert.equal(p, "tenant/t1/patients/p1/i1-shot.png");
  });

  it("metadata object guard", () => {
    assert.deepEqual(assertPatientImageMetadataObject("m", {}), {});
    assert.throws(() => assertPatientImageMetadataObject("m", []));
    assert.throws(() => assertPatientImageMetadataObject("m", "x"));
  });

  it("changed_keys generation", () => {
    const base: Omit<PatientImageEditableSnapshot, "image_category" | "caption" | "taken_at" | "metadata"> = {
      imaging_library_axis: "general_clinical",
      clinic_id: null,
      captured_by_staff_id: null,
      device_type: null,
      anatomical_region: null,
      visit_type: null,
      follow_up_interval: null,
      imaging_protocol_template_slug: null,
      imaging_protocol_slot_slug: null,
      consultation_id: null,
    };
    const before: PatientImageEditableSnapshot = {
      ...base,
      image_category: "other",
      caption: null,
      taken_at: null,
      metadata: { a: 1 },
    };
    const after: PatientImageEditableSnapshot = {
      ...base,
      image_category: "consult",
      caption: "Hi",
      taken_at: "2026-01-01T00:00:00.000Z",
      metadata: { a: 2 },
    };
    const keys = patientImageDetailChangedKeys(before, after).sort();
    assert.deepEqual(keys, ["caption", "image_category", "metadata", "taken_at"]);
    assert.deepEqual(
      [...patientImageArchiveChangedKeys()].sort(),
      ["archive_reason", "archived_at", "archived_by_user_id", "image_status"]
    );
  });

  it("archived edit guard", () => {
    assert.throws(() => assertPatientImageEditableStatus("archived"));
    assert.doesNotThrow(() => assertPatientImageEditableStatus("active"));
  });

  it("signed URL descriptor shaping", () => {
    const d: PatientImageSignedDescriptor = {
      imageId: "11111111-1111-4111-8111-111111111111",
      url: "https://example.test/signed",
      expiresAtIso: "2026-06-01T12:00:00.000Z",
    };
    assert.equal(d.imageId.length, 36);
    assert.ok(d.url.startsWith("https://"));
    assert.ok(Date.parse(d.expiresAtIso) > 0);
  });
});
