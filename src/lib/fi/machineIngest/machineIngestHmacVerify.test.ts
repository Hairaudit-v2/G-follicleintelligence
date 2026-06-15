import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import {
  buildMachineIngestCanonicalString,
  computeMachineIngestHmacHex,
  sha256HexOfBuffer,
} from "./machineIngestCanonical";
import { verifySignedMachineIngestPartnersRequest } from "./machineIngestHmacVerify.server";
import {
  encryptMachineIngestSecret,
  deriveMachineIngestMasterKey,
} from "./machineIngestSecretCrypto.server";
import { evaluateLegacyFiApiAccess } from "@/src/lib/fiOs/legacyFiApiAuth";

/** RFC 4122 variant 1 + version 4 */
const TENANT = "aaaaaaaa-bbbb-442c-8aaa-eeeeeeeeeeee";
const OTHER = "bbbbbbbb-bbbb-442c-8bbb-ffffffffffff";

function makeRequest(input: {
  url: string;
  method?: string;
  headers: Record<string, string>;
  bodyUtf8: string;
}): Request {
  return new Request(input.url, {
    method: input.method ?? "POST",
    headers: {
      "content-type": "application/json",
      ...input.headers,
    },
    body: input.bodyUtf8,
  });
}

function signBody(input: {
  secret: string;
  method: string;
  pathname: string;
  timestampMs: number;
  nonce: string;
  bodyUtf8: string;
}): string {
  const bodySha256Hex = sha256HexOfBuffer(Buffer.from(input.bodyUtf8, "utf8"));
  const canonical = buildMachineIngestCanonicalString({
    method: input.method,
    pathname: input.pathname,
    timestampMs: input.timestampMs,
    nonce: input.nonce,
    bodySha256Hex,
  });
  return computeMachineIngestHmacHex(input.secret, canonical);
}

