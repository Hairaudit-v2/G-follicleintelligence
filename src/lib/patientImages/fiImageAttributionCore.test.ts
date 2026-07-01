import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFiImageMetadata,
  buildFiImageTimelineEntry,
  buildMarketingExportCaption,
  inferFiImageProcedureStage,
  mapToFiImageAttributionType,
  normalizeFiImageCaptureSource,
  normalizeFiImageCaptureType,
  parseFiImageAttributionSettings,
  sortFiImageTimelineEntries,
} from "./fiImageAttributionCore";

describe("FI image attribution core", () => {
  it("normalizes capture type and source", () => {
    assert.equal(normalizeFiImageCaptureType("camera"), "camera");
    assert.equal(normalizeFiImageCaptureType("bogus"), "upload");
    assert.equal(normalizeFiImageCaptureSource("patient_profile"), "patient_profile");
    assert.equal(normalizeFiImageCaptureSource("surgery_os"), "surgery_os");
    assert.equal(normalizeFiImageCaptureSource("follow_up_outcome"), "follow_up_outcome");
    assert.equal(normalizeFiImageCaptureSource(""), "unknown");
  });

  it("parses tenant attribution settings with defaults", () => {
    const settings = parseFiImageAttributionSettings({});
    assert.equal(settings.enable_watermark, true);
    assert.equal(settings.enable_patient_name_overlay, false);
    assert.equal(settings.watermark_opacity, 0.25);
  });

  it("infers procedure stage from guided protocol context", () => {
    assert.equal(
      inferFiImageProcedureStage({
        imaging_protocol_template_slug: "surgery_day",
        visit_type: "surgery_day_front",
      }),
      "surgery_day"
    );
    assert.equal(
      inferFiImageProcedureStage({
        imaging_protocol_template_slug: "follow_up_review",
        follow_up_interval: "month_6",
      }),
      "follow_up"
    );
  });

  it("infers procedure stage from normalized capture_source", () => {
    assert.equal(
      inferFiImageProcedureStage({
        capture_source: "surgery_os",
        imaging_protocol_template_slug: "surgery_day",
      }),
      "surgery_day"
    );
    assert.equal(
      inferFiImageProcedureStage({
        capture_source: "follow_up_outcome",
        imaging_protocol_template_slug: "follow_up_review",
      }),
      "follow_up"
    );
    assert.equal(
      inferFiImageProcedureStage({
        capture_source: "imaging_os_wizard",
        imaging_protocol_template_slug: "hair_loss_consultation",
      }),
      "baseline"
    );
  });

  it("maps categories to attribution image types", () => {
    assert.equal(mapToFiImageAttributionType({ ai_category: "donor" }), "donor_zone");
    assert.equal(mapToFiImageAttributionType({ anatomical_region: "crown" }), "crown");
    assert.equal(mapToFiImageAttributionType({ image_category: "trichoscopy" }), "trichoscopy");
  });

  it("builds structured fi_image_metadata", () => {
    const meta = buildFiImageMetadata({
      patient_id: "p1",
      patient_full_name: "John Smith",
      clinic_id: "c1",
      clinic_name: "Evolved Hair Restoration",
      practitioner_id: "s1",
      practitioner_name: "Dr Lee",
      capture_timestamp: "2026-06-25T10:00:00.000Z",
      capture_type: "camera",
      capture_source: "imaging_os_wizard",
      anatomical_region: "frontal",
      visit_type: "baseline_consult",
      procedure_stage: "baseline",
      image_type: "frontal_hairline",
      image_type_confidence: 0.974,
    });
    assert.equal(meta.patient_full_name, "John Smith");
    assert.equal(meta.capture_type, "camera");
    assert.equal(meta.procedure_stage, "baseline");
    assert.equal(meta.image_type_confidence, 0.974);
    assert.match(meta.capture_date, /2026/);
  });

  it("sorts timeline entries by journey order", () => {
    const entries = sortFiImageTimelineEntries([
      buildFiImageTimelineEntry({
        image_id: "i3",
        capture_timestamp: "2026-03-01T00:00:00.000Z",
        procedure_stage: "follow_up",
        follow_up_interval: "month_6",
        image_type: "crown",
      }),
      buildFiImageTimelineEntry({
        image_id: "i1",
        capture_timestamp: "2026-01-01T00:00:00.000Z",
        procedure_stage: "baseline",
        image_type: "frontal_hairline",
      }),
      buildFiImageTimelineEntry({
        image_id: "i2",
        capture_timestamp: "2026-02-01T00:00:00.000Z",
        procedure_stage: "pre_op",
        image_type: "donor_zone",
      }),
    ]);
    assert.deepEqual(
      entries.map((e) => e.image_id),
      ["i1", "i2", "i3"]
    );
    assert.equal(entries[2]?.label, "Month 6");
  });

  it("builds marketing export caption without patient identifiers", () => {
    const caption = buildMarketingExportCaption({
      clinic_name: "Evolved Hair Restoration",
      procedure_stage: "follow_up",
      follow_up_interval: "month_6",
    });
    assert.equal(caption.headline, "Evolved Hair Restoration");
    assert.equal(caption.subline, "Month 6 Results");
  });
});
