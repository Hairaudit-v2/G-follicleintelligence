import {
  fromDatetimeLocalValueInTimezone,
  toDatetimeLocalValueInTimezone,
} from "@/src/lib/calendar/calendarTimezone";

const STEP_MS = 15 * 60_000;

/** Snap wall time up to the next 15-minute boundary in `timeZone` (for datetime-local pickers). */
export function nextQuarterHourLocalString(localInput: string, timeZone: string): string {
  const t = localInput.trim();
  const iso = fromDatetimeLocalValueInTimezone(t, timeZone);
  if (!iso) return t;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return t;
  const snapped = Math.ceil(ms / STEP_MS) * STEP_MS;
  return toDatetimeLocalValueInTimezone(new Date(snapped).toISOString(), timeZone);
}

export function localNowForDatetimePicker(timeZone: string): string {
  return toDatetimeLocalValueInTimezone(new Date().toISOString(), timeZone);
}
