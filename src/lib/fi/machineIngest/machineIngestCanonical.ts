import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** POST/GET etc. — uppercased in canonical string. */
export function buildMachineIngestCanonicalString(input: {
  method: string;
  pathname: string;
  timestampMs: number;
  nonce: string;
  bodySha256Hex: string;
}): string {
  const method = input.method.trim().toUpperCase() || "POST";
  return `${method}\n${input.pathname}\n${String(input.timestampMs)}\n${input.nonce}\n${input.bodySha256Hex}`;
}

export function sha256HexOfBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function computeMachineIngestHmacHex(secret: string, canonical: string): string {
  return createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
}

export function verifyMachineIngestHmacTimingSafe(
  secret: string,
  canonical: string,
  signatureHex: string
): boolean {
  const expectedHex = computeMachineIngestHmacHex(secret, canonical);
  const sig = signatureHex.trim().toLowerCase();
  const exp = expectedHex.toLowerCase();
  if (!/^[0-9a-f]+$/.test(sig) || sig.length !== exp.length) return false;
  try {
    const a = Buffer.from(exp, "hex");
    const b = Buffer.from(sig, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Default ±5 minutes per replacement plan. */
export const MACHINE_INGEST_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

/** Production deploys: used for `FI_MACHINE_INGEST_MASTER_KEY` minimum length enforcement. */
export function isMachineIngestProductionDeploy(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

/** Minimum UTF-8 length for `FI_MACHINE_INGEST_MASTER_KEY` in production (after trim). */
export const MACHINE_INGEST_MASTER_KEY_MIN_PRODUCTION_LENGTH = 32;

/**
 * Strict Unix timestamp in milliseconds: digits only (no decimals or scientific notation),
 * length in a sane ms-epoch range, and within `Number.isSafeInteger` for skew math.
 */
export function parseMachineIngestTimestampMs(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (!s) return null;
  // 12–16 digits covers ~1970–2286 as ms while staying ≤ Number.MAX_SAFE_INTEGER.
  if (!/^\d{12,16}$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n)) return null;
  return n;
}

export function verifyMachineIngestTimestamp(timestampMs: number, nowMs: number, skewMs: number): boolean {
  if (!Number.isFinite(timestampMs) || !Number.isFinite(nowMs)) return false;
  return Math.abs(nowMs - timestampMs) <= skewMs;
}
