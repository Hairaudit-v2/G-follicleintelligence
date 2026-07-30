/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — Gateway + contract tests.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { POST as projectionPost } from "../app/api/v1/pre-surgery/projections/route";
import { GET as healthGet } from "../app/api/health/route";
import { POST as classifyPost } from "../app/api/internal/imaging/classify/route";
import {
  signHairAuditProjectionRequest,
  signHairAuditProjectionCallback,
  verifyHairAuditProjectionCallbackSignature,
  sha256Hex,
} from "../src/lib/imaging-os/preSurgeryProjection/hmac";
import { parseHairAuditProjectionRequest } from "../src/lib/imaging-os/preSurgeryProjection/schema";
import {
  canTransitionProjectionJob,
  evaluateApprovalEligibility,
  evaluatePatientSharingEligibility,
} from "../src/lib/imaging-os/preSurgeryProjection/domain.server";
import {
  createMemoryJobStore,
} from "../src/lib/imaging-os/preSurgeryProjection/jobs.server";
import {
  createMemoryReplayStore,
  assertProjectionRequestNotReplayed,
} from "../src/lib/imaging-os/preSurgeryProjection/replayProtection.server";
import {
  createMemoryProjectionStorage,
  validateProjectionOutputBytes,
  assertCrossCaseStorageAccess,
} from "../src/lib/imaging-os/preSurgeryProjection/storage.server";
import {
  deliverHairAuditProjectionCallback,
  buildHairAuditCallbackUrl,
} from "../src/lib/imaging-os/preSurgeryProjection/callback.server";
import {
  handleHairAuditProjectionRequest,
  buildProjectionHealth,
} from "../src/lib/imaging-os/preSurgeryProjection/gateway.server";
import {
  resolveProjectionGatewayConfig,
  type ProjectionGatewayConfig,
} from "../src/lib/imaging-os/preSurgeryProjection/config.server";
import { ProjectionGatewayError } from "../src/lib/imaging-os/preSurgeryProjection/errors";
import { buildHairAuditProjectionFixture } from "./fixtures/preSurgeryProjection/hairAuditRequestFixture";

const TOKEN = "ha-projection-service-token-32chars!!";
const SIGNING_SECRET = "ha-projection-request-signing-secret-32";
const CALLBACK_SECRET = "ha-projection-callback-signing-secret-32";
const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const CLINIC_ID = "22222222-2222-2222-2222-222222222222";

