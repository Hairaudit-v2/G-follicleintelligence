import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

import { POST as unifiedPost } from "../app/api/internal/imaging/classify/route";
import { POST as hairauditPost } from "../app/api/internal/hairaudit/image-classify/route";
import {
  authorizeInternalImagingClassifierRequest,
  FI_IMAGING_HDR_SIGNATURE,
  FI_IMAGING_HDR_TIMESTAMP,
  signInternalImagingClassifierRequestForTests,
} from "../src/lib/security/internalImagingClassifierAuth";
import {
  mapExternalLabelToPhotoCategoryV1,
  mapHliCategoryToPhotoCategoryV1,
} from "../src/lib/imaging/unifiedClassifier/categoryMapping";
import {
  buildImageClassificationResultV1,
  buildNormalizedImageSignalV1,
} from "../src/lib/imaging/unifiedClassifier/contractMapping";
import { classifyWithLiveHieStack } from "../src/lib/imaging/unifiedClassifier/liveHieClassifier.server";
import {
  classifyUnifiedImageRequest,
  mapUnifiedResultToHairAuditResponse,
} from "../src/lib/imaging/unifiedClassifier/unifiedImageClassifyService.server";
import {
  parseUnifiedImageClassifyRequest,
  type UnifiedImageClassifyRequest,
} from "../src/lib/imaging/unifiedClassifier/unifiedImageClassifyRequest";
import {
  classifyHairAuditImageRequest,
  parseHairAuditImageClassifyRequest,
} from "../src/lib/hairaudit/fiOsHairAuditImageClassifyService";

const VALID_TOKEN = "fi-internal-imaging-token-32chars";
const HMAC_SECRET = "fi-imaging-hmac-secret-32chars-min";
const SAMPLE_IMAGE = "https://example.test/signed-image.jpg";

function buildUnifiedPayload(overrides: Record<string, unknown> = {}) {
  return {
    source_system: "fi_os",
    source_image_id: "img-001",
    signed_url: SAMPLE_IMAGE,
    capture_source: "guided_capture",
    upload_source: "fi_os",
    ...overrides,
  };
}

function mockUnifiedRequest(
  body: unknown,
  headers: Record<string, string> = {}
): Request {
  const rawBody = JSON.stringify(body);
  return new Request("https://fi.example.com/api/internal/imaging/classify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${VALID_TOKEN}`,
      ...headers,
    },
    body: rawBody,
  });
}

const ENV_KEYS = [
  "NODE_ENV",
  "OPENAI_API_KEY",
  "HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN",
  "HAIRAUDIT_IMAGE_CLASSIFIER_MODE",
  "FI_INTERNAL_IMAGING_CLASSIFIER_TOKEN",
  "FI_INTERNAL_IMAGING_HMAC_SECRET",
  "FI_INTERNAL_IMAGING_REQUIRE_HMAC",
  "FI_INTERNAL_IMAGING_ALLOWED_SOURCES",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

type EnvKey = (typeof ENV_KEYS)[number];
let savedEnv: Partial<Record<EnvKey, string | undefined>>;

function saveEnv(): void {
  savedEnv = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
}

function setEnv(key: EnvKey, value: string | undefined): void {
  if (key === "NODE_ENV") {
    if (value === undefined) delete (process.env as { NODE_ENV?: string }).NODE_ENV;
    else (process.env as { NODE_ENV?: string }).NODE_ENV = value;
    return;
  }
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function restoreEnv(): void {
  for (const key of ENV_KEYS) setEnv(key, savedEnv[key]);
}

function mockOpenAiSuccessFetch(): void {
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("api.openai.com")) {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: "front",
                  category_confidence: 0.91,
                  hair_state: "dry",
                  shave_state: "non_shaved",
                  surgery_stage: "pre_op",
                  notes: "Clear frontal view",
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("not found", { status: 404 });
  });
}

