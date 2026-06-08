import {
  DEFAULT_CALENDAR_TIMEZONE,
  fromDatetimeLocalValueInTimezone,
  toDatetimeLocalValueInTimezone,
} from "@/src/lib/calendar/calendarTimezone";
import { endIsoFromStartAndProcedure } from "@/src/lib/bookings/servicesCatalog";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";

export function toDatetimeLocalValue(iso: string, timeZone?: string | null): string {
  if (timeZone?.trim()) return toDatetimeLocalValueInTimezone(iso, timeZone);
  return toDatetimeLocalValueInTimezone(iso, DEFAULT_CALENDAR_TIMEZONE);
}

export function fromDatetimeLocalValue(local: string, timeZone?: string | null): string | null {
  if (timeZone?.trim()) return fromDatetimeLocalValueInTimezone(local, timeZone);
  return fromDatetimeLocalValueInTimezone(local, DEFAULT_CALENDAR_TIMEZONE);
}

/**
 * Computes `datetime-local` end value from current start + procedure type, using
 * {@link endIsoFromStartAndProcedure} and the tenant `fi_services` catalog when provided.
 */
export function endLocalFromStartLocalAndProcedure(
  startLocal: string,
  procedure: string,
  timeZone?: string | null,
  services?: FiServiceRow[] | null
): string | null {
  const startIso = fromDatetimeLocalValue(startLocal, timeZone);
  if (!startIso) return null;
  try {
    const endIso = endIsoFromStartAndProcedure(startIso, procedure, services ?? undefined);
    return toDatetimeLocalValue(endIso, timeZone);
  } catch {
    return null;
  }
}

export function defaultRangeIso(timeZone?: string | null): { start: string; end: string } {
  const now = new Date();
  if (timeZone?.trim()) {
    const localNow = toDatetimeLocalValueInTimezone(now.toISOString(), timeZone);
    const [datePart, timePart] = localNow.split("T");
    if (datePart && timePart) {
      const [h] = timePart.split(":").map(Number);
      const pad = (n: number) => String(n).padStart(2, "0");
      const startLocal = `${datePart}T${pad((h + 1) % 24)}:00`;
      const endLocal = `${datePart}T${pad((h + 2) % 24)}:00`;
      const start = fromDatetimeLocalValueInTimezone(startLocal, timeZone);
      const end = fromDatetimeLocalValueInTimezone(endLocal, timeZone);
      if (start && end) return { start, end };
    }
  }
  const a = new Date();
  a.setMinutes(0, 0, 0);
  a.setHours(a.getHours() + 1);
  const b = new Date(a);
  b.setHours(b.getHours() + 1);
  return { start: a.toISOString(), end: b.toISOString() };
}
