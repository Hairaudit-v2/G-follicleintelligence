/**
 * Clinic-local calendar timezone helpers (IANA). Pure — safe for tests and server/client.
 *
 * Operational calendar uses a single effective zone: optional per-clinic override, else tenant
 * `default_timezone` / `metadata.timezone`, else {@link FALLBACK_CALENDAR_TIMEZONE}.
 * Explicit `"UTC"` remains valid for UTC-native grids and fast paths.
 */

import {
  parseUtcCalendarDateString,
  utcCalendarDateStringFromDate,
} from "@/src/lib/bookings/calendarQuery";

/** Explicit UTC calendar mode (lane math + ISO without IANA offset lookup). */
export const DEFAULT_CALENDAR_TIMEZONE = "UTC";

/** When tenant/clinic omit or supply an invalid IANA id, FI scheduling defaults here (no DST). */
export const FALLBACK_CALENDAR_TIMEZONE = "Australia/Brisbane";

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const validatedTimezoneCache = new Map<string, string>();

/** Validates IANA timezone; falls back to {@link FALLBACK_CALENDAR_TIMEZONE}. */
export function normalizeCalendarTimezone(tz: string | null | undefined): string {
  const t = tz?.trim();
  if (!t) return FALLBACK_CALENDAR_TIMEZONE;
  const cached = validatedTimezoneCache.get(t);
  if (cached) return cached;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: t });
    validatedTimezoneCache.set(t, t);
    return t;
  } catch {
    validatedTimezoneCache.set(t, FALLBACK_CALENDAR_TIMEZONE);
    return FALLBACK_CALENDAR_TIMEZONE;
  }
}

export type CalendarTimeZoneSource = {
  tenant?: { default_timezone?: string | null; metadata?: Record<string, unknown> | null } | null;
  /** Future: `fi_clinics.timezone` when present — wins over tenant default for that location. */
  clinic?: { timezone?: string | null } | null;
};

/**
 * Single source for operational calendar IANA zone: clinic override (when set), else tenant
 * resolution, else Brisbane fallback.
 */
export function getCalendarTimeZone(source?: CalendarTimeZoneSource | null): string {
  const c = source?.clinic?.timezone?.trim();
  if (c) return normalizeCalendarTimezone(c);
  return resolveTenantCalendarTimezone(source?.tenant ?? null);
}

/** Tenant column `default_timezone`, then `metadata.timezone`, else {@link FALLBACK_CALENDAR_TIMEZONE}. */
export function resolveTenantCalendarTimezone(
  input:
    | {
        default_timezone?: string | null;
        metadata?: Record<string, unknown> | null;
      }
    | null
    | undefined
): string {
  if (!input) return normalizeCalendarTimezone(null);
  const meta =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? input.metadata
      : {};
  const fromMeta = typeof meta.timezone === "string" ? meta.timezone.trim() : "";
  const fromColumn = input.default_timezone?.trim() || "";
  return normalizeCalendarTimezone(fromColumn || fromMeta || null);
}

const zonedPartsFormatterCache = new Map<string, Intl.DateTimeFormat>();
const calendarDateFormatterCache = new Map<string, Intl.DateTimeFormat>();
const weekdayShortFormatterCache = new Map<string, Intl.DateTimeFormat>();
const zonedMidnightUtcMsCache = new Map<string, number | null>();
const parseCalendarDateStringCache = new Map<string, string | null>();
const zonedDateTimeToUtcCache = new Map<string, number | null>();

function getZonedPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  const tz = normalizeCalendarTimezone(timeZone);
  let fmt = zonedPartsFormatterCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      weekday: "short",
    });
    zonedPartsFormatterCache.set(tz, fmt);
  }
  return fmt;
}

function getCalendarDateFormatter(timeZone: string): Intl.DateTimeFormat {
  const tz = normalizeCalendarTimezone(timeZone);
  let fmt = calendarDateFormatterCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    calendarDateFormatterCache.set(tz, fmt);
  }
  return fmt;
}

function getWeekdayShortFormatter(timeZone: string): Intl.DateTimeFormat {
  const tz = normalizeCalendarTimezone(timeZone);
  let fmt = weekdayShortFormatterCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: tz });
    weekdayShortFormatterCache.set(tz, fmt);
  }
  return fmt;
}

function getZonedParts(ms: number, timeZone: string): ZonedParts {
  const parts = Object.fromEntries(
    getZonedPartsFormatter(timeZone)
      .formatToParts(new Date(ms))
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY_INDEX[parts.weekday as string] ?? 0,
  };
}

