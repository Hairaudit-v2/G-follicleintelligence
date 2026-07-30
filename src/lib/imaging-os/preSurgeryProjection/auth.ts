/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — Inbound service auth + HMAC verification.
 */

import { resolveProvidedBearerToken } from "@/src/lib/security/hairauditClassifierAuth";
import { timingSafeUtf8Equal } from "@/src/lib/security/timingSafeSecret";
import {
  DEFAULT_PROJECTION_PATH,
  HDR_HA_CASE_ID,
  HDR_HA_SIGNATURE,
  HDR_HA_TIMESTAMP,
  HDR_IDEMPOTENCY_KEY,
  isProductionRuntime,
  resolveProjectionGatewayConfig,
  validateProjectionServiceToken,
  type ProjectionGatewayConfig,
} from "./config.server";
import { ProjectionGatewayError } from "./errors";
import { signHairAuditProjectionRequest, timingSafeHexEqual } from "./hmac";
import { logProjectionEvent } from "./observability";

export type ProjectionAuthOk = {
  ok: true;
  idempotencyKey: string;
  timestamp: string;
  caseIdHeader: string;
  signatureVerified: boolean;
};

function parseUnixTimestampSeconds(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d{10}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) ? n : null;
}

export function authorizeHairAuditProjectionRequest(input: {
  req: Request;
  rawBody: string;
  path?: string;
  caseIdFromBody?: string;
  env?: NodeJS.ProcessEnv;
  nowMs?: number;
  config?: ProjectionGatewayConfig;
}): ProjectionAuthOk {
  const env = input.env ?? process.env;
  const config = input.config ?? resolveProjectionGatewayConfig(env);
  const nowMs = input.nowMs ?? Date.now();

  const tokenConfig = validateProjectionServiceToken(env);
  if (!tokenConfig.valid) {
    logProjectionEvent({
      event: "authentication_failed",
      reason: "missing_token_config",
      httpStatus: isProductionRuntime(env) ? 503 : 401,
    });
    throw new ProjectionGatewayError(
      "missing_token_config",
      "Projection service token is not configured",
      isProductionRuntime(env) ? 503 : 401
    );
  }

  const provided = resolveProvidedBearerToken(input.req);
  if (!provided || !timingSafeUtf8Equal(tokenConfig.token, provided)) {
    // Reject cookie/session-style browser calls the same as bad bearer — no session path.
    const hasCookie = Boolean(input.req.headers.get("cookie")?.trim());
    const reason = hasCookie && !provided ? "browser_session_denied" : "invalid_bearer";
    logProjectionEvent({
      event: "authentication_failed",
      reason,
      httpStatus: reason === "browser_session_denied" ? 403 : 401,
    });
    throw new ProjectionGatewayError(
      reason === "browser_session_denied" ? "browser_session_denied" : "invalid_bearer",
      reason === "browser_session_denied"
        ? "Browser sessions cannot call the projection gateway"
        : "Invalid projection service token",
      reason === "browser_session_denied" ? 403 : 401
    );
  }

  const idempotencyKey = input.req.headers.get(HDR_IDEMPOTENCY_KEY)?.trim() ?? "";
  if (!idempotencyKey) {
    throw new ProjectionGatewayError(
      "validation_failed",
      "Idempotency-Key header is required",
      400
    );
  }

  const caseIdHeader = input.req.headers.get(HDR_HA_CASE_ID)?.trim() ?? "";
  if (!caseIdHeader) {
    throw new ProjectionGatewayError(
      "validation_failed",
      "X-HairAudit-Case-Id header is required",
      400
    );
  }
  if (input.caseIdFromBody && input.caseIdFromBody !== caseIdHeader) {
    logProjectionEvent({
      event: "authentication_failed",
      reason: "case_header_mismatch",
      externalCaseId: caseIdHeader,
      httpStatus: 403,
    });
    throw new ProjectionGatewayError(
      "case_header_mismatch",
      "Case ID header does not match request body",
      403
    );
  }

  const timestamp = input.req.headers.get(HDR_HA_TIMESTAMP)?.trim() ?? "";
  const signature = input.req.headers.get(HDR_HA_SIGNATURE)?.trim() ?? "";
  const hmacRequired = config.requireHmac || Boolean(config.requestSigningSecret);

  if (hmacRequired) {
    if (!config.requestSigningSecret) {
      logProjectionEvent({
        event: "signature_failed",
        reason: "missing_hmac_secret",
        httpStatus: 503,
      });
      throw new ProjectionGatewayError(
        "missing_token_config",
        "Projection request signing secret is not configured",
        503
      );
    }
    if (!timestamp || !signature) {
      logProjectionEvent({
        event: "signature_failed",
        reason: "missing_hmac_headers",
        httpStatus: 401,
      });
      throw new ProjectionGatewayError(
        "missing_hmac_headers",
        "Missing HairAudit timestamp or signature headers",
        401
      );
    }

    const tsSec = parseUnixTimestampSeconds(timestamp);
    if (tsSec === null) {
      throw new ProjectionGatewayError("invalid_timestamp", "Invalid timestamp", 401);
    }
    if (Math.abs(nowMs - tsSec * 1000) > config.timestampSkewSeconds * 1000) {
      logProjectionEvent({
        event: "signature_failed",
        reason: "timestamp_skew",
        httpStatus: 401,
      });
      throw new ProjectionGatewayError("timestamp_skew", "Request timestamp outside allowed skew", 401);
    }

    const expected = signHairAuditProjectionRequest({
      method: "POST",
      path: input.path ?? DEFAULT_PROJECTION_PATH,
      timestamp,
      idempotencyKey,
      rawBody: input.rawBody,
      secret: config.requestSigningSecret,
    });
    if (!timingSafeHexEqual(expected, signature)) {
      logProjectionEvent({
        event: "signature_failed",
        reason: "signature_invalid",
        httpStatus: 401,
      });
      throw new ProjectionGatewayError("signature_invalid", "Invalid request signature", 401);
    }

    return {
      ok: true,
      idempotencyKey,
      timestamp,
      caseIdHeader,
      signatureVerified: true,
    };
  }

  return {
    ok: true,
    idempotencyKey,
    timestamp: timestamp || String(Math.floor(nowMs / 1000)),
    caseIdHeader,
    signatureVerified: false,
  };
}

export function authorizeProjectionHealthRequest(input: {
  req: Request;
  env?: NodeJS.ProcessEnv;
}): void {
  const env = input.env ?? process.env;
  const tokenConfig = validateProjectionServiceToken(env);
  if (!tokenConfig.valid) {
    throw new ProjectionGatewayError(
      "missing_token_config",
      "Projection service token is not configured",
      isProductionRuntime(env) ? 503 : 401
    );
  }
  const provided = resolveProvidedBearerToken(input.req);
  if (!provided || !timingSafeUtf8Equal(tokenConfig.token, provided)) {
    throw new ProjectionGatewayError("invalid_bearer", "Invalid projection service token", 401);
  }
}
