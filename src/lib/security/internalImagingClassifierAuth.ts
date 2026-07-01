/**
 * Internal unified imaging classifier authentication (FIN-IMAGING-2).
 *
 * Bearer token required; optional HMAC when FI_INTERNAL_IMAGING_REQUIRE_HMAC=true.
 * Accepts FI_INTERNAL_IMAGING_CLASSIFIER_TOKEN or legacy HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  CRON_OR_WEBHOOK_SECRET_MIN_LENGTH,
  timingSafeUtf8Equal,
} from "@/src/lib/security/timingSafeSecret";
import {
  getHairauditClassifierToken,
  resolveProvidedBearerToken,
} from "@/src/lib/security/hairauditClassifierAuth";
import { logImagingClassifierEvent } from "@/src/lib/imaging/unifiedClassifier/imagingClassifierObservability";
import { isAllowedUnifiedSourceSystem } from "@/src/lib/imaging/unifiedClassifier/unifiedImageClassifyRequest";

export const FI_INTERNAL_IMAGING_CLASSIFIER_TOKEN_ENV =
  "FI_INTERNAL_IMAGING_CLASSIFIER_TOKEN" as const;
export const FI_INTERNAL_IMAGING_HMAC_SECRET_ENV = "FI_INTERNAL_IMAGING_HMAC_SECRET" as const;
export const FI_INTERNAL_IMAGING_REQUIRE_HMAC_ENV = "FI_INTERNAL_IMAGING_REQUIRE_HMAC" as const;
export const FI_INTERNAL_IMAGING_ALLOWED_SOURCES_ENV =
  "FI_INTERNAL_IMAGING_ALLOWED_SOURCES" as const;

export const FI_IMAGING_HDR_TIMESTAMP = "x-fi-imaging-timestamp" as const;
export const FI_IMAGING_HDR_SIGNATURE = "x-fi-imaging-signature" as const;
export const FI_IMAGING_HDR_SOURCE_SYSTEM = "x-fi-source-system" as const;

export const FI_IMAGING_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

const DEFAULT_ALLOWED_SOURCES = ["fi_os", "hairaudit", "hli", "iiohr"] as const;

function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

export function getInternalImagingClassifierToken(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const primary = env[FI_INTERNAL_IMAGING_CLASSIFIER_TOKEN_ENV]?.trim();
  if (primary) return primary;
  return getHairauditClassifierToken(env);
}

export function resolveAllowedImagingSourceSystems(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const raw = env[FI_INTERNAL_IMAGING_ALLOWED_SOURCES_ENV]?.trim();
  if (!raw) return [...DEFAULT_ALLOWED_SOURCES];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isHmacRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env[FI_INTERNAL_IMAGING_REQUIRE_HMAC_ENV]?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export function getInternalImagingHmacSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = env[FI_INTERNAL_IMAGING_HMAC_SECRET_ENV]?.trim();
  return secret || null;
}

export function buildImagingClassifierSignatureMaterial(timestamp: string, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

export function computeImagingClassifierHmacHex(secret: string, material: string): string {
  return createHmac("sha256", secret).update(material, "utf8").digest("hex");
}

function timingSafeHexEqual(expectedHex: string, providedHex: string): boolean {
  const a = Buffer.from(expectedHex.trim(), "hex");
  const b = Buffer.from(providedHex.trim(), "hex");
  if (a.length !== b.length || a.length === 0) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function parseImagingClassifierTimestampMs(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d{10,13}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n)) return null;
  if (trimmed.length === 10) return n * 1000;
  return n;
}

export function verifyImagingClassifierTimestamp(
  timestampMs: number,
  nowMs: number,
  skewMs: number = FI_IMAGING_TIMESTAMP_SKEW_MS
): boolean {
  return Math.abs(nowMs - timestampMs) <= skewMs;
}

export type InternalImagingClassifierAuthRejectReason =
  | "missing_token_config"
  | "invalid_bearer"
  | "missing_hmac_headers"
  | "invalid_timestamp"
  | "timestamp_skew"
  | "missing_hmac_secret"
  | "signature_invalid"
  | "unsupported_source"
  | "source_header_mismatch";

export type InternalImagingClassifierAuthResult =
  | { ok: true }
  | { ok: false; httpStatus: number; reason: InternalImagingClassifierAuthRejectReason };

export function validateInternalImagingClassifierTokenConfig(
  env: NodeJS.ProcessEnv = process.env
): { valid: true; token: string } | { valid: false; reason: "missing_config" | "too_short" } {
  const token = getInternalImagingClassifierToken(env);
  if (!token) {
    return { valid: false, reason: "missing_config" };
  }
  if (token.length < CRON_OR_WEBHOOK_SECRET_MIN_LENGTH) {
    return { valid: false, reason: "too_short" };
  }

  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRole && token === serviceRole) {
    return { valid: false, reason: "too_short" };
  }

  return { valid: true, token };
}

export function authorizeInternalImagingClassifierRequest(input: {
  req: Request;
  rawBody: string;
  bodySourceSystem?: string;
  env?: NodeJS.ProcessEnv;
  nowMs?: number;
}): InternalImagingClassifierAuthResult {
  const env = input.env ?? process.env;
  const tokenConfig = validateInternalImagingClassifierTokenConfig(env);

  if (!tokenConfig.valid) {
    logImagingClassifierEvent("fi_imaging_classifier_security_rejected", {
      reason: "missing_token_config",
    });
    return {
      ok: false,
      httpStatus: isProductionRuntime(env) ? 503 : 401,
      reason: "missing_token_config",
    };
  }

  const provided = resolveProvidedBearerToken(input.req);
  if (!provided || !timingSafeUtf8Equal(tokenConfig.token, provided)) {
    logImagingClassifierEvent("fi_imaging_classifier_security_rejected", {
      reason: "invalid_bearer",
    });
    return { ok: false, httpStatus: 401, reason: "invalid_bearer" };
  }

  const headerSource = input.req.headers.get(FI_IMAGING_HDR_SOURCE_SYSTEM)?.trim() ?? "";
  const bodySource = input.bodySourceSystem?.trim() ?? "";

  if (bodySource) {
    const allowed = resolveAllowedImagingSourceSystems(env);
    if (!isAllowedUnifiedSourceSystem(bodySource) || !allowed.includes(bodySource)) {
      logImagingClassifierEvent("fi_imaging_classifier_unsupported_source", {
        source_system: bodySource,
      });
      logImagingClassifierEvent("fi_imaging_classifier_security_rejected", {
        reason: "unsupported_source",
        source_system: bodySource,
      });
      return { ok: false, httpStatus: 400, reason: "unsupported_source" };
    }
    if (headerSource && headerSource !== bodySource) {
      logImagingClassifierEvent("fi_imaging_classifier_security_rejected", {
        reason: "source_header_mismatch",
        header_source: headerSource,
        body_source: bodySource,
      });
      return { ok: false, httpStatus: 400, reason: "source_header_mismatch" };
    }
  }

  if (!isHmacRequired(env)) {
    return { ok: true };
  }

  const secret = getInternalImagingHmacSecret(env);
  if (!secret) {
    if (isProductionRuntime(env)) {
      logImagingClassifierEvent("fi_imaging_classifier_security_rejected", {
        reason: "missing_hmac_secret",
      });
      return { ok: false, httpStatus: 503, reason: "missing_hmac_secret" };
    }
    return { ok: true };
  }

  const timestamp = input.req.headers.get(FI_IMAGING_HDR_TIMESTAMP)?.trim() ?? "";
  const signature = input.req.headers.get(FI_IMAGING_HDR_SIGNATURE)?.trim() ?? "";
  if (!timestamp || !signature) {
    logImagingClassifierEvent("fi_imaging_classifier_security_rejected", {
      reason: "missing_hmac_headers",
    });
    return { ok: false, httpStatus: 401, reason: "missing_hmac_headers" };
  }

  const timestampMs = parseImagingClassifierTimestampMs(timestamp);
  if (timestampMs === null) {
    logImagingClassifierEvent("fi_imaging_classifier_security_rejected", {
      reason: "invalid_timestamp",
    });
    return { ok: false, httpStatus: 401, reason: "invalid_timestamp" };
  }

  const nowMs = input.nowMs ?? Date.now();
  if (!verifyImagingClassifierTimestamp(timestampMs, nowMs)) {
    logImagingClassifierEvent("fi_imaging_classifier_security_rejected", {
      reason: "timestamp_skew",
    });
    return { ok: false, httpStatus: 401, reason: "timestamp_skew" };
  }

  const material = buildImagingClassifierSignatureMaterial(timestamp, input.rawBody);
  const expected = computeImagingClassifierHmacHex(secret, material);
  if (!timingSafeHexEqual(expected, signature)) {
    logImagingClassifierEvent("fi_imaging_classifier_security_rejected", {
      reason: "signature_invalid",
    });
    return { ok: false, httpStatus: 401, reason: "signature_invalid" };
  }

  return { ok: true };
}

/** Test helper — sign unified classifier requests when HMAC mode is enabled. */
export function signInternalImagingClassifierRequestForTests(input: {
  secret: string;
  timestamp: string;
  rawBody: string;
}): { timestamp: string; signature: string } {
  const material = buildImagingClassifierSignatureMaterial(input.timestamp, input.rawBody);
  return {
    timestamp: input.timestamp,
    signature: computeImagingClassifierHmacHex(input.secret, material),
  };
}