function compareZoned(
  a: Pick<ZonedParts, "year" | "month" | "day" | "hour" | "minute" | "second">,
  b: Pick<ZonedParts, "year" | "month" | "day" | "hour" | "minute" | "second">
): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  if (a.day !== b.day) return a.day - b.day;
  if (a.hour !== b.hour) return a.hour - b.hour;
  if (a.minute !== b.minute) return a.minute - b.minute;
  return a.second - b.second;
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): number | null {
  const tz = normalizeCalendarTimezone(timeZone);
  const cacheKey = `${year}|${month}|${day}|${hour}|${minute}|${second}|${tz}`;
  const cached = zonedDateTimeToUtcCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const target = { year, month, day, hour, minute, second };
  const base = Date.UTC(year, month - 1, day, hour, minute, second);
  // `base` is a naive UTC interpretation of the wall clock; the true UTC instant can be many
  // hours away (e.g. Australia/Brisbane +10). Scan a full ±20h window before wider bisection.
  for (let offsetMin = -20 * 60; offsetMin <= 20 * 60; offsetMin++) {
    const candidate = base + offsetMin * 60_000;
    const p = getZonedParts(candidate, tz);
    if (compareZoned(p, target) === 0) {
      zonedDateTimeToUtcCache.set(cacheKey, candidate);
      return candidate;
    }
  }
  let lo = base - 14 * 3_600_000;
  let hi = base + 14 * 3_600_000;
  for (let i = 0; i < 48; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const p = getZonedParts(mid, tz);
    const cmp = compareZoned(p, target);
    if (cmp === 0) {
      zonedDateTimeToUtcCache.set(cacheKey, mid);
      return mid;
    }
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  zonedDateTimeToUtcCache.set(cacheKey, null);
  return null;
}

/** Calendar `YYYY-MM-DD` for an instant in the given IANA timezone. */
export function calendarDateStringFromInstant(d: Date, timeZone: string): string {
  const tz = normalizeCalendarTimezone(timeZone);
  if (tz === DEFAULT_CALENDAR_TIMEZONE) return utcCalendarDateStringFromDate(d);
  return getCalendarDateFormatter(tz).format(d);
}

/** Validates a calendar date string in the given timezone. */
export function parseCalendarDateString(ymd: string, timeZone: string): string | null {
  const tz = normalizeCalendarTimezone(timeZone);
  if (tz === DEFAULT_CALENDAR_TIMEZONE) return parseUtcCalendarDateString(ymd);
  const t = ymd.trim();
  const cacheKey = `${t}|${tz}`;
  const cached = parseCalendarDateStringCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const m = YMD_RE.exec(t);
  if (!m) {
    parseCalendarDateStringCache.set(cacheKey, null);
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(da)) {
    parseCalendarDateStringCache.set(cacheKey, null);
    return null;
  }
  const ms = zonedDateTimeToUtc(y, mo, da, 12, 0, 0, tz);
  if (ms == null) {
    parseCalendarDateStringCache.set(cacheKey, null);
    return null;
  }
  const normalized = calendarDateStringFromInstant(new Date(ms), tz);
  const result = normalized === t ? t : null;
  parseCalendarDateStringCache.set(cacheKey, result);
  return result;
}

/** UTC epoch ms for local midnight on `ymd` in `timeZone`. */
export function zonedMidnightUtcMs(ymd: string, timeZone: string): number | null {
  const tz = normalizeCalendarTimezone(timeZone);
  const parsed = parseCalendarDateString(ymd, tz);
  if (!parsed) return null;
  const cacheKey = `${parsed}|${tz}`;
  const cached = zonedMidnightUtcMsCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const [y, mo, da] = parsed.split("-").map(Number);
  const ms =
    tz === DEFAULT_CALENDAR_TIMEZONE
      ? Date.UTC(y, mo - 1, da, 0, 0, 0, 0)
      : zonedDateTimeToUtc(y, mo, da, 0, 0, 0, tz);
  zonedMidnightUtcMsCache.set(cacheKey, ms);
  return ms;
}

/** e.g. "Tuesday, 18 June 2026" for clinic-local `YYYY-MM-DD` in `timeZone`. */
export function formatCalendarLongWeekdayDate(dayKey: string, timeZone: string): string {
  const tz = normalizeCalendarTimezone(timeZone);
  const ymd = dayKey.trim();
  const ms = zonedMidnightUtcMs(ymd, tz);
  if (ms == null) return ymd;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(ms));
}

