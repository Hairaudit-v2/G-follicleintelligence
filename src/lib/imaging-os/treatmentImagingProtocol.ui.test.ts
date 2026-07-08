import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

import { requiresTreatmentPhotosChecklist } from "@/src/lib/imaging-os/treatmentImagingProtocol";

describe("treatment imaging UI integration", () => {
  it("TreatmentPhotosChecklist renders required slots and capture CTA", () => {
    const panelPath = path.join(
      process.cwd(),
      "src/components/fi/treatment-imaging/TreatmentPhotosChecklist.tsx"
    );
    const src = fs.readFileSync(panelPath, "utf8");
    assert.match(src, /Treatment Photos/);
    assert.match(src, /treatment-photos-checklist/);
    assert.match(src, /VieCaptureWizard/);
    assert.match(src, /treatment-photos-capture-btn/);
  });

  it("appointment detail surfaces checklist for regenerative bookings only", () => {
    const detailPath = path.join(
      process.cwd(),
      "src/components/fi/appointments/detail/AppointmentDetailPageView.tsx"
    );
    const src = fs.readFileSync(detailPath, "utf8");
    assert.match(src, /TreatmentPhotosChecklist/);
    assert.match(src, /treatmentImaging\.applies/);
    assert.match(src, /isSurgeryBookingType/);
  });

  it("appointment slide-over includes treatment photos checklist", () => {
    const slidePath = path.join(
      process.cwd(),
      "src/components/fi/appointments/AppointmentSlideOver.tsx"
    );
    const src = fs.readFileSync(slidePath, "utf8");
    assert.match(src, /TreatmentPhotosChecklist/);
    assert.match(src, /treatmentImaging\.applies/);
  });

  it("consultation bookings do not require treatment photos checklist", () => {
    assert.equal(requiresTreatmentPhotosChecklist("consultation"), false);
    assert.equal(requiresTreatmentPhotosChecklist("trichology"), false);
    assert.equal(requiresTreatmentPhotosChecklist("prp"), true);
    assert.equal(requiresTreatmentPhotosChecklist("exosomes"), true);
  });
});
