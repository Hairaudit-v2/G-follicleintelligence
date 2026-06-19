import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  authorizeHairauditClassifierRequest,
  getHairauditClassifierToken,
  MIN_CLASSIFIER_TOKEN_LENGTH,
  resolveProvidedBearerToken,
  validateHairauditClassifierTokenConfig,
} from "../src/lib/security/hairauditClassifierAuth";
import {
  buildStubClassificationResponse,
  classifyHairAuditImageRequest,
  isSafeClassificationResponseBody,
  parseHairAuditImageClassifyRequest,
  stubConfidenceForIdempotencyKey,
} from "../src/lib/hairaudit/fiOsHairAuditImageClassifyService";
import { POST } from "../app/api/internal/hairaudit/image-classify/route";

const SAMPLE_CASE = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const SAMPLE_UPLOAD = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
const VALID_TOKEN = "hairaudit-classifier-token-32chars";

function buildValidPayload(overrides: Record<string, unknown> = {}) {
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

function mockRequest(
  body: unknown,
  headers: Record<string, string> = {},
  url = "https://fi.example.com/api/internal/hairaudit/image-classify"
): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const ENV_KEYS = [
  "NODE_ENV",
  "HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN",
  "HAIRAUDIT_IMAGE_CLASSIFIER_MODE",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

let savedEnv: Partial<Record<EnvKey, string | undefined>>;

function saveEnv(): void {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
}

function setEnvVar(key: EnvKey, value: string | undefined): void {
  if (key === "NODE_ENV") {
    if (value === undefined) delete (process.env as { NODE_ENV?: string }).NODE_ENV;
    else (process.env as { NODE_ENV?: string }).NODE_ENV = value;
    return;
  }
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    setEnvVar(key, savedEnv[key]);
  }
}

describe("hairaudit classifier auth", () => {
  beforeEach(() => {
    saveEnv();
    setEnvVar("NODE_ENV", "test");
    process.env.HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN = VALID_TOKEN;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-should-not-auth";
  });

  afterEach(() => {
    restoreEnv();
  });

  it("getHairauditClassifierToken excludes service role fallback", () => {
    delete process.env.HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-only";
    assert.strictEqual(getHairauditClassifierToken(), null);
  });

  it("validateHairauditClassifierTokenConfig rejects service role reuse", () => {
    process.env.HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN = "service-role-key-should-not-auth";
    const result = validateHairauditClassifierTokenConfig();
    assert.strictEqual(result.valid, false);
    if (!result.valid) {
      assert.strictEqual(result.reason, "service_role_reused");
    }
  });

  it("validateHairauditClassifierTokenConfig rejects too-short token", () => {
    process.env.HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN = "short";
    const result = validateHairauditClassifierTokenConfig();
    assert.strictEqual(result.valid, false);
    if (!result.valid) {
      assert.strictEqual(result.reason, "too_short");
    }
    assert.ok(MIN_CLASSIFIER_TOKEN_LENGTH >= 16);
  });

  it("authorizeHairauditClassifierRequest accepts valid bearer token", () => {
    const req = mockRequest({}, { authorization: `Bearer ${VALID_TOKEN}` });
    assert.strictEqual(resolveProvidedBearerToken(req), VALID_TOKEN);
    assert.strictEqual(authorizeHairauditClassifierRequest(req), true);
  });

  it("authorizeHairauditClassifierRequest rejects invalid bearer token", () => {
    const req = mockRequest({}, { authorization: "Bearer wrong-token-value-here" });
    assert.strictEqual(authorizeHairauditClassifierRequest(req), false);
  });

  it("authorizeHairauditClassifierRequest rejects missing bearer token", () => {
    const req = mockRequest({});
    assert.strictEqual(authorizeHairauditClassifierRequest(req), false);
  });
});

describe("hairaudit image classify request parsing", () => {
  it("accepts a valid HairAudit payload", () => {
    const parsed = parseHairAuditImageClassifyRequest(buildValidPayload());
    assert.strictEqual(parsed.ok, true);
    if (parsed.ok) {
      assert.strictEqual(parsed.data.source_system, "hairaudit");
      assert.strictEqual(parsed.data.canonical_photo_category, "patient_current_front");
    }
  });

  it("rejects wrong source_system", () => {
    const parsed = parseHairAuditImageClassifyRequest(
      buildValidPayload({ source_system: "other_system" })
    );
    assert.strictEqual(parsed.ok, false);
    if (!parsed.ok) {
      assert.strictEqual(parsed.field, "source_system");
    }
  });

  it("rejects invalid payload — missing idempotency_key", () => {
    const parsed = parseHairAuditImageClassifyRequest(
      buildValidPayload({ idempotency_key: "" })
    );
    assert.strictEqual(parsed.ok, false);
  });

  it("rejects invalid payload — bad UUID", () => {
    const parsed = parseHairAuditImageClassifyRequest(
      buildValidPayload({ source_case_id: "not-a-uuid" })
    );
    assert.strictEqual(parsed.ok, false);
    if (!parsed.ok) {
      assert.strictEqual(parsed.field, "source_case_id");
    }
  });

  it("rejects unsupported image_content_type", () => {
    const parsed = parseHairAuditImageClassifyRequest(
      buildValidPayload({ image_content_type: "application/pdf" })
    );
    assert.strictEqual(parsed.ok, false);
  });
});

describe("hairaudit image classify service", () => {
  beforeEach(() => {
    saveEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it("returns provider_not_ready when live mode and classifier unavailable", async () => {
    delete process.env.HAIRAUDIT_IMAGE_CLASSIFIER_MODE;
    const parsed = parseHairAuditImageClassifyRequest(buildValidPayload());
    assert.strictEqual(parsed.ok, true);
    if (!parsed.ok) return;

    const outcome = await classifyHairAuditImageRequest(parsed.data);
    assert.strictEqual(outcome.ok, false);
    if (!outcome.ok) {
      assert.strictEqual(outcome.code, "provider_not_ready");
      assert.strictEqual(outcome.status, 503);
    }
  });

  it("returns normalized stub response in stub mode", async () => {
    process.env.HAIRAUDIT_IMAGE_CLASSIFIER_MODE = "stub";
    const parsed = parseHairAuditImageClassifyRequest(buildValidPayload());
    assert.strictEqual(parsed.ok, true);
    if (!parsed.ok) return;

    const outcome = await classifyHairAuditImageRequest(parsed.data);
    assert.strictEqual(outcome.ok, true);
    if (!outcome.ok) return;

    assert.strictEqual(outcome.result.canonical_photo_category, "front");
    assert.strictEqual(outcome.result.category, "patient_current_front");
    assert.strictEqual(outcome.result.quality_status, "not_evaluated");
    assert.strictEqual(outcome.result.protocol_status, "not_evaluated");
    assert.strictEqual(outcome.result.classifier_version, "fi-os-stub-v1");
    assert.strictEqual(outcome.result.notes, "Stub classification only");
    assert.ok(outcome.result.confidence >= 0.5 && outcome.result.confidence <= 0.7);
  });

  it("stub confidence is deterministic for idempotency key", () => {
    const key = "hairaudit:image-intelligence:abc:def:v1";
    assert.strictEqual(
      stubConfidenceForIdempotencyKey(key),
      stubConfidenceForIdempotencyKey(key)
    );
  });

  it("buildStubClassificationResponse maps category unchanged", () => {
    const parsed = parseHairAuditImageClassifyRequest(
      buildValidPayload({ canonical_photo_category: "preop_donor_rear" })
    );
    assert.strictEqual(parsed.ok, true);
    if (!parsed.ok) return;

    const stub = buildStubClassificationResponse(parsed.data);
    assert.strictEqual(stub.canonical_photo_category, "donor");
    assert.strictEqual(stub.category, "preop_donor_rear");
  });

  it("response excludes signed URLs and secrets", () => {
    process.env.HAIRAUDIT_IMAGE_CLASSIFIER_MODE = "stub";
    const parsed = parseHairAuditImageClassifyRequest(buildValidPayload());
    assert.strictEqual(parsed.ok, true);
    if (!parsed.ok) return;

    const stub = buildStubClassificationResponse(parsed.data);
    assert.strictEqual(isSafeClassificationResponseBody(stub), true);
    assert.strictEqual(
      isSafeClassificationResponseBody({
        ...stub,
        signedUrl: "https://example.supabase.co/storage/v1/object/sign/case-files/foo?token=secret",
      }),
      false
    );
  });
});

describe("hairaudit image classify route", () => {
  beforeEach(() => {
    saveEnv();
    setEnvVar("NODE_ENV", "test");
    process.env.HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN = VALID_TOKEN;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    restoreEnv();
  });

  it("missing token → 401", async () => {
    const res = await POST(mockRequest(buildValidPayload()));
    assert.strictEqual(res.status, 401);
  });

  it("invalid token → 401", async () => {
    const res = await POST(
      mockRequest(buildValidPayload(), { authorization: "Bearer invalid-token-value-here" })
    );
    assert.strictEqual(res.status, 401);
  });

  it("wrong source_system → 400", async () => {
    const res = await POST(
      mockRequest(buildValidPayload({ source_system: "other" }), {
        authorization: `Bearer ${VALID_TOKEN}`,
      })
    );
    assert.strictEqual(res.status, 400);
  });

  it("invalid payload → 400", async () => {
    const res = await POST(
      mockRequest(buildValidPayload({ source_upload_id: "bad" }), {
        authorization: `Bearer ${VALID_TOKEN}`,
      })
    );
    assert.strictEqual(res.status, 400);
  });

  it("provider not ready → 503", async () => {
    delete process.env.HAIRAUDIT_IMAGE_CLASSIFIER_MODE;
    const res = await POST(
      mockRequest(buildValidPayload(), { authorization: `Bearer ${VALID_TOKEN}` })
    );
    assert.strictEqual(res.status, 503);
    const json = (await res.json()) as { code?: string };
    assert.strictEqual(json.code, "provider_not_ready");
  });

  it("stub mode success → normalized response", async () => {
    process.env.HAIRAUDIT_IMAGE_CLASSIFIER_MODE = "stub";
    const res = await POST(
      mockRequest(buildValidPayload(), { authorization: `Bearer ${VALID_TOKEN}` })
    );
    assert.strictEqual(res.status, 200);
    const json = (await res.json()) as Record<string, unknown>;
    assert.strictEqual(isSafeClassificationResponseBody(json), true);
    assert.strictEqual(json.canonical_photo_category, "front");
    assert.strictEqual(json.category, "patient_current_front");
    assert.strictEqual(json.classifier_version, "fi-os-stub-v1");
    assert.ok(!("signedUrl" in json));
    assert.ok(!("storage_path" in json));
  });

  it("route module does not reference SUPABASE_SERVICE_ROLE_KEY", () => {
    const routePath = path.join(
      process.cwd(),
      "app/api/internal/hairaudit/image-classify/route.ts"
    );
    const authPath = path.join(process.cwd(), "src/lib/security/hairauditClassifierAuth.ts");
    const routeSrc = fs.readFileSync(routePath, "utf8");
    const authSrc = fs.readFileSync(authPath, "utf8");
    assert.doesNotMatch(routeSrc, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(authSrc, /INTERNAL_API_KEY|REPORT_RENDER_TOKEN/);
    assert.match(authSrc, /timingSafeUtf8Equal/);
  });
});