const ENV_KEYS = [
  "NODE_ENV",
  "VERCEL_ENV",
  "HAIRAUDIT_PROJECTION_SERVICE_TOKEN",
  "HAIRAUDIT_PROJECTION_REQUEST_SIGNING_SECRET",
  "HAIRAUDIT_PROJECTION_CALLBACK_SIGNING_SECRET",
  "HAIRAUDIT_PROJECTION_CALLBACK_BASE_URL",
  "HAIRAUDIT_PROJECTION_FIOS_TENANT_ID",
  "HAIRAUDIT_PROJECTION_FIOS_CLINIC_ID",
  "FI_PRE_SURGERY_PROJECTION_PROVIDER",
  "FI_PRE_SURGERY_PROJECTION_ALLOW_STUB_IN_PRODUCTION",
  "FI_PRE_SURGERY_PROJECTION_ENABLED",
  "FI_PRE_SURGERY_PROJECTION_HAIRAUDIT_ENABLED",
  "FI_PRE_SURGERY_PROJECTION_CLINIC_ENABLED",
  "FI_PRE_SURGERY_PROJECTION_PATIENT_SHARING_ENABLED",
  "FI_PRE_SURGERY_PROJECTION_REQUIRE_HMAC",
  "FI_INTERNAL_IMAGING_CLASSIFIER_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
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

function enableGatewayEnv(opts?: { production?: boolean; requireHmac?: boolean }): void {
  setEnv("NODE_ENV", opts?.production ? "production" : "test");
  if (!opts?.production) delete process.env.VERCEL_ENV;
  else setEnv("VERCEL_ENV", "production");
  setEnv("HAIRAUDIT_PROJECTION_SERVICE_TOKEN", TOKEN);
  setEnv("HAIRAUDIT_PROJECTION_REQUEST_SIGNING_SECRET", SIGNING_SECRET);
  setEnv("HAIRAUDIT_PROJECTION_CALLBACK_SIGNING_SECRET", CALLBACK_SECRET);
  setEnv("HAIRAUDIT_PROJECTION_CALLBACK_BASE_URL", "https://hairaudit.test/api/cases");
  setEnv("HAIRAUDIT_PROJECTION_FIOS_TENANT_ID", TENANT_ID);
  setEnv("HAIRAUDIT_PROJECTION_FIOS_CLINIC_ID", CLINIC_ID);
  setEnv("FI_PRE_SURGERY_PROJECTION_PROVIDER", "stub");
  setEnv("FI_PRE_SURGERY_PROJECTION_ALLOW_STUB_IN_PRODUCTION", "false");
  setEnv("FI_PRE_SURGERY_PROJECTION_ENABLED", "true");
  setEnv("FI_PRE_SURGERY_PROJECTION_HAIRAUDIT_ENABLED", "true");
  setEnv("FI_PRE_SURGERY_PROJECTION_CLINIC_ENABLED", "false");
  setEnv("FI_PRE_SURGERY_PROJECTION_PATIENT_SHARING_ENABLED", "false");
  setEnv("FI_PRE_SURGERY_PROJECTION_REQUIRE_HMAC", opts?.requireHmac === false ? "false" : "true");
  // Force memory stores in gateway
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function testConfig(overrides: Partial<ProjectionGatewayConfig> = {}): ProjectionGatewayConfig {
  return {
    ...resolveProjectionGatewayConfig(),
    supabaseConfigured: false,
    ...overrides,
  };
}

function signedProjectionRequest(
  bodyObj: Record<string, unknown>,
  headers: Record<string, string> = {},
  opts?: { timestamp?: string; idempotencyKey?: string; skipSignature?: boolean }
): { req: Request; rawBody: string } {
  const rawBody = JSON.stringify(bodyObj);
  const idempotencyKey =
    opts?.idempotencyKey ??
    String(bodyObj.idempotencyKey ?? "idem-fixture-001");
  const timestamp = opts?.timestamp ?? String(Math.floor(Date.now() / 1000));
  const hdrs: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
    "Idempotency-Key": idempotencyKey,
    "X-HairAudit-Timestamp": timestamp,
    "X-HairAudit-Case-Id": String(bodyObj.caseId),
  };
  if (!opts?.skipSignature) {
    hdrs["X-HairAudit-Signature"] = signHairAuditProjectionRequest({
      method: "POST",
      path: "/v1/pre-surgery/projections",
      timestamp,
      idempotencyKey,
      rawBody,
      secret: SIGNING_SECRET,
    });
  }
  // Caller overrides applied last (e.g. invalid signature, mismatched case id).
  Object.assign(hdrs, headers);
  const req = new Request("https://fi.example.com/api/v1/pre-surgery/projections", {
    method: "POST",
    headers: hdrs,
    body: rawBody,
  });
  return { req, rawBody };
}

describe("preSurgeryProjection schema compatibility", () => {
  it("accepts exact HairAudit request fixture", () => {
    const parsed = parseHairAuditProjectionRequest(buildHairAuditProjectionFixture());
    assert.equal(parsed.ok, true);
  });

  it("rejects unsupported schema version", () => {
    const parsed = parseHairAuditProjectionRequest(
      buildHairAuditProjectionFixture({ schemaVersion: "v0" })
    );
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.code, "unsupported_schema_version");
  });

  it("rejects unsafe javascript source refs", () => {
    const parsed = parseHairAuditProjectionRequest(
      buildHairAuditProjectionFixture({ sourceImageRef: "javascript:alert(1)" })
    );
    assert.equal(parsed.ok, false);
  });

  it("rejects invalid projection mode", () => {
    const parsed = parseHairAuditProjectionRequest(
      buildHairAuditProjectionFixture({ mode: "aggressive" })
    );
    assert.equal(parsed.ok, false);
  });

  it("rejects canonical plan checksum mismatch", () => {
    const fixture = buildHairAuditProjectionFixture();
    const canonical = {
      ...(fixture.canonical as Record<string, unknown>),
      approvedGraftPlanChecksum: "c".repeat(64),
    };
    const parsed = parseHairAuditProjectionRequest({ ...fixture, canonical });
    assert.equal(parsed.ok, false);
  });
});