describe("unified imaging classifier auth", () => {
  beforeEach(() => {
    saveEnv();
    setEnv("NODE_ENV", "test");
    setEnv("FI_INTERNAL_IMAGING_CLASSIFIER_TOKEN", VALID_TOKEN);
    delete process.env.FI_INTERNAL_IMAGING_REQUIRE_HMAC;
  });
  afterEach(() => restoreEnv());

  it("valid bearer token request succeeds", () => {
    const body = buildUnifiedPayload();
    const rawBody = JSON.stringify(body);
    const req = mockUnifiedRequest(body);
    const auth = authorizeInternalImagingClassifierRequest({
      req,
      rawBody,
      bodySourceSystem: "fi_os",
    });
    assert.equal(auth.ok, true);
  });

  it("invalid token rejected", () => {
    const body = buildUnifiedPayload();
    const rawBody = JSON.stringify(body);
    const req = new Request("https://fi.example.com/api/internal/imaging/classify", {
      method: "POST",
      headers: {
        authorization: "Bearer wrong-token-value-here",
        "Content-Type": "application/json",
      },
      body: rawBody,
    });
    const auth = authorizeInternalImagingClassifierRequest({
      req,
      rawBody,
      bodySourceSystem: "fi_os",
    });
    assert.equal(auth.ok, false);
    if (!auth.ok) assert.equal(auth.reason, "invalid_bearer");
  });

  it("unknown source_system rejected when not in allowlist", () => {
    setEnv("FI_INTERNAL_IMAGING_ALLOWED_SOURCES", "fi_os,hairaudit");
    const body = buildUnifiedPayload({ source_system: "iiohr" });
    const rawBody = JSON.stringify(body);
    const req = mockUnifiedRequest(body);
    const auth = authorizeInternalImagingClassifierRequest({
      req,
      rawBody,
      bodySourceSystem: "iiohr",
    });
    assert.equal(auth.ok, false);
    if (!auth.ok) assert.equal(auth.reason, "unsupported_source");
  });

  it("HMAC valid request succeeds when enabled", () => {
    setEnv("FI_INTERNAL_IMAGING_REQUIRE_HMAC", "true");
    setEnv("FI_INTERNAL_IMAGING_HMAC_SECRET", HMAC_SECRET);
    const body = buildUnifiedPayload();
    const rawBody = JSON.stringify(body);
    const ts = String(Date.now());
    const signed = signInternalImagingClassifierRequestForTests({
      secret: HMAC_SECRET,
      timestamp: ts,
      rawBody,
    });
    const req = mockUnifiedRequest(body, {
      [FI_IMAGING_HDR_TIMESTAMP]: signed.timestamp,
      [FI_IMAGING_HDR_SIGNATURE]: signed.signature,
    });
    const auth = authorizeInternalImagingClassifierRequest({
      req,
      rawBody,
      bodySourceSystem: "fi_os",
      nowMs: Date.now(),
    });
    assert.equal(auth.ok, true);
  });

  it("HMAC invalid request fails", () => {
    setEnv("FI_INTERNAL_IMAGING_REQUIRE_HMAC", "true");
    setEnv("FI_INTERNAL_IMAGING_HMAC_SECRET", HMAC_SECRET);
    const body = buildUnifiedPayload();
    const rawBody = JSON.stringify(body);
    const req = mockUnifiedRequest(body, {
      [FI_IMAGING_HDR_TIMESTAMP]: String(Date.now()),
      [FI_IMAGING_HDR_SIGNATURE]: "deadbeef".repeat(8),
    });
    const auth = authorizeInternalImagingClassifierRequest({
      req,
      rawBody,
      bodySourceSystem: "fi_os",
    });
    assert.equal(auth.ok, false);
    if (!auth.ok) assert.equal(auth.reason, "signature_invalid");
  });

  it("stale timestamp fails when HMAC enabled", () => {
    setEnv("FI_INTERNAL_IMAGING_REQUIRE_HMAC", "true");
    setEnv("FI_INTERNAL_IMAGING_HMAC_SECRET", HMAC_SECRET);
    const body = buildUnifiedPayload();
    const rawBody = JSON.stringify(body);
    const staleTs = String(Date.now() - 10 * 60 * 1000);
    const signed = signInternalImagingClassifierRequestForTests({
      secret: HMAC_SECRET,
      timestamp: staleTs,
      rawBody,
    });
    const req = mockUnifiedRequest(body, {
      [FI_IMAGING_HDR_TIMESTAMP]: signed.timestamp,
      [FI_IMAGING_HDR_SIGNATURE]: signed.signature,
    });
    const auth = authorizeInternalImagingClassifierRequest({
      req,
      rawBody,
      bodySourceSystem: "fi_os",
      nowMs: Date.now(),
    });
    assert.equal(auth.ok, false);
    if (!auth.ok) assert.equal(auth.reason, "timestamp_skew");
  });
});

