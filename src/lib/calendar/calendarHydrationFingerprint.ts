import type { OperationalCalendarBookingDisplay } from "@/src/lib/calendar/operationalCalendarTypes";
import type { FiBookingRow } from "@/src/lib/bookings/types";

/** Cheap FNV-1a-ish 32-bit mix for stable hydration keys (avoids re-running Zustand hydrate on referentially new server arrays). */
function fnv1a32(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/**
 * Fingerprint visible booking rows so client hydration can skip when the server payload is unchanged.
 * Bottleneck addressed: `useCalendarAppointments` previously listed `data.bookings` / `data.bookingDisplay`
 * in `useEffect` deps — new object identities each RSC render re-fired hydrate and re-bucketed the grid.
 */
export function calendarBookingsHydrationFingerprint(rows: FiBookingRow[]): string {
  if (rows.length === 0) return "0";
  let acc = `${rows.length}|`;
  for (const b of rows) {
    acc += `${b.id}:${b.updated_at ?? b.start_at}:${b.start_at}:${b.end_at}:${b.booking_status};`;
  }
  return fnv1a32(acc);
}

export function calendarBookingDisplayHydrationFingerprint(
  display: Record<string, OperationalCalendarBookingDisplay>
): string {
  const keys = Object.keys(display).sort();
  if (keys.length === 0) return "0";
  let acc = `${keys.length}|`;
  for (const k of keys) {
    const v = display[k]!;
    acc += `${k}:${v.anchorLabel ?? ""}:${v.reminderHint ?? ""}:${v.scalesSummary ?? ""}:${v.procedureCatalogName ?? ""};`;
  }
  return fnv1a32(acc);
}
