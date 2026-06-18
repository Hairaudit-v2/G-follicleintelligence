import { createHash, timingSafeEqual } from "node:crypto";

import { CRON_OR_WEBHOOK_SECRET_MIN_LENGTH } from "@/src/lib/security/timingSafeSecret";

export class HubspotWebhookAuthError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HubspotWebhookAuthError";
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
 * HubSpot timeline-sync webhooks: require `Authorization: Bearer <FI_HUBSPOT_WEBHOOK_SECRET>`.
 * Used by the `POST /api/tenants/[tenantId]/integrations/hubspot/{contact,email-event,deal}` routes.
 * In production (and whenever the secret is missing/too short), fails closed.
 */
export function assertHubspotWebhookAuthorized(request: Request): void {
  const configured = process.env.FI_HUBSPOT_WEBHOOK_SECRET?.trim() ?? "";

  if (!configured || configured.length < CRON_OR_WEBHOOK_SECRET_MIN_LENGTH) {
    throw new HubspotWebhookAuthError(503, "Service unavailable.");
  }

  const token = extractBearerToken(request);
  if (!token) {
    throw new HubspotWebhookAuthError(401, "Unauthorized.");
  }

  if (!timingSafeSecretEquals(configured, token)) {
    throw new HubspotWebhookAuthError(401, "Unauthorized.");
  }
}
