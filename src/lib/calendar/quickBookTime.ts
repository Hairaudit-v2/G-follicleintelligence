import { formatClinicDateTimeRange } from "@/src/lib/calendar/calendarLocaleFormatting";
import {
  addUtcMinutesToIso,
  fromDatetimeLocalValueInTimezone,
  toDatetimeLocalValueInTimezone,
} from "@/src/lib/calendar/calendarTimezone";

const PAD2 = (n: number) => String(n).padStart(2, "0");

/**
 * Normalize `datetime-local` strings to `YYYY-MM-DDTHH:mm` (strip optional seconds).
 * Unknown shapes are returned trimmed as-is for downstream validation.
 */
export function normalizeQuickBookDatetimeLocal(local: string): string {
  const t = local.trim();
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2}(?:\.\d{1,3})?)?$/.exec(t);
  return m ? m[1]! : t;
}

function formatClockHm(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/**
 * Add minutes to a local `datetime-local` wall time using calendar-component arithmetic
 * (same as treating Y-M-D H:M as a UTC calendar instant for the delta). Used for display math tests;
 * scheduling uses {@link deriveQuickBookEndLocal} with a real IANA zone.
 */
export function addMinutesToLocalTime(localStart: string, durationMinutes: number): string {
  const base = normalizeQuickBookDatetimeLocal(localStart);
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(base);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  if (![y, mo, d, hour, minute].every((x) => Number.isFinite(x))) return "";
  const ms = Date.UTC(y, mo - 1, d, hour, minute, 0, 0) + durationMinutes * 60_000;
  const out = new Date(ms);
  return `${out.getUTCFullYear()}-${PAD2(out.getUTCMonth() + 1)}-${PAD2(out.getUTCDate())}T${PAD2(out.getUTCHours())}:${PAD2(out.getUTCMinutes())}`;
}

export function deriveQuickBookEndLocal(opts: {
  startLocal: string;
  durationMinutes: number;
  timeZone: string;
}): string | null {
  if (!Number.isFinite(opts.durationMinutes) || opts.durationMinutes <= 0) return null;
  const start = normalizeQuickBookDatetimeLocal(opts.startLocal);
  const startIso = fromDatetimeLocalValueInTimezone(start, opts.timeZone);
  if (!startIso) return null;
  const endIso = addUtcMinutesToIso(startIso, opts.durationMinutes);
  return toDatetimeLocalValueInTimezone(endIso, opts.timeZone);
}

export function buildQuickBookTimeSummary(opts: {
  label: string | null | undefined;
  startLocal: string;
  endLocal: string;
  durationMinutes: number | null | undefined;
  /** When set with `timeZone`, times use 12-hour locale formatting (e.g. en-AU). */
  locale?: string | null;
  timeZone?: string | null;
}): string {
  if (!opts.label?.trim() || opts.durationMinutes == null || !Number.isFinite(opts.durationMinutes)) {
    return "Select an appointment type to calculate finish time.";
  }
  const s = normalizeQuickBookDatetimeLocal(opts.startLocal);
  const e = normalizeQuickBookDatetimeLocal(opts.endLocal);
  const hmRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if (!hmRe.test(s) || !hmRe.test(e)) {
    return "Select an appointment type to calculate finish time.";
  }
  const locale = opts.locale?.trim();
  const timeZone = opts.timeZone?.trim();
  const range =
    locale && timeZone
      ? formatClinicDateTimeRange(s, e, locale, timeZone)
      : `${formatClockHm(s.slice(11, 16))}–${formatClockHm(e.slice(11, 16))}`;
  return `${opts.label.trim()} · ${Math.round(opts.durationMinutes)} min · ${range}`;
}
