/**
 * URL / search-param parsing for FI Admin booking calendar (Stage 3C). Pure.
 */

import { isAllowedBookingStatus, isAllowedBookingType } from "./bookingPolicy";

export type CalendarViewMode = "day" | "week";

function firstString(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? String(v[0] ?? "") : String(v);
}

function parseBoolParam(v: string | string[] | undefined): boolean {
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

export type ParsedCalendarQuery = {
  view: CalendarViewMode;
  /** UTC calendar anchor `YYYY-MM-DD` (day containing this instant at 00:00 UTC). */
  dateAnchor: string;
  status: string | null;
  bookingType: string | null;
  assignedUserId: string | null;
  clinicId: string | null;
  includeCancelled: boolean;
  /** Substring match against title, type, patient/lead label (server-side). */
  search: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v: string): boolean {
  return UUID_RE.test(v.trim());
}

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** UTC `YYYY-MM-DD` for the calendar day containing `d` (UTC midnight boundary). */
export function utcCalendarDateStringFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseUtcCalendarDateString(ymd: string): string | null {
  const t = ymd.trim();
  const m = YMD_RE.exec(t);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const ms = Date.UTC(y, mo, day);
  if (!Number.isFinite(ms)) return null;
  const chk = new Date(ms);
  if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== mo || chk.getUTCDate() !== day) return null;
  return utcCalendarDateStringFromDate(chk);
}

function parseView(raw: string): CalendarViewMode {
  const v = raw.trim().toLowerCase();
  if (v === "day") return "day";
  return "week";
}

/**
 * Parse `searchParams` from the Next.js app router into a normalised calendar query.
 * Invalid `date` falls back to today (UTC). Invalid `view` falls back to `week`.
 */
export function parseCalendarSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  now: Date = new Date()
): ParsedCalendarQuery {
  const today = utcCalendarDateStringFromDate(now);
  const view = parseView(firstString(searchParams.view));

  const dateRaw = firstString(searchParams.date).trim();
  const dateAnchor = parseUtcCalendarDateString(dateRaw) ?? today;

  const statusRaw = firstString(searchParams.status).trim();
  const status = statusRaw && isAllowedBookingStatus(statusRaw) ? statusRaw : null;

  const typeRaw = firstString(searchParams.type).trim();
  const bookingType = typeRaw && isAllowedBookingType(typeRaw) ? typeRaw : null;

  const assignedRaw = firstString(searchParams.assignedUserId).trim();
  const assignedUserId = assignedRaw && isUuid(assignedRaw) ? assignedRaw : null;

  const clinicRaw = firstString(searchParams.clinicId).trim();
  const clinicId = clinicRaw && isUuid(clinicRaw) ? clinicRaw : null;

  let includeCancelled = parseBoolParam(searchParams.includeCancelled);
  if (status === "cancelled") includeCancelled = true;

  const searchRaw = firstString(searchParams.q).trim();
  const search = searchRaw.length > 120 ? searchRaw.slice(0, 120) : searchRaw || null;

  return {
    view,
    dateAnchor,
    status,
    bookingType,
    assignedUserId,
    clinicId,
    includeCancelled,
    search,
  };
}

export type CalendarHrefQuery = {
  view?: CalendarViewMode;
  date?: string;
  status?: string;
  type?: string;
  assignedUserId?: string;
  clinicId?: string;
  includeCancelled?: boolean;
  q?: string;
};

export function buildCalendarHref(tenantId: string, q: CalendarHrefQuery): string {
  const base = `/fi-admin/${tenantId.trim()}/calendar`;
  const sp = new URLSearchParams();
  if (q.view && q.view !== "week") sp.set("view", q.view);
  if (q.date?.trim()) sp.set("date", q.date.trim());
  if (q.status?.trim()) sp.set("status", q.status.trim());
  if (q.type?.trim()) sp.set("type", q.type.trim());
  if (q.assignedUserId?.trim()) sp.set("assignedUserId", q.assignedUserId.trim());
  if (q.clinicId?.trim()) sp.set("clinicId", q.clinicId.trim());
  if (q.includeCancelled) sp.set("includeCancelled", "1");
  if (q.q?.trim()) sp.set("q", q.q.trim());
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Merge current calendar URL state with partial overrides (pure). */
export function mergeCalendarHrefQuery(current: ParsedCalendarQuery, patch: CalendarHrefQuery): CalendarHrefQuery {
  return {
    view: patch.view ?? current.view,
    date: patch.date ?? current.dateAnchor,
    status: patch.status !== undefined ? patch.status : current.status ?? undefined,
    type: patch.type !== undefined ? patch.type : current.bookingType ?? undefined,
    assignedUserId: patch.assignedUserId !== undefined ? patch.assignedUserId : current.assignedUserId ?? undefined,
    clinicId: patch.clinicId !== undefined ? patch.clinicId : current.clinicId ?? undefined,
    includeCancelled: patch.includeCancelled !== undefined ? patch.includeCancelled : current.includeCancelled,
    q: patch.q !== undefined ? patch.q : current.search ?? undefined,
  };
}

/** `start` / `end` ISO for booking overlap query covering the visible calendar range. */
export function calendarRangeIsoForQuery(q: ParsedCalendarQuery): { rangeStartIso: string; rangeEndIso: string } {
  const { rangeStartMs, rangeEndMs } = calendarVisibleUtcRangeMs(q);
  return {
    rangeStartIso: new Date(rangeStartMs).toISOString(),
    rangeEndIso: new Date(rangeEndMs).toISOString(),
  };
}

export function calendarVisibleUtcRangeMs(q: ParsedCalendarQuery): { rangeStartMs: number; rangeEndMs: number } {
  const anchor = parseUtcCalendarDateString(q.dateAnchor);
  const ymd = anchor ?? utcCalendarDateStringFromDate(new Date());
  const startMs = Date.UTC(
    Number(ymd.slice(0, 4)),
    Number(ymd.slice(5, 7)) - 1,
    Number(ymd.slice(8, 10)),
    0,
    0,
    0,
    0
  );
  if (q.view === "day") {
    return { rangeStartMs: startMs, rangeEndMs: startMs + 86400000 };
  }
  const mondayMs = utcMondayStartMsContaining(startMs);
  return { rangeStartMs: mondayMs, rangeEndMs: mondayMs + 7 * 86400000 };
}

/** UTC Monday 00:00 of the week containing the given UTC calendar midnight. */
export function utcMondayStartMsContaining(utcMidnightMs: number): number {
  const dow = new Date(utcMidnightMs).getUTCDay();
  const deltaDays = (dow + 6) % 7;
  return utcMidnightMs - deltaDays * 86400000;
}

/** Optional `start` / `end` query params (ISO) for deep links / tests — must fall back to derived range when invalid. */
export function parseCalendarRangeOverride(
  searchParams: Record<string, string | string[] | undefined>,
  fallback: { rangeStartIso: string; rangeEndIso: string }
): { rangeStartIso: string; rangeEndIso: string } {
  const startRaw = firstString(searchParams.start);
  const endRaw = firstString(searchParams.end);
  const startIso = tryParseIso(startRaw);
  const endIso = tryParseIso(endRaw);
  if (!startIso || !endIso || Date.parse(startIso) >= Date.parse(endIso)) return fallback;
  return { rangeStartIso: startIso, rangeEndIso: endIso };
}