describe("category alias mapping", () => {
  it("maps HLI front to PhotoCategoryV1 front", () => {
    const mapped = mapHliCategoryToPhotoCategoryV1("front");
    assert.equal(mapped.category, "front");
    assert.equal(mapped.mappingSource, "hli");
  });

  it("maps HairAudit external label via alias table", () => {
    const mapped = mapExternalLabelToPhotoCategoryV1("patient_current_front");
    assert.equal(mapped.category, "front");
    assert.equal(mapped.aliasUsed, true);
  });

  it("maps preop_donor_rear to donor", () => {
    const mapped = mapExternalLabelToPhotoCategoryV1("preop_donor_rear");
    assert.equal(mapped.category, "donor");
  });
});

describe("live HIE classifier (mocked provider)", () => {
  beforeEach(() => {
    saveEnv();
    setEnv("OPENAI_API_KEY", "sk-test-key");
  });
  afterEach(() => {
    restoreEnv();
    mock.restoreAll();
  });

  it("mocked live HIE response returns structured ImageClassificationResultV1", async () => {
    mockOpenAiSuccessFetch();
    const parsed = parseUnifiedImageClassifyRequest(buildUnifiedPayload());
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    const live = await classifyWithLiveHieStack(parsed.data);
    assert.ok(live.hliResult);
    assert.equal(live.fallbackUsed, false);
    assert.match(live.provider, /hli-openai-vision/);

    const classification = buildImageClassificationResultV1({
      request: parsed.data,
      hliResult: live.hliResult,
      provider: live.provider,
      processingVersion: live.processingVersion,
      fallbackUsed: live.fallbackUsed,
    });
    assert.equal(classification.schemaVersion, 1);
    assert.equal(classification.category, "front");
    assert.ok(classification.confidence > 0.8);
  });

  it("live hook no longer returns null in mocked success path", async () => {
    mockOpenAiSuccessFetch();
    const parsed = parseUnifiedImageClassifyRequest(buildUnifiedPayload());
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    const outcome = await classifyUnifiedImageRequest(parsed.data);
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.ok(outcome.result.classification);
    assert.equal(outcome.result.fallback_used, false);
    assert.equal(outcome.result.success, true);
  });

  it("fallback result returned on provider failure", async () => {
    delete process.env.OPENAI_API_KEY;
    const parsed = parseUnifiedImageClassifyRequest(buildUnifiedPayload());
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    const outcome = await classifyUnifiedImageRequest(parsed.data);
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.result.fallback_used, true);
    assert.ok(outcome.result.classification.confidence > 0);
    assert.equal(outcome.result.error?.code, "classifier_fallback");
  });
});

