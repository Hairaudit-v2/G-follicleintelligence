/**
 * URL / search-param parsing for FI Admin booking operator page (Stage 3B). Pure.
 */

import { isAllowedBookingStatus, isAllowedBookingType } from "./bookingPolicy";

export type ParsedOperatorBookingQuery = {
  startIso: string;
  endIso: string;
  status: string | null;
  bookingType: string | null;
  assignedUserId: string | null;
  clinicId: string | null;
  includeCancelled: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v: string): boolean {
  return UUID_RE.test(v.trim());
}

export function startOfUtcDayFromDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export function addUtcDays(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

/**
 * Default list window: start of today (UTC) through start of the calendar day 31 days later (exclusive end),
 * so bookings on “today + 30” calendar days are included (same pattern as “30 days ahead” + today).
 */
export function defaultOperatorBookingRangeIso(now: Date = new Date()): { startIso: string; endIso: string } {
  const start = startOfUtcDayFromDate(now);
  const endExclusive = addUtcDays(start, 31);
  return { startIso: start.toISOString(), endIso: endExclusive.toISOString() };
}

function firstString(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? String(v[0] ?? "") : String(v);
}

function parseBool(v: string | string[] | undefined): boolean {
  const s = firstString(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function tryParseIso(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

/**
 * Parse `searchParams` from the Next.js app router into a normalised operator query.
 * Invalid `start` / `end` fall back to {@link defaultOperatorBookingRangeIso}.
 */
export function parseOperatorBookingSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  now: Date = new Date()
): ParsedOperatorBookingQuery {
  const def = defaultOperatorBookingRangeIso(now);
  const startRaw = firstString(searchParams.start);
  const endRaw = firstString(searchParams.end);
  const startIso = tryParseIso(startRaw) ?? def.startIso;
  const endIso = tryParseIso(endRaw) ?? def.endIso;

  let start = startIso;
  let end = endIso;
  if (Date.parse(start) >= Date.parse(end)) {
    start = def.startIso;
    end = def.endIso;
  }

  const statusRaw = firstString(searchParams.status).trim();
  const status = statusRaw && isAllowedBookingStatus(statusRaw) ? statusRaw : null;

  const typeRaw = firstString(searchParams.type).trim();
  const bookingType = typeRaw && isAllowedBookingType(typeRaw) ? typeRaw : null;

  const assignedRaw = firstString(searchParams.assignedUserId).trim();
  const assignedUserId = assignedRaw && isUuid(assignedRaw) ? assignedRaw : null;

  const clinicRaw = firstString(searchParams.clinicId).trim();
  const clinicId = clinicRaw && isUuid(clinicRaw) ? clinicRaw : null;

  let includeCancelled = parseBool(searchParams.includeCancelled);
  if (status === "cancelled") includeCancelled = true;

  return {
    startIso: start,
    endIso: end,
    status,
    bookingType,
    assignedUserId,
    clinicId,
    includeCancelled,
  };
}

export type OperatorBookingHrefQuery = {
  start?: string;
  end?: string;
  status?: string;
  type?: string;
  assignedUserId?: string;
  clinicId?: string;
  includeCancelled?: boolean;
};

/** Start/end of the UTC calendar day containing `d` (for summary tiles). */
export function utcDayBoundsMs(d: Date): { dayStartMs: number; dayEndMs: number } {
  const start = startOfUtcDayFromDate(d);
  const end = addUtcDays(start, 1);
  return { dayStartMs: start.getTime(), dayEndMs: end.getTime() };
}

export function buildOperatorBookingsHref(tenantId: string, q: OperatorBookingHrefQuery): string {
  const base = `/fi-admin/${tenantId.trim()}/bookings`;
  const sp = new URLSearchParams();
  if (q.start?.trim()) sp.set("start", q.start.trim());
  if (q.end?.trim()) sp.set("end", q.end.trim());
  if (q.status?.trim()) sp.set("status", q.status.trim());
  if (q.type?.trim()) sp.set("type", q.type.trim());
  if (q.assignedUserId?.trim()) sp.set("assignedUserId", q.assignedUserId.trim());
  if (q.clinicId?.trim()) sp.set("clinicId", q.clinicId.trim());
  if (q.includeCancelled) sp.set("includeCancelled", "1");
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}