describe("preSurgeryProjection HMAC", () => {
  it("matches HairAudit newline material format", () => {
    const body = JSON.stringify({ a: 1 });
    const sig = signHairAuditProjectionRequest({
      method: "POST",
      path: "/v1/pre-surgery/projections",
      timestamp: "1700000000",
      idempotencyKey: "k1",
      rawBody: body,
      secret: SIGNING_SECRET,
    });
    assert.match(sig, /^[a-f0-9]{64}$/);
    const bodyHash = sha256Hex(body);
    assert.ok(bodyHash.length === 64);
  });

  it("callback uses timestamp.rawBody material", () => {
    const rawBody = JSON.stringify({ projectionId: "p1", providerResponseId: "r1" });
    const timestamp = "1700000000";
    const sig = signHairAuditProjectionCallback({
      timestamp,
      rawBody,
      secret: CALLBACK_SECRET,
    });
    assert.equal(
      verifyHairAuditProjectionCallbackSignature({
        timestamp,
        rawBody,
        signature: sig,
        secret: CALLBACK_SECRET,
      }),
      true
    );
  });
});

describe("preSurgeryProjection gateway auth + lifecycle", () => {
  beforeEach(() => {
    saveEnv();
    enableGatewayEnv();
  });
  afterEach(() => restoreEnv());

  it("denies anonymous requests", async () => {
    const body = buildHairAuditProjectionFixture();
    const rawBody = JSON.stringify(body);
    const req = new Request("https://fi.example.com/api/v1/pre-surgery/projections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rawBody,
    });
    const result = await handleHairAuditProjectionRequest({
      req,
      rawBody,
      deps: { useMemory: true, config: testConfig() },
    });
    assert.equal(result.httpStatus, 401);
  });

  it("denies authenticated browser cookie sessions without bearer", async () => {
    const body = buildHairAuditProjectionFixture();
    const rawBody = JSON.stringify(body);
    const req = new Request("https://fi.example.com/api/v1/pre-surgery/projections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "sb-access-token=fake",
      },
      body: rawBody,
    });
    const result = await handleHairAuditProjectionRequest({
      req,
      rawBody,
      deps: { useMemory: true, config: testConfig() },
    });
    assert.equal(result.httpStatus, 403);
  });

  it("rejects invalid signatures", async () => {
    const body = buildHairAuditProjectionFixture();
    const { req, rawBody } = signedProjectionRequest(body, {
      "X-HairAudit-Signature": "00".repeat(32),
    });
    const result = await handleHairAuditProjectionRequest({
      req,
      rawBody,
      deps: { useMemory: true, config: testConfig() },
    });
    assert.equal(result.httpStatus, 401);
  });

  it("rejects stale timestamps", async () => {
    const body = buildHairAuditProjectionFixture();
    const stale = String(Math.floor(Date.now() / 1000) - 10_000);
    const { req, rawBody } = signedProjectionRequest(body, {}, { timestamp: stale });
    const result = await handleHairAuditProjectionRequest({
      req,
      rawBody,
      deps: { useMemory: true, config: testConfig() },
    });
    assert.equal(result.httpStatus, 401);
  });

  it("rejects case header mismatch", async () => {
    const body = buildHairAuditProjectionFixture();
    const { req, rawBody } = signedProjectionRequest(body, {
      "X-HairAudit-Case-Id": "other-case",
    });
    // Resign with original would fail case check after parse — signature uses headers' idempotency
    // but case mismatch is checked against body; signature still valid for body.
    const result = await handleHairAuditProjectionRequest({
      req,
      rawBody,
      deps: { useMemory: true, config: testConfig() },
    });
    assert.equal(result.httpStatus, 403);
  });

  it("rejects replayed signed requests", async () => {
    const store = createMemoryReplayStore();
    const body = buildHairAuditProjectionFixture();
    const { req, rawBody } = signedProjectionRequest(body);
    const authTs = req.headers.get("x-hairaudit-timestamp")!;
    const idem = req.headers.get("idempotency-key")!;
    await assertProjectionRequestNotReplayed({
      store,
      serviceSource: "hairaudit",
      timestamp: authTs,
      idempotencyKey: idem,
      rawBody,
    });
    await assert.rejects(
      () =>
        assertProjectionRequestNotReplayed({
          store,
          serviceSource: "hairaudit",
          timestamp: authTs,
          idempotencyKey: idem,
          rawBody,
        }),
      (e: unknown) => e instanceof ProjectionGatewayError && e.code === "replay_rejected"
    );
  });

  it("sync success returns HairAudit-compatible body", async () => {
    const jobStore = createMemoryJobStore();
    const replayStore = createMemoryReplayStore();
    const storage = createMemoryProjectionStorage();
    const body = buildHairAuditProjectionFixture({
      idempotencyKey: "idem-sync-1",
    });
    const { req, rawBody } = signedProjectionRequest(body, {}, { idempotencyKey: "idem-sync-1" });
    const result = await handleHairAuditProjectionRequest({
      req,
      rawBody,
      deps: {
        useMemory: true,
        jobStore,
        replayStore,
        storage,
        config: testConfig(),
      },
    });
    assert.equal(result.httpStatus, 200);
    const res = result.body as Record<string, unknown>;
    assert.ok(typeof res.outputStorageRef === "string" && res.outputStorageRef);
    assert.ok(typeof res.outputChecksum === "string" && String(res.outputChecksum).length === 64);
    assert.ok(Array.isArray(res.limitations));
    assert.ok(String((res.limitations as string[])[0]).includes("STUB"));
  });

  it("idempotency same key + same body returns prior result without regenerating", async () => {
    const jobStore = createMemoryJobStore();
    const replayStore = createMemoryReplayStore();
    const storage = createMemoryProjectionStorage();
    const body = buildHairAuditProjectionFixture({ idempotencyKey: "idem-hit-1" });
    const first = signedProjectionRequest(body, {}, { idempotencyKey: "idem-hit-1" });
    const r1 = await handleHairAuditProjectionRequest({
      req: first.req,
      rawBody: first.rawBody,
      deps: { useMemory: true, jobStore, replayStore, storage, config: testConfig() },
    });
    assert.equal(r1.httpStatus, 200);
    // Same idempotency + body (possibly same-second timestamp) must return prior result.
    const second = signedProjectionRequest(body, {}, { idempotencyKey: "idem-hit-1" });
    const r2 = await handleHairAuditProjectionRequest({
      req: second.req,
      rawBody: second.rawBody,
      deps: { useMemory: true, jobStore, replayStore, storage, config: testConfig() },
    });
    assert.equal(r2.httpStatus, 200);
    assert.equal(
      (r1.body as { outputChecksum: string }).outputChecksum,
      (r2.body as { outputChecksum: string }).outputChecksum
    );
    assert.equal(jobStore.rows.size, 1);
    assert.equal(storage.objects.size, 1);
  });

  it("idempotency conflict on same key different body", async () => {
    const jobStore = createMemoryJobStore();
    const replayStore = createMemoryReplayStore();
    const storage = createMemoryProjectionStorage();
    const body1 = buildHairAuditProjectionFixture({ idempotencyKey: "idem-conflict" });
    const first = signedProjectionRequest(body1, {}, { idempotencyKey: "idem-conflict" });
    await handleHairAuditProjectionRequest({
      req: first.req,
      rawBody: first.rawBody,
      deps: { useMemory: true, jobStore, replayStore, storage, config: testConfig() },
    });
    const body2 = buildHairAuditProjectionFixture({
      idempotencyKey: "idem-conflict",
      deterministicSeed: "different-seed",
    });
    const second = signedProjectionRequest(body2, {}, { idempotencyKey: "idem-conflict" });
    const r2 = await handleHairAuditProjectionRequest({
      req: second.req,
      rawBody: second.rawBody,
      deps: { useMemory: true, jobStore, replayStore, storage, config: testConfig() },
    });
    assert.equal(r2.httpStatus, 409);
  });

  it("stub blocked in production returns 503", async () => {
    enableGatewayEnv({ production: true });
    const body = buildHairAuditProjectionFixture({ idempotencyKey: "idem-prod" });
    const { req, rawBody } = signedProjectionRequest(body, {}, { idempotencyKey: "idem-prod" });
    const result = await handleHairAuditProjectionRequest({
      req,
      rawBody,
      deps: {
        useMemory: true,
        config: testConfig({
          allowStubInProduction: false,
          provider: "stub",
          requireHmac: true,
        }),
      },
    });
    assert.equal(result.httpStatus, 503);
  });

  it("disabled feature returns safe 503", async () => {
    const body = buildHairAuditProjectionFixture();
    const { req, rawBody } = signedProjectionRequest(body);
    const result = await handleHairAuditProjectionRequest({
      req,
      rawBody,
      deps: {
        useMemory: true,
        config: testConfig({ enabled: false }),
      },
    });
    assert.equal(result.httpStatus, 503);
  });

  it("route POST integrates with gateway", async () => {
    const body = buildHairAuditProjectionFixture({ idempotencyKey: "idem-route" });
    const { req } = signedProjectionRequest(body, {}, { idempotencyKey: "idem-route" });
    // Route uses process env + memory because supabase unset
    const res = await projectionPost(req);
    assert.ok([200, 503, 401].includes(res.status));
    // With env enabled should be 200
    assert.equal(res.status, 200);
    const json = (await res.json()) as { outputStorageRef?: string };
    assert.ok(json.outputStorageRef);
  });
});