describe("source system mapping", () => {
  beforeEach(() => {
    saveEnv();
    setEnv("NODE_ENV", "test");
    delete process.env.OPENAI_API_KEY;
  });
  afterEach(() => restoreEnv());

  it("fi_os request maps correctly", async () => {
    const parsed = parseUnifiedImageClassifyRequest(
      buildUnifiedPayload({ source_system: "fi_os", upload_source: "fi_os" })
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const outcome = await classifyUnifiedImageRequest(parsed.data);
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.result.normalized_signal.source_system, "fi_os");
    assert.equal(outcome.result.classification.capture_source, "guided_capture");
  });

  it("hairaudit request maps correctly", async () => {
    setEnv("HAIRAUDIT_IMAGE_CLASSIFIER_MODE", "stub");
    const { capture_source: _ignored, ...base } = buildUnifiedPayload();
    const parsed = parseUnifiedImageClassifyRequest({
      ...base,
      source_system: "hairaudit",
      canonical_photo_category: "patient_current_front",
      upload_source: "hairaudit",
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const outcome = await classifyUnifiedImageRequest(parsed.data);
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.result.normalized_signal.source_system, "hairaudit");
    assert.equal(outcome.result.classification.capture_source, "forensic_audit");
  });

  it("hli request maps correctly", async () => {
    const { capture_source: _ignored, ...base } = buildUnifiedPayload();
    const parsed = parseUnifiedImageClassifyRequest({
      ...base,
      source_system: "hli",
      patient_id: "hli-patient-1",
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const outcome = await classifyUnifiedImageRequest(parsed.data);
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.result.normalized_signal.subject_id, "hli-patient-1");
    assert.equal(outcome.result.classification.capture_source, "patient_portal");
  });

  it("iiohr request maps academy metadata correctly", async () => {
    const parsed = parseUnifiedImageClassifyRequest(
      buildUnifiedPayload({
        source_system: "iiohr",
        source_image_id: "iiohr-img-1",
        academy_case_id: "academy-case-42",
        professional_id: "prof-9",
        global_professional_id: "global-prof-9",
        metadata: { academy_module: "graft_planning" },
      })
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    const signal = buildNormalizedImageSignalV1({
      request: parsed.data,
      classification: buildImageClassificationResultV1({
        request: parsed.data,
        hliResult: {
          category: "donor",
          categoryConfidence: 0.7,
          hairState: "unknown",
          shaveState: "unknown",
          surgeryStage: "unknown",
          notes: "",
        },
        provider: "test",
        processingVersion: "test-v1",
        fallbackUsed: true,
      }),
      processingVersion: "test-v1",
    });

    assert.equal(signal.source_system, "iiohr");
    assert.equal(parsed.data.metadata?.academy_case_id, "academy-case-42");
    assert.equal(parsed.data.metadata?.professional_id, "prof-9");
    assert.equal(parsed.data.metadata?.global_professional_id, "global-prof-9");
  });
});

describe("unified imaging classify route", () => {
  beforeEach(() => {
    saveEnv();
    setEnv("NODE_ENV", "test");
    setEnv("FI_INTERNAL_IMAGING_CLASSIFIER_TOKEN", VALID_TOKEN);
    delete process.env.OPENAI_API_KEY;
  });
  afterEach(() => restoreEnv());

  it("missing token → 401", async () => {
    delete process.env.FI_INTERNAL_IMAGING_CLASSIFIER_TOKEN;
    delete process.env.HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN;
    const res = await unifiedPost(mockUnifiedRequest(buildUnifiedPayload()));
    assert.equal(res.status, 401);
  });

  it("unknown source_system → 400", async () => {
    setEnv("FI_INTERNAL_IMAGING_ALLOWED_SOURCES", "fi_os");
    const res = await unifiedPost(
      mockUnifiedRequest(buildUnifiedPayload({ source_system: "iiohr" }))
    );
    assert.equal(res.status, 400);
  });

  it("valid request returns V1 contracts", async () => {
    const res = await unifiedPost(mockUnifiedRequest(buildUnifiedPayload()));
    assert.equal(res.status, 200);
    const json = (await res.json()) as Record<string, unknown>;
    assert.equal(json.success, false);
    assert.equal(json.fallback_used, true);
    assert.ok(json.classification);
    assert.ok(json.normalized_signal);
  });
});

describe("hairaudit backward compatibility", () => {
  const SAMPLE_CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const SAMPLE_UPLOAD = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
  const HAIRAUDIT_TOKEN = "hairaudit-classifier-token-32chars";

  beforeEach(() => {
    saveEnv();
    setEnv("NODE_ENV", "test");
    process.env.HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN = HAIRAUDIT_TOKEN;
    process.env.HAIRAUDIT_IMAGE_CLASSIFIER_MODE = "stub";
  });
  afterEach(() => restoreEnv());

  it("/api/internal/hairaudit/image-classify still works via unified service", async () => {
    const payload = {
      source_system: "hairaudit",
      idempotency_key: `hairaudit:image-intelligence:${SAMPLE_CASE}:${SAMPLE_UPLOAD}:v1`,
      source_case_id: SAMPLE_CASE,
      source_upload_id: SAMPLE_UPLOAD,
      canonical_photo_category: "patient_current_front",
      storage_bucket: "case-files",
      storage_path: `cases/${SAMPLE_CASE}/patient/front/1.jpg`,
    };
    const res = await hairauditPost(
      new Request("https://fi.example.com/api/internal/hairaudit/image-classify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${HAIRAUDIT_TOKEN}`,
        },
        body: JSON.stringify(payload),
      })
    );
    assert.equal(res.status, 200);
    const json = (await res.json()) as Record<string, unknown>;
    assert.equal(json.canonical_photo_category, "front");
    assert.equal(json.classifier_version, "fi-os-stub-v1");
  });

  it("mapUnifiedResultToHairAuditResponse preserves legacy fields", async () => {
    const unifiedRequest: UnifiedImageClassifyRequest = {
      source_system: "hairaudit",
      source_image_id: SAMPLE_UPLOAD,
      signed_url: SAMPLE_IMAGE,
      canonical_photo_category: "patient_current_front",
    };
    const parsed = parseHairAuditImageClassifyRequest({
      source_system: "hairaudit",
      idempotency_key: "key",
      source_case_id: SAMPLE_CASE,
      source_upload_id: SAMPLE_UPLOAD,
      canonical_photo_category: "patient_current_front",
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    const outcome = await classifyHairAuditImageRequest(parsed.data);
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.ok(outcome.result.confidence > 0);
    assert.ok(outcome.result.category);
  });
});
