import { createHash, timingSafeEqual } from "node:crypto";

import { CRON_OR_WEBHOOK_SECRET_MIN_LENGTH } from "@/src/lib/security/timingSafeSecret";

export class TimelyWebhookAuthError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "TimelyWebhookAuthError";
  }
}

function sha256Hex(input: string): Buffer {
  return createHash("sha256").update(input, "utf8").digest();
}

/** Constant-time comparison for arbitrary-length secrets. */
export function timingSafeSecretEquals(expected: string, received: string): boolean {
  const a = sha256Hex(expected);
  const b = sha256Hex(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

function extractBearerToken(request: Request): string | null {
  const raw = request.headers.get("authorization")?.trim();
  if (!raw) return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw);
  return m?.[1]?.trim() || null;
}

/**
 * Zapier Timely webhooks: require `Authorization: Bearer <FI_TIMELY_WEBHOOK_SECRET>`.
 * Used by patient/appointment sync routes and the temporary discovery endpoint
 * `POST /api/tenants/[tenantId]/integrations/timely/discovery`.
 * In production, rejects all requests when the secret env var is missing, empty, or shorter than the minimum (fail closed).
 */
export function assertTimelyWebhookAuthorized(request: Request): void {
  const isProd = process.env.NODE_ENV === "production";
  const configured = process.env.FI_TIMELY_WEBHOOK_SECRET?.trim() ?? "";

  if (isProd && (!configured || configured.length < CRON_OR_WEBHOOK_SECRET_MIN_LENGTH)) {
    throw new TimelyWebhookAuthError(503, "Service unavailable.");
  }

  if (!configured || configured.length < CRON_OR_WEBHOOK_SECRET_MIN_LENGTH) {
    throw new TimelyWebhookAuthError(503, "Service unavailable.");
  }

  const token = extractBearerToken(request);
  if (!token) {
    throw new TimelyWebhookAuthError(401, "Unauthorized.");
  }

  if (!timingSafeSecretEquals(configured, token)) {
    throw new TimelyWebhookAuthError(401, "Unauthorized.");
  }
}