describe("preSurgeryProjection callback", () => {
  it("builds trusted callback URL from config host only", () => {
    const url = buildHairAuditCallbackUrl({
      callbackBaseUrl: "https://hairaudit.test/api/cases",
      caseId: "case-1",
    });
    assert.equal(
      url,
      "https://hairaudit.test/api/cases/case-1/pre-surgery-intelligence/projection/callback"
    );
  });

  it("signs and retries transient failures", async () => {
    let attempts = 0;
    const fetchImpl: typeof fetch = async () => {
      attempts += 1;
      if (attempts < 3) return new Response("nope", { status: 503 });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const jobStore = createMemoryJobStore();
    const job = await jobStore.insert({
      sourceChannel: "hairaudit_service",
      serviceSource: "hairaudit",
      tenantId: TENANT_ID,
      clinicId: CLINIC_ID,
      caseId: "case-1",
      externalCaseId: "case-1",
      externalProjectionId: "proj-1",
      patientId: null,
      procedureId: null,
      idempotencyKey: "k",
      inputChecksum: "c".repeat(64),
      schemaVersion: "ha-imagingos-pre-surgery-projection-request-v1",
      mode: "planned",
      modelVersion: "stub-v1",
      requestPayloadChecksum: "d".repeat(64),
      providerName: "stub",
      immutableSnapshot: null,
    });
    const completed = await jobStore.update(job.id, {
      status: "completed",
      providerResponseId: "resp-1",
      outputStorageRef: "memory://x",
      outputChecksum: "e".repeat(64),
      completedAt: new Date().toISOString(),
    });
    const result = await deliverHairAuditProjectionCallback({
      job: completed,
      status: "completed",
      config: testConfig({
        callbackBaseUrl: "https://hairaudit.test/api/cases",
        callbackSigningSecret: CALLBACK_SECRET,
      }),
      fetchImpl,
      sleep: async () => undefined,
    });
    assert.equal(result.ok, true);
    assert.equal(attempts, 3);
  });
});

describe("preSurgeryProjection output + domain", () => {
  it("validates stub png output", async () => {
    const sharp = (await import("sharp")).default;
    const bytes = await sharp({
      create: { width: 128, height: 128, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer();
    const validated = await validateProjectionOutputBytes({
      bytes,
      mimeType: "image/png",
      jobId: "j1",
      caseId: "c1",
    });
    assert.equal(validated.width, 128);
    assert.equal(validated.checksum.length, 64);
  });

  it("denies cross-case storage access", () => {
    assert.throws(
      () => assertCrossCaseStorageAccess({ refCaseId: "a", requestedCaseId: "b" }),
      (e: unknown) => e instanceof ProjectionGatewayError && e.code === "cross_case_denied"
    );
  });

  it("enforces job lifecycle and clinician-review rules", () => {
    assert.equal(canTransitionProjectionJob("queued", "generating"), true);
    assert.equal(canTransitionProjectionJob("completed", "generating"), false);
    const job = {
      status: "completed" as const,
      clinicianReviewState: "awaiting_review" as const,
      patientVisibilityEligibility: "eligible_after_approval" as const,
      staleReason: null,
      supersededByJobId: null,
    };
    assert.equal(evaluateApprovalEligibility(job as never).ok, true);
    assert.equal(
      evaluatePatientSharingEligibility({
        ...job,
        clinicianReviewState: "awaiting_review",
      } as never).ok,
      false
    );
  });
});

describe("preSurgeryProjection health + classifier isolation", () => {
  beforeEach(() => {
    saveEnv();
    enableGatewayEnv();
  });
  afterEach(() => restoreEnv());

  it("health requires projection bearer and returns provider state", async () => {
    const req = new Request("https://fi.example.com/api/health", {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const res = await healthGet(req);
    assert.equal(res.status, 200);
    const json = (await res.json()) as { providerState: string; status: string };
    assert.equal(json.providerState, "STUB_ONLY_NON_PRODUCTION");
    assert.ok(["healthy", "degraded", "disabled"].includes(json.status));
  });

  it("health denies without token", async () => {
    const res = await healthGet(new Request("https://fi.example.com/api/health"));
    assert.equal(res.status, 401);
  });

  it("buildProjectionHealth reports disabled when feature off", () => {
    const health = buildProjectionHealth(testConfig({ enabled: false }));
    assert.equal(health.status, "disabled");
    assert.equal(health.providerState, "PROVIDER_DISABLED");
  });

  it("classifier route remains distinct (not projection)", async () => {
    setEnv("FI_INTERNAL_IMAGING_CLASSIFIER_TOKEN", "fi-internal-imaging-token-32chars");
    setEnv("NODE_ENV", "test");
    delete process.env.FI_INTERNAL_IMAGING_REQUIRE_HMAC;
    const body = {
      source_system: "fi_os",
      source_image_id: "img-001",
      signed_url: "https://example.test/x.jpg",
      capture_source: "guided_capture",
      upload_source: "fi_os",
    };
    const req = new Request("https://fi.example.com/api/internal/imaging/classify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer fi-internal-imaging-token-32chars`,
      },
      body: JSON.stringify(body),
    });
    // Projection token must not authorize classifier
    const bad = new Request("https://fi.example.com/api/internal/imaging/classify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(body),
    });
    const badRes = await classifyPost(bad);
    assert.equal(badRes.status, 401);
    // Ensure route module still exports POST (unchanged surface)
    assert.equal(typeof classifyPost, "function");
    assert.equal(typeof projectionPost, "function");
    void req;
  });
});

describe("preSurgeryProjection migration contract", () => {
  it("migration enables RLS and service_role-only grants", () => {
    const sqlPath = path.join(
      process.cwd(),
      "supabase/migrations/202611036001_imaging_os_pre_surgery_projection_1a.sql"
    );
    const sql = readFileSync(sqlPath, "utf8");
    assert.match(sql, /imaging_os_pre_surgery_projection_jobs/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /grant select, insert, update, delete on public\.imaging_os_pre_surgery_projection_jobs to service_role/);
    assert.match(sql, /revoke all on public\.imaging_os_pre_surgery_projection_jobs from public/);
    assert.match(sql, /unique \(service_source, case_id, idempotency_key\)/);
    assert.match(sql, /pre-surgery-projections/);
    assert.match(sql, /source_channel/);
  });
});
