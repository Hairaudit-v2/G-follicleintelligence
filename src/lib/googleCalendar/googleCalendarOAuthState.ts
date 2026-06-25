/**
 * CalendarOS GC-2 — signed Google Calendar OAuth state (tamper-resistant, tenant-scoped).
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const GOOGLE_CALENDAR_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export type GoogleCalendarOAuthStatePayload = {
  tenantId: string;
  nonce: string;
  exp: number;
};

export function resolveGoogleCalendarOAuthStateSecret(): string | null {
  const secret = (
    process.env.GOOGLE_CALENDAR_OAUTH_STATE_SECRET ??
    process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY ??
    ""
  ).trim();
  return secret || null;
}

export function signGoogleCalendarOAuthState(
  tenantId: string,
  secret: string,
  opts?: { nonce?: string; exp?: number }
): string {
  const payload: GoogleCalendarOAuthStatePayload = {
    tenantId: tenantId.trim(),
    nonce: opts?.nonce ?? randomBytes(16).toString("hex"),
    exp: opts?.exp ?? Date.now() + GOOGLE_CALENDAR_OAUTH_STATE_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payloadB64, "utf8").digest("base64url");
  return `${payloadB64}.${signature}`;
}

export function verifyGoogleCalendarOAuthState(
  state: string,
  secret: string
): GoogleCalendarOAuthStatePayload | null {
  const trimmed = state.trim();
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
    ) as GoogleCalendarOAuthStatePayload;
    if (!parsed.tenantId?.trim() || !parsed.nonce?.trim() || !parsed.exp) return null;
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
