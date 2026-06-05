/**
 * Clinic-local calendar timezone helpers (IANA). Pure — safe for tests and server/client.
 */

import { parseUtcCalendarDateString, utcCalendarDateStringFromDate } from "@/src/lib/bookings/calendarQuery";

export const DEFAULT_CALENDAR_TIMEZONE = "UTC";

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

/** Validates IANA timezone; falls back to UTC. */
export function normalizeCalendarTimezone(tz: string | null | undefined): string {
  const t = tz?.trim();
  if (!t) return DEFAULT_CALENDAR_TIMEZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: t });
    return t;
  } catch {
    return DEFAULT_CALENDAR_TIMEZONE;
  }
}

/** Tenant column `default_timezone`, then `metadata.timezone`. */
export function resolveTenantCalendarTimezone(input: {
  default_timezone?: string | null;
  metadata?: Record<string, unknown> | null;
} | null | undefined): string {
  if (!input) return DEFAULT_CALENDAR_TIMEZONE;
  const meta =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? input.metadata
      : {};
  const fromMeta = typeof meta.timezone === "string" ? meta.timezone.trim() : "";
  const fromColumn = input.default_timezone?.trim() || "";
  return normalizeCalendarTimezone(fromColumn || fromMeta || null);
}

function getZonedParts(ms: number, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(new Date(ms)).filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
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
  const target = { year, month, day, hour, minute, second };
  const base = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let offsetMin = -180; offsetMin <= 180; offsetMin++) {
    const candidate = base + offsetMin * 60_000;
    const p = getZonedParts(candidate, timeZone);
    if (compareZoned(p, target) === 0) return candidate;
  }
  let lo = base - 14 * 3_600_000;
  let hi = base + 14 * 3_600_000;
  for (let i = 0; i < 48; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const p = getZonedParts(mid, timeZone);
    const cmp = compareZoned(p, target);
    if (cmp === 0) return mid;
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}

/** Calendar `YYYY-MM-DD` for an instant in the given IANA timezone. */
export function calendarDateStringFromInstant(d: Date, timeZone: string): string {
  const tz = normalizeCalendarTimezone(timeZone);
  if (tz === DEFAULT_CALENDAR_TIMEZONE) return utcCalendarDateStringFromDate(d);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Validates a calendar date string in the given timezone. */
export function parseCalendarDateString(ymd: string, timeZone: string): string | null {
  const tz = normalizeCalendarTimezone(timeZone);
  if (tz === DEFAULT_CALENDAR_TIMEZONE) return parseUtcCalendarDateString(ymd);
  const t = ymd.trim();
  const m = YMD_RE.exec(t);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(da)) return null;
  const ms = zonedDateTimeToUtc(y, mo, da, 12, 0, 0, tz);
  if (ms == null) return null;
  const normalized = calendarDateStringFromInstant(new Date(ms), tz);
  return normalized === t ? t : null;
}

/** UTC epoch ms for local midnight on `ymd` in `timeZone`. */
export function zonedMidnightUtcMs(ymd: string, timeZone: string): number | null {
  const tz = normalizeCalendarTimezone(timeZone);
  const parsed = parseCalendarDateString(ymd, tz);
  if (!parsed) return null;
  const [y, mo, da] = parsed.split("-").map(Number);
  if (tz === DEFAULT_CALENDAR_TIMEZONE) {
    return Date.UTC(y, mo - 1, da, 0, 0, 0, 0);
  }
  return zonedDateTimeToUtc(y, mo, da, 0, 0, 0, tz);
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

export function addMonthsToCalendarDate(ymd: string, deltaMonths: number, timeZone: string): string {
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
  const tz = normalizeCalendarTimezone(timeZone);
  return new Date(ms).toLocaleDateString("en-GB", { weekday: "short", timeZone: tz });
}

/** ISO instant from local calendar day + minutes-from-midnight. */
export function isoFromLocalDayMinutes(dayKey: string, minutesLocal: number, timeZone: string): string | null {
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
  const start = new Date(startAt).toLocaleTimeString(undefined, fmt);
  const end = new Date(endAt).toLocaleTimeString(undefined, fmt);
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

/** ISO from minutes offset within a lane (local day). */
export function isoFromLaneMinutes(laneStartMs: number, minutesLocal: number): string {
  return new Date(laneStartMs + minutesLocal * 60_000).toISOString();
}

/** `datetime-local` value for an ISO instant in clinic timezone. */
export function toDatetimeLocalValueInTimezone(iso: string, timeZone: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const tz = normalizeCalendarTimezone(timeZone);
  const p = getZonedParts(ms, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Parse `datetime-local` as clinic-local wall time → ISO UTC. */
export function fromDatetimeLocalValueInTimezone(local: string, timeZone: string): string | null {
  const t = local.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const tz = normalizeCalendarTimezone(timeZone);
  if (tz === DEFAULT_CALENDAR_TIMEZONE) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const utcMs = zonedDateTimeToUtc(y, mo, da, hour, minute, 0, tz);
  if (utcMs == null) return null;
  return new Date(utcMs).toISOString();
}
