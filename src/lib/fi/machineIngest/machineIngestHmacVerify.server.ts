import type { SupabaseClient } from "@supabase/supabase-js";

import { logStructured } from "@/src/lib/server/structuredLog";
import {
  buildMachineIngestCanonicalString,
  isMachineIngestProductionDeploy,
  MACHINE_INGEST_MASTER_KEY_MIN_PRODUCTION_LENGTH,
  MACHINE_INGEST_TIMESTAMP_SKEW_MS,
  parseMachineIngestTimestampMs,
  sha256HexOfBuffer,
  verifyMachineIngestHmacTimingSafe,
  verifyMachineIngestTimestamp,
} from "@/src/lib/fi/machineIngest/machineIngestCanonical";
import {
  decryptMachineIngestSecret,
  deriveMachineIngestMasterKey,
} from "@/src/lib/fi/machineIngest/machineIngestSecretCrypto.server";

const HDR_TS = "x-fi-timestamp";
const HDR_NONCE = "x-fi-nonce";
const HDR_KID = "x-fi-key-id";
const HDR_SIG = "x-fi-signature";

const KID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const NONCE_RE = /^[a-zA-Z0-9._-]{8,128}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MachineIngestRejectReason =
  | "malformed_headers"
  | "missing_master_key"
  | "master_key_weak"
  | "unknown_kid"
  | "decrypt_failed"
  | "signature_invalid"
  | "timestamp_skew"
  | "tenant_mismatch"
  | "invalid_json"
  | "replay_nonce"
  | "nonce_reserve_failed";

export type MachineIngestVerifySuccess = {
  ok: true;
  tenantId: string;
  kid: string;
  jsonBody: Record<string, unknown>;
  bodySha256Hex: string;
};

export type MachineIngestVerifyFailure = {
  ok: false;
  httpStatus: number;
  reason: MachineIngestRejectReason;
  publicMessage: string;
  tenantId: string | null;
  kid: string | null;
  bodySha256Hex: string;
};

export type MachineIngestVerifyResult = MachineIngestVerifySuccess | MachineIngestVerifyFailure;

async function insertMachineIngestAudit(
  supabase: SupabaseClient,
  row: {
    tenant_id: string | null;
    kid: string | null;
    route: string;
    outcome: "accepted" | "rejected";
    reason_code: string | null;
    http_status: number | null;
    body_sha256: string | null;
  }
): Promise<void> {
  const { error } = await supabase.from("fi_machine_ingest_audit").insert({
    tenant_id: row.tenant_id,
    kid: row.kid,
    route: row.route,
    outcome: row.outcome,
    reason_code: row.reason_code,
    http_status: row.http_status,
    body_sha256: row.body_sha256,
  });
  if (error) {
    logStructured("error", "machine_ingest_audit_insert_failed", {
      route: row.route,
      outcome: row.outcome,
      err: error.message,
    });
  }
}

