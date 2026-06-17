import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  mapExternalCategoryToCanonical,
  isCanonicalHairImageCategory,
  confidenceBandForScore,
  buildImagingIntakeRecord,
  buildHairAuditImagingIntake,
  evaluateImageQualityStub,
  evaluateImageProtocol,
  findMissingProtocolCategories,
  classifyImageCategoryStub,
  runImagingOsStubPipeline,
  CANONICAL_HAIR_IMAGE_CATEGORIES,
} from "../src/lib/imaging-os";
import {
  buildStubClassificationResponse,
  classifyHairAuditImageRequest,
  STUB_CLASSIFIER_VERSION,
} from "../src/lib/hairaudit/fiOsHairAuditImageClassifyService";
import type { HairAuditImageClassifyRequest } from "../src/lib/hairaudit/fiOsHairAuditImageClassifyService";

const SAMPLE_CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const SAMPLE_UPLOAD = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";

function hairAuditRequest(
  overrides: Partial<HairAuditImageClassifyRequest> = {}
): HairAuditImageClassifyRequest {
  return {
    source_system: "hairaudit",
    idempotency_key: `hairaudit:image-intelligence:${SAMPLE_CASE}:${SAMPLE_UPLOAD}:v1`,
    source_case_id: SAMPLE_CASE,
    source_upload_id: SAMPLE_UPLOAD,
    canonical_photo_category: "patient_current_front",
    legacy_upload_type: "patient_photo:front",
    storage_bucket: "case-files",
    storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
    image_content_type: "image/jpeg",
    image_size_bytes: 1024,
    ...overrides,
  };
}

describe("ImagingOS IM-1 — canonical categories", () => {
  it("defines all required canonical categories", () => {
    for (const cat of [
      "front",
      "top",
      "crown",
      "left",
      "right",
      "donor",
      "recipient",
      "hairline",
      "temporal",
      "vertex",
      "graft_tray",
      "immediate_post_op",
      "follow_up",
      "microscopic",
      "other",
    ] as const) {
      assert.ok(CANONICAL_HAIR_IMAGE_CATEGORIES.includes(cat));
      assert.ok(isCanonicalHairImageCategory(cat));
    }
  });

  it("maps HairAudit front category to canonical front", () => {
    const mapped = mapExternalCategoryToCanonical("patient_current_front", "patient_photo:front");
    assert.strictEqual(mapped.canonical, "front");
    assert.strictEqual(mapped.matched, true);
  });

  it("maps donor rear alias to canonical donor", () => {
    const mapped = mapExternalCategoryToCanonical("preop_donor_rear");
    assert.strictEqual(mapped.canonical, "donor");
    assert.strictEqual(mapped.matched, true);
  });

  it("falls back unknown external category to other", () => {
    const mapped = mapExternalCategoryToCanonical("totally_unknown_xyz");
    assert.strictEqual(mapped.canonical, "other");
    assert.strictEqual(mapped.matched, false);
    assert.strictEqual(mapped.source, "fallback");
  });

  it("maps legacy upload type when external label is unknown", () => {
    const mapped = mapExternalCategoryToCanonical("unknown_label", "patient_photo:crown");
    assert.strictEqual(mapped.canonical, "crown");
    assert.strictEqual(mapped.source, "legacy_upload_type");
  });

  it("assigns confidence bands", () => {
    assert.strictEqual(confidenceBandForScore(0.9), "high");
    assert.strictEqual(confidenceBandForScore(0.7), "medium");
    assert.strictEqual(confidenceBandForScore(0.5), "low");
    assert.strictEqual(confidenceBandForScore(0.2), "insufficient");
  });
});

describe("ImagingOS IM-1 — intake contract", () => {
  it("validates a HairAudit intake record", () => {
    const result = buildHairAuditImagingIntake({
      source_case_id: SAMPLE_CASE,
      source_upload_id: SAMPLE_UPLOAD,
      storage_bucket: "case-files",
      storage_path: "cases/foo.jpg",
      content_type: "image/jpeg",
      file_size_bytes: 512,
      idempotency_key: "key-1",
      external_category: "patient_current_front",
    });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    assert.strictEqual(result.intake.source_system, "hairaudit");
    assert.strictEqual(result.intake.upload_surface, "hairaudit_case_upload");
    assert.strictEqual(result.intake.metadata_version, "imaging-intake.v1");
  });

  it("rejects invalid UUID intake", () => {
    const result = buildImagingIntakeRecord({
      source_system: "fi_os",
      source_case_id: "not-a-uuid",
      source_upload_id: SAMPLE_UPLOAD,
    });
    assert.strictEqual(result.ok, false);
    if (result.ok) return;
    assert.strictEqual(result.field, "source_case_id");
  });

  it("rejects storage bucket without path", () => {
    const result = buildImagingIntakeRecord({
      source_system: "hli",
      source_case_id: SAMPLE_CASE,
      source_upload_id: SAMPLE_UPLOAD,
      storage_bucket: "bucket-only",
    });
    assert.strictEqual(result.ok, false);
  });
});

