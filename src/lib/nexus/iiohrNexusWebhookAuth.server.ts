import { createHmac, timingSafeEqual } from "node:crypto";

export const IIOHR_NEXUS_HDR_TIMESTAMP = "x-iiohr-fi-webhook-timestamp";
export const IIOHR_NEXUS_HDR_SIGNATURE = "x-iiohr-fi-webhook-signature";
export const IIOHR_NEXUS_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

export function buildIiohrNexusSignatureMaterial(timestamp: string, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

export function computeIiohrNexusHmacHex(secret: string, material: string): string {
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

export function verifyIiohrNexusHmacTimingSafe(secret: string, material: string, signatureHex: string): boolean {
  const expectedHex = computeIiohrNexusHmacHex(secret, material);
  return timingSafeHexEqual(expectedHex, signatureHex);
}

/** Parses unix seconds (10 digits) or milliseconds (13 digits). */
export function parseIiohrNexusTimestampMs(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d{10,13}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n)) return null;
  if (trimmed.length === 10) return n * 1000;
  return n;
}

export function verifyIiohrNexusTimestamp(timestampMs: number, nowMs: number, skewMs: number): boolean {
  return Math.abs(nowMs - timestampMs) <= skewMs;
}

export type IiohrNexusAuthRejectReason =
  | "missing_headers"
  | "invalid_timestamp"
  | "timestamp_skew"
  | "missing_secret"
  | "signature_invalid";

export type IiohrNexusAuthResult =
  | { ok: true; timestamp: string; rawBody: string }
  | { ok: false; httpStatus: number; error: string; reason: IiohrNexusAuthRejectReason };

export function evaluateIiohrNexusSignedRequest(input: {
  timestampHeader: string | null;
  signatureHeader: string | null;
  rawBody: string;
  secret: string | null;
  nowMs?: number;
}): IiohrNexusAuthResult {
  if (!input.secret) {
    return {
      ok: false,
      httpStatus: 503,
      error: "Service unavailable.",
      reason: "missing_secret",
    };
  }

  const timestamp = input.timestampHeader?.trim() ?? "";
  const signature = input.signatureHeader?.trim() ?? "";
  if (!timestamp || !signature) {
    return {
      ok: false,
      httpStatus: 401,
      error: "Unauthorized.",
      reason: "missing_headers",
    };
  }

  const timestampMs = parseIiohrNexusTimestampMs(timestamp);
  if (timestampMs === null) {
    return {
      ok: false,
      httpStatus: 401,
      error: "Unauthorized.",
      reason: "invalid_timestamp",
    };
  }

  const nowMs = input.nowMs ?? Date.now();
  if (!verifyIiohrNexusTimestamp(timestampMs, nowMs, IIOHR_NEXUS_TIMESTAMP_SKEW_MS)) {
    return {
      ok: false,
      httpStatus: 401,
      error: "Unauthorized.",
      reason: "timestamp_skew",
    };
  }

  const material = buildIiohrNexusSignatureMaterial(timestamp, input.rawBody);
  if (!verifyIiohrNexusHmacTimingSafe(input.secret, material, signature)) {
    return {
      ok: false,
      httpStatus: 401,
      error: "Unauthorized.",
      reason: "signature_invalid",
    };
  }

  return { ok: true, timestamp, rawBody: input.rawBody };
}

export function signIiohrNexusRequestForTests(input: {
  secret: string;
  timestamp: string;
  rawBody: string;
}): { timestamp: string; signature: string } {
  const material = buildIiohrNexusSignatureMaterial(input.timestamp, input.rawBody);
  return {
    timestamp: input.timestamp,
    signature: computeIiohrNexusHmacHex(input.secret, material),
  };
}