function safeLogFragment(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function logRejection(fields: {
  reason: MachineIngestRejectReason;
  route: string;
  tenant_id?: string | null;
  kid?: string | null;
  http_status: number;
}): void {
  logStructured("warn", "machine_ingest_rejected", {
    reason: fields.reason,
    route: fields.route,
    http_status: fields.http_status,
    tenant_id_prefix: safeLogFragment(fields.tenant_id ?? null, 10),
    kid_prefix: safeLogFragment(fields.kid ?? null, 8),
  });
}

/**
 * Verifies HMAC, timestamp skew, tenant path match, reserves nonce (replay protection), inserts reject audit on failure.
 * On success, caller must insert an **accepted** audit after business logic completes (or failure audit if business fails).
 */
export async function verifySignedMachineIngestPartnersRequest(input: {
  supabase: SupabaseClient;
  req: Request;
  pathTenantId: string;
  bodyBuf: Buffer;
}): Promise<MachineIngestVerifyResult> {
  const pathname = new URL(input.req.url).pathname;
  const route = pathname;
  const bodySha256Hex = sha256HexOfBuffer(input.bodyBuf);

  const tidPath = input.pathTenantId.trim();
  if (!UUID_RE.test(tidPath)) {
    const fail: MachineIngestVerifyFailure = {
      ok: false,
      httpStatus: 400,
      reason: "malformed_headers",
      publicMessage: "Invalid tenant id.",
      tenantId: null,
      kid: null,
      bodySha256Hex,
    };
    logRejection({ reason: fail.reason, route, http_status: fail.httpStatus });
    await insertMachineIngestAudit(input.supabase, {
      tenant_id: null,
      kid: null,
      route,
      outcome: "rejected",
      reason_code: fail.reason,
      http_status: fail.httpStatus,
      body_sha256: bodySha256Hex,
    });
    return fail;
  }

  const tsTrim = input.req.headers.get(HDR_TS)?.trim() ?? "";
  const nonce = input.req.headers.get(HDR_NONCE)?.trim() ?? "";
  const kid = input.req.headers.get(HDR_KID)?.trim() ?? "";
  const sig = input.req.headers.get(HDR_SIG)?.trim() ?? "";

  if (!tsTrim || !nonce || !kid || !sig) {
    const fail: MachineIngestVerifyFailure = {
      ok: false,
      httpStatus: 400,
      reason: "malformed_headers",
      publicMessage: "Missing signing headers (x-fi-timestamp, x-fi-nonce, x-fi-key-id, x-fi-signature).",
      tenantId: tidPath,
      kid: kid || null,
      bodySha256Hex,
    };
    logRejection({ reason: fail.reason, route, tenant_id: tidPath, kid: fail.kid, http_status: fail.httpStatus });
    await insertMachineIngestAudit(input.supabase, {
      tenant_id: tidPath,
      kid: fail.kid,
      route,
      outcome: "rejected",
      reason_code: fail.reason,
      http_status: fail.httpStatus,
      body_sha256: bodySha256Hex,
    });
    return fail;
  }

  if (!KID_RE.test(kid) || !NONCE_RE.test(nonce)) {
    const fail: MachineIngestVerifyFailure = {
      ok: false,
      httpStatus: 400,
      reason: "malformed_headers",
      publicMessage: "Invalid key id or nonce format.",
      tenantId: tidPath,
      kid,
      bodySha256Hex,
    };
    logRejection({ reason: fail.reason, route, tenant_id: tidPath, kid, http_status: fail.httpStatus });
    await insertMachineIngestAudit(input.supabase, {
      tenant_id: tidPath,
      kid,
      route,
      outcome: "rejected",
      reason_code: fail.reason,
      http_status: fail.httpStatus,
      body_sha256: bodySha256Hex,
    });
    return fail;
  }

  const tsMs = parseMachineIngestTimestampMs(tsTrim);
  if (tsMs === null) {
    const fail: MachineIngestVerifyFailure = {
      ok: false,
      httpStatus: 400,
      reason: "malformed_headers",
      publicMessage: "Invalid timestamp.",
      tenantId: tidPath,
      kid,
      bodySha256Hex,
    };
    logRejection({ reason: fail.reason, route, tenant_id: tidPath, kid, http_status: fail.httpStatus });
    await insertMachineIngestAudit(input.supabase, {
      tenant_id: tidPath,
      kid,
      route,
      outcome: "rejected",
      reason_code: fail.reason,
      http_status: fail.httpStatus,
      body_sha256: bodySha256Hex,
    });
    return fail;
  }

  const now = Date.now();
  if (!verifyMachineIngestTimestamp(tsMs, now, MACHINE_INGEST_TIMESTAMP_SKEW_MS)) {
    const fail: MachineIngestVerifyFailure = {
      ok: false,
      httpStatus: 401,
      reason: "timestamp_skew",
      publicMessage: "Request timestamp outside allowed window.",
      tenantId: tidPath,
      kid,
      bodySha256Hex,
    };
    logRejection({ reason: fail.reason, route, tenant_id: tidPath, kid, http_status: fail.httpStatus });
    await insertMachineIngestAudit(input.supabase, {
      tenant_id: tidPath,
      kid,
      route,
      outcome: "rejected",
      reason_code: fail.reason,
      http_status: fail.httpStatus,
      body_sha256: bodySha256Hex,
    });
    return fail;
  }

  const masterRaw = (process.env.FI_MACHINE_INGEST_MASTER_KEY ?? "").trim();
  if (!masterRaw) {
    const fail: MachineIngestVerifyFailure = {
      ok: false,
      httpStatus: 503,
      reason: "missing_master_key",
      publicMessage: "Service unavailable.",
      tenantId: tidPath,
      kid,
      bodySha256Hex,
    };
    logRejection({ reason: fail.reason, route, tenant_id: tidPath, kid, http_status: fail.httpStatus });
    await insertMachineIngestAudit(input.supabase, {
      tenant_id: tidPath,
      kid,
      route,
      outcome: "rejected",
      reason_code: fail.reason,
      http_status: fail.httpStatus,
      body_sha256: bodySha256Hex,
    });
    return fail;
  }

  if (isMachineIngestProductionDeploy() && masterRaw.length < MACHINE_INGEST_MASTER_KEY_MIN_PRODUCTION_LENGTH) {
    logStructured("error", "machine_ingest_master_key_production_length_invalid", {
      route,
      min_length: MACHINE_INGEST_MASTER_KEY_MIN_PRODUCTION_LENGTH,
      length: masterRaw.length,
    });
    const fail: MachineIngestVerifyFailure = {
      ok: false,
      httpStatus: 503,
      reason: "master_key_weak",
      publicMessage: "Service unavailable.",
      tenantId: tidPath,
      kid,
      bodySha256Hex,
    };
    logRejection({ reason: fail.reason, route, tenant_id: tidPath, kid, http_status: fail.httpStatus });
    await insertMachineIngestAudit(input.supabase, {
      tenant_id: tidPath,
      kid,
      route,
      outcome: "rejected",
      reason_code: fail.reason,
      http_status: fail.httpStatus,
      body_sha256: bodySha256Hex,
    });
    return fail;
  }

  const masterKey = deriveMachineIngestMasterKey(masterRaw);
  if (!masterKey) {
    const fail: MachineIngestVerifyFailure = {
      ok: false,
      httpStatus: 503,
      reason: "missing_master_key",
      publicMessage: "Service unavailable.",
      tenantId: tidPath,
      kid,
      bodySha256Hex,
    };
    logRejection({ reason: fail.reason, route, tenant_id: tidPath, kid, http_status: fail.httpStatus });
    await insertMachineIngestAudit(input.supabase, {
      tenant_id: tidPath,
      kid,
      route,
      outcome: "rejected",
      reason_code: fail.reason,
      http_status: fail.httpStatus,
      body_sha256: bodySha256Hex,
    });
    return fail;
  }

  const { data: keyRow, error: keyErr } = await input.supabase
    .from("fi_machine_ingest_hmac_keys")
    .select("secret_encrypted")
    .eq("tenant_id", tidPath)
    .eq("kid", kid)
    .is("revoked_at", null)
    .maybeSingle();

  if (keyErr || !keyRow?.secret_encrypted) {
    const fail: MachineIngestVerifyFailure = {
      ok: false,
      httpStatus: 401,
      reason: "unknown_kid",
      publicMessage: "Unauthorized.",
      tenantId: tidPath,
      kid,
      bodySha256Hex,
    };
    logRejection({ reason: fail.reason, route, tenant_id: tidPath, kid, http_status: fail.httpStatus });
    await insertMachineIngestAudit(input.supabase, {
      tenant_id: tidPath,
      kid,
      route,
      outcome: "rejected",
      reason_code: fail.reason,
      http_status: fail.httpStatus,
      body_sha256: bodySha256Hex,
    });
    return fail;
  }

  let secret: string;
  try {
    secret = decryptMachineIngestSecret(String(keyRow.secret_encrypted), masterKey);
  } catch {
    const fail: MachineIngestVerifyFailure = {
      ok: false,
      httpStatus: 503,
      reason: "decrypt_failed",
      publicMessage: "Service unavailable.",
      tenantId: tidPath,
      kid,
      bodySha256Hex,
    };
    logRejection({ reason: fail.reason, route, tenant_id: tidPath, kid, http_status: fail.httpStatus });
    await insertMachineIngestAudit(input.supabase, {
      tenant_id: tidPath,
      kid,
      route,
      outcome: "rejected",
      reason_code: fail.reason,
      http_status: fail.httpStatus,
      body_sha256: bodySha256Hex,
    });
    return fail;
  }

  const canonical = buildMachineIngestCanonicalString({
    method: input.req.method,
    pathname,
    timestampMs: tsMs,
    nonce,
    bodySha256Hex,
  });

  if (!verifyMachineIngestHmacTimingSafe(secret, canonical, sig)) {
    const fail: MachineIngestVerifyFailure = {
      ok: false,
      httpStatus: 401,
      reason: "signature_invalid",
      publicMessage: "Unauthorized.",
      tenantId: tidPath,
      kid,
      bodySha256Hex,
    };
    logRejection({ reason: fail.reason, route, tenant_id: tidPath, kid, http_status: fail.httpStatus });
    await insertMachineIngestAudit(input.supabase, {
      tenant_id: tidPath,
      kid,
      route,
      outcome: "rejected",
      reason_code: fail.reason,
      http_status: fail.httpStatus,
      body_sha256: bodySha256Hex,
    });
    return fail;
  }

  let jsonBody: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(input.bodyBuf.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not_object");
    }
    jsonBody = parsed as Record<string, unknown>;
  } catch {
    const fail: MachineIngestVerifyFailure = {
      ok: false,
      httpStatus: 400,
      reason: "invalid_json",
      publicMessage: "Invalid JSON body.",
      tenantId: tidPath,
      kid,
      bodySha256Hex,
    };
    logRejection({ reason: fail.reason, route, tenant_id: tidPath, kid, http_status: fail.httpStatus });
    await insertMachineIngestAudit(input.supabase, {
      tenant_id: tidPath,
      kid,
      route,
      outcome: "rejected",
      reason_code: fail.reason,
      http_status: fail.httpStatus,
      body_sha256: bodySha256Hex,
    });
    return fail;
  }

  const bodyTenant = typeof jsonBody.tenant_id === "string" ? jsonBody.tenant_id.trim() : "";
  if (!bodyTenant || bodyTenant !== tidPath) {
    const fail: MachineIngestVerifyFailure = {
      ok: false,
      httpStatus: 400,
      reason: "tenant_mismatch",
      publicMessage: "tenant_id must match path tenant.",
      tenantId: tidPath,
      kid,
      bodySha256Hex,
    };
    logRejection({ reason: fail.reason, route, tenant_id: tidPath, kid, http_status: fail.httpStatus });
    await insertMachineIngestAudit(input.supabase, {
      tenant_id: tidPath,
      kid,
      route,
      outcome: "rejected",
      reason_code: fail.reason,
      http_status: fail.httpStatus,
      body_sha256: bodySha256Hex,
    });
    return fail;
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error: nonceErr } = await input.supabase.from("fi_machine_ingest_nonce").insert({
    tenant_id: tidPath,
    kid,
    nonce,
    expires_at: expiresAt,
  });

  if (nonceErr?.code === "23505") {
    const fail: MachineIngestVerifyFailure = {
      ok: false,
      httpStatus: 409,
      reason: "replay_nonce",
      publicMessage: "Replay detected.",
      tenantId: tidPath,
      kid,
      bodySha256Hex,
    };
    logRejection({ reason: fail.reason, route, tenant_id: tidPath, kid, http_status: fail.httpStatus });
    await insertMachineIngestAudit(input.supabase, {
      tenant_id: tidPath,
      kid,
      route,
      outcome: "rejected",
      reason_code: fail.reason,
      http_status: fail.httpStatus,
      body_sha256: bodySha256Hex,
    });
    return fail;
  }

  if (nonceErr) {
    const fail: MachineIngestVerifyFailure = {
      ok: false,
      httpStatus: 500,
      reason: "nonce_reserve_failed",
      publicMessage: "Could not reserve request nonce.",
      tenantId: tidPath,
      kid,
      bodySha256Hex,
    };
    logRejection({ reason: fail.reason, route, tenant_id: tidPath, kid, http_status: fail.httpStatus });
    await insertMachineIngestAudit(input.supabase, {
      tenant_id: tidPath,
      kid,
      route,
      outcome: "rejected",
      reason_code: fail.reason,
      http_status: fail.httpStatus,
      body_sha256: bodySha256Hex,
    });
    return fail;
  }

  return {
    ok: true,
    tenantId: tidPath,
    kid,
    jsonBody,
    bodySha256Hex,
  };
}

