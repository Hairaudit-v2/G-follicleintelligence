/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — HMAC signing matching HairAudit exactly.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** HairAudit outbound request signature material (newline-separated). */
export function buildHairAuditProjectionRequestMaterial(args: {
  method: string;
  path: string;
  timestamp: string;
  idempotencyKey: string;
  rawBody: string;
}): string {
  const bodySha256 = createHash("sha256").update(args.rawBody, "utf8").digest("hex");
  return [
    args.method.toUpperCase(),
    args.path,
    args.timestamp,
    args.idempotencyKey,
    bodySha256,
  ].join("\n");
}

export function signHairAuditProjectionRequest(args: {
  method: string;
  path: string;
  timestamp: string;
  idempotencyKey: string;
  rawBody: string;
  secret: string;
}): string {
  const material = buildHairAuditProjectionRequestMaterial(args);
  return createHmac("sha256", args.secret).update(material, "utf8").digest("hex");
}

export function timingSafeHexEqual(expectedHex: string, providedHex: string): boolean {
  try {
    const a = Buffer.from(expectedHex.trim(), "hex");
    const b = Buffer.from(providedHex.trim(), "hex");
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** HairAudit callback signature: HMAC-SHA256(timestamp.rawBody). */
export function signHairAuditProjectionCallback(args: {
  timestamp: string;
  rawBody: string;
  secret: string;
}): string {
  return createHmac("sha256", args.secret)
    .update(`${args.timestamp}.${args.rawBody}`, "utf8")
    .digest("hex");
}

export function verifyHairAuditProjectionCallbackSignature(args: {
  timestamp: string;
  rawBody: string;
  signature: string;
  secret: string;
}): boolean {
  const expected = signHairAuditProjectionCallback(args);
  // HairAudit compares utf8 buffers of hex strings (not decoded hex).
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(args.signature.trim(), "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}
