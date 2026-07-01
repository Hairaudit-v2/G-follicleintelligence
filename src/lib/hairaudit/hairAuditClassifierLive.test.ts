import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  buildDegradedHairAuditClassification,
  buildHairAuditClassificationFromHli,
} from "./hairAuditClassifierResponseMap";
import {
  classifyHairAuditImageRequest,
  parseHairAuditImageClassifyRequest,
} from "./fiOsHairAuditImageClassifyService";
import {
  isClinicalHairImageClassifierAvailable,
} from "./classifyClinicalHairImageFromModelUrl";

const SAMPLE_CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const SAMPLE_UPLOAD = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";

function buildValidPayload() {
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
  };
}

const ENV_KEYS = ["HAIRAUDIT_IMAGE_CLASSIFIER_MODE", "OPENAI_API_KEY"] as const;
let savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;

function saveEnv(): void {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
}

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
}

describe("hairaudit live classifier wiring", () => {
  beforeEach(() => saveEnv());
  afterEach(() => restoreEnv());

  it("stub mode still works", async () => {
    process.env.HAIRAUDIT_IMAGE_CLASSIFIER_MODE = "stub";
    const parsed = parseHairAuditImageClassifyRequest(buildValidPayload());
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const outcome = await classifyHairAuditImageRequest(parsed.data);
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.result.classifier_version, "fi-os-stub-v1");
  });

  it("live mode no longer returns 503 when classifier prerequisites are missing", async () => {
    process.env.HAIRAUDIT_IMAGE_CLASSIFIER_MODE = "live";
    delete process.env.OPENAI_API_KEY;
    const parsed = parseHairAuditImageClassifyRequest(buildValidPayload());
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const outcome = await classifyHairAuditImageRequest(parsed.data);
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.ok(outcome.result.confidence > 0);
    assert.match(outcome.result.notes, /Degraded classification/i);
  });

  it("isClinicalHairImageClassifierAvailable is true only in live mode with OpenAI key", () => {
    process.env.HAIRAUDIT_IMAGE_CLASSIFIER_MODE = "live";
    process.env.OPENAI_API_KEY = "sk-test";
    assert.equal(isClinicalHairImageClassifierAvailable(), true);
    delete process.env.OPENAI_API_KEY;
    assert.equal(isClinicalHairImageClassifierAvailable(), false);
    process.env.HAIRAUDIT_IMAGE_CLASSIFIER_MODE = "stub";
    process.env.OPENAI_API_KEY = "sk-test";
    assert.equal(isClinicalHairImageClassifierAvailable(), false);
  });

  it("low-confidence HLI result is handled safely", () => {
    const result = buildHairAuditClassificationFromHli({
      hliCategory: "unknown",
      categoryConfidence: 0.2,
      classifierVersion: "hli-image-classifier@1.0.0",
      notes: "ambiguous framing",
      fallbackExternalCategory: "patient_current_front",
    });
    assert.equal(result.canonical_photo_category, "front");
    assert.equal(result.quality_status, "review_recommended");
    assert.match(result.notes, /Low confidence/i);
  });

  it("classifier failure degrades safely", () => {
    const degraded = buildDegradedHairAuditClassification({
      canonical_photo_category: "preop_donor_rear",
      classifier_version: "hli-openai-hairaudit-live-v1",
      reason: "signed URL unavailable",
    });
    assert.equal(degraded.canonical_photo_category, "donor");
    assert.equal(degraded.quality_status, "not_evaluated");
    assert.match(degraded.notes, /Degraded classification/i);
  });
});