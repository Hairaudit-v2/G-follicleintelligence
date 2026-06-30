import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { CRON_OR_WEBHOOK_SECRET_MIN_LENGTH } from "@/src/lib/security/timingSafeSecret";

const HUBSPOT_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

const HUBSPOT_URI_DECODE_MAP: Record<string, string> = {
  "%3A": ":",
  "%2F": "/",
  "%3F": "?",
  "%40": "@",
  "%21": "!",
  "%24": "$",
  "%27": "'",
  "%28": "(",
  "%29": ")",
  "%2A": "*",
  "%2C": ",",
  "%3B": ";",
};

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

function timingSafeStringEquals(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) {
    try {
      timingSafeEqual(a, a);
    } catch {
      // ignore
    }
    return false;
  }
  return timingSafeEqual(a, b);
}

function extractBearerToken(request: Request): string | null {
  const raw = request.headers.get("authorization")?.trim();
  if (!raw) return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw);
  return m?.[1]?.trim() || null;
}

function resolveHubspotClientSecret(): string {
  return (process.env.HUBSPOT_CLIENT_SECRET ?? process.env.FI_HUBSPOT_CLIENT_SECRET ?? "").trim();
}

function decodeHubspotUriEncodedChars(value: string): string {
  return value.replace(
    /%[0-9A-Fa-f]{2}/g,
    (match) => HUBSPOT_URI_DECODE_MAP[match.toUpperCase()] ?? match
  );
}

/** Full request URI as HubSpot signs it (origin + decoded path/query). */
export function buildHubspotSignatureRequestUri(requestUrl: string): string {
  const url = new URL(requestUrl);
  const pathname = decodeHubspotUriEncodedChars(url.pathname);
  const search = url.search ? decodeHubspotUriEncodedChars(url.search) : "";
  return `${url.origin}${pathname}${search}`;
}

export function computeHubspotSignatureV3(
  method: string,
  requestUri: string,
  rawBody: string,
  timestamp: string,
  clientSecret: string
): string {
  const rawString = `${method}${requestUri}${rawBody}${timestamp}`;
  return createHmac("sha256", clientSecret).update(rawString, "utf8").digest("base64");
}

function assertHubspotBearerWebhookAuthorized(request: Request): void {
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

function assertHubspotSignatureV3WebhookAuthorized(request: Request, rawBody: string): void {
  const signature = request.headers.get("x-hubspot-signature-v3")?.trim();
  const timestampRaw = request.headers.get("x-hubspot-request-timestamp")?.trim();

  if (!signature || !timestampRaw) {
    throw new HubspotWebhookAuthError(401, "Unauthorized.");
  }

  const clientSecret = resolveHubspotClientSecret();
  if (!clientSecret) {
    throw new HubspotWebhookAuthError(503, "Service unavailable.");
  }

  const timestamp = Number(timestampRaw);
  if (!Number.isFinite(timestamp)) {
    throw new HubspotWebhookAuthError(401, "Unauthorized.");
  }

  if (Date.now() - timestamp > HUBSPOT_SIGNATURE_MAX_AGE_MS) {
    throw new HubspotWebhookAuthError(401, "Unauthorized.");
  }

  const requestUri = buildHubspotSignatureRequestUri(request.url);
  const expected = computeHubspotSignatureV3(
    request.method.toUpperCase(),
    requestUri,
    rawBody,
    timestampRaw,
    clientSecret
  );

  if (!timingSafeStringEquals(expected, signature)) {
    throw new HubspotWebhookAuthError(401, "Unauthorized.");
  }
}

/**
 * HubSpot timeline-sync webhooks: require `Authorization: Bearer <FI_HUBSPOT_WEBHOOK_SECRET>`.
 * Used by the `POST /api/tenants/[tenantId]/integrations/hubspot/{contact,email-event,deal}` routes.
 * In production (and whenever the secret is missing/too short), fails closed.
 */
export function assertHubspotWebhookAuthorized(request: Request): void {
  assertHubspotBearerWebhookAuthorized(request);
}

/**
 * LeadFlow HubSpot webhook queue route: Bearer token (Zapier/internal) OR native HubSpot v3 signature.
 * Signature validation requires the raw request body bytes (call `req.text()` before JSON parsing).
 */
export function assertHubspotLeadFlowWebhookAuthorized(request: Request, rawBody: string): void {
  const bearerToken = extractBearerToken(request);
  if (bearerToken !== null) {
    assertHubspotBearerWebhookAuthorized(request);
    return;
  }

  assertHubspotSignatureV3WebhookAuthorized(request, rawBody);
}