function createMockSupabase(input: { encrypted: string | null; omitActiveKeyRow?: boolean }) {
  const nonces = new Set<string>();
  return {
    from(table: string) {
      if (table === "fi_machine_ingest_hmac_keys") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: () => ({
                  maybeSingle: async () => {
                    if (input.omitActiveKeyRow) return { data: null, error: null };
                    if (!input.encrypted) return { data: null, error: null };
                    return { data: { secret_encrypted: input.encrypted }, error: null };
                  },
                }),
              }),
            }),
          }),
        };
      }
      if (table === "fi_machine_ingest_nonce") {
        return {
          insert: async (row: { tenant_id: string; kid: string; nonce: string }) => {
            const k = `${row.tenant_id}|${row.kid}|${row.nonce}`;
            if (nonces.has(k)) return { error: { code: "23505", message: "dup" } };
            nonces.add(k);
            return { error: null };
          },
        };
      }
      if (table === "fi_machine_ingest_audit") {
        return {
          insert: async () => ({ error: null }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

describe("machineIngestHmacVerify (partners)", () => {
  const MASTER = "test-machine-ingest-master-key-material-32b!!";
  const SECRET = "tenant-hmac-secret-value";
  let encrypted: string;

  beforeEach(() => {
    process.env.FI_MACHINE_INGEST_MASTER_KEY = MASTER;
    const mk = deriveMachineIngestMasterKey(MASTER);
    assert.ok(mk);
    encrypted = encryptMachineIngestSecret(SECRET, mk);
  });

  it("valid signature and fresh nonce succeeds", async () => {
    const pathname = `/api/ingest/${TENANT}/partners`;
    const url = `https://example.com${pathname}`;
    const bodyUtf8 = JSON.stringify({
      tenant_id: TENANT,
      name: "Partner A",
      reference_code: "ref_ok_1",
    });
    const ts = Date.now();
    const nonce = "nonce-ok-1";
    const sig = signBody({
      secret: SECRET,
      method: "POST",
      pathname,
      timestampMs: ts,
      nonce,
      bodyUtf8,
    });
    const req = makeRequest({
      url,
      headers: {
        "x-fi-timestamp": String(ts),
        "x-fi-nonce": nonce,
        "x-fi-key-id": "kid1",
        "x-fi-signature": sig,
      },
      bodyUtf8,
    });
    const r = await verifySignedMachineIngestPartnersRequest({
      supabase: createMockSupabase({ encrypted }),
      req,
      pathTenantId: TENANT,
      bodyBuf: Buffer.from(bodyUtf8, "utf8"),
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.tenantId, TENANT);
      assert.equal(r.kid, "kid1");
      assert.equal(r.jsonBody.name, "Partner A");
    }
  });

  it("invalid signature fails", async () => {
    const pathname = `/api/ingest/${TENANT}/partners`;
    const bodyUtf8 = JSON.stringify({ tenant_id: TENANT, name: "X", reference_code: "ref_bad_sig" });
    const ts = Date.now();
    const req = makeRequest({
      url: `https://example.com${pathname}`,
      headers: {
        "x-fi-timestamp": String(ts),
        "x-fi-nonce": "nonce-bad-sig",
        "x-fi-key-id": "kid1",
        "x-fi-signature": "00".repeat(32),
      },
      bodyUtf8,
    });
    const r = await verifySignedMachineIngestPartnersRequest({
      supabase: createMockSupabase({ encrypted }),
      req,
      pathTenantId: TENANT,
      bodyBuf: Buffer.from(bodyUtf8, "utf8"),
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.reason, "signature_invalid");
      assert.equal(r.httpStatus, 401);
    }
  });

  it("expired timestamp fails", async () => {
    const pathname = `/api/ingest/${TENANT}/partners`;
    const bodyUtf8 = JSON.stringify({ tenant_id: TENANT, name: "X", reference_code: "ref_old_ts" });
    const ts = Date.now() - 60 * 60 * 1000;
    const nonce = "nonce-old-ts";
    const sig = signBody({
      secret: SECRET,
      method: "POST",
      pathname,
      timestampMs: ts,
      nonce,
      bodyUtf8,
    });
    const req = makeRequest({
      url: `https://example.com${pathname}`,
      headers: {
        "x-fi-timestamp": String(ts),
        "x-fi-nonce": nonce,
        "x-fi-key-id": "kid1",
        "x-fi-signature": sig,
      },
      bodyUtf8,
    });
    const r = await verifySignedMachineIngestPartnersRequest({
      supabase: createMockSupabase({ encrypted }),
      req,
      pathTenantId: TENANT,
      bodyBuf: Buffer.from(bodyUtf8, "utf8"),
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "timestamp_skew");
  });

  it("reused nonce fails on second identical request", async () => {
    const mock = createMockSupabase({ encrypted });
    const pathname = `/api/ingest/${TENANT}/partners`;
    const bodyUtf8 = JSON.stringify({ tenant_id: TENANT, name: "X", reference_code: "ref_replay_twice" });
    const ts = Date.now();
    const nonce = "nonce-replay-twice";
    const sig = signBody({
      secret: SECRET,
      method: "POST",
      pathname,
      timestampMs: ts,
      nonce,
      bodyUtf8,
    });
    const req = makeRequest({
      url: `https://example.com${pathname}`,
      headers: {
        "x-fi-timestamp": String(ts),
        "x-fi-nonce": nonce,
        "x-fi-key-id": "kid1",
        "x-fi-signature": sig,
      },
      bodyUtf8,
    });
    const buf = Buffer.from(bodyUtf8, "utf8");
    const r1 = await verifySignedMachineIngestPartnersRequest({
      supabase: mock,
      req,
      pathTenantId: TENANT,
      bodyBuf: buf,
    });
    assert.equal(r1.ok, true);
    const r2 = await verifySignedMachineIngestPartnersRequest({
      supabase: mock,
      req,
      pathTenantId: TENANT,
      bodyBuf: buf,
    });
    assert.equal(r2.ok, false);
    if (!r2.ok) assert.equal(r2.reason, "replay_nonce");
  });

  it("tenant body mismatch vs path fails", async () => {
    const pathname = `/api/ingest/${TENANT}/partners`;
    const bodyUtf8 = JSON.stringify({ tenant_id: OTHER, name: "X", reference_code: "ref_mismatch" });
    const ts = Date.now();
    const nonce = "nonce-mismatch";
    const sig = signBody({
      secret: SECRET,
      method: "POST",
      pathname,
      timestampMs: ts,
      nonce,
      bodyUtf8,
    });
    const req = makeRequest({
      url: `https://example.com${pathname}`,
      headers: {
        "x-fi-timestamp": String(ts),
        "x-fi-nonce": nonce,
        "x-fi-key-id": "kid1",
        "x-fi-signature": sig,
      },
      bodyUtf8,
    });
    const r = await verifySignedMachineIngestPartnersRequest({
      supabase: createMockSupabase({ encrypted }),
      req,
      pathTenantId: TENANT,
      bodyBuf: Buffer.from(bodyUtf8, "utf8"),
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "tenant_mismatch");
  });

  it("non-integer timestamp header is rejected", async () => {
    const pathname = `/api/ingest/${TENANT}/partners`;
    const bodyUtf8 = JSON.stringify({ tenant_id: TENANT, name: "X", reference_code: "ref_bad_ts" });
    const req = makeRequest({
      url: `https://example.com${pathname}`,
      headers: {
        "x-fi-timestamp": "1700000000000.0",
        "x-fi-nonce": "nonce-bad-ts-1",
        "x-fi-key-id": "kid1",
        "x-fi-signature": "00".repeat(32),
      },
      bodyUtf8,
    });
    const r = await verifySignedMachineIngestPartnersRequest({
      supabase: createMockSupabase({ encrypted }),
      req,
      pathTenantId: TENANT,
      bodyBuf: Buffer.from(bodyUtf8, "utf8"),
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "malformed_headers");
  });

  it("missing signing headers is rejected", async () => {
    const pathname = `/api/ingest/${TENANT}/partners`;
    const bodyUtf8 = JSON.stringify({ tenant_id: TENANT, name: "X", reference_code: "ref_miss_hdr" });
    const ts = Date.now();
    const req = makeRequest({
      url: `https://example.com${pathname}`,
      headers: {
        "x-fi-timestamp": String(ts),
        "x-fi-nonce": "nonce-miss-hdr",
        "x-fi-key-id": "kid1",
      },
      bodyUtf8,
    });
    const r = await verifySignedMachineIngestPartnersRequest({
      supabase: createMockSupabase({ encrypted }),
      req,
      pathTenantId: TENANT,
      bodyBuf: Buffer.from(bodyUtf8, "utf8"),
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "malformed_headers");
  });

  it("unknown kid (no key row) is rejected before MAC", async () => {
    const pathname = `/api/ingest/${TENANT}/partners`;
    const bodyUtf8 = JSON.stringify({ tenant_id: TENANT, name: "X", reference_code: "ref_unk_kid" });
    const ts = Date.now();
    const req = makeRequest({
      url: `https://example.com${pathname}`,
      headers: {
        "x-fi-timestamp": String(ts),
        "x-fi-nonce": "nonce-unk-kid-1",
        "x-fi-key-id": "kid1",
        "x-fi-signature": "ab".repeat(32),
      },
      bodyUtf8,
    });
    const r = await verifySignedMachineIngestPartnersRequest({
      supabase: createMockSupabase({ encrypted: null }),
      req,
      pathTenantId: TENANT,
      bodyBuf: Buffer.from(bodyUtf8, "utf8"),
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "unknown_kid");
  });

  it("no active key row (e.g. revoked) returns unknown_kid", async () => {
    const pathname = `/api/ingest/${TENANT}/partners`;
    const bodyUtf8 = JSON.stringify({ tenant_id: TENANT, name: "X", reference_code: "ref_revoked" });
    const ts = Date.now();
    const req = makeRequest({
      url: `https://example.com${pathname}`,
      headers: {
        "x-fi-timestamp": String(ts),
        "x-fi-nonce": "nonce-revoked-1",
        "x-fi-key-id": "kid1",
        "x-fi-signature": "cd".repeat(32),
      },
      bodyUtf8,
    });
    const r = await verifySignedMachineIngestPartnersRequest({
      supabase: createMockSupabase({ encrypted, omitActiveKeyRow: true }),
      req,
      pathTenantId: TENANT,
      bodyBuf: Buffer.from(bodyUtf8, "utf8"),
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "unknown_kid");
  });

  it("invalid JSON after valid HMAC is rejected", async () => {
    const pathname = `/api/ingest/${TENANT}/partners`;
    const bodyUtf8 = `{"tenant_id":"${TENANT}","name":"X","reference_code":"ref_bad_json","oops":`;
    const ts = Date.now();
    const nonce = "nonce-bad-json-1";
    const sig = signBody({
      secret: SECRET,
      method: "POST",
      pathname,
      timestampMs: ts,
      nonce,
      bodyUtf8,
    });
    const req = makeRequest({
      url: `https://example.com${pathname}`,
      headers: {
        "x-fi-timestamp": String(ts),
        "x-fi-nonce": nonce,
        "x-fi-key-id": "kid1",
        "x-fi-signature": sig,
      },
      bodyUtf8,
    });
    const r = await verifySignedMachineIngestPartnersRequest({
      supabase: createMockSupabase({ encrypted }),
      req,
      pathTenantId: TENANT,
      bodyBuf: Buffer.from(bodyUtf8, "utf8"),
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "invalid_json");
  });
});

describe("machineIngestHmacVerify production master key length", () => {
  /** `process.env` typings mark some keys read-only; tests must assign/delete freely. */
  const testEnv = process.env as Record<string, string | undefined>;
  const saved = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    FI_MACHINE_INGEST_MASTER_KEY: process.env.FI_MACHINE_INGEST_MASTER_KEY,
  };

  afterEach(() => {
    if (saved.NODE_ENV === undefined) delete testEnv.NODE_ENV;
    else testEnv.NODE_ENV = saved.NODE_ENV;
    if (saved.VERCEL_ENV === undefined) delete testEnv.VERCEL_ENV;
    else testEnv.VERCEL_ENV = saved.VERCEL_ENV;
    if (saved.FI_MACHINE_INGEST_MASTER_KEY === undefined) delete testEnv.FI_MACHINE_INGEST_MASTER_KEY;
    else testEnv.FI_MACHINE_INGEST_MASTER_KEY = saved.FI_MACHINE_INGEST_MASTER_KEY;
  });

  it("rejects when master key is shorter than 32 chars in production", async () => {
    testEnv.NODE_ENV = "production";
    delete testEnv.VERCEL_ENV;
    testEnv.FI_MACHINE_INGEST_MASTER_KEY = "x".repeat(31);

    const pathname = `/api/ingest/${TENANT}/partners`;
    const bodyUtf8 = JSON.stringify({ tenant_id: TENANT, name: "X", reference_code: "ref_weak_mk" });
    const ts = Date.now();
    const req = makeRequest({
      url: `https://example.com${pathname}`,
      headers: {
        "x-fi-timestamp": String(ts),
        "x-fi-nonce": "nonce-weak-mk-1",
        "x-fi-key-id": "kid1",
        "x-fi-signature": "00".repeat(32),
      },
      bodyUtf8,
    });
    const r = await verifySignedMachineIngestPartnersRequest({
      supabase: createMockSupabase({ encrypted: "dummy" }),
      req,
      pathTenantId: TENANT,
      bodyBuf: Buffer.from(bodyUtf8, "utf8"),
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.reason, "master_key_weak");
      assert.equal(r.httpStatus, 503);
    }
  });
});

describe("legacy POST /api/fi/partners gate unchanged", () => {
  it("returns 404 when legacy FI API disabled (default)", () => {
    const r = evaluateLegacyFiApiAccess(
      new Request("https://example.com/api/fi/partners", { method: "POST" }),
      {}
    );
    assert.ok(r);
    assert.equal(r.status, 404);
  });

  it("returns null when enabled with correct bearer", () => {
    const env = { FI_LEGACY_FI_API_ENABLED: "true", FI_LEGACY_FI_API_SECRET: "secret-value" };
    const r = evaluateLegacyFiApiAccess(
      new Request("https://example.com/api/fi/partners", {
        method: "POST",
        headers: { Authorization: "Bearer secret-value" },
      }),
      env
    );
    assert.equal(r, null);
  });
});