/** UTC epoch ms for the next local calendar day after `ymd`. */
export function zonedNextDayUtcMs(ymd: string, timeZone: string): number | null {
  return zonedMidnightUtcMs(addDaysToCalendarDate(ymd, 1, timeZone), timeZone);
}

export function addDaysToCalendarDate(ymd: string, days: number, timeZone: string): string {
  const tz = normalizeCalendarTimezone(timeZone);
  const parsed = parseCalendarDateString(ymd, tz);
  if (!parsed) return ymd.trim();
  const start = zonedMidnightUtcMs(parsed, tz);
  if (start == null) return parsed;
  return calendarDateStringFromInstant(new Date(start + days * 86_400_000), tz);
}

export function addMonthsToCalendarDate(
  ymd: string,
  deltaMonths: number,
  timeZone: string
): string {
  const tz = normalizeCalendarTimezone(timeZone);
  const parsed = parseCalendarDateString(ymd, tz) ?? ymd.trim();
  const [y, mo] = parsed.split("-").map(Number);
  const targetIndex = mo - 1 + deltaMonths;
  const targetY = y + Math.floor(targetIndex / 12);
  const targetMo = (targetIndex % 12) + 1;
  if (tz === DEFAULT_CALENDAR_TIMEZONE) {
    return utcCalendarDateStringFromDate(new Date(Date.UTC(targetY, targetMo - 1, 1)));
  }
  const anchorMs = zonedDateTimeToUtc(targetY, targetMo, 1, 12, 0, 0, tz);
  if (anchorMs == null) return parsed;
  return calendarDateStringFromInstant(new Date(anchorMs), tz);
}

/** Local Monday 00:00 (as UTC instant) for the week containing `anchorMidnightMs`. */
export function localMondayStartMsContaining(anchorMidnightMs: number, timeZone: string): number {
  const tz = normalizeCalendarTimezone(timeZone);
  if (tz === DEFAULT_CALENDAR_TIMEZONE) {
    const dow = new Date(anchorMidnightMs).getUTCDay();
    const deltaDays = (dow + 6) % 7;
    return anchorMidnightMs - deltaDays * 86_400_000;
  }
  const parts = getZonedParts(anchorMidnightMs, tz);
  const deltaDays = (parts.weekday + 6) % 7;
  const anchorYmd = calendarDateStringFromInstant(new Date(anchorMidnightMs), tz);
  const mondayYmd = addDaysToCalendarDate(anchorYmd, -deltaDays, tz);
  return zonedMidnightUtcMs(mondayYmd, tz) ?? anchorMidnightMs;
}

export function formatWeekdayShort(ms: number, timeZone: string): string {
  return getWeekdayShortFormatter(timeZone).format(new Date(ms));
}

/** ISO instant from local calendar day + minutes-from-midnight. */
export function isoFromLocalDayMinutes(
  dayKey: string,
  minutesLocal: number,
  timeZone: string
): string | null {
  const dayStart = zonedMidnightUtcMs(dayKey, timeZone);
  if (dayStart == null) return null;
  const [y, mo, da] = dayKey.split("-").map(Number);
  const hour = Math.floor(minutesLocal / 60);
  const minute = Math.floor(minutesLocal % 60);
  const tz = normalizeCalendarTimezone(timeZone);
  if (tz === DEFAULT_CALENDAR_TIMEZONE) {
    return new Date(dayStart + minutesLocal * 60_000).toISOString();
  }
  const utcMs = zonedDateTimeToUtc(y, mo, da, hour, minute, 0, tz);
  if (utcMs == null) return null;
  return new Date(utcMs).toISOString();
}

/** ISO range for a business slot on a local calendar day. */
export function localBusinessSlotIsoRange(
  dayKey: string,
  slotIndex: number,
  cfg: { dayStartHourUtc: number; dayEndHourUtc: number; slotMinutes: number },
  timeZone: string
): { startIso: string; endIso: string } | null {
  const dayStart = zonedMidnightUtcMs(dayKey, timeZone);
  if (dayStart == null || !Number.isInteger(slotIndex) || slotIndex < 0) return null;
  const spanH = Math.max(1, cfg.dayEndHourUtc - cfg.dayStartHourUtc);
  const max = (spanH * 60) / cfg.slotMinutes;
  if (slotIndex >= max) return null;
  const startMin = cfg.dayStartHourUtc * 60 + slotIndex * cfg.slotMinutes;
  const startIso = isoFromLocalDayMinutes(dayKey, startMin, timeZone);
  const endIso = isoFromLocalDayMinutes(dayKey, startMin + cfg.slotMinutes, timeZone);
  if (!startIso || !endIso) return null;
  return { startIso, endIso };
}

