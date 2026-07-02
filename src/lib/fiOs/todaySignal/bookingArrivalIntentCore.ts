import { createHmac, timingSafeEqual } from "node:crypto";

/** Booking metadata — patient self-arrival intent (not clinical check-in). */
export const FI_ARRIVAL_INTENT_AT_KEY = "fi_arrival_intent_at" as const;
export const FI_ARRIVAL_INTENT_SOURCE_KEY = "fi_arrival_intent_source" as const;

export type ArrivalIntentSource = "qr";

export type BookingArrivalTokenPayload = {
  tenantId: string;
  bookingId: string;
  exp: number;
};

export const BOOKING_ARRIVAL_TOKEN_TTL_MS = 6 * 60 * 60_000;

export function resolveBookingArrivalTokenSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = (
    env.FI_ARRIVAL_TOKEN_SECRET ??
    env.FI_EXTERNAL_CONNECTOR_MASTER_KEY ??
    ""
  ).trim();
  return secret || null;
}

export function signBookingArrivalToken(
  payload: BookingArrivalTokenPayload,
  secret: string
): string {
  const body: BookingArrivalTokenPayload = {
    tenantId: payload.tenantId.trim(),
    bookingId: payload.bookingId.trim(),
    exp: payload.exp,
  };
  const payloadB64 = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payloadB64, "utf8").digest("base64url");
  return `${payloadB64}.${signature}`;
}

export function verifyBookingArrivalToken(
  token: string,
  secret: string,
  nowMs: number = Date.now()
): BookingArrivalTokenPayload | null {
  const trimmed = token.trim();
  const dotIdx = trimmed.lastIndexOf(".");
  if (dotIdx <= 0) return null;

  const payloadB64 = trimmed.slice(0, dotIdx);
  const providedSig = trimmed.slice(dotIdx + 1);
  const expectedSig = createHmac("sha256", secret).update(payloadB64, "utf8").digest("base64url");

  const a = Buffer.from(expectedSig);
  const b = Buffer.from(providedSig);
  if (a.length !== b.length || a.length === 0) return null;
  try {
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as BookingArrivalTokenPayload;
    if (!parsed?.tenantId?.trim() || !parsed?.bookingId?.trim()) return null;
    if (typeof parsed.exp !== "number" || parsed.exp < nowMs) return null;
    return {
      tenantId: parsed.tenantId.trim(),
      bookingId: parsed.bookingId.trim(),
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function parseArrivalIntentAt(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const v = metadata?.[FI_ARRIVAL_INTENT_AT_KEY];
  if (typeof v !== "string" || !v.trim()) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? v.trim() : null;
}

export function parseArrivalIntentSource(
  metadata: Record<string, unknown> | null | undefined
): ArrivalIntentSource | null {
  const v = metadata?.[FI_ARRIVAL_INTENT_SOURCE_KEY];
  return v === "qr" ? "qr" : null;
}

export function withArrivalIntentMetadata(
  metadata: Record<string, unknown>,
  intentAtIso: string,
  source: ArrivalIntentSource = "qr"
): Record<string, unknown> {
  return {
    ...metadata,
    [FI_ARRIVAL_INTENT_AT_KEY]: intentAtIso,
    [FI_ARRIVAL_INTENT_SOURCE_KEY]: source,
  };
}

export function withoutArrivalIntentMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const next = { ...metadata };
  delete next[FI_ARRIVAL_INTENT_AT_KEY];
  delete next[FI_ARRIVAL_INTENT_SOURCE_KEY];
  return next;
}

export function bookingHasPendingArrivalIntent(row: {
  booking_status: string;
  metadata: Record<string, unknown>;
}): boolean {
  const st = String(row.booking_status ?? "").trim();
  if (st === "arrived" || st === "completed" || st === "cancelled" || st === "no_show") {
    return false;
  }
  return parseArrivalIntentAt(row.metadata) != null;
}
