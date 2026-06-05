import {
  fromDatetimeLocalValueInTimezone,
  toDatetimeLocalValueInTimezone,
} from "@/src/lib/calendar/calendarTimezone";

export function toDatetimeLocalValue(iso: string, timeZone?: string | null): string {
  if (timeZone?.trim()) return toDatetimeLocalValueInTimezone(iso, timeZone);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(local: string, timeZone?: string | null): string | null {
  if (timeZone?.trim()) return fromDatetimeLocalValueInTimezone(local, timeZone);
  const t = local.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
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
