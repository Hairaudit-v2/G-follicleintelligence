import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";

const HDR_TENANT = "x-fi-tenant-id";
const HDR_REQUEST_ID = "x-fi-request-id";
const HDR_TIMESTAMP = "x-fi-timestamp";
const HDR_SIG_VERSION = "x-fi-signature-version";
const HDR_SIGNATURE = "x-fi-signature";

export const HLI_TRICHOSCOPY_SIGNATURE_VERSION = "v1";
export const HLI_TRICHOSCOPY_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

export { HDR_TENANT, HDR_REQUEST_ID, HDR_TIMESTAMP, HDR_SIG_VERSION, HDR_SIGNATURE };

export function buildHliTrichoscopyCanonicalString(opts: {
  timestamp: string;
  requestId: string;
  tenantId: string;
  bodySha256Hex: string;
}): string {
  return `${opts.timestamp}.${opts.requestId}.${opts.tenantId}.${opts.bodySha256Hex}`;
}

export function sha256HexOfBody(body: string | Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

export function signHliTrichoscopyPayload(opts: {
  secret: string;
  timestamp: string;
  requestId: string;
  tenantId: string;
  body: string | Buffer;
}): string {
  const bodySha = sha256HexOfBody(opts.body);
  const canonical = buildHliTrichoscopyCanonicalString({
    timestamp: opts.timestamp,
    requestId: opts.requestId,
    tenantId: opts.tenantId,
    bodySha256Hex: bodySha,
  });
  return createHmac("sha256", opts.secret).update(canonical).digest("hex");
}

export function verifyHliTrichoscopySignature(opts: {
  secret: string;
  timestamp: string;
  requestId: string;
  tenantId: string;
  body: string | Buffer;
  signature: string;
}): boolean {
  const expected = signHliTrichoscopyPayload(opts);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(opts.signature ?? "").trim(), "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyHliTrichoscopyTimestamp(
  timestampRaw: string,
  nowMs = Date.now(),
  skewMs = HLI_TRICHOSCOPY_TIMESTAMP_SKEW_MS
): boolean {
  const ts = Number.parseInt(String(timestampRaw).trim(), 10);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(nowMs - ts) <= skewMs;
}

export function newHliRequestId(): string {
  return randomUUID();
}

export function buildOutboundHliHeaders(opts: {
  tenantId: string;
  secret: string;
  body: string;
  requestId?: string;
  nowMs?: number;
}): Record<string, string> {
  const requestId = opts.requestId ?? newHliRequestId();
  const timestamp = String(opts.nowMs ?? Date.now());
  const signature = signHliTrichoscopyPayload({
    secret: opts.secret,
    timestamp,
    requestId,
    tenantId: opts.tenantId,
    body: opts.body,
  });
  return {
    [HDR_TENANT]: opts.tenantId,
    [HDR_REQUEST_ID]: requestId,
    [HDR_TIMESTAMP]: timestamp,
    [HDR_SIG_VERSION]: HLI_TRICHOSCOPY_SIGNATURE_VERSION,
    [HDR_SIGNATURE]: signature,
    "content-type": "application/json",
  };
}
