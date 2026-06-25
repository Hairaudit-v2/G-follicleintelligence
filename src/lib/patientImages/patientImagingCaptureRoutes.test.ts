import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPatientImagingCaptureHref,
  buildPatientProfilePhotoAddedHref,
  parseImagingCaptureIntent,
  parseImagingWorkspaceTab,
  parsePatientPhotoAddedFeedback,
  parsePatientPhotoQuickActionSource,
} from "@/src/lib/patientImages/patientImagingCaptureRoutes";

test("buildPatientImagingCaptureHref encodes tenant, patient, intent, and source", () => {
  const href = buildPatientImagingCaptureHref("tenant-1", "patient-2", "camera", "patient_profile");
  assert.equal(
    href,
    "/fi-admin/tenant-1/patients/patient-2/imaging?tab=capture&intent=camera&source=patient_profile"
  );
});

test("buildPatientImagingCaptureHref supports library upload intent from slide-over", () => {
  const href = buildPatientImagingCaptureHref("t", "p", "library", "patient_slide_over");
  assert.equal(href, "/fi-admin/t/patients/p/imaging?tab=capture&intent=library&source=patient_slide_over");
});

test("parseImagingWorkspaceTab accepts capture tab only", () => {
  assert.equal(parseImagingWorkspaceTab("capture"), "capture");
  assert.equal(parseImagingWorkspaceTab("gallery"), null);
});

test("parseImagingCaptureIntent accepts camera and library", () => {
  assert.equal(parseImagingCaptureIntent("camera"), "camera");
  assert.equal(parseImagingCaptureIntent("library"), "library");
  assert.equal(parseImagingCaptureIntent("upload"), null);
});

test("buildPatientProfilePhotoAddedHref opens gallery with success feedback param", () => {
  const href = buildPatientProfilePhotoAddedHref("tenant-1", "patient-2", { tab: "gallery" });
  assert.equal(href, "/fi-admin/tenant-1/patients/patient-2?photoAdded=1&tab=gallery");
});

test("parsePatientPhotoAddedFeedback accepts common truthy values", () => {
  assert.equal(parsePatientPhotoAddedFeedback("1"), true);
  assert.equal(parsePatientPhotoAddedFeedback("true"), true);
  assert.equal(parsePatientPhotoAddedFeedback("0"), false);
});

test("parsePatientPhotoQuickActionSource accepts profile and slide-over sources", () => {
  assert.equal(parsePatientPhotoQuickActionSource("patient_profile"), "patient_profile");
  assert.equal(parsePatientPhotoQuickActionSource("patient_slide_over"), "patient_slide_over");
  assert.equal(parsePatientPhotoQuickActionSource("other"), null);
});