export function formatTimeRangeInTimezone(
  startAt: string,
  endAt: string,
  timeZone: string,
  opts?: { suffix?: boolean }
): string {
  const tz = normalizeCalendarTimezone(timeZone);
  const fmt: Intl.DateTimeFormatOptions = { timeStyle: "short", timeZone: tz };
  const startMs = parseIsoUtcMs(startAt);
  const endMs = parseIsoUtcMs(endAt);
  if (startMs == null || endMs == null) return "";
  const start = new Date(startMs).toLocaleTimeString(undefined, fmt);
  const end = new Date(endMs).toLocaleTimeString(undefined, fmt);
  const suffix = opts?.suffix && tz !== DEFAULT_CALENDAR_TIMEZONE ? ` ${tzLabel(tz)}` : "";
  return `${start} – ${end}${suffix}`;
}

function tzLabel(timeZone: string): string {
  if (timeZone === "Europe/London") return "GMT/BST";
  if (timeZone === DEFAULT_CALENDAR_TIMEZONE) return "GMT";
  const parts = timeZone.split("/");
  return parts[parts.length - 1]?.replace(/_/g, " ") ?? timeZone;
}

/** Short label for calendar column subtitles (no raw "UTC" string in UI). */
export function displayCalendarTimezoneSubtitle(timeZone: string): string {
  const tz = normalizeCalendarTimezone(timeZone);
  if (tz === DEFAULT_CALENDAR_TIMEZONE) return "GMT";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      timeZoneName: "shortGeneric",
    }).formatToParts(new Date());
    const name = parts.find((p) => p.type === "timeZoneName")?.value?.trim();
    if (name) return name;
  } catch {
    /* fall through */
  }
  return tzLabel(tz);
}

/** Minutes from lane start (local day midnight UTC instant). */
export function minutesFromLaneStart(laneStartMs: number, ms: number): number {
  return Math.max(0, (ms - laneStartMs) / 60_000);
}

/**
 * Wall-clock minutes from local midnight (hour×60 + minute) for an instant in `timeZone`.
 * Used when moving an appointment to another calendar day while keeping the same local time
 * (e.g. month grid drag across days in Australia/Perth).
 */
export function localClockMinutesFromInstant(ms: number, timeZone: string): number | null {
  if (!Number.isFinite(ms)) return null;
  const tz = normalizeCalendarTimezone(timeZone);
  const p = getZonedParts(ms, tz);
  return p.hour * 60 + p.minute;
}

/** ISO from minutes offset within a lane (local day). */
export function isoFromLaneMinutes(laneStartMs: number, minutesLocal: number): string {
  return new Date(laneStartMs + minutesLocal * 60_000).toISOString();
}