export async function insertMachineIngestAcceptedAudit(input: {
  supabase: SupabaseClient;
  route: string;
  tenantId: string;
  kid: string;
  bodySha256Hex: string;
  httpStatus: number;
}): Promise<void> {
  await insertMachineIngestAudit(input.supabase, {
    tenant_id: input.tenantId,
    kid: input.kid,
    route: input.route,
    outcome: "accepted",
    reason_code: "accepted",
    http_status: input.httpStatus,
    body_sha256: input.bodySha256Hex,
  });
}

export async function insertMachineIngestRejectedAfterVerify(input: {
  supabase: SupabaseClient;
  route: string;
  tenantId: string;
  kid: string;
  bodySha256Hex: string;
  reason_code: string;
  httpStatus: number;
}): Promise<void> {
  logStructured("warn", "machine_ingest_rejected", {
    reason: input.reason_code,
    route: input.route,
    http_status: input.httpStatus,
    tenant_id_prefix: safeLogFragment(input.tenantId, 10),
    kid_prefix: safeLogFragment(input.kid, 8),
  });
  await insertMachineIngestAudit(input.supabase, {
    tenant_id: input.tenantId,
    kid: input.kid,
    route: input.route,
    outcome: "rejected",
    reason_code: input.reason_code,
    http_status: input.httpStatus,
    body_sha256: input.bodySha256Hex,
  });
}
