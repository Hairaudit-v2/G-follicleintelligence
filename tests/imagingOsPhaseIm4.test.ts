import { describe, it } from "node:test";
import assert from "node:assert";
import {
  canUseImageForClinicalIntelligence,
  evaluateImageQualityFromMetadata,
  evaluateImageQualityStub,
  getImageQualityExpectationsForCategory,
  hasMetadataForQualityEvaluation,
  IMAGING_QUALITY_METADATA_EVALUATOR_VERSION,
  isImagingOsMetadataQualityResult,
  runImagingOsIngestionPipeline,
} from "../src/lib/imaging-os";

const HIGH_QUALITY_INPUT = {
  width: 1600,
  height: 1200,
  size_bytes: 512 * 1024,
  content_type: "image/jpeg",
  canonical_category: "front" as const,
};

describe("ImagingOS IM-4 — evaluateImageQualityFromMetadata", () => {
  it("high quality JPEG 1600x1200 returns excellent or acceptable", () => {
    const result = evaluateImageQualityFromMetadata(HIGH_QUALITY_INPUT);
    assert.ok(["excellent", "acceptable"].includes(result.quality_status));
    assert.ok(result.quality_score >= 70);
    assert.strictEqual(result.is_clinically_usable, true);
    assert.strictEqual(result.evaluator_version, IMAGING_QUALITY_METADATA_EVALUATOR_VERSION);
  });

  it("missing dimensions returns warning but not invalid", () => {
    const result = evaluateImageQualityFromMetadata({
      content_type: "image/png",
      size_bytes: 512 * 1024,
      canonical_category: "top",
    });
    assert.notStrictEqual(result.quality_status, "invalid");
    assert.ok(result.warnings.some((w) => /dimensions missing/i.test(w)));
    assert.ok(result.signals.some((s) => s.name === "dimensions" && s.status === "warning"));
  });

  it("tiny dimensions returns poor and not clinically usable", () => {
    const result = evaluateImageQualityFromMetadata({
      width: 400,
      height: 300,
      size_bytes: 512 * 1024,
      content_type: "image/jpeg",
      canonical_category: "front",
    });
    assert.strictEqual(result.quality_status, "poor");
    assert.strictEqual(result.is_clinically_usable, false);
    assert.ok(result.blockers.some((b) => /dimensions below minimum/i.test(b)));
  });

  it("unsupported content type returns invalid and blocker", () => {
    const result = evaluateImageQualityFromMetadata({
      width: 1600,
      height: 1200,
      size_bytes: 512 * 1024,
      content_type: "image/tiff",
      canonical_category: "front",
    });
    assert.strictEqual(result.quality_status, "invalid");
    assert.ok(result.blockers.some((b) => /unsupported content type/i.test(b)));
    assert.strictEqual(result.is_clinically_usable, false);
  });

  it("low file size returns poor or borderline", () => {
    const result = evaluateImageQualityFromMetadata({
      width: 1600,
      height: 1200,
      size_bytes: 40 * 1024,
      content_type: "image/jpeg",
      canonical_category: "front",
    });
    assert.ok(["poor", "borderline"].includes(result.quality_status));
    assert.strictEqual(result.is_clinically_usable, false);
    assert.ok(result.blockers.some((b) => /file size too small/i.test(b)));
  });

  it("extreme aspect ratio adds warning", () => {
    const result = evaluateImageQualityFromMetadata({
      width: 3000,
      height: 500,
      size_bytes: 512 * 1024,
      content_type: "image/jpeg",
      canonical_category: "front",
    });
    assert.ok(result.warnings.some((w) => /aspect ratio/i.test(w)));
    assert.ok(result.signals.some((s) => s.name === "aspect_ratio" && s.status === "warning"));
  });

  it("blur_score high creates blocker", () => {
    const result = evaluateImageQualityFromMetadata({
      ...HIGH_QUALITY_INPUT,
      metadata: { blur_score: 0.85 },
    });
    assert.ok(result.blockers.some((b) => /blur/i.test(b)));
    assert.strictEqual(result.is_clinically_usable, false);
  });

  it("lighting_score low creates blocker", () => {
    const result = evaluateImageQualityFromMetadata({
      ...HIGH_QUALITY_INPUT,
      metadata: { lighting_score: 0.2 },
    });
    assert.ok(result.blockers.some((b) => /lighting/i.test(b)));
    assert.strictEqual(result.is_clinically_usable, false);
  });

  it("scalp_visibility_score low creates blocker", () => {
    const result = evaluateImageQualityFromMetadata({
      ...HIGH_QUALITY_INPUT,
      canonical_category: "donor",
      metadata: { scalp_visibility_score: 0.2 },
    });
    assert.ok(result.blockers.some((b) => /scalp visibility/i.test(b)));
    assert.strictEqual(result.is_clinically_usable, false);
  });

  it("canonical_category unknown adds warning", () => {
    const result = evaluateImageQualityFromMetadata({
      ...HIGH_QUALITY_INPUT,
      canonical_category: "other",
    });
    assert.ok(result.warnings.some((w) => /category missing or unknown/i.test(w)));
    assert.ok(
      result.signals.some((s) => s.name === "category_suitability" && s.status === "warning")
    );
  });
});