/** `datetime-local` value for an ISO instant in clinic timezone. */
export function toDatetimeLocalValueInTimezone(iso: string, timeZone: string): string {
  const ms = parseIsoUtcMs(iso);
  if (ms == null) return "";
  const tz = normalizeCalendarTimezone(timeZone);
  const p = getZonedParts(ms, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Parse `datetime-local` as clinic-local wall time → ISO UTC. */
export function fromDatetimeLocalValueInTimezone(local: string, timeZone: string): string | null {
  const t = local.trim();
  // Accept optional seconds / fractional seconds (some UI paths append `:00`).
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/.exec(t);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const tz = normalizeCalendarTimezone(timeZone);
  if (tz === DEFAULT_CALENDAR_TIMEZONE) {
    const ms = Date.UTC(y, mo - 1, da, hour, minute, 0, 0);
    if (!Number.isFinite(ms)) return null;
    return new Date(ms).toISOString();
  }
  const utcMs = zonedDateTimeToUtc(y, mo, da, hour, minute, 0, tz);
  if (utcMs == null) return null;
  return new Date(utcMs).toISOString();
}

/** Local calendar day + minutes from local midnight → UTC ISO (operational grid / slot click). */
export function clinicLocalSlotToUtcIso(
  dayKey: string,
  minutesFromLocalMidnight: number,
  timeZone: string
): string | null {
  return isoFromLocalDayMinutes(dayKey, minutesFromLocalMidnight, timeZone);
}

// ---------------------------------------------------------------------------
// UTC instant helpers (ISO strings from DB/API — arithmetic is always UTC)
// ---------------------------------------------------------------------------

/** Parse a booking/server ISO instant to UTC epoch ms; invalid → null. */
export function parseIsoUtcMs(iso: string): number | null {
  const ms = Date.parse(iso.trim());
  return Number.isFinite(ms) ? ms : null;
}

/** Current instant as UTC ISO (single entry point for calendar/agenda placeholders). */
export function utcNowIso(): string {
  return new Date().toISOString();
}

/** Add whole minutes to a UTC ISO instant (durations, resize handles, templates). */
export function addUtcMinutesToIso(iso: string, minutes: number): string {
  const ms = parseIsoUtcMs(iso);
  if (ms == null) return new Date(0).toISOString();
  return new Date(ms + minutes * 60_000).toISOString();
}

export function bookingDurationMinutesUtc(startIso: string, endIso: string): number | null {
  const a = parseIsoUtcMs(startIso);
  const b = parseIsoUtcMs(endIso);
  if (a == null || b == null || b <= a) return null;
  return Math.round((b - a) / 60_000);
}

export function maxUtcIsoFromMs(aMs: number, bMs: number): string {
  return new Date(Math.max(aMs, bMs)).toISOString();
}

export function formatIsoDateTimeInTimezone(iso: string, timeZone: string): string {
  const tz = normalizeCalendarTimezone(timeZone);
  const ms = parseIsoUtcMs(iso);
  if (ms == null) return iso.trim();
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: tz,
  });
}

/** Compact time (e.g. agenda pills) using explicit IANA zone. */
export function formatIsoTimeNumericInTimezone(iso: string, timeZone: string): string {
  const tz = normalizeCalendarTimezone(timeZone);
  const ms = parseIsoUtcMs(iso);
  if (ms == null) return iso.trim();
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}

/** Month title from a UTC-ms anchor (e.g. zoned local midnight). */
export function formatIsoMonthYearInTimezone(anchorMs: number, timeZone: string): string {
  const tz = normalizeCalendarTimezone(timeZone);
  if (!Number.isFinite(anchorMs)) return "";
  return new Date(anchorMs).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: tz,
  });
}

/**
 * Human-readable booking window in a single IANA zone (drawer / list rows).
 * `endPart: "timeOnly"` matches legacy “start full → end time only” rows.
 */
export function formatBookingWindowInTimezone(
  startIso: string,
  endIso: string,
  timeZone: string,
  opts?: { endPart?: "mediumShort" | "timeOnly" }
): string {
  const tz = normalizeCalendarTimezone(timeZone);
  const start = formatIsoDateTimeInTimezone(startIso, tz);
  const endPart = opts?.endPart ?? "mediumShort";
  const end =
    endPart === "timeOnly"
      ? formatIsoTimeNumericInTimezone(endIso, tz)
      : formatIsoDateTimeInTimezone(endIso, tz);
  return `${start} → ${end}`;
}

/** UTC ISO instant → short display string in the clinic zone (never uses browser-local offset alone). */
export function utcIsoToClinicDisplay(
  iso: string,
  timeZone: string,
  style: "time" | "datetime" = "time"
): string {
  const tz = normalizeCalendarTimezone(timeZone);
  const ms = parseIsoUtcMs(iso);
  if (ms == null) return "";
  const opts: Intl.DateTimeFormatOptions =
    style === "time"
      ? { timeStyle: "short", timeZone: tz }
      : { dateStyle: "medium", timeStyle: "short", timeZone: tz };
  return new Date(ms).toLocaleString(undefined, opts);
}

export function formatClinicTime(iso: string, timeZone: string): string {
  return utcIsoToClinicDisplay(iso, timeZone, "time");
}

/** Wall clock on a clinic-local calendar day → UTC ISO instant. */
export function buildClinicZonedDateTime(
  dayKey: string,
  wall: { hour: number; minute: number },
  timeZone: string
): string | null {
  return isoFromLocalDayMinutes(dayKey, wall.hour * 60 + wall.minute, timeZone);
}

/**
 * Dev-only structured log for calendar timezone audits (slot pick, quick create, server save).
 * No-op outside `NODE_ENV === "development"`.
 */
export function logFiCalendarTimezoneDebug(stage: string, fields: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "development") return;
  // eslint-disable-next-line no-console -- intentional FI calendar audit trail (development only)
  console.info(`[fi-calendar-tz] ${stage}`, fields);
}