describe("ImagingOS IM-1 — quality stub", () => {
  it("returns not_evaluated stub scores", () => {
    const quality = evaluateImageQualityStub({ content_type: "image/jpeg", file_size_bytes: 100 });
    assert.strictEqual(quality.quality_status, "not_evaluated");
    assert.strictEqual(quality.blur_score, null);
    assert.strictEqual(quality.lighting_score, null);
    assert.match(quality.notes, /IM-1 stub/i);
  });
});

describe("ImagingOS IM-1 — protocol helpers", () => {
  it("detects missing required categories", () => {
    const missing = findMissingProtocolCategories(["front", "donor"], ["front"]);
    assert.deepStrictEqual(missing, ["donor"]);
  });

  it("evaluates non-compliant protocol when all required missing", () => {
    const evalResult = evaluateImageProtocol({
      required_categories: ["front", "donor"],
      present_categories: [],
    });
    assert.strictEqual(evalResult.protocol_status, "non_compliant");
    assert.deepStrictEqual(evalResult.missing_categories, ["front", "donor"]);
  });

  it("evaluates compliant protocol when all present", () => {
    const evalResult = evaluateImageProtocol({
      required_categories: ["front", "donor"],
      present_categories: ["front", "donor"],
    });
    assert.strictEqual(evalResult.protocol_status, "compliant");
    assert.deepStrictEqual(evalResult.missing_categories, []);
  });
});

describe("ImagingOS IM-1 — classification stub", () => {
  it("returns dry_run classification without AI", () => {
    const result = classifyImageCategoryStub({
      external_category: "patient_current_front",
      idempotency_key: "stable-key",
    });
    assert.strictEqual(result.classification_status, "dry_run");
    assert.strictEqual(result.canonical_photo_category, "front");
    assert.strictEqual(result.model_provider, "imaging-os-stub");
    assert.ok(result.confidence >= 0.5 && result.confidence <= 0.7);
  });

  it("stub pipeline produces full snapshot", () => {
    const pipeline = runImagingOsStubPipeline(
      {
        source_system: "hairaudit",
        source_case_id: SAMPLE_CASE,
        source_upload_id: SAMPLE_UPLOAD,
        external_category: "preop_donor_rear",
      },
      { idempotency_key: "pipeline-key" }
    );
    assert.strictEqual(pipeline.ok, true);
    if (!pipeline.ok) return;
    assert.strictEqual(pipeline.snapshot.classification.canonical_photo_category, "donor");
    assert.strictEqual(pipeline.snapshot.quality.quality_status, "not_evaluated");
    assert.strictEqual(pipeline.snapshot.protocol.protocol_status, "not_evaluated");
  });
});

describe("ImagingOS IM-1 — HairAudit endpoint stub compatibility", () => {
  const ENV_KEYS = ["HAIRAUDIT_IMAGE_CLASSIFIER_MODE"] as const;
  let savedMode: string | undefined;

  beforeEach(() => {
    savedMode = process.env.HAIRAUDIT_IMAGE_CLASSIFIER_MODE;
    process.env.HAIRAUDIT_IMAGE_CLASSIFIER_MODE = "stub";
  });

  afterEach(() => {
    if (savedMode === undefined) delete process.env.HAIRAUDIT_IMAGE_CLASSIFIER_MODE;
    else process.env.HAIRAUDIT_IMAGE_CLASSIFIER_MODE = savedMode;
  });

  it("buildStubClassificationResponse returns fi-os-stub-v1 shape", () => {
    const stub = buildStubClassificationResponse(hairAuditRequest());
    assert.strictEqual(stub.classifier_version, STUB_CLASSIFIER_VERSION);
    assert.strictEqual(stub.category, "patient_current_front");
    assert.strictEqual(stub.canonical_photo_category, "front");
    assert.strictEqual(stub.quality_status, "not_evaluated");
    assert.strictEqual(stub.protocol_status, "not_evaluated");
    assert.strictEqual(stub.notes, "Stub classification only");
    assert.ok(stub.confidence >= 0.5 && stub.confidence <= 0.7);
  });

  it("classifyHairAuditImageRequest stub mode uses ImagingOS mapping", async () => {
    const outcome = await classifyHairAuditImageRequest(hairAuditRequest());
    assert.strictEqual(outcome.ok, true);
    if (!outcome.ok) return;
    assert.strictEqual(outcome.result.classifier_version, "fi-os-stub-v1");
    assert.strictEqual(outcome.result.canonical_photo_category, "front");
  });
});

describe("ImagingOS IM-1 — no AI provider imports in foundation modules", () => {
  const imagingOsDir = path.join(process.cwd(), "src/lib/imaging-os");
  const files = fs.readdirSync(imagingOsDir).filter((f) => f.endsWith(".ts"));

  for (const file of files) {
    it(`${file} does not import OpenAI/Claude/Gemini`, () => {
      const src = fs.readFileSync(path.join(imagingOsDir, file), "utf8");
      assert.doesNotMatch(src, /openai|anthropic|claude|gemini|@google\/generative-ai/i);
    });
  }

  it("HairAudit stub service uses imaging-os not openai classifier", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/lib/hairaudit/fiOsHairAuditImageClassifyService.ts"),
      "utf8"
    );
    assert.match(src, /imaging-os/);
    assert.doesNotMatch(src, /openAiHairImageClassifier|classifyHairRestorationImageWithOpenAi/);
  });
});