describe("ImagingOS IM-4 — category expectations", () => {
  it("microscopic expects higher detail thresholds", () => {
    const expectations = getImageQualityExpectationsForCategory("microscopic");
    assert.ok((expectations.preferred_min_width ?? 0) >= 1600);
    assert.ok((expectations.min_size_bytes ?? 0) >= 250 * 1024);
  });

  it("donor marks scalp visibility as important", () => {
    const expectations = getImageQualityExpectationsForCategory("donor");
    assert.strictEqual(expectations.scalp_visibility_important, true);
  });
});

describe("ImagingOS IM-4 — canUseImageForClinicalIntelligence", () => {
  it("returns usable for acceptable quality", () => {
    const result = evaluateImageQualityFromMetadata(HIGH_QUALITY_INPUT);
    const gate = canUseImageForClinicalIntelligence(result);
    assert.strictEqual(gate.usable, result.is_clinically_usable);
    if (result.is_clinically_usable) {
      assert.strictEqual(gate.reason, "Image quality acceptable for clinical intelligence.");
    }
  });

  it("returns not usable for invalid quality", () => {
    const result = evaluateImageQualityFromMetadata({
      ...HIGH_QUALITY_INPUT,
      content_type: "application/pdf",
    });
    const gate = canUseImageForClinicalIntelligence(result);
    assert.strictEqual(gate.usable, false);
    assert.strictEqual(gate.reason, "Image quality invalid.");
    assert.ok(gate.blockers.length > 0);
  });

  it("returns below threshold for poor quality", () => {
    const result = evaluateImageQualityFromMetadata({
      width: 400,
      height: 300,
      size_bytes: 512 * 1024,
      content_type: "image/jpeg",
      canonical_category: "front",
    });
    const gate = canUseImageForClinicalIntelligence(result);
    assert.strictEqual(gate.usable, false);
    assert.strictEqual(gate.reason, "Image quality below clinical usability threshold.");
  });
});

describe("ImagingOS IM-4 — pipeline integration", () => {
  it("uses metadata quality evaluator when metadata exists", () => {
    const result = runImagingOsIngestionPipeline({
      source_system: "fi_os",
      upload_surface: "clinic_console",
      storage_path: "uploads/front.jpg",
      external_category: "patient_current_front",
      content_type: "image/jpeg",
      width: 1600,
      height: 1200,
      size_bytes: 512 * 1024,
    });
    assert.ok(isImagingOsMetadataQualityResult(result.quality));
    assert.strictEqual(result.quality.evaluator_version, IMAGING_QUALITY_METADATA_EVALUATOR_VERSION);
    assert.ok(result.quality.quality_score >= 0);
    assert.strictEqual(result.classification.classification_status, "dry_run");
  });

  it("falls back to stub when no metadata exists", () => {
    const result = runImagingOsIngestionPipeline({
      source_system: "fi_os",
      upload_surface: "clinic_console",
      storage_path: "uploads/test.jpg",
      external_category: "donor",
    });
    assert.strictEqual(result.quality.quality_status, "not_evaluated");
    assert.strictEqual("evaluator_version" in result.quality, false);
    assert.strictEqual(result.status, "dry_run");
  });

  it("adds pipeline warning when quality is not clinically usable", () => {
    const result = runImagingOsIngestionPipeline({
      source_system: "fi_os",
      upload_surface: "clinic_console",
      storage_path: "uploads/tiny.jpg",
      external_category: "front",
      content_type: "image/jpeg",
      width: 400,
      height: 300,
      size_bytes: 512 * 1024,
    });
    assert.ok(result.warnings?.some((w) => /not clinically usable/i.test(w)));
    assert.strictEqual(result.classification.classification_status, "dry_run");
  });

  it("uses metadata evaluator when only quality hint metadata exists", () => {
    assert.strictEqual(
      hasMetadataForQualityEvaluation({ metadata: { blur_score: 0.5 } }),
      true
    );
    const result = runImagingOsIngestionPipeline({
      source_system: "fi_os",
      upload_surface: "clinic_console",
      storage_path: "uploads/front.jpg",
      external_category: "front",
      metadata: { blur_score: 0.5 },
    });
    assert.ok(isImagingOsMetadataQualityResult(result.quality));
  });
});

describe("ImagingOS IM-4 — IM-2/IM-3 compatibility", () => {
  it("evaluateImageQualityStub still returns not_evaluated", () => {
    const stub = evaluateImageQualityStub();
    assert.strictEqual(stub.quality_status, "not_evaluated");
    assert.match(stub.notes, /IM-1 stub/i);
  });

  it("preserves IM-3 pipeline behavior when protocol context is provided", () => {
    const result = runImagingOsIngestionPipeline(
      {
        source_system: "hairaudit",
        upload_surface: "audit_upload",
        storage_path: "cases/front.jpg",
        external_category: "patient_current_front",
      },
      {
        protocol: "hairaudit_baseline",
        case_categories: ["front", "left", "right", "top", "crown", "donor"],
      }
    );
    assert.strictEqual(result.quality.quality_status, "not_evaluated");
    assert.ok(result.protocol_completeness);
    assert.strictEqual(result.protocol_completeness!.status, "complete");
  });
});
