/**
 * FI-PATIENT-APP-1C — HMAC-signed patient image upload intents (pure).
 * Intent tokens bind tenant, patient, auth user, storage path, MIME, size, and slot.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { PatientGatewayImageSlot } from "./patientGatewayImageSlots";

export const PATIENT_GATEWAY_UPLOAD_INTENT_TTL_MS = 15 * 60 * 1000;
export const PATIENT_GATEWAY_SIGNED_READ_TTL_SEC = 15 * 60;

export type PatientGatewayUploadIntentPayload = {
  v: 1;
  intentId: string;
  imageId: string;
  tenantId: string;
  patientId: string;
  authUserId: string;
  slot: PatientGatewayImageSlot;
  mimeType: string;
  fileSize: number;
  bucket: string;
  storagePath: string;
  exp: number;
  nonce: string;
};

export function resolvePatientGatewayUploadIntentSecret(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const secret = (
    env.FI_PATIENT_GATEWAY_UPLOAD_INTENT_SECRET ??
    env.FI_INTERNAL_IMAGING_HMAC_SECRET ??
    env.FI_EXTERNAL_CONNECTOR_MASTER_KEY ??
    env.CRON_SECRET ??
    ""
  ).trim();
  return secret || null;
}

export function signPatientGatewayUploadIntent(
  payload: Omit<PatientGatewayUploadIntentPayload, "v" | "nonce" | "exp"> & {
    nonce?: string;
    exp?: number;
  },
  secret: string,
  nowMs: number = Date.now()
): string {
  const full: PatientGatewayUploadIntentPayload = {
    v: 1,
    intentId: payload.intentId.trim(),
    imageId: payload.imageId.trim(),
    tenantId: payload.tenantId.trim(),
    patientId: payload.patientId.trim(),
    authUserId: payload.authUserId.trim(),
    slot: payload.slot,
    mimeType: payload.mimeType.trim().toLowerCase(),
    fileSize: payload.fileSize,
    bucket: payload.bucket.trim(),
    storagePath: payload.storagePath.trim(),
    nonce: payload.nonce ?? randomBytes(12).toString("hex"),
    exp: payload.exp ?? nowMs + PATIENT_GATEWAY_UPLOAD_INTENT_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(full), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payloadB64, "utf8").digest("base64url");
  return `${payloadB64}.${signature}`;
}

export type VerifyUploadIntentResult =
  | { ok: true; payload: PatientGatewayUploadIntentPayload }
  | { ok: false; reason: "invalid" | "expired" };

export function verifyPatientGatewayUploadIntent(
  token: string,
  secret: string,
  nowMs: number = Date.now()
): VerifyUploadIntentResult {
  const trimmed = token.trim();
  const dotIdx = trimmed.lastIndexOf(".");
  if (dotIdx <= 0) return { ok: false, reason: "invalid" };

  const payloadB64 = trimmed.slice(0, dotIdx);
  const providedSig = trimmed.slice(dotIdx + 1);
  const expectedSig = createHmac("sha256", secret).update(payloadB64, "utf8").digest("base64url");

  const a = Buffer.from(expectedSig);
  const b = Buffer.from(providedSig);
  if (a.length !== b.length || a.length === 0) return { ok: false, reason: "invalid" };
  try {
    if (!timingSafeEqual(a, b)) return { ok: false, reason: "invalid" };
  } catch {
    return { ok: false, reason: "invalid" };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as PatientGatewayUploadIntentPayload;
    if (
      parsed.v !== 1 ||
      !parsed.intentId?.trim() ||
      !parsed.imageId?.trim() ||
      !parsed.tenantId?.trim() ||
      !parsed.patientId?.trim() ||
      !parsed.authUserId?.trim() ||
      !parsed.slot?.trim() ||
      !parsed.mimeType?.trim() ||
      !parsed.bucket?.trim() ||
      !parsed.storagePath?.trim() ||
      !parsed.nonce?.trim() ||
      typeof parsed.fileSize !== "number" ||
      typeof parsed.exp !== "number"
    ) {
      return { ok: false, reason: "invalid" };
    }
    if (parsed.exp < nowMs) return { ok: false, reason: "expired" };
    return {
      ok: true,
      payload: {
        v: 1,
        intentId: parsed.intentId.trim(),
        imageId: parsed.imageId.trim(),
        tenantId: parsed.tenantId.trim(),
        patientId: parsed.patientId.trim(),
        authUserId: parsed.authUserId.trim(),
        slot: parsed.slot,
        mimeType: parsed.mimeType.trim().toLowerCase(),
        fileSize: parsed.fileSize,
        bucket: parsed.bucket.trim(),
        storagePath: parsed.storagePath.trim(),
        exp: parsed.exp,
        nonce: parsed.nonce.trim(),
      },
    };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

/** Fail-closed ownership check between gateway context and verified intent. */
export function assertUploadIntentOwnedByContext(
  payload: PatientGatewayUploadIntentPayload,
  ctx: { authUserId: string; patientId: string; tenantId: string }
): "ok" | "ownership" | "wrong_tenant" {
  if (payload.tenantId !== ctx.tenantId.trim()) return "wrong_tenant";
  if (payload.patientId !== ctx.patientId.trim()) return "ownership";
  if (payload.authUserId !== ctx.authUserId.trim()) return "ownership";
  return "ok";
}

export function assertStoragePathMatchesIntent(
  payload: PatientGatewayUploadIntentPayload,
  claimedPath: string | null | undefined
): boolean {
  const claimed = claimedPath?.trim() || "";
  if (!claimed) return true; // client must not supply path; empty is fine
  return claimed === payload.storagePath;
}
