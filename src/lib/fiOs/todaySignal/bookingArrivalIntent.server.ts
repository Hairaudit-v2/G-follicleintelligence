import "server-only";

import { loadBookingForTenant } from "@/src/lib/bookings/bookings";
import { updateBooking } from "@/src/lib/bookings/server";
import { loadReceptionOperationalDayWindow } from "@/src/lib/fiOs/receptionBoardOperationalWindow.server";
import { assertBookingStartInOperationalWindow } from "@/src/lib/fiOs/receptionBoardFlowPolicy";
import {
  BOOKING_ARRIVAL_TOKEN_TTL_MS,
  resolveBookingArrivalTokenSecret,
  signBookingArrivalToken,
  verifyBookingArrivalToken,
  withArrivalIntentMetadata,
} from "@/src/lib/fiOs/todaySignal/bookingArrivalIntentCore";
import { logStructured } from "@/src/lib/server/structuredLog";

export async function createBookingArrivalToken(
  tenantId: string,
  bookingId: string,
  now: Date = new Date()
): Promise<{ token: string; expiresAt: string } | null> {
  const secret = resolveBookingArrivalTokenSecret();
  if (!secret) return null;
  const exp = now.getTime() + BOOKING_ARRIVAL_TOKEN_TTL_MS;
  const token = signBookingArrivalToken({ tenantId, bookingId, exp }, secret);
  return { token, expiresAt: new Date(exp).toISOString() };
}

export function buildBookingArrivalPublicUrl(token: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/arrival?token=${encodeURIComponent(token)}`;
}

export async function recordBookingArrivalIntentFromToken(
  token: string,
  now: Date = new Date()
): Promise<
  | { ok: true; tenantId: string; bookingId: string }
  | { ok: false; error: string; code: "invalid_token" | "not_found" | "not_today" | "already_checked_in" }
> {
  const secret = resolveBookingArrivalTokenSecret();
  if (!secret) {
    return { ok: false, error: "Arrival links are not configured.", code: "invalid_token" };
  }

  const payload = verifyBookingArrivalToken(token, secret, now.getTime());
  if (!payload) {
    return { ok: false, error: "This arrival link is invalid or has expired.", code: "invalid_token" };
  }

  const booking = await loadBookingForTenant(payload.tenantId, payload.bookingId);
  if (!booking) {
    return { ok: false, error: "Appointment not found.", code: "not_found" };
  }

  const st = String(booking.booking_status ?? "").trim();
  if (st === "arrived" || st === "completed" || st === "cancelled" || st === "no_show") {
    return { ok: false, error: "This appointment is already checked in or closed.", code: "already_checked_in" };
  }

  const { localStartIso, localEndIso } = await loadReceptionOperationalDayWindow(payload.tenantId);
  const window = assertBookingStartInOperationalWindow(booking.start_at, localStartIso, localEndIso);
  if (!window.ok) {
    return { ok: false, error: "This link is only valid on your appointment day.", code: "not_today" };
  }

  const meta =
    booking.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, unknown>)
      : {};

  await updateBooking({
    tenantId: payload.tenantId,
    bookingId: payload.bookingId,
    metadata: withArrivalIntentMetadata(meta, now.toISOString(), "qr"),
  });

  logStructured("info", "fi_booking_arrival_intent_recorded", {
    tenant_id: payload.tenantId,
    booking_id: payload.bookingId,
    source: "qr",
  });

  return { ok: true, tenantId: payload.tenantId, bookingId: payload.bookingId };
}
